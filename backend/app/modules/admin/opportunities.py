"""Opportunity review & management for DEEN staff."""
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select

from app.core.audit import record
from app.core.deps import DB, Principal, Staff, require
from app.core.roles import Perm
from app.modules.notifications.service import notify
from app.modules.opportunities.models import AccessTier, Opportunity, OppStatus, ReviewEvent, ReviewMessage
from app.modules.opportunities.schemas import OpportunityIn
from app.modules.opportunities.service import REVIEW_ACTIONS, orgs_by_id, review_action, run_risk_scan, staff_view
from app.modules.orgs.models import Organization
from app.modules.users.models import User

router = APIRouter(prefix="/api/v1/admin/opportunities", tags=["admin"])

QUEUE = [OppStatus.submitted, OppStatus.under_review, OppStatus.verification, OppStatus.info_requested]


@router.get("")
async def list_opps(session: DB, p: Principal = require(Perm.opps_view), status: str | None = None,
                    queue: bool = False, q: str | None = None, category: str | None = None,
                    organization_id: str | None = None, flagged: bool = False, featured: bool | None = None,
                    page: int = 1, limit: int = 30):
    stmt = select(Opportunity)
    if queue:
        stmt = stmt.where(Opportunity.status.in_(QUEUE))
    elif status:
        stmt = stmt.where(Opportunity.status == status)
    if q:
        stmt = stmt.where(or_(Opportunity.title.ilike(f"%{q}%"), Opportunity.organization_id.in_(
            select(Organization.id).where(Organization.name.ilike(f"%{q}%")))))
    if category:
        stmt = stmt.where(Opportunity.category == category)
    if organization_id:
        stmt = stmt.where(Opportunity.organization_id == organization_id)
    if flagged:
        stmt = stmt.where(Opportunity.risk_score >= 30)
    if featured is not None:
        stmt = stmt.where(Opportunity.featured.is_(featured))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    order = ([Opportunity.risk_score.desc(), Opportunity.submitted_at.asc()] if queue
             else [Opportunity.updated_at.desc()])
    limit = max(1, min(limit, 100))
    rows = (await session.execute(stmt.order_by(*order).offset((max(page, 1) - 1) * limit).limit(limit))).scalars().all()
    orgs = await orgs_by_id(session, {o.organization_id for o in rows})
    counts = dict((await session.execute(select(Opportunity.status, func.count()).group_by(Opportunity.status))).all())
    return {"items": [staff_view(o, orgs.get(o.organization_id)) for o in rows], "total": total or 0,
            "counts": {k.value: v for k, v in counts.items()}}


@router.get("/{opp_id}")
async def get_opp(opp_id: str, session: DB, p: Principal = require(Perm.opps_view)):
    opp = await session.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    org = await session.get(Organization, opp.organization_id)
    history = (await session.execute(
        select(ReviewEvent, User.full_name).outerjoin(User, User.id == ReviewEvent.actor_id)
        .where(ReviewEvent.opportunity_id == opp.id).order_by(ReviewEvent.created_at))).all()
    messages = (await session.execute(
        select(ReviewMessage, User.full_name).outerjoin(User, User.id == ReviewMessage.author_id)
        .where(ReviewMessage.opportunity_id == opp.id).order_by(ReviewMessage.created_at))).all()
    out = staff_view(opp, org)
    out["org_detail"] = {"id": org.id, "name": org.name, "verification": org.verification.value,
                         "website": org.website, "status": org.status.value}
    out["history"] = [{"from": h.from_status, "to": h.to_status, "note": h.note, "by": name or "System",
                       "at": h.created_at} for h, name in history]
    out["messages"] = [{"id": m.id, "body": m.body, "internal": m.internal, "from_platform": m.from_platform,
                        "author": name, "at": m.created_at} for m, name in messages]
    out["actions"] = [a for a, (src, _) in REVIEW_ACTIONS.items() if opp.status in src]
    return out


class ActionIn(BaseModel):
    action: str
    note: str | None = Field(None, max_length=4000)


PUBLISHING_ACTIONS = {"publish", "republish", "archive"}


@router.post("/{opp_id}/actions")
async def act(opp_id: str, body: ActionIn, session: DB, p: Staff):
    # Reviewers run the whole workflow; content managers may only publish/unpublish.
    allowed = p.can(Perm.opps_review) or (body.action in PUBLISHING_ACTIONS and p.can(Perm.opps_publish))
    if not allowed:
        raise HTTPException(403, "You don't have permission to do that")
    opp = await session.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    await review_action(session, opp, body.action, p.id, body.note)
    if body.note and body.action in ("request_info", "reject"):
        session.add(ReviewMessage(opportunity_id=opp.id, author_id=p.id, body=body.note, from_platform=True))
    record(session, actor_id=p.id, action=f"opportunity.{body.action}", entity="opportunity", entity_id=opp.id,
           ip=p.ip, note=body.note)
    await session.commit()
    return {"ok": True, "status": opp.status.value}


class AdminEditIn(OpportunityIn):
    featured: bool = False
    featured_until: datetime | None = None


@router.put("/{opp_id}")
async def edit(opp_id: str, body: AdminEditIn, session: DB, p: Principal = require(Perm.opps_edit)):
    opp = await session.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    data = body.to_columns()
    for k, v in data.items():
        if k in {"featured", "featured_until"} or k in OpportunityIn.model_fields:
            setattr(opp, k, v)
    await run_risk_scan(session, opp)
    record(session, actor_id=p.id, action="opportunity.edited", entity="opportunity", entity_id=opp.id, ip=p.ip)
    await session.commit()
    return staff_view(opp, await session.get(Organization, opp.organization_id))


class FeatureIn(BaseModel):
    featured: bool
    featured_until: datetime | None = None
    access_tier: AccessTier | None = None


@router.post("/{opp_id}/placement")
async def placement(opp_id: str, body: FeatureIn, session: DB, p: Principal = require(Perm.opps_publish)):
    opp = await session.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    opp.featured, opp.featured_until = body.featured, body.featured_until
    opp.feature_requested = False
    if body.access_tier:
        opp.access_tier = body.access_tier
    record(session, actor_id=p.id, action="opportunity.placement", entity="opportunity", entity_id=opp.id, ip=p.ip,
           featured=body.featured, tier=opp.access_tier.value)
    await session.commit()
    return {"ok": True}


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    internal: bool = False


@router.post("/{opp_id}/messages")
async def message(opp_id: str, body: MessageIn, session: DB, p: Principal = require(Perm.opps_review)):
    opp = await session.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    session.add(ReviewMessage(opportunity_id=opp.id, author_id=p.id, body=body.body.strip(), internal=body.internal,
                              from_platform=True))
    if not body.internal:
        org_users = (await session.execute(select(User.id).where(User.organization_id == opp.organization_id))).scalars()
        await notify(session, list(org_users), kind="organizations", title="Message from DEEN",
                     body=f'About "{opp.title}": {body.body[:180]}', data={"opportunity_id": opp.id},
                     channels_=("email",))
    await session.commit()
    return {"ok": True}


class CreateForOrgIn(OpportunityIn):
    organization_id: str


@router.post("")
async def create_for_org(body: CreateForOrgIn, session: DB, p: Principal = require(Perm.opps_edit)):
    """DEEN staff can list an opportunity on an organization's behalf (e.g. sourced by the team)."""
    org = await session.get(Organization, body.organization_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    cols = body.to_columns()
    cols.pop("organization_id", None)
    opp = Opportunity(organization_id=org.id, created_by_id=p.id, status=OppStatus.submitted, **cols)
    session.add(opp)
    await session.flush()
    await run_risk_scan(session, opp)
    session.add(ReviewEvent(opportunity_id=opp.id, actor_id=p.id, from_status=None, to_status="submitted",
                            note="Created by DEEN staff"))
    record(session, actor_id=p.id, action="opportunity.created_by_staff", entity="opportunity", entity_id=opp.id,
           ip=p.ip)
    await session.commit()
    return staff_view(opp, org)
