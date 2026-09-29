"""Control Center analytics: the platform at a glance."""
from datetime import timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.clock import local_day, utcnow
from app.core.deps import DB, require
from app.core.roles import Perm, Role
from app.modules.applications.models import Application, AppStatus, Outcome
from app.modules.identity.models import IdentityVerification
from app.modules.moderation.models import Report, ReportStatus
from app.modules.opportunities.models import EngagementEvent, Opportunity, OppStatus
from app.modules.orgs.models import Organization, Verification
from app.modules.subscriptions.models import Payment, PayStatus, Plan, Subscription, SubStatus
from app.modules.directory.models import DirectoryListing, ListingStatus
from app.modules.users.models import MemberProfile, User, UserStatus

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

REVIEW_QUEUE = (OppStatus.submitted, OppStatus.under_review, OppStatus.verification)


_day = local_day


async def _series(session, col, where, since) -> dict[str, int]:
    rows = await session.execute(select(_day(col), func.count()).where(col >= since, *where)
                                 .group_by(_day(col)).order_by(_day(col)))
    return {d.isoformat(): n for d, n in rows.all()}


@router.get("/overview", dependencies=[require(Perm.analytics_view)])
async def overview(session: DB, days: int = 30):
    days = max(7, min(days, 365))
    now = utcnow()
    since = now - timedelta(days=days)
    members = [User.role == Role.member, User.status == UserStatus.active]

    total_members = await session.scalar(select(func.count()).select_from(User).where(*members))
    new_members = await session.scalar(select(func.count()).select_from(User).where(*members, User.created_at >= since))
    active_7d = await session.scalar(select(func.count()).select_from(User).where(
        *members, User.last_active_at >= now - timedelta(days=7)))
    active_30d = await session.scalar(select(func.count()).select_from(User).where(
        *members, User.last_active_at >= now - timedelta(days=30)))
    paying = await session.scalar(select(func.count(func.distinct(Subscription.user_id))).where(
        Subscription.status == SubStatus.active, Subscription.ends_at > now))
    orgs = dict((await session.execute(select(Organization.verification, func.count())
                                       .group_by(Organization.verification))).all())
    opp_status = dict((await session.execute(select(Opportunity.status, func.count())
                                             .group_by(Opportunity.status))).all())
    apps_total = await session.scalar(select(func.count()).select_from(Application))
    accepted = await session.scalar(select(func.count()).select_from(Application).where(
        Application.status == AppStatus.accepted))
    outcomes = await session.scalar(select(func.count()).select_from(Outcome))
    revenue_period = await session.scalar(select(func.coalesce(func.sum(Payment.amount_kes), 0)).where(
        Payment.status == PayStatus.success, Payment.settled_at >= since))
    revenue_all = await session.scalar(select(func.coalesce(func.sum(Payment.amount_kes), 0)).where(
        Payment.status == PayStatus.success))

    signups = await _series(session, User.created_at, members, since)
    applications = await _series(session, Application.created_at, [], since)
    views = await _series(session, EngagementEvent.created_at, [EngagementEvent.kind == "view"], since)
    rev_rows = await session.execute(select(_day(Payment.settled_at), func.sum(Payment.amount_kes)).where(
        Payment.status == PayStatus.success, Payment.settled_at >= since)
        .group_by(_day(Payment.settled_at)))
    revenue = {d.isoformat(): float(v) for d, v in rev_rows.all()}
    series = []
    for i in range(days, -1, -1):
        d = (now - timedelta(days=i)).astimezone().date().isoformat()
        series.append({"date": d, "signups": signups.get(d, 0), "applications": applications.get(d, 0),
                       "views": views.get(d, 0), "revenue": revenue.get(d, 0)})

    categories = await session.execute(
        select(Opportunity.category, func.count(), func.coalesce(func.sum(Opportunity.views_count), 0),
               func.coalesce(func.sum(Opportunity.applications_count), 0))
        .where(Opportunity.published_at.is_not(None)).group_by(Opportunity.category))
    counties = await session.execute(
        select(MemberProfile.county, func.count()).join(User, User.id == MemberProfile.user_id)
        .where(*members, MemberProfile.county.is_not(None)).group_by(MemberProfile.county)
        .order_by(func.count().desc()))
    demand = dict((await session.execute(
        select(EngagementEvent.county, func.count()).where(EngagementEvent.county.is_not(None),
                                                           EngagementEvent.created_at >= since)
        .group_by(EngagementEvent.county))).all())
    supply = {}
    for county, n in (await session.execute(
            select(func.unnest(Opportunity.counties), func.count()).where(Opportunity.status == OppStatus.published)
            .group_by(func.unnest(Opportunity.counties)))).all():
        supply[county] = n
    top_orgs = await session.execute(
        select(Organization.id, Organization.name, Organization.verification, func.count(Opportunity.id),
               func.coalesce(func.sum(Opportunity.applications_count), 0))
        .join(Opportunity, Opportunity.organization_id == Organization.id)
        .where(Opportunity.published_at.is_not(None))
        .group_by(Organization.id).order_by(func.coalesce(func.sum(Opportunity.applications_count), 0).desc()).limit(8))
    top_opps = (await session.execute(select(Opportunity).where(Opportunity.published_at.is_not(None))
                                      .order_by(Opportunity.views_count.desc()).limit(8))).scalars().all()
    plan_mix = await session.execute(
        select(Plan.name, func.count()).join(Subscription, Subscription.plan_id == Plan.id)
        .where(Subscription.status == SubStatus.active, Subscription.ends_at > now).group_by(Plan.name))

    return {
        "kpis": {
            "members": total_members or 0, "new_members": new_members or 0, "active_7d": active_7d or 0,
            "active_30d": active_30d or 0, "paying_members": paying or 0,
            "organizations": sum(orgs.values()), "verified_orgs": orgs.get(Verification.verified, 0) + orgs.get(Verification.trusted, 0),
            "live_opportunities": opp_status.get(OppStatus.published, 0),
            "applications": apps_total or 0, "accepted": accepted or 0, "outcomes": outcomes or 0,
            "successful_connections": (accepted or 0) + (outcomes or 0),
            "revenue_period": float(revenue_period or 0), "revenue_all": float(revenue_all or 0),
        },
        "attention": {
            "review_queue": sum(opp_status.get(s, 0) for s in REVIEW_QUEUE),
            "info_requested": opp_status.get(OppStatus.info_requested, 0),
            "pending_orgs": orgs.get(Verification.pending, 0),
            "open_reports": await session.scalar(select(func.count()).select_from(Report).where(
                Report.status.in_([ReportStatus.open, ReportStatus.investigating]))) or 0,
            "identity_pending": await session.scalar(select(func.count()).select_from(IdentityVerification).where(
                IdentityVerification.status == "pending")) or 0,
            "directory_pending": await session.scalar(select(func.count()).select_from(DirectoryListing).where(
                DirectoryListing.status == ListingStatus.pending)) or 0,
        },
        "series": series,
        "opportunity_status": {k.value: v for k, v in opp_status.items()},
        "categories": [{"category": c, "opportunities": n, "views": int(v), "applications": int(a)}
                       for c, n, v, a in categories.all()],
        "counties": [{"county": c, "members": n, "demand": demand.get(c, 0), "supply": supply.get(c, 0)}
                     for c, n in counties.all()],
        "top_organizations": [{"id": i, "name": n, "verification": v.value, "opportunities": c, "applications": int(a)}
                              for i, n, v, c, a in top_orgs.all()],
        "top_opportunities": [{"id": o.id, "title": o.title, "category": o.category, "views": o.views_count,
                               "applications": o.applications_count, "saves": o.saves_count}
                              for o in top_opps],
        "plan_mix": [{"plan": n, "count": c} for n, c in plan_mix.all()],
    }
