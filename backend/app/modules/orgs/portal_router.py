"""Organization portal: profile, team, opportunities and analytics for one organization."""
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, update

from app.core.audit import record
from app.core.clock import local_day, utcnow
from app.core.deps import DB, OrgAdmin, OrgUser
from app.core.roles import Role
from app.modules.applications.models import Application, AppStatus, Outcome
from app.modules.opportunities.models import (EngagementEvent, Opportunity, OppStatus, ReviewEvent, ReviewMessage,
                                              SavedOpportunity)
from app.modules.opportunities.schemas import OpportunityIn, submission_problems
from app.modules.opportunities.service import ORG_EDITABLE, run_risk_scan, staff_view, transition
from app.modules.orgs.models import Invite, Organization
from app.modules.orgs.service import create_invite, org_out
from app.modules.users.models import User, UserStatus
from app.modules.users.service import revoke_all

router = APIRouter(prefix="/api/v1/org", tags=["org-portal"])


async def _org(session, p) -> Organization:
    return await session.get(Organization, p.user.organization_id)


async def _own_opp(session, opp_id: str, p) -> Opportunity:
    opp = await session.get(Opportunity, opp_id)
    if not opp or opp.organization_id != p.user.organization_id:
        raise HTTPException(404, "Opportunity not found")
    return opp


# ---------- profile ----------

@router.get("/profile")
async def profile(p: OrgUser, session: DB):
    return org_out(await _org(session, p))


class OrgProfileIn(BaseModel):
    tagline: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=8000)
    website: str | None = Field(None, max_length=300)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    county: str | None = None
    address: str | None = Field(None, max_length=300)
    logo_file_id: str | None = None


@router.patch("/profile")
async def update_profile(body: OrgProfileIn, p: OrgAdmin, session: DB):
    org = await _org(session, p)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(org, k, v)
    record(session, actor_id=p.id, action="org.profile_updated", entity="organization", entity_id=org.id, ip=p.ip)
    await session.commit()
    return org_out(org)


# ---------- team ----------

@router.get("/team")
async def team(p: OrgUser, session: DB):
    users = (await session.execute(select(User).where(User.organization_id == p.user.organization_id)
                                   .order_by(User.created_at))).scalars().all()
    invites = (await session.execute(select(Invite).where(
        Invite.organization_id == p.user.organization_id, Invite.accepted_at.is_(None),
        Invite.revoked_at.is_(None), Invite.expires_at > utcnow()))).scalars().all()
    return {
        "members": [{"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role.value,
                     "status": u.status.value, "last_active_at": u.last_active_at, "totp_enabled": u.totp_enabled}
                    for u in users],
        "invites": [{"id": i.id, "email": i.email, "role": i.role.value, "expires_at": i.expires_at} for i in invites],
    }


class TeamInviteIn(BaseModel):
    email: EmailStr
    full_name: str | None = Field(None, max_length=120)
    role: Role = Role.org_staff


@router.post("/team/invite")
async def invite(body: TeamInviteIn, p: OrgAdmin, session: DB):
    if body.role not in (Role.org_staff, Role.org_admin):
        raise HTTPException(422, "Choose staff or administrator")
    if await session.scalar(select(User.id).where(User.email == body.email.lower())):
        raise HTTPException(409, "Someone with this email already has a DEEN account")
    out = await create_invite(session, email=body.email, role=body.role, invited_by=p.id,
                              organization=await _org(session, p), full_name=body.full_name)
    record(session, actor_id=p.id, action="org.team_invited", entity="organization",
           entity_id=p.user.organization_id, ip=p.ip, email=body.email)
    await session.commit()
    return out


@router.delete("/team/invites/{invite_id}")
async def revoke_invite(invite_id: str, p: OrgAdmin, session: DB):
    inv = await session.get(Invite, invite_id)
    if not inv or inv.organization_id != p.user.organization_id:
        raise HTTPException(404, "Invitation not found")
    inv.revoked_at = utcnow()
    await session.commit()
    return {"ok": True}


@router.post("/team/{user_id}/deactivate")
async def deactivate(user_id: str, p: OrgAdmin, session: DB):
    u = await session.get(User, user_id)
    if not u or u.organization_id != p.user.organization_id or u.id == p.id:
        raise HTTPException(404, "Team member not found")
    u.status = UserStatus.suspended
    await revoke_all(session, u.id)
    record(session, actor_id=p.id, action="org.team_deactivated", entity="user", entity_id=u.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


# ---------- opportunities ----------

@router.get("/opportunities")
async def list_opps(p: OrgUser, session: DB, status: str | None = None, q: str | None = None):
    stmt = select(Opportunity).where(Opportunity.organization_id == p.user.organization_id)
    if status:
        stmt = stmt.where(Opportunity.status == status)
    if q:
        stmt = stmt.where(Opportunity.title.ilike(f"%{q}%"))
    rows = (await session.execute(stmt.order_by(Opportunity.updated_at.desc()).limit(300))).scalars().all()
    org = await _org(session, p)
    return [staff_view(o, org) for o in rows]


@router.post("/opportunities")
async def create_opp(body: OpportunityIn, p: OrgUser, session: DB):
    opp = Opportunity(organization_id=p.user.organization_id, created_by_id=p.id, status=OppStatus.draft,
                      **body.to_columns())
    session.add(opp)
    await session.flush()
    record(session, actor_id=p.id, action="opportunity.created", entity="opportunity", entity_id=opp.id, ip=p.ip)
    await session.commit()
    return staff_view(opp, await _org(session, p))


@router.get("/opportunities/{opp_id}")
async def get_opp(opp_id: str, p: OrgUser, session: DB):
    opp = await _own_opp(session, opp_id, p)
    history = (await session.execute(select(ReviewEvent).where(ReviewEvent.opportunity_id == opp.id)
                                     .order_by(ReviewEvent.created_at))).scalars().all()
    out = staff_view(opp, await _org(session, p))
    # Organizations see automated flags only as "things to fix", never the internal risk score.
    out.pop("risk_score", None)
    out["history"] = [{"from": h.from_status, "to": h.to_status, "note": h.note, "at": h.created_at} for h in history]
    out["editable"] = opp.status in ORG_EDITABLE
    out["missing"] = submission_problems(opp)
    return out


@router.put("/opportunities/{opp_id}")
async def update_opp(opp_id: str, body: OpportunityIn, p: OrgUser, session: DB):
    opp = await _own_opp(session, opp_id, p)
    if opp.status not in ORG_EDITABLE:
        raise HTTPException(409, "Withdraw it from review before editing")
    for k, v in body.to_columns().items():
        setattr(opp, k, v)
    record(session, actor_id=p.id, action="opportunity.updated", entity="opportunity", entity_id=opp.id, ip=p.ip)
    await session.commit()
    return staff_view(opp, await _org(session, p))


@router.post("/opportunities/{opp_id}/submit")
async def submit(opp_id: str, p: OrgUser, session: DB):
    opp = await _own_opp(session, opp_id, p)
    if opp.status not in ORG_EDITABLE:
        raise HTTPException(409, "This opportunity is already with DEEN")
    if missing := submission_problems(opp):
        raise HTTPException(422, "Add " + ", ".join(missing) + " before submitting")
    await run_risk_scan(session, opp)
    await transition(session, opp, OppStatus.submitted, p.id)
    record(session, actor_id=p.id, action="opportunity.submitted", entity="opportunity", entity_id=opp.id, ip=p.ip)
    await session.commit()
    return {"ok": True, "status": opp.status.value}


@router.post("/opportunities/{opp_id}/withdraw")
async def withdraw(opp_id: str, p: OrgUser, session: DB):
    opp = await _own_opp(session, opp_id, p)
    if opp.status not in (OppStatus.submitted, OppStatus.under_review, OppStatus.info_requested,
                          OppStatus.verification, OppStatus.approved):
        raise HTTPException(409, "Only opportunities in review can be withdrawn")
    await transition(session, opp, OppStatus.draft, p.id, "Withdrawn by organization")
    await session.commit()
    return {"ok": True, "status": opp.status.value}


@router.post("/opportunities/{opp_id}/close")
async def close(opp_id: str, p: OrgUser, session: DB):
    opp = await _own_opp(session, opp_id, p)
    if opp.status != OppStatus.published:
        raise HTTPException(409, "Only live opportunities can be closed")
    await transition(session, opp, OppStatus.archived, p.id, "Closed by organization")
    await session.commit()
    return {"ok": True, "status": opp.status.value}


class DeadlineIn(BaseModel):
    deadline: datetime


@router.post("/opportunities/{opp_id}/deadline")
async def update_deadline(opp_id: str, body: DeadlineIn, p: OrgUser, session: DB):
    """Providers extend or bring forward a live deadline without re-review (spec section 16).
    The change is logged and visible to DEEN reviewers; members who saved it get fresh reminders."""
    opp = await _own_opp(session, opp_id, p)
    if opp.status not in (OppStatus.published, OppStatus.submitted, OppStatus.under_review, OppStatus.approved):
        raise HTTPException(409, "Edit the opportunity to change its deadline")
    if body.deadline < utcnow():
        raise HTTPException(422, "The new deadline is in the past")
    before = opp.deadline
    opp.deadline = body.deadline
    session.add(ReviewEvent(opportunity_id=opp.id, actor_id=p.id, from_status=opp.status.value,
                            to_status=opp.status.value,
                            note=f"Deadline changed from {before:%d %b %Y} to {body.deadline:%d %b %Y}" if before
                            else f"Deadline set to {body.deadline:%d %b %Y}"))
    await session.execute(update(SavedOpportunity).where(SavedOpportunity.opportunity_id == opp.id)
                          .values(reminder_stage=0))
    record(session, actor_id=p.id, action="opportunity.deadline_changed", entity="opportunity", entity_id=opp.id,
           ip=p.ip, deadline=body.deadline.isoformat())
    await session.commit()
    return {"ok": True, "deadline": opp.deadline}


@router.post("/opportunities/{opp_id}/duplicate")
async def duplicate(opp_id: str, p: OrgUser, session: DB):
    src = await _own_opp(session, opp_id, p)
    fields = OpportunityIn.model_fields.keys()
    copy = Opportunity(organization_id=src.organization_id, created_by_id=p.id, status=OppStatus.draft,
                       **{f: getattr(src, f) for f in fields})
    copy.title = f"{src.title} (copy)"[:200]
    copy.deadline = None
    session.add(copy)
    await session.commit()
    return {"id": copy.id}


@router.delete("/opportunities/{opp_id}")
async def delete_draft(opp_id: str, p: OrgUser, session: DB):
    opp = await _own_opp(session, opp_id, p)
    if opp.status != OppStatus.draft:
        raise HTTPException(409, "Only drafts can be deleted")
    await session.delete(opp)
    await session.commit()
    return {"ok": True}


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


@router.get("/opportunities/{opp_id}/messages")
async def messages(opp_id: str, p: OrgUser, session: DB):
    opp = await _own_opp(session, opp_id, p)
    rows = (await session.execute(
        select(ReviewMessage, User.full_name).outerjoin(User, User.id == ReviewMessage.author_id)
        .where(ReviewMessage.opportunity_id == opp.id, ReviewMessage.internal.is_(False))
        .order_by(ReviewMessage.created_at))).all()
    return [{"id": m.id, "body": m.body, "author": "DEEN Review Team" if m.from_platform else name,
             "from_platform": m.from_platform, "at": m.created_at} for m, name in rows]


@router.post("/opportunities/{opp_id}/messages")
async def post_message(opp_id: str, body: MessageIn, p: OrgUser, session: DB):
    opp = await _own_opp(session, opp_id, p)
    session.add(ReviewMessage(opportunity_id=opp.id, author_id=p.id, body=body.body.strip()))
    await session.commit()
    return {"ok": True}


# ---------- analytics ----------

@router.get("/dashboard")
async def dashboard(p: OrgUser, session: DB, days: int = 30):
    org_id = p.user.organization_id
    since = utcnow() - timedelta(days=max(7, min(days, 365)))
    status_counts = dict((await session.execute(
        select(Opportunity.status, func.count()).where(Opportunity.organization_id == org_id)
        .group_by(Opportunity.status))).all())
    totals = (await session.execute(select(
        func.coalesce(func.sum(Opportunity.views_count), 0), func.coalesce(func.sum(Opportunity.clicks_count), 0),
        func.coalesce(func.sum(Opportunity.saves_count), 0), func.coalesce(func.sum(Opportunity.applications_count), 0),
    ).where(Opportunity.organization_id == org_id))).one()
    day = local_day(EngagementEvent.created_at)
    series_rows = (await session.execute(
        select(day, EngagementEvent.kind, func.count()).where(EngagementEvent.organization_id == org_id,
                                                              EngagementEvent.created_at >= since)
        .group_by(day, EngagementEvent.kind).order_by(day))).all()
    series: dict[str, dict] = {}
    for d, kind, n in series_rows:
        series.setdefault(d.isoformat(), {"date": d.isoformat(), "view": 0, "click": 0, "save": 0, "apply": 0,
                                          "share": 0})[kind] = n
    counties = (await session.execute(
        select(EngagementEvent.county, func.count()).where(EngagementEvent.organization_id == org_id,
                                                           EngagementEvent.county.is_not(None),
                                                           EngagementEvent.created_at >= since)
        .group_by(EngagementEvent.county).order_by(func.count().desc()).limit(12))).all()
    funnel = dict((await session.execute(select(Application.status, func.count()).where(
        Application.organization_id == org_id).group_by(Application.status))).all())
    top = (await session.execute(select(Opportunity).where(
        Opportunity.organization_id == org_id, Opportunity.status.in_([OppStatus.published, OppStatus.expired,
                                                                       OppStatus.archived]))
        .order_by(Opportunity.views_count.desc()).limit(8))).scalars().all()
    outcomes = await session.scalar(select(func.count()).select_from(Outcome).where(Outcome.organization_id == org_id))
    return {
        "status_counts": {k.value: v for k, v in status_counts.items()},
        "totals": {"views": totals[0], "clicks": totals[1], "saves": totals[2], "applications": totals[3],
                   "accepted": funnel.get(AppStatus.accepted, 0), "outcomes": outcomes or 0},
        "series": list(series.values()),
        "counties": [{"county": c, "count": n} for c, n in counties],
        "funnel": {k.value: v for k, v in funnel.items()},
        "top": [{"id": o.id, "title": o.title, "status": o.status.value, "views": o.views_count,
                 "clicks": o.clicks_count, "saves": o.saves_count, "applications": o.applications_count,
                 "conversion": round(100 * o.applications_count / o.views_count, 1) if o.views_count else 0}
                for o in top],
    }
