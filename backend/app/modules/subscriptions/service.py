"""Membership: one community maintenance fee, whether a member has paid it, and activating a payment."""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.modules.opportunities.models import AccessTier
from app.modules.subscriptions.models import Plan, Subscription, SubStatus

COMMUNITY_CODE = "community"
DEFAULT_FREE_APPLICATIONS = 3


async def fee_plan(session: AsyncSession) -> Plan | None:
    """The one community maintenance fee. Its amount, period and what it covers are set
    by the super admin in the Control Center; nothing about pricing lives in code."""
    return await session.scalar(select(Plan).where(Plan.code == COMMUNITY_CODE))


def fee_out(plan: Plan | None) -> dict:
    if not plan:
        return {"amount_kes": 0, "period_months": 1, "covers": [], "free_monthly_applications": None,
                "active": False, "note": None}
    features = plan.features or {}
    return {"amount_kes": float(plan.price_kes), "period_months": plan.interval_months, "covers": plan.benefits or [],
            "free_monthly_applications": features.get("free_monthly_applications", DEFAULT_FREE_APPLICATIONS),
            "active": plan.active and float(plan.price_kes) > 0, "note": plan.tagline}


async def active_subscription(session: AsyncSession, user_id: str) -> tuple[Subscription, Plan] | None:
    row = (await session.execute(
        select(Subscription, Plan).join(Plan, Plan.id == Subscription.plan_id)
        .where(Subscription.user_id == user_id, Subscription.status == SubStatus.active,
               Subscription.ends_at > utcnow())
        .order_by(Subscription.ends_at.desc()).limit(1)
    )).first()
    return (row[0], row[1]) if row else None


async def current_membership(session: AsyncSession, user_id: str) -> dict:
    """Paid up, or not. There are no packages: every paying member gets the same access."""
    active = await active_subscription(session, user_id)
    if active:
        sub, _ = active
        return {"tier": "member", "paid": True, "ends_at": sub.ends_at, "sponsored": sub.sponsored_by_id is not None,
                "features": {"monthly_applications": None}}
    fee = fee_out(await fee_plan(session))
    # When the admin switches the fee off, nobody is limited.
    limit = fee["free_monthly_applications"] if fee["active"] else None
    return {"tier": "free", "paid": False, "ends_at": None, "sponsored": False,
            "features": {"monthly_applications": limit}}


def tier_allows(member_tier: str, required: AccessTier | str) -> bool:
    required = AccessTier(required) if isinstance(required, str) else required
    # Any paid membership opens member-only opportunities (legacy "premium" included).
    return required == AccessTier.free or member_tier != "free"


async def activate(session: AsyncSession, user_id: str, plan: Plan, sponsored_by: str | None = None) -> Subscription:
    """Extends from the end of the current paid period, so paying early never loses days."""
    current = await active_subscription(session, user_id)
    start = current[0].ends_at if current else utcnow()
    sub = Subscription(user_id=user_id, plan_id=plan.id, status=SubStatus.active, starts_at=start,
                       ends_at=start + timedelta(days=30 * plan.interval_months), sponsored_by_id=sponsored_by)
    session.add(sub)
    await session.flush()
    return sub


async def applications_this_month(session: AsyncSession, user_id: str) -> int:
    from app.modules.applications.models import Application

    start = utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Only applications sent through DEEN count towards the plan limit, never self-tracked ones.
    return await session.scalar(select(func.count()).select_from(Application).where(
        Application.user_id == user_id, Application.source == "deen", Application.created_at >= start)) or 0
