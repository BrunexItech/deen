"""Member-facing discovery: For You, Explore/search, detail, saves, engagement."""
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError

from app.core.clock import utcnow
from app.core.deps import DB, Member
from app.core.roles import Role
from app.modules.applications.models import Application
from app.modules.opportunities.matching import evaluate, headline
from app.modules.opportunities.models import AccessTier, Opportunity, SavedOpportunity
from app.modules.opportunities.service import (card, detail, is_locked, live_filter, member_context, orgs_by_id,
                                               saved_ids, track)
from app.modules.orgs.models import Organization, OrgStatus, Verification
from app.modules.taxonomy.data import STUDENT_HUB
from app.modules.taxonomy.models import OpportunityType
from app.modules.users.models import User

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
                              Opportunity.work_mode == "remote", Opportunity.is_international))
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
    week_ago = now - timedelta(days=7)
    newest = sorted([(o, m) for o, m in scored if o.published_at and o.published_at >= week_ago],
                    key=lambda x: x[0].published_at, reverse=True)[:12]
    active_apps = await session.scalar(select(func.count()).select_from(Application).where(
        Application.user_id == p.id, Application.status.in_(["started", "submitted", "in_review", "shortlisted",
                                                              "interview"])))
    return {
        "headline": headline(sig, ctx.profile),
        "new": [c(o, m) for o, m in newest],
        "active_applications": active_apps or 0,
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
    category: str | None = None, type: str | None = None,
    types: str | None = Query(None, max_length=400, description="Comma-separated type keys"),
    country: str | None = None, county: str | None = None, organization_id: str | None = None,
    education_level: str | None = None, field_of_study: str | None = Query(None, max_length=80),
    industry: str | None = None, max_experience: int | None = Query(None, ge=0, le=50),
    age: int | None = Query(None, ge=10, le=100),
    compensation: Literal["paid", "unpaid", "stipend"] | None = None,
    work_mode: Literal["physical", "remote", "hybrid"] | None = None,
    duration: Literal["short", "medium", "long"] | None = None,
    scope: Literal["local", "international"] | None = None,
    closing_within: int | None = Query(None, ge=1, le=365),
    remote: bool | None = None, events: bool | None = None,
    cause: str | None = None, weekend: bool | None = None, student_friendly: bool | None = None,
    certificate: bool | None = None, islamic: bool | None = None, islamic_tag: str | None = None,
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
    if types:
        stmt = stmt.where(Opportunity.type.in_([t.strip() for t in types.split(",") if t.strip()]))
    if country:
        stmt = stmt.where(Opportunity.country == country)
    if county:
        stmt = stmt.where(or_(Opportunity.counties.any(county), Opportunity.counties == []))
    if organization_id:
        stmt = stmt.where(Opportunity.organization_id == organization_id)
    if education_level:
        stmt = stmt.where(or_(Opportunity.education_levels == [], Opportunity.education_levels.any(education_level)))
    if field_of_study:
        like = f"%{field_of_study.strip()}%"
        stmt = stmt.where(or_(func.array_to_string(Opportunity.fields_of_study, " ").ilike(like),
                              Opportunity.title.ilike(like)))
    if industry:
        stmt = stmt.where(Opportunity.industry == industry)
    if max_experience is not None:
        stmt = stmt.where(or_(Opportunity.min_experience_years.is_(None),
                              Opportunity.min_experience_years <= max_experience))
    if age is not None:
        stmt = stmt.where(or_(Opportunity.min_age.is_(None), Opportunity.min_age <= age),
                          or_(Opportunity.max_age.is_(None), Opportunity.max_age >= age))
    if compensation == "paid":
        stmt = stmt.where(Opportunity.compensation.in_(["paid", "stipend"]))
    elif compensation:
        stmt = stmt.where(Opportunity.compensation == compensation)
    if work_mode:
        stmt = stmt.where(Opportunity.work_mode == work_mode)
    if remote:
        stmt = stmt.where(Opportunity.work_mode == "remote")
    if duration == "short":
        stmt = stmt.where(Opportunity.duration_weeks <= 4)
    elif duration == "medium":
        stmt = stmt.where(Opportunity.duration_weeks.between(5, 12))
    elif duration == "long":
        stmt = stmt.where(Opportunity.duration_weeks > 12)
    if scope == "local":
        stmt = stmt.where(Opportunity.is_international.is_(False))
    elif scope == "international":
        stmt = stmt.where(Opportunity.is_international.is_(True))
    if closing_within:
        stmt = stmt.where(Opportunity.deadline <= utcnow() + timedelta(days=closing_within))
    if events:
        stmt = stmt.where(Opportunity.is_event.is_(True))
    if cause:
        stmt = stmt.where(Opportunity.causes.any(cause))
    if weekend:
        stmt = stmt.where(Opportunity.weekend.is_(True))
    if student_friendly:
        stmt = stmt.where(Opportunity.student_friendly.is_(True))
    if certificate:
        stmt = stmt.where(Opportunity.certificate_provided.is_(True))
    if islamic:
        stmt = stmt.where(or_(Opportunity.islamic_tags != [], Opportunity.category == "islamic_economy"))
    if islamic_tag:
        stmt = stmt.where(Opportunity.islamic_tags.any(islamic_tag))

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    if sort == "deadline":
        stmt = stmt.order_by(Opportunity.deadline.asc().nullslast(), Opportunity.id)
    elif sort == "newest":
        stmt = stmt.order_by(Opportunity.published_at.desc(), Opportunity.id)
    elif rank is None:
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


@router.get("/hub")
async def student_hub(p: Member, session: DB):
    """Student & Graduate Hub (spec section 26): Study, Experience, Career, Growth."""
    ctx = await member_context(session, p.user)
    all_types = [t for _, _, ts in STUDENT_HUB for t in ts]
    rows = (await session.execute(select(Opportunity).where(live_filter(), _live_orgs(), Opportunity.type.in_(all_types))
                                  .order_by(Opportunity.deadline.asc().nullslast()).limit(300))).scalars().all()
    orgs = await orgs_by_id(session, {o.organization_id for o in rows})
    names = dict((await session.execute(select(OpportunityType.key, OpportunityType.name))).all())
    sections = []
    for key, label, ts in STUDENT_HUB:
        items = [o for o in rows if o.type in ts]
        counts = {t: sum(1 for o in items if o.type == t) for t in ts}
        sections.append({
            "key": key, "label": label,
            "types": [{"key": t, "name": names.get(t, t), "count": counts[t]} for t in ts],
            "items": [card(o, orgs.get(o.organization_id), match=evaluate(o, ctx.signals), locked=is_locked(o, ctx))
                      for o in items[:8]],
        })
    return {"sections": sections}


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
        raise HTTPException(402, "This opportunity is for paid-up DEEN members")
    await track(session, opp, body.kind, p.user, ctx.profile)
    await session.commit()
    return {"ok": True, "external_url": opp.external_url if body.kind == "click" else None}


public_router = APIRouter(prefix="/api/v1/public", tags=["public"])


@public_router.get("/opportunities/{opp_id}")
async def public_preview(opp_id: str, session: DB):
    """Share-link preview (WhatsApp, social). Only live listings, and never the
    application details: those need the app and a signed-in member."""
    opp = await session.scalar(select(Opportunity).where(Opportunity.id == opp_id, live_filter()))
    if not opp:
        raise HTTPException(404, "This opportunity is no longer available")
    org = await session.get(Organization, opp.organization_id)
    c = card(opp, org)
    return {k: c[k] for k in ("id", "title", "summary", "category", "type", "organization", "deadline", "days_left",
                              "location", "amount_label", "is_event", "starts_at")}


_PUBLIC_FIELDS = ("id", "title", "summary", "category", "type", "organization", "deadline", "days_left", "location",
                  "amount_label", "is_event", "starts_at", "closing_soon", "verified_by_deen")


@public_router.get("/opportunities")
async def public_list(session: DB, category: str | None = None, limit: int = 6, page: int = 1):
    """The website's opportunity pages: live listings, member-only ones excluded."""
    limit, page = min(max(limit, 1), 48), max(page, 1)
    stmt = (select(Opportunity, Organization).join(Organization, Organization.id == Opportunity.organization_id)
            .where(live_filter(), Opportunity.access_tier == AccessTier.free))
    if category:
        stmt = stmt.where(Opportunity.category == category)
    rows = (await session.execute(stmt.order_by(Opportunity.featured.desc(), Opportunity.published_at.desc())
                                  .offset((page - 1) * limit).limit(limit + 1))).all()
    items = [{k: c[k] for k in _PUBLIC_FIELDS} for c in (card(o, org) for o, org in rows[:limit])]
    return {"items": items, "has_more": len(rows) > limit, "page": page}


@public_router.get("/stats")
async def public_stats(session: DB):
    live = await session.scalar(select(func.count()).select_from(Opportunity).where(live_filter()))
    orgs = await session.scalar(select(func.count()).select_from(Organization).where(
        Organization.status == OrgStatus.active, Organization.verification != Verification.pending))
    members = await session.scalar(select(func.count()).select_from(User).where(User.role == Role.member))
    return {"live_opportunities": live or 0, "verified_organizations": orgs or 0, "members": members or 0}
