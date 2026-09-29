"""Member-facing discovery: For You, Explore/search, detail, saves, engagement."""
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError

from app.core.clock import utcnow
from app.core.deps import DB, Member
from app.modules.applications.models import Application
from app.modules.opportunities.matching import evaluate
from app.modules.opportunities.models import Opportunity, SavedOpportunity
from app.modules.opportunities.service import (card, detail, is_locked, live_filter, member_context, orgs_by_id,
                                               saved_ids, track)
from app.modules.orgs.models import Organization, OrgStatus

router = APIRouter(prefix="/api/v1/opportunities", tags=["discovery"])

FEED_CANDIDATES = 400


def _live_orgs():
    return Opportunity.organization_id.in_(select(Organization.id).where(Organization.status == OrgStatus.active))


@router.get("/feed")
async def for_you(p: Member, session: DB):
    """Scores the most relevant slice of live opportunities for this member. The SQL
    pre-filter bounds work per request regardless of catalogue size."""
    ctx = await member_context(session, p.user)
    sig = ctx.signals
    stmt = select(Opportunity).where(live_filter(), _live_orgs())
    if sig.county:
        stmt = stmt.where(or_(Opportunity.counties == [], Opportunity.counties.any(sig.county),
                              Opportunity.is_remote, Opportunity.is_international))
    if sig.gender:
        stmt = stmt.where(or_(Opportunity.gender.is_(None), Opportunity.gender == sig.gender))
    opps = (await session.execute(
        stmt.order_by(Opportunity.featured.desc(), Opportunity.published_at.desc()).limit(FEED_CANDIDATES)
    )).scalars().all()

    orgs = await orgs_by_id(session, {o.organization_id for o in opps})
    saved = await saved_ids(session, p.id, [o.id for o in opps])
    scored = [(o, evaluate(o, sig)) for o in opps]

    def c(o, m):
        return card(o, orgs.get(o.organization_id), match=m, saved=o.id in saved, locked=is_locked(o, ctx))

    eligible = [(o, m) for o, m in scored if m.eligible]
    ranked = sorted(eligible, key=lambda x: (-x[1].score, x[0].deadline or utcnow() + timedelta(days=3650)))
    strong = [(o, m) for o, m in ranked if m.score >= 45]
    summary: dict[str, int] = {}
    for o, _ in strong:
        summary[o.category] = summary.get(o.category, 0) + 1
    now = utcnow()
    closing = sorted([(o, m) for o, m in eligible if o.deadline and o.deadline <= now + timedelta(days=7)],
                     key=lambda x: x[0].deadline)
    featured = [(o, m) for o, m in eligible if o.featured][:8]
    events = sorted([(o, m) for o, m in eligible if o.is_event and o.starts_at and o.starts_at > now],
                    key=lambda x: x[0].starts_at)[:10]
    profile_ready = bool(ctx.profile and ctx.profile.onboarding_completed)
    return {
        "summary": [{"category": k, "count": v} for k, v in sorted(summary.items(), key=lambda kv: -kv[1])],
        "total_matches": len(strong),
        "featured": [c(o, m) for o, m in featured],
        "closing_soon": [c(o, m) for o, m in closing[:10]],
        "for_you": [c(o, m) for o, m in ranked[:40]],
        "events": [c(o, m) for o, m in events],
        "tier": ctx.tier,
        "profile_ready": profile_ready,
    }


@router.get("")
async def explore(
    p: Member, session: DB,
    q: str | None = Query(None, max_length=120),
    category: str | None = None, type: str | None = None, county: str | None = None,
    organization_id: str | None = None,
    closing_within: int | None = Query(None, ge=1, le=365),
    remote: bool | None = None, events: bool | None = None,
    eligible_only: bool = False,
    sort: Literal["relevance", "deadline", "newest"] = "relevance",
    page: int = Query(1, ge=1, le=50), limit: int = Query(20, ge=1, le=50),
):
    ctx = await member_context(session, p.user)
    stmt = select(Opportunity).where(live_filter(), _live_orgs())
    rank = None
    if q and q.strip():
        tsq = func.websearch_to_tsquery("english", q.strip())
        org_ids = select(Organization.id).where(Organization.name.ilike(f"%{q.strip()}%"))
        stmt = stmt.where(or_(Opportunity.search_tsv.op("@@")(tsq), Opportunity.organization_id.in_(org_ids),
                              Opportunity.tags.any(q.strip().lower())))
        rank = func.ts_rank(Opportunity.search_tsv, tsq)
    if category:
        stmt = stmt.where(Opportunity.category == category)
    if type:
        stmt = stmt.where(Opportunity.type == type)
    if county:
        stmt = stmt.where(or_(Opportunity.counties.any(county), Opportunity.counties == []))
    if organization_id:
        stmt = stmt.where(Opportunity.organization_id == organization_id)
    if closing_within:
        stmt = stmt.where(Opportunity.deadline <= utcnow() + timedelta(days=closing_within))
    if remote:
        stmt = stmt.where(Opportunity.is_remote.is_(True))
    if events:
        stmt = stmt.where(Opportunity.is_event.is_(True))

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    if sort == "deadline":
        stmt = stmt.order_by(Opportunity.deadline.asc().nullslast(), Opportunity.id)
    elif sort == "newest" or rank is None:
        stmt = stmt.order_by(Opportunity.featured.desc(), Opportunity.published_at.desc(), Opportunity.id)
    else:
        stmt = stmt.order_by(rank.desc(), Opportunity.published_at.desc())
    opps = (await session.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()

    orgs = await orgs_by_id(session, {o.organization_id for o in opps})
    saved = await saved_ids(session, p.id, [o.id for o in opps])
    items = []
    for o in opps:
        m = evaluate(o, ctx.signals)
        if eligible_only and not m.eligible:
            continue
        items.append(card(o, orgs.get(o.organization_id), match=m, saved=o.id in saved, locked=is_locked(o, ctx)))
    if sort == "relevance" and rank is None:
        items.sort(key=lambda x: -(x["match"]["score"] if x["match"] else 0))
    return {"items": items, "total": total or 0, "page": page, "has_more": page * limit < (total or 0)}


@router.get("/saved")
async def saved(p: Member, session: DB):
    ctx = await member_context(session, p.user)
    rows = (await session.execute(
        select(Opportunity).join(SavedOpportunity, SavedOpportunity.opportunity_id == Opportunity.id)
        .where(SavedOpportunity.user_id == p.id).order_by(SavedOpportunity.created_at.desc()).limit(200)
    )).scalars().all()
    orgs = await orgs_by_id(session, {o.organization_id for o in rows})
    return [card(o, orgs.get(o.organization_id), match=evaluate(o, ctx.signals), saved=True, locked=is_locked(o, ctx))
            for o in rows]


async def _published(session, opp_id: str) -> Opportunity:
    opp = await session.get(Opportunity, opp_id)
    if not opp or opp.status.value not in ("published", "expired"):
        raise HTTPException(404, "This opportunity is no longer available")
    return opp


@router.get("/{opp_id}")
async def get_one(opp_id: str, p: Member, session: DB):
    opp = await _published(session, opp_id)
    ctx = await member_context(session, p.user)
    org = await session.get(Organization, opp.organization_id)
    app_row = await session.scalar(select(Application).where(Application.opportunity_id == opp.id,
                                                              Application.user_id == p.id))
    is_saved = bool(await saved_ids(session, p.id, [opp.id]))
    await track(session, opp, "view", p.user, ctx.profile)
    await session.commit()
    application = {"id": app_row.id, "status": app_row.status.value, "created_at": app_row.created_at} if app_row else None
    return detail(opp, org, match=evaluate(opp, ctx.signals), saved=is_saved, locked=is_locked(opp, ctx),
                  application=application)


@router.get("/{opp_id}/similar")
async def similar(opp_id: str, p: Member, session: DB):
    opp = await _published(session, opp_id)
    ctx = await member_context(session, p.user)
    rows = (await session.execute(select(Opportunity).where(
        live_filter(), Opportunity.id != opp.id,
        or_(Opportunity.type == opp.type, Opportunity.category == opp.category)
    ).order_by((Opportunity.type == opp.type).desc(), Opportunity.published_at.desc()).limit(8))).scalars().all()
    orgs = await orgs_by_id(session, {o.organization_id for o in rows})
    return [card(o, orgs.get(o.organization_id), match=evaluate(o, ctx.signals), locked=is_locked(o, ctx)) for o in rows]


@router.post("/{opp_id}/save")
async def save(opp_id: str, p: Member, session: DB):
    opp = await _published(session, opp_id)
    ctx = await member_context(session, p.user)
    session.add(SavedOpportunity(user_id=p.id, opportunity_id=opp.id))
    try:
        await track(session, opp, "save", p.user, ctx.profile)
        await session.commit()
    except IntegrityError:
        await session.rollback()
    return {"saved": True}


@router.delete("/{opp_id}/save")
async def unsave(opp_id: str, p: Member, session: DB):
    await session.execute(delete(SavedOpportunity).where(SavedOpportunity.user_id == p.id,
                                                          SavedOpportunity.opportunity_id == opp_id))
    await session.commit()
    return {"saved": False}


class EventIn(BaseModel):
    kind: Literal["click", "share"]


@router.post("/{opp_id}/events")
async def engagement(opp_id: str, body: EventIn, p: Member, session: DB):
    opp = await _published(session, opp_id)
    ctx = await member_context(session, p.user)
    if body.kind == "click" and is_locked(opp, ctx):
        raise HTTPException(402, "Upgrade your membership to apply for this opportunity")
    await track(session, opp, body.kind, p.user, ctx.profile)
    await session.commit()
    return {"ok": True, "external_url": opp.external_url if body.kind == "click" else None}
