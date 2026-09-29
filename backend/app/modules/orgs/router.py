"""Member-facing organization profiles and follows."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.core.deps import DB, Member
from app.modules.opportunities.matching import evaluate
from app.modules.opportunities.models import Opportunity
from app.modules.opportunities.service import card, is_locked, live_filter, member_context, org_mini
from app.modules.orgs.models import Organization, OrgFollow, OrgStatus, Verification

router = APIRouter(prefix="/api/v1/organizations", tags=["organizations"])


@router.get("")
async def list_orgs(p: Member, session: DB, q: str | None = None, type: str | None = None):
    stmt = select(Organization).where(Organization.status == OrgStatus.active,
                                      Organization.verification != Verification.pending)
    if q:
        stmt = stmt.where(Organization.name.ilike(f"%{q}%"))
    if type:
        stmt = stmt.where(Organization.org_type == type)
    rows = (await session.execute(stmt.order_by(Organization.verification.desc(), Organization.name).limit(100))).scalars()
    return [{**org_mini(o), "tagline": o.tagline, "followers_count": o.followers_count} for o in rows]


@router.get("/{org_id}")
async def get_org(org_id: str, p: Member, session: DB):
    org = await session.get(Organization, org_id)
    if not org or org.status != OrgStatus.active:
        raise HTTPException(404, "Organization not found")
    ctx = await member_context(session, p.user)
    opps = (await session.execute(select(Opportunity).where(live_filter(), Opportunity.organization_id == org.id)
                                  .order_by(Opportunity.published_at.desc()).limit(50))).scalars().all()
    following = await session.scalar(select(OrgFollow.id).where(OrgFollow.user_id == p.id,
                                                                 OrgFollow.organization_id == org.id))
    total = await session.scalar(select(func.count()).select_from(Opportunity).where(
        Opportunity.organization_id == org.id, Opportunity.published_at.is_not(None)))
    return {
        **org_mini(org), "tagline": org.tagline, "description": org.description, "website": org.website,
        "email": org.email, "phone": org.phone, "address": org.address, "followers_count": org.followers_count,
        "following": following is not None, "opportunities_total": total or 0,
        "opportunities": [card(o, org, match=evaluate(o, ctx.signals), locked=is_locked(o, ctx)) for o in opps],
    }


@router.post("/{org_id}/follow")
async def follow(org_id: str, p: Member, session: DB):
    org = await session.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    session.add(OrgFollow(user_id=p.id, organization_id=org.id))
    try:
        await session.flush()
        await session.execute(update(Organization).where(Organization.id == org.id)
                              .values(followers_count=Organization.followers_count + 1))
        await session.commit()
    except IntegrityError:
        await session.rollback()
    return {"following": True}


@router.delete("/{org_id}/follow")
async def unfollow(org_id: str, p: Member, session: DB):
    row = await session.scalar(select(OrgFollow).where(OrgFollow.user_id == p.id, OrgFollow.organization_id == org_id))
    if row:
        await session.delete(row)
        await session.execute(update(Organization).where(Organization.id == org_id)
                              .values(followers_count=func.greatest(Organization.followers_count - 1, 0)))
        await session.commit()
    return {"following": False}
