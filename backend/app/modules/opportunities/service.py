"""Opportunity lifecycle, serialisation and distribution."""
from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.config import settings
from app.core.roles import Role
from app.modules.jobs.service import enqueue, handler
from app.modules.notifications.service import notify
from app.modules.opportunities import risk
from app.modules.opportunities.matching import Match, MemberSignals, bump_affinity, evaluate
from app.modules.opportunities.models import (AccessTier, EngagementEvent, Opportunity, OppStatus, ReviewEvent,
                                              SavedOpportunity)
from app.modules.orgs.models import Organization, OrgFollow, OrgStatus, Verification
from app.modules.subscriptions.service import tier_allows
from app.modules.users.models import MemberProfile, User, UserStatus

S = OppStatus

# Reviewer actions: allowed source statuses -> target status.
REVIEW_ACTIONS: dict[str, tuple[set[OppStatus], OppStatus]] = {
    "start_review": ({S.submitted}, S.under_review),
    "request_info": ({S.submitted, S.under_review, S.verification}, S.info_requested),
    "send_to_verification": ({S.submitted, S.under_review}, S.verification),
    "approve": ({S.submitted, S.under_review, S.verification}, S.approved),
    "publish": ({S.submitted, S.approved, S.under_review, S.verification}, S.published),
    "reject": ({S.submitted, S.under_review, S.verification, S.info_requested}, S.rejected),
    "archive": ({S.published, S.approved, S.expired}, S.archived),
    "republish": ({S.archived, S.expired}, S.published),
}
ORG_EDITABLE = {S.draft, S.info_requested, S.rejected}


# ---------- serialisation ----------

def file_url(file_id: str | None) -> str | None:
    return f"/api/v1/files/{file_id}" if file_id else None


def org_mini(org: Organization | None) -> dict | None:
    if not org:
        return None
    return {"id": org.id, "name": org.name, "slug": org.slug, "type": org.org_type.value,
            "verification": org.verification.value, "logo_url": file_url(org.logo_file_id), "county": org.county}


def _days_left(opp: Opportunity) -> int | None:
    if not opp.deadline:
        return None
    return max(0, (opp.deadline - utcnow()).days)


def card(opp: Opportunity, org: Organization | None, *, match: Match | None = None, saved: bool = False,
         locked: bool = False) -> dict:
    days = _days_left(opp)
    return {
        "id": opp.id, "title": opp.title, "summary": opp.summary, "category": opp.category, "type": opp.type,
        "organization": org_mini(org), "deadline": opp.deadline, "days_left": days,
        "closing_soon": days is not None and days <= 7 and opp.status == S.published,
        "location": opp.location_label or ("Remote" if opp.is_remote else ", ".join(opp.counties[:2]) or "Kenya-wide"),
        "is_remote": opp.is_remote, "is_event": opp.is_event, "starts_at": opp.starts_at,
        "amount_label": opp.amount_label, "access_tier": opp.access_tier.value, "locked": locked,
        "featured": opp.featured, "status": opp.status.value, "published_at": opp.published_at,
        "saved": saved, "applications_count": opp.applications_count,
        "match": {"score": match.score, "eligible": match.eligible, "reasons": match.reasons,
                  "blockers": match.blockers} if match else None,
    }


def detail(opp: Opportunity, org: Organization | None, *, match: Match | None = None, saved: bool = False,
           locked: bool = False, application: dict | None = None) -> dict:
    out = card(opp, org, match=match, saved=saved, locked=locked)
    out.update({
        "description": opp.description, "eligibility": opp.eligibility, "benefits": opp.benefits,
        "requirements": opp.requirements, "tags": opp.tags, "counties": opp.counties,
        "education_levels": opp.education_levels, "min_age": opp.min_age, "max_age": opp.max_age,
        "gender": opp.gender, "skills": opp.skills, "is_international": opp.is_international,
        "ends_at": opp.ends_at, "venue": opp.venue, "slots": opp.slots,
        "requires_verified_identity": opp.requires_verified_identity,
        "apply_mode": opp.apply_mode.value, "required_documents": opp.required_documents,
        "attachments": [{**a, "url": file_url(a.get("file_id"))} for a in (opp.attachments or [])],
        "organization": {**(org_mini(org) or {}), "tagline": org.tagline if org else None,
                         "website": org.website if org else None},
        "application": application,
        "share_url": f"{settings.app_url}/o/{opp.id}",
    })
    # Locked (tier-gated) opportunities show what they are, never how to apply.
    if locked:
        out.update({"application_process": None, "external_url": None, "form_questions": []})
    else:
        out.update({"application_process": opp.application_process, "external_url": opp.external_url,
                    "form_questions": opp.form_questions or []})
    return out


def staff_view(opp: Opportunity, org: Organization | None) -> dict:
    out = detail(opp, org)
    out.update({"flags": opp.flags or [], "risk_score": opp.risk_score, "submitted_at": opp.submitted_at,
                "feature_requested": opp.feature_requested, "featured_until": opp.featured_until,
                "views_count": opp.views_count, "clicks_count": opp.clicks_count, "saves_count": opp.saves_count,
                "created_at": opp.created_at, "updated_at": opp.updated_at,
                "application_process": opp.application_process, "external_url": opp.external_url,
                "form_questions": opp.form_questions or []})
    return out


# ---------- member context ----------

class MemberContext:
    def __init__(self, user: User, profile: MemberProfile | None, tier: str):
        self.user, self.profile, self.tier = user, profile, tier
        self.signals = MemberSignals.from_profile(profile)


async def member_context(session: AsyncSession, user: User) -> MemberContext:
    from app.modules.subscriptions.service import current_membership

    profile = await session.scalar(select(MemberProfile).where(MemberProfile.user_id == user.id))
    tier = (await current_membership(session, user.id))["tier"] if user.role.value == "member" else "premium"
    return MemberContext(user, profile, tier)


def live_filter():
    now = utcnow()
    return and_(Opportunity.status == S.published, or_(Opportunity.deadline.is_(None), Opportunity.deadline > now))


def is_locked(opp: Opportunity, ctx: MemberContext | None) -> bool:
    if opp.access_tier == AccessTier.free:
        return False
    return ctx is None or not tier_allows(ctx.tier, opp.access_tier)


async def saved_ids(session: AsyncSession, user_id: str, opp_ids: list[str]) -> set[str]:
    if not opp_ids:
        return set()
    rows = await session.execute(select(SavedOpportunity.opportunity_id).where(
        SavedOpportunity.user_id == user_id, SavedOpportunity.opportunity_id.in_(opp_ids)))
    return set(rows.scalars())


async def orgs_by_id(session: AsyncSession, ids: set[str]) -> dict[str, Organization]:
    if not ids:
        return {}
    return {o.id: o for o in (await session.execute(select(Organization).where(Organization.id.in_(ids)))).scalars()}


# ---------- engagement ----------

AFFINITY_WEIGHT = {"view": 1.0, "click": 2.0, "save": 3.0, "share": 2.0, "apply": 5.0}
COUNTER = {"view": Opportunity.views_count, "click": Opportunity.clicks_count, "save": Opportunity.saves_count,
           "apply": Opportunity.applications_count}


async def track(session: AsyncSession, opp: Opportunity, kind: str, user: User | None,
                profile: MemberProfile | None = None) -> None:
    session.add(EngagementEvent(opportunity_id=opp.id, user_id=user.id if user else None,
                                organization_id=opp.organization_id, kind=kind,
                                county=profile.county if profile else None))
    if kind in COUNTER:
        col = COUNTER[kind]
        await session.execute(update(Opportunity).where(Opportunity.id == opp.id).values({col: col + 1}))
    if profile is not None:
        profile.affinity = bump_affinity(profile.affinity, opp.category, AFFINITY_WEIGHT.get(kind, 1.0))


# ---------- workflow ----------

async def run_risk_scan(session: AsyncSession, opp: Opportunity) -> None:
    org = await session.get(Organization, opp.organization_id)
    recent = (await session.execute(
        select(Opportunity.id, Opportunity.title).where(
            Opportunity.category == opp.category, Opportunity.id != opp.id,
            Opportunity.created_at > utcnow() - timedelta(days=120),
            Opportunity.status.notin_([S.draft, S.rejected]),
        ).order_by(Opportunity.created_at.desc()).limit(300)
    )).all()
    opp.flags, opp.risk_score = risk.scan(opp, org, [(r.id, r.title) for r in recent])


async def transition(session: AsyncSession, opp: Opportunity, to: OppStatus, actor_id: str | None,
                     note: str | None = None) -> None:
    session.add(ReviewEvent(opportunity_id=opp.id, actor_id=actor_id, from_status=opp.status.value,
                            to_status=to.value, note=note))
    opp.status = to
    if to == S.submitted:
        opp.submitted_at = utcnow()
    if to == S.published:
        opp.published_at = opp.published_at or utcnow()
        await enqueue(session, "opportunities.fanout", {"opportunity_id": opp.id},
                      dedupe_key=f"fanout:{opp.id}")


async def review_action(session: AsyncSession, opp: Opportunity, action: str, actor_id: str,
                        note: str | None) -> None:
    if action not in REVIEW_ACTIONS:
        raise HTTPException(422, "Unknown action")
    sources, target = REVIEW_ACTIONS[action]
    if opp.status not in sources:
        raise HTTPException(409, f"Can't {action.replace('_', ' ')} an opportunity that is {opp.status.value.replace('_', ' ')}")
    org = await session.get(Organization, opp.organization_id)
    if target == S.published:
        if org.verification == Verification.pending or org.status != OrgStatus.active:
            raise HTTPException(409, "Verify the organization before publishing its opportunities")
        if opp.deadline and opp.deadline < utcnow():
            raise HTTPException(409, "The deadline has passed. Update it before publishing.")
    if action in ("request_info", "reject") and not (note or "").strip():
        raise HTTPException(422, "Tell the organization what to change or why it was declined")
    opp.reviewed_by_id = actor_id
    await transition(session, opp, target, actor_id, note)
    org_users = (await session.execute(select(User.id).where(User.organization_id == opp.organization_id,
                                                             User.status == UserStatus.active))).scalars().all()
    titles = {
        S.info_requested: ("DEEN needs more information", f'"{opp.title}": {note}'),
        S.published: ("Your opportunity is live", f'"{opp.title}" is now published to DEEN members.'),
        S.rejected: ("Submission declined", f'"{opp.title}": {note}'),
        S.approved: ("Approved", f'"{opp.title}" was approved and will be published shortly.'),
    }
    if target in titles:
        t, b = titles[target]
        await notify(session, list(org_users), kind="organizations", title=t, body=b,
                     data={"opportunity_id": opp.id}, channels_=("email",))


# ---------- distribution ----------

@handler("opportunities.fanout")
async def fanout(session: AsyncSession, payload: dict) -> None:
    """Scores the new opportunity against members in keyset batches and notifies the
    strongest matches (plus followers of the organization). Each batch re-enqueues the
    next, so a million members become ~500 short jobs spread across workers."""
    opp = await session.get(Opportunity, payload["opportunity_id"])
    if not opp or opp.status != S.published:
        return
    after = payload.get("after") or ""
    batch = settings.fanout_batch_size
    stmt = (select(MemberProfile, User.identity_status)
            .join(User, User.id == MemberProfile.user_id)
            .where(User.status == UserStatus.active, User.role == Role.member, MemberProfile.user_id > after,
                   MemberProfile.onboarding_completed.is_(True)))
    # Cheap SQL pre-filter: skip members who can never be eligible.
    if opp.counties and not (opp.is_remote or opp.is_international):
        stmt = stmt.where(or_(MemberProfile.county.is_(None), MemberProfile.county.in_(opp.counties)))
    if opp.gender:
        stmt = stmt.where(or_(MemberProfile.gender.is_(None), MemberProfile.gender == opp.gender))
    if opp.education_levels:
        stmt = stmt.where(or_(MemberProfile.education_level.is_(None),
                              MemberProfile.education_level.in_(opp.education_levels)))
    rows = (await session.execute(stmt.order_by(MemberProfile.user_id).limit(batch))).all()

    followers = set((await session.execute(select(OrgFollow.user_id).where(
        OrgFollow.organization_id == opp.organization_id,
        OrgFollow.user_id.in_([r[0].user_id for r in rows])))).scalars()) if rows else set()
    org = await session.get(Organization, opp.organization_id)
    targets: list[str] = []
    for profile, _ in rows:
        m = evaluate(opp, MemberSignals.from_profile(profile))
        if m.eligible and (m.score >= settings.match_notify_threshold or profile.user_id in followers):
            targets.append(profile.user_id)
    if targets:
        await notify(session, targets, kind="matches", title="New opportunity for you",
                     body=f"{opp.title} · {org.name}", data={"screen": "opportunity", "id": opp.id})
    if len(rows) == batch:
        await enqueue(session, "opportunities.fanout", {"opportunity_id": opp.id, "after": rows[-1][0].user_id})


@handler("opportunities.maintenance")
async def maintenance(session: AsyncSession, payload: dict) -> None:
    """Expires past-deadline listings and reminds members about saved ones closing soon."""
    now = utcnow()
    expired = (await session.execute(select(Opportunity).where(
        Opportunity.status == S.published, Opportunity.deadline.is_not(None), Opportunity.deadline < now)
    )).scalars().all()
    for opp in expired:
        await transition(session, opp, S.expired, None, "Deadline passed")
    await session.flush()

    closing = (await session.execute(
        select(SavedOpportunity, Opportunity)
        .join(Opportunity, Opportunity.id == SavedOpportunity.opportunity_id)
        .where(Opportunity.status == S.published, SavedOpportunity.reminded_at.is_(None),
               Opportunity.deadline.between(now, now + timedelta(days=3)))
        .limit(5000)
    )).all()
    by_opp: dict[str, tuple[Opportunity, list[str]]] = {}
    for saved, opp in closing:
        saved.reminded_at = now
        by_opp.setdefault(opp.id, (opp, []))[1].append(saved.user_id)
    from app.modules.applications.models import Application

    for opp, users in by_opp.values():
        applied = set((await session.execute(select(Application.user_id).where(
            Application.opportunity_id == opp.id, Application.user_id.in_(users)))).scalars())
        pending = [u for u in users if u not in applied]
        days = max(0, (opp.deadline - now).days)
        when = "today" if days == 0 else "tomorrow" if days == 1 else f"in {days} days"
        await notify(session, pending, kind="deadlines", title=f"Closing {when}",
                     body=f"{opp.title}: don't miss it. Apply before the deadline.",
                     data={"screen": "opportunity", "id": opp.id})


async def counts_by_category(session: AsyncSession) -> dict[str, int]:
    rows = await session.execute(select(Opportunity.category, func.count()).where(live_filter())
                                 .group_by(Opportunity.category))
    return {k: v for k, v in rows.all()}
