"""Organization onboarding & verification. Only DEEN creates organizations."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, or_, select

from app.core.audit import record
from app.core.clock import utcnow
from app.core.deps import DB, Principal, require
from app.core.roles import Perm, Role
from app.modules.applications.models import Application
from app.modules.opportunities.models import Opportunity
from app.modules.orgs.models import Invite, Organization, OrgStatus, OrgType, Verification
from app.modules.orgs.service import create_invite, org_out, unique_slug
from app.modules.taxonomy.data import COUNTIES
from app.modules.users.models import User, UserStatus
from app.modules.users.service import revoke_all

router = APIRouter(prefix="/api/v1/admin/organizations", tags=["admin"])


@router.get("")
async def list_orgs(session: DB, p: Principal = require(Perm.orgs_view), q: str | None = None,
                    verification: str | None = None, status: str | None = None, type: str | None = None):
    stmt = select(Organization)
    if q:
        stmt = stmt.where(or_(Organization.name.ilike(f"%{q}%"), Organization.email.ilike(f"%{q}%")))
    if verification:
        stmt = stmt.where(Organization.verification == verification)
    if status:
        stmt = stmt.where(Organization.status == status)
    if type:
        stmt = stmt.where(Organization.org_type == type)
    orgs = (await session.execute(stmt.order_by(Organization.created_at.desc()).limit(500))).scalars().all()
    ids = [o.id for o in orgs]
    opp_counts = dict((await session.execute(select(Opportunity.organization_id, func.count()).where(
        Opportunity.organization_id.in_(ids)).group_by(Opportunity.organization_id))).all()) if ids else {}
    team = dict((await session.execute(select(User.organization_id, func.count()).where(
        User.organization_id.in_(ids)).group_by(User.organization_id))).all()) if ids else {}
    return [org_out(o, {"opportunities": opp_counts.get(o.id, 0), "team": team.get(o.id, 0)}) for o in orgs]


class OrgIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    org_type: OrgType
    tagline: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=8000)
    website: str | None = Field(None, max_length=300)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    county: str | None = None
    address: str | None = Field(None, max_length=300)
    registration_number: str | None = Field(None, max_length=80)
    logo_file_id: str | None = None
    verification: Verification = Verification.pending
    premium: bool = False

    @field_validator("county")
    @classmethod
    def _county(cls, v):
        if v and v not in COUNTIES:
            raise ValueError("Choose a Kenyan county")
        return v


class CreateOrgIn(OrgIn):
    admin_email: EmailStr | None = None  # first representative to invite
    admin_name: str | None = Field(None, max_length=120)


@router.post("")
async def create_org(body: CreateOrgIn, session: DB, p: Principal = require(Perm.orgs_manage)):
    data = body.model_dump(exclude={"admin_email", "admin_name"})
    org = Organization(**data, slug=await unique_slug(session, body.name), created_by_id=p.id)
    if org.verification != Verification.pending:
        org.verified_at = utcnow()
    session.add(org)
    await session.flush()
    invite = None
    if body.admin_email:
        if await session.scalar(select(User.id).where(User.email == body.admin_email.lower())):
            raise HTTPException(409, "That email already has a DEEN account")
        invite = await create_invite(session, email=body.admin_email, role=Role.org_admin, invited_by=p.id,
                                     organization=org, full_name=body.admin_name)
    record(session, actor_id=p.id, action="org.created", entity="organization", entity_id=org.id, ip=p.ip,
           name=org.name)
    await session.commit()
    return {**org_out(org), "invite": invite}


@router.get("/{org_id}")
async def get_org(org_id: str, session: DB, p: Principal = require(Perm.orgs_view)):
    org = await session.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    team = (await session.execute(select(User).where(User.organization_id == org.id))).scalars().all()
    invites = (await session.execute(select(Invite).where(Invite.organization_id == org.id)
                                     .order_by(Invite.created_at.desc()))).scalars().all()
    opps = (await session.execute(select(Opportunity).where(Opportunity.organization_id == org.id)
                                  .order_by(Opportunity.updated_at.desc()).limit(100))).scalars().all()
    apps = await session.scalar(select(func.count()).select_from(Application).where(
        Application.organization_id == org.id))
    return {
        **org_out(org),
        "team": [{"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role.value,
                  "status": u.status.value, "last_active_at": u.last_active_at, "totp_enabled": u.totp_enabled}
                 for u in team],
        "invites": [{"id": i.id, "email": i.email, "role": i.role.value, "expires_at": i.expires_at,
                     "accepted_at": i.accepted_at, "revoked_at": i.revoked_at} for i in invites],
        "opportunities": [{"id": o.id, "title": o.title, "status": o.status.value, "category": o.category,
                           "deadline": o.deadline, "views": o.views_count, "applications": o.applications_count,
                           "risk_score": o.risk_score} for o in opps],
        "applications": apps or 0,
    }


@router.put("/{org_id}")
async def update_org(org_id: str, body: OrgIn, session: DB, p: Principal = require(Perm.orgs_manage)):
    org = await session.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    before = org.verification
    for k, v in body.model_dump().items():
        if k == "verification" and not p.can(Perm.orgs_verify):
            continue
        setattr(org, k, v)
    if before == Verification.pending and org.verification != Verification.pending:
        org.verified_at = utcnow()
    record(session, actor_id=p.id, action="org.updated", entity="organization", entity_id=org.id, ip=p.ip)
    await session.commit()
    return org_out(org)


class VerifyIn(BaseModel):
    verification: Verification
    note: str | None = None


@router.post("/{org_id}/verification")
async def set_verification(org_id: str, body: VerifyIn, session: DB, p: Principal = require(Perm.orgs_verify)):
    org = await session.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    org.verification = body.verification
    org.verified_at = utcnow() if body.verification != Verification.pending else None
    record(session, actor_id=p.id, action="org.verification", entity="organization", entity_id=org.id, ip=p.ip,
           level=body.verification.value, note=body.note)
    await session.commit()
    return org_out(org)


class StatusIn(BaseModel):
    status: OrgStatus
    reason: str | None = None


@router.post("/{org_id}/status")
async def set_status(org_id: str, body: StatusIn, session: DB, p: Principal = require(Perm.orgs_manage)):
    org = await session.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    org.status = body.status
    if body.status == OrgStatus.suspended:
        # Suspension signs out the organization's whole team immediately.
        for uid in (await session.execute(select(User.id).where(User.organization_id == org.id))).scalars():
            await revoke_all(session, uid)
    record(session, actor_id=p.id, action=f"org.{body.status.value}", entity="organization", entity_id=org.id,
           ip=p.ip, reason=body.reason)
    await session.commit()
    return org_out(org)


class InviteIn(BaseModel):
    email: EmailStr
    full_name: str | None = Field(None, max_length=120)
    role: Role = Role.org_admin


@router.post("/{org_id}/invites")
async def invite_rep(org_id: str, body: InviteIn, session: DB, p: Principal = require(Perm.orgs_manage)):
    org = await session.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    if body.role not in (Role.org_admin, Role.org_staff):
        raise HTTPException(422, "Organization roles only")
    if await session.scalar(select(User.id).where(User.email == body.email.lower())):
        raise HTTPException(409, "That email already has a DEEN account")
    out = await create_invite(session, email=body.email, role=body.role, invited_by=p.id, organization=org,
                              full_name=body.full_name)
    record(session, actor_id=p.id, action="org.rep_invited", entity="organization", entity_id=org.id, ip=p.ip,
           email=body.email)
    await session.commit()
    return out


@router.delete("/{org_id}/invites/{invite_id}")
async def revoke_invite(org_id: str, invite_id: str, session: DB, p: Principal = require(Perm.orgs_manage)):
    inv = await session.get(Invite, invite_id)
    if not inv or inv.organization_id != org_id:
        raise HTTPException(404, "Invitation not found")
    inv.revoked_at = utcnow()
    await session.commit()
    return {"ok": True}


class TeamStatusIn(BaseModel):
    suspended: bool


@router.post("/{org_id}/team/{user_id}/status")
async def team_status(org_id: str, user_id: str, body: TeamStatusIn, session: DB,
                      p: Principal = require(Perm.orgs_manage)):
    u = await session.get(User, user_id)
    if not u or u.organization_id != org_id:
        raise HTTPException(404, "User not found")
    u.status = UserStatus.suspended if body.suspended else UserStatus.active
    if u.status == UserStatus.suspended:
        await revoke_all(session, u.id)
    record(session, actor_id=p.id, action="org.team_status", entity="user", entity_id=u.id, ip=p.ip,
           status=u.status.value)
    await session.commit()
    return {"ok": True}
