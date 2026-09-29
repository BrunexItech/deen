"""Global search across opportunities, organizations and the directory."""
from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.core.deps import DB, Member
from app.modules.directory.models import DirectoryListing, ListingStatus
from app.modules.directory.router import listing_out
from app.modules.opportunities.matching import evaluate
from app.modules.opportunities.models import Opportunity
from app.modules.opportunities.service import card, is_locked, live_filter, member_context, org_mini, orgs_by_id
from app.modules.orgs.models import Organization, OrgStatus, Verification

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.get("")
async def search(p: Member, session: DB, q: str = Query(min_length=2, max_length=120)):
    term = q.strip()
    ctx = await member_context(session, p.user)
    tsq = func.websearch_to_tsquery("english", term)
    opps = (await session.execute(
        select(Opportunity).where(live_filter(), or_(Opportunity.search_tsv.op("@@")(tsq),
                                                     Opportunity.title.ilike(f"%{term}%")))
        .order_by(func.ts_rank(Opportunity.search_tsv, tsq).desc()).limit(12))).scalars().all()
    orgs_map = await orgs_by_id(session, {o.organization_id for o in opps})
    orgs = (await session.execute(select(Organization).where(
        Organization.status == OrgStatus.active, Organization.verification != Verification.pending,
        Organization.name.ilike(f"%{term}%")).limit(6))).scalars()
    listings = (await session.execute(select(DirectoryListing).where(
        DirectoryListing.status == ListingStatus.approved,
        or_(DirectoryListing.name.ilike(f"%{term}%"), DirectoryListing.headline.ilike(f"%{term}%"))).limit(6))).scalars()
    cards = [card(o, orgs_map.get(o.organization_id), match=evaluate(o, ctx.signals), locked=is_locked(o, ctx))
             for o in opps]
    return {
        "opportunities": [c for c in cards if not c["is_event"]],
        "events": [c for c in cards if c["is_event"]],
        "organizations": [{**org_mini(o), "tagline": o.tagline} for o in orgs],
        "directory": [listing_out(d) for d in listings],
    }
