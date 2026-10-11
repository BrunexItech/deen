"""Members, DEEN staff and identity verification."""
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select

from app.core.audit import record
from app.core.clock import age_on, utcnow
from app.core.crypto import decrypt_text, mask_tail
from app.core.deps import DB, Principal, require
from app.core.roles import PLATFORM_ROLES, Perm, Role
from app.modules.applications.models import Application
from app.modules.identity.models import IdentityVerification
from app.modules.notifications.service import notify
from app.modules.opportunities.models import Opportunity
from app.modules.orgs.models import Invite
from app.modules.orgs.service import create_invite
from app.modules.subscriptions.models import Payment, Plan, Subscription
from app.modules.subscriptions.service import activate, current_membership, fee_plan
from app.modules.users.models import IdentityStatus, MemberProfile, User, UserSession, UserStatus
from app.modules.users.router import profile_out
from app.modules.users.service import revoke_all

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _user_row(u: User, profile: MemberProfile | None = None) -> dict:
    return {"id": u.id, "full_name": u.full_name, "phone": u.phone, "email": u.email, "role": u.role.value,
            "status": u.status.value, "identity_status": u.identity_status.value,
            "phone_verified": u.phone_verified_at is not None, "created_at": u.created_at,
            "last_active_at": u.last_active_at, "totp_enabled": u.totp_enabled,
            "county": profile.county if profile else None,
            "education_level": profile.education_level if profile else None,
            "age": age_on(profile.date_of_birth) if profile else None,
            "user_types": (profile.user_types or []) if profile else []}


@router.get("/members")
async def members(session: DB, p: Principal = require(Perm.users_view), q: str | None = None,
                  county: str | None = None, status: str | None = None, identity: str | None = None,
                  user_type: str | None = None,
                  page: int = 1, limit: int = 30):
    stmt = select(User, MemberProfile).outerjoin(MemberProfile, MemberProfile.user_id == User.id).where(
        User.role == Role.member, User.status != UserStatus.deleted)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.phone.ilike(like), User.email.ilike(like)))
    if county:
        stmt = stmt.where(MemberProfile.county == county)
    if status:
        stmt = stmt.where(User.status == status)
    if identity:
        stmt = stmt.where(User.identity_status == identity)
    if user_type:
        stmt = stmt.where(MemberProfile.user_types.any(user_type))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    limit = max(1, min(limit, 100))
    rows = (await session.execute(stmt.order_by(User.created_at.desc()).offset((max(page, 1) - 1) * limit)
                                  .limit(limit))).all()
    return {"items": [_user_row(u, prof) for u, prof in rows], "total": total or 0}


@router.get("/members/{user_id}")
async def member_detail(user_id: str, session: DB, p: Principal = require(Perm.users_view)):
    u = await session.get(User, user_id)
    if not u or u.role != Role.member:
        raise HTTPException(404, "Member not found")
    prof = await session.scalar(select(MemberProfile).where(MemberProfile.user_id == u.id))
    apps = (await session.execute(
        select(Application, Opportunity.title).join(Opportunity, Opportunity.id == Application.opportunity_id)
        .where(Application.user_id == u.id).order_by(Application.created_at.desc()).limit(50))).all()
    pays = (await session.execute(select(Payment, Plan.name).join(Plan, Plan.id == Payment.plan_id)
                                  .where(Payment.user_id == u.id).order_by(Payment.created_at.desc()).limit(30))).all()
    sessions = (await session.execute(select(UserSession).where(
        UserSession.user_id == u.id, UserSession.revoked_at.is_(None), UserSession.expires_at > utcnow()))).scalars()
    record(session, actor_id=p.id, action="member.viewed", entity="user", entity_id=u.id, ip=p.ip)
    await session.commit()
    return {
        **_user_row(u, prof), "profile": profile_out(prof), "membership": await current_membership(session, u.id),
        "applications": [{"id": a.id, "opportunity": t, "status": a.status.value, "created_at": a.created_at}
                         for a, t in apps],
        "payments": [{"id": x.id, "plan": n, "amount_kes": float(x.amount_kes), "status": x.status.value,
                      "receipt": x.receipt, "created_at": x.created_at} for x, n in pays],
        "devices": [{"device_name": s.device_name, "platform": s.platform, "last_seen_at": s.last_seen_at,
                     "biometric_enabled": s.biometric_enabled} for s in sessions],
    }


class StatusIn(BaseModel):
    suspended: bool
    reason: str | None = Field(None, max_length=500)


@router.post("/members/{user_id}/status")
async def member_status(user_id: str, body: StatusIn, session: DB, p: Principal = require(Perm.users_manage)):
    u = await session.get(User, user_id)
    if not u or u.role != Role.member:
        raise HTTPException(404, "Member not found")
    u.status = UserStatus.suspended if body.suspended else UserStatus.active
    if body.suspended:
        await revoke_all(session, u.id)
    record(session, actor_id=p.id, action="member.suspended" if body.suspended else "member.reactivated",
           entity="user", entity_id=u.id, ip=p.ip, reason=body.reason)
    await session.commit()
    return {"ok": True, "status": u.status.value}


class GrantIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


@router.post("/members/{user_id}/grant")
async def grant(user_id: str, body: GrantIn, session: DB, p: Principal = require(Perm.plans_manage)):
    """Waive one fee period (students in need, partners, community leaders)."""
    u = await session.get(User, user_id)
    plan = await fee_plan(session)
    if not u or u.role != Role.member:
        raise HTTPException(404, "Member not found")
    if not plan:
        raise HTTPException(409, "Set the community fee first")
    sub = await activate(session, u.id, plan)
    await notify(session, [u.id], kind="subscription", title="DEEN has covered your membership",
                 body=f"Your membership is active until {sub.ends_at:%d %b %Y}.", data={"screen": "membership"})
    record(session, actor_id=p.id, action="member.granted", entity="user", entity_id=u.id, ip=p.ip,
           reason=body.reason)
    await session.commit()
    return {"ok": True, "ends_at": sub.ends_at}


# ---------- identity verification ----------

@router.get("/identity")
async def identity_queue(session: DB, p: Principal = require(Perm.identity_review), status: str = "pending"):
    rows = (await session.execute(
        select(IdentityVerification, User).join(User, User.id == IdentityVerification.user_id)
        .where(IdentityVerification.status == status).order_by(IdentityVerification.created_at).limit(200))).all()
    return [{"id": v.id, "user": {"id": u.id, "full_name": u.full_name, "phone": u.phone}, "id_type": v.id_type,
             "id_number_masked": mask_tail(v.id_last4), "status": v.status, "created_at": v.created_at,
             "id_front_url": f"/api/v1/files/{v.id_front_file_id}", "selfie_url": f"/api/v1/files/{v.selfie_file_id}",
             "review_note": v.review_note} for v, u in rows]


@router.post("/identity/{ver_id}/reveal")
async def identity_reveal(ver_id: str, session: DB, p: Principal = require(Perm.identity_review)):
    v = await session.get(IdentityVerification, ver_id)
    if not v:
        raise HTTPException(404, "Not found")
    record(session, actor_id=p.id, action="identity.revealed", entity="identity", entity_id=v.id, ip=p.ip)
    await session.commit()
    return {"id_number": decrypt_text(v.id_number_enc)}


class IdentityDecisionIn(BaseModel):
    approve: bool
    note: str | None = Field(None, max_length=500)


@router.post("/identity/{ver_id}")
async def identity_decide(ver_id: str, body: IdentityDecisionIn, session: DB,
                          p: Principal = require(Perm.identity_review)):
    v = await session.get(IdentityVerification, ver_id)
    if not v or v.status != "pending":
        raise HTTPException(404, "Nothing to review")
    if not body.approve and not body.note:
        raise HTTPException(422, "Tell the member why, so they can fix it")
    u = await session.get(User, v.user_id)
    v.status = "verified" if body.approve else "rejected"
    v.reviewer_id, v.review_note, v.reviewed_at = p.id, body.note, utcnow()
    u.identity_status = IdentityStatus.verified if body.approve else IdentityStatus.rejected
    await notify(session, [u.id], kind="announcements",
                 title="Identity verified ✓" if body.approve else "Identity check needs attention",
                 body="Your DEEN profile now carries the verified badge." if body.approve
                 else f"We couldn't verify your identity: {body.note}", data={"screen": "identity"})
    record(session, actor_id=p.id, action="identity." + v.status, entity="user", entity_id=u.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


# ---------- DEEN staff ----------

@router.get("/staff")
async def staff(session: DB, p: Principal = require(Perm.users_view)):
    users = (await session.execute(select(User).where(User.role.in_(PLATFORM_ROLES)).order_by(User.created_at))).scalars()
    invites = (await session.execute(select(Invite).where(
        Invite.organization_id.is_(None), Invite.accepted_at.is_(None), Invite.revoked_at.is_(None),
        Invite.expires_at > utcnow()))).scalars()
    return {"members": [_user_row(u) for u in users],
            "invites": [{"id": i.id, "email": i.email, "role": i.role.value, "expires_at": i.expires_at}
                        for i in invites]}


class StaffInviteIn(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: Role


@router.post("/staff/invite")
async def invite_staff(body: StaffInviteIn, session: DB, p: Principal = require(Perm.staff_manage)):
    if body.role not in PLATFORM_ROLES:
        raise HTTPException(422, "Choose a DEEN staff role")
    if await session.scalar(select(User.id).where(User.email == body.email.lower())):
        raise HTTPException(409, "That email already has a DEEN account")
    out = await create_invite(session, email=body.email, role=body.role, invited_by=p.id, full_name=body.full_name)
    record(session, actor_id=p.id, action="staff.invited", entity="user", ip=p.ip, email=body.email,
           role=body.role.value)
    await session.commit()
    return out


class StaffUpdateIn(BaseModel):
    role: Role | None = None
    suspended: bool | None = None


@router.patch("/staff/{user_id}")
async def update_staff(user_id: str, body: StaffUpdateIn, session: DB, p: Principal = require(Perm.staff_manage)):
    u = await session.get(User, user_id)
    if not u or u.role not in PLATFORM_ROLES:
        raise HTTPException(404, "Staff member not found")
    if u.id == p.id:
        raise HTTPException(409, "You can't change your own access")
    if body.role:
        if body.role not in PLATFORM_ROLES:
            raise HTTPException(422, "Choose a DEEN staff role")
        u.role = body.role
    if body.suspended is not None:
        u.status = UserStatus.suspended if body.suspended else UserStatus.active
    await revoke_all(session, u.id)  # new permissions apply from their next sign-in
    record(session, actor_id=p.id, action="staff.updated", entity="user", entity_id=u.id, ip=p.ip,
           role=u.role.value, status=u.status.value)
    await session.commit()
    return _user_row(u)


@router.get("/subscriptions")
async def subscriptions(session: DB, p: Principal = require(Perm.payments_view), active: bool = True):
    stmt = (select(Subscription, User.full_name, User.phone, Plan.name)
            .join(User, User.id == Subscription.user_id).join(Plan, Plan.id == Subscription.plan_id))
    if active:
        stmt = stmt.where(Subscription.status == "active", Subscription.ends_at > utcnow())
    rows = (await session.execute(stmt.order_by(Subscription.created_at.desc()).limit(300))).all()
    soon = utcnow() + timedelta(days=7)
    return [{"id": s.id, "member": n, "phone": ph, "plan": pl, "status": s.status.value, "starts_at": s.starts_at,
             "ends_at": s.ends_at, "expiring_soon": s.ends_at < soon, "sponsored": s.sponsored_by_id is not None}
            for s, n, ph, pl in rows]
