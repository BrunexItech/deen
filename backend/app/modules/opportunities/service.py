"""Opportunity lifecycle, serialisation and distribution."""
from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.config import settings
from app.core.roles import Role
from app.modules.applications.models import Application
from app.modules.jobs.service import enqueue, handler
from app.modules.notifications.service import notify
from app.modules.opportunities import risk
from app.modules.opportunities.matching import DISCLAIMER, Match, MemberSignals, bump_affinity, evaluate
from app.modules.opportunities.models import (AccessTier, EngagementEvent, Opportunity, OppStatus, ReviewEvent,
                                              SavedOpportunity)
from app.modules.orgs.models import Organization, OrgFollow, OrgStatus, Verification
from app.modules.subscriptions.service import tier_allows
from app.modules.taxonomy.data import CHECKLIST_KEYS
from app.modules.taxonomy.models import OpportunityType
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
    "archive": ({S.published, S.approved, S.expired, S.suspended}, S.archived),
    "republish": ({S.archived, S.expired}, S.published),
    "suspend": ({S.published}, S.suspended),
    "reinstate": ({S.suspended}, S.published),
    "mark_expired": ({S.published, S.suspended}, S.expired),
}
# Actions that make an opportunity visible to members: the verification checklist must be complete.
PUBLISHING = {"publish", "republish", "reinstate"}
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


def status_label(opp: Opportunity) -> str:
    """What members see (spec section 14): Application open / Closing soon / Application closed…"""
    if opp.status == S.published:
        days = _days_left(opp)
        if opp.deadline and opp.deadline < utcnow():
            return "Application closed"
        return "Closing soon" if days is not None and days <= 7 else "Application open"
    return {S.expired: "Application closed", S.archived: "Application closed", S.suspended: "Suspended",
            S.rejected: "Rejected", S.submitted: "Pending verification", S.under_review: "Under review",
            S.verification: "Under review", S.info_requested: "Under review", S.approved: "Verified",
            S.draft: "Draft"}.get(opp.status, opp.status.value)


def _location(opp: Opportunity) -> str:
    if opp.location_label:
        return opp.location_label
    if opp.work_mode == "remote":
        return "Remote"
    place = ", ".join(opp.counties[:2]) if opp.counties else ("Kenya-wide" if opp.country == "Kenya" else opp.country)
    return f"{place} · Hybrid" if opp.work_mode == "hybrid" else place


def card(opp: Opportunity, org: Organization | None, *, match: Match | None = None, saved: bool = False,
         locked: bool = False) -> dict:
    days = _days_left(opp)
    return {
        "id": opp.id, "title": opp.title, "summary": opp.summary, "category": opp.category, "type": opp.type,
        "organization": org_mini(org), "deadline": opp.deadline, "days_left": days,
        "closing_soon": days is not None and days <= 7 and opp.status == S.published,
        "status_label": status_label(opp),
        # "Verified by DEEN" = passed the admin checklist and published (spec section 14).
        "verified_by_deen": opp.verified_at is not None and opp.status in (S.published, S.expired, S.archived),
        "location": _location(opp), "country": opp.country, "work_mode": opp.work_mode,
        "is_remote": opp.work_mode == "remote", "is_international": opp.is_international,
        "is_event": opp.is_event, "starts_at": opp.starts_at, "industry": opp.industry,
        "duration_label": opp.duration_label, "compensation": opp.compensation,
        "amount_label": opp.amount_label, "access_tier": opp.access_tier.value, "locked": locked,
        "featured": opp.featured, "sponsored": opp.sponsored, "islamic_tags": opp.islamic_tags or [],
        "status": opp.status.value, "published_at": opp.published_at,
        "saved": saved, "applications_count": opp.applications_count,
        "match": {"score": match.score, "eligible": match.eligible, "reasons": match.reasons,
                  "blockers": match.blockers, "disclaimer": DISCLAIMER} if match else None,
    }


def detail(opp: Opportunity, org: Organization | None, *, match: Match | None = None, saved: bool = False,
           locked: bool = False, application: dict | None = None) -> dict:
    out = card(opp, org, match=match, saved=saved, locked=locked)
    out.update({
        "description": opp.description, "eligibility": opp.eligibility, "benefits": opp.benefits,
        "requirements": opp.requirements, "responsibilities": opp.responsibilities, "tags": opp.tags,
        "counties": opp.counties, "eligible_countries": opp.eligible_countries,
        "education_levels": opp.education_levels, "fields_of_study": opp.fields_of_study,
        "min_age": opp.min_age, "max_age": opp.max_age, "min_experience_years": opp.min_experience_years,
        "gender": opp.gender, "skills": opp.skills, "target_user_types": opp.target_user_types,
        "department": opp.department, "duration_weeks": opp.duration_weeks, "time_commitment": opp.time_commitment,
        "allowances": opp.allowances, "certificate_provided": opp.certificate_provided, "weekend": opp.weekend,
        "student_friendly": opp.student_friendly, "causes": opp.causes, "shariah_basis": opp.shariah_basis,
        "contact_email": opp.contact_email, "contact_phone": opp.contact_phone,
        "ends_at": opp.ends_at, "venue": opp.venue, "slots": opp.slots,
        "requires_verified_identity": opp.requires_verified_identity,
        "apply_mode": opp.apply_mode.value, "required_documents": opp.required_documents,
        "attachments": [{**a, "url": file_url(a.get("file_id"))} for a in (opp.attachments or [])],
        "organization": {**(org_mini(org) or {}), "tagline": org.tagline if org else None,
                         "website": org.website if org else None},
        "verified_at": opp.verified_at,
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
                "form_questions": opp.form_questions or [],
                "verification_checklist": opp.verification_checklist or {},
                "checklist_complete": checklist_complete(opp)})
    return out


def checklist_complete(opp: Opportunity) -> bool:
    done = opp.verification_checklist or {}
    return all(done.get(k) in ("yes", "na") for k in CHECKLIST_KEYS)


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
    if action in PUBLISHING:
        if org.verification == Verification.pending or org.status != OrgStatus.active:
            raise HTTPException(409, "Verify the organization before publishing its opportunities")
        if not checklist_complete(opp):
            raise HTTPException(409, "Complete the verification checklist before publishing")
        opp.verified_at = opp.verified_at or utcnow()
        if opp.deadline and opp.deadline < utcnow():
            raise HTTPException(409, "The deadline has passed. Update it before publishing.")
    if action in ("request_info", "reject", "suspend") and not (note or "").strip():
        raise HTTPException(422, "Add a note explaining why")
    opp.reviewed_by_id = actor_id
    await transition(session, opp, target, actor_id, note)
    org_users = (await session.execute(select(User.id).where(User.organization_id == opp.organization_id,
                                                             User.status == UserStatus.active))).scalars().all()
    titles = {
        S.info_requested: ("DEEN needs more information", f'"{opp.title}": {note}'),
        S.published: ("Your opportunity is live", f'"{opp.title}" is now published to DEEN members.'),
        S.rejected: ("Submission declined", f'"{opp.title}": {note}'),
        S.approved: ("Approved", f'"{opp.title}" was approved and will be published shortly.'),
        S.suspended: ("Opportunity suspended", f'"{opp.title}" was taken down pending review: {note}'),
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
    if opp.counties and opp.work_mode != "remote" and not opp.is_international:
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
    # Spec section 21: strong matches, followers of the organization, and members who chose
    # this category and are in its location all hear about a new opportunity.
    matches: list[str] = []
    local: list[str] = []
    for profile, _ in rows:
        m = evaluate(opp, MemberSignals.from_profile(profile))
        if not m.eligible:
            continue
        in_area = opp.work_mode == "remote" or not opp.counties or profile.county in opp.counties
        if m.score >= settings.match_notify_threshold or profile.user_id in followers:
            matches.append(profile.user_id)
        elif opp.category in (profile.interests or []) and in_area:
            local.append(profile.user_id)
    data = {"screen": "opportunity", "id": opp.id}
    if matches:
        await notify(session, matches, kind="matches", title="New opportunity matching your profile",
                     body=f"{opp.title} · {org.name}", data=data)
    if local:
        where = f" in {opp.counties[0]}" if len(opp.counties) == 1 else ""
        await notify(session, local, kind="matches", title=f"New in a category you follow{where}",
                     body=f"{opp.title} · {org.name}", data=data)
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

    await send_deadline_reminders(session, now)


# Reminder stages for saved opportunities (spec section 20): 7 days, 3 days, 1 day before closing.
REMINDER_STAGES = ((3, 1), (2, 3), (1, 7))  # (stage, days before deadline), tightest first


async def send_deadline_reminders(session: AsyncSession, now) -> None:
    type_names = dict((await session.execute(select(OpportunityType.key, OpportunityType.name))).all())
    rows = (await session.execute(
        select(SavedOpportunity, Opportunity)
        .join(Opportunity, Opportunity.id == SavedOpportunity.opportunity_id)
        .where(Opportunity.status == S.published, SavedOpportunity.reminder_stage < 3,
               Opportunity.deadline.between(now, now + timedelta(days=7)))
        .limit(10000)
    )).all()
    batches: dict[tuple[str, int], tuple[Opportunity, list[str]]] = {}
    for saved, opp in rows:
        days_left = (opp.deadline - now).total_seconds() / 86400
        stage = next((st for st, d in REMINDER_STAGES if days_left <= d), 0)
        if stage > saved.reminder_stage:
            saved.reminder_stage, saved.reminded_at = stage, now
            batches.setdefault((opp.id, stage), (opp, []))[1].append(saved.user_id)
    for (_, stage), (opp, users) in batches.items():
        # Anyone who already sent their application doesn't need a nudge ("started" still does).
        done = set((await session.execute(select(Application.user_id).where(
            Application.opportunity_id == opp.id, Application.user_id.in_(users),
            Application.status != "started"))).scalars())
        pending = [u for u in users if u not in done]
        if not pending:
            continue
        kind = type_names.get(opp.type, "Opportunity")
        when = {3: "tomorrow", 2: "in 3 days", 1: "in 7 days"}[stage]
        await notify(session, pending, kind="deadlines", title=f"Your saved {kind.lower()} closes {when}",
                     body=f"{opp.title}. Apply before the deadline.", data={"screen": "opportunity", "id": opp.id},
                     channels_=("push", "email") if stage == 3 else ("push",))


async def counts_by_category(session: AsyncSession) -> dict[str, int]:
    rows = await session.execute(select(Opportunity.category, func.count()).where(live_filter())
                                 .group_by(Opportunity.category))
    return {k: v for k, v in rows.all()}
