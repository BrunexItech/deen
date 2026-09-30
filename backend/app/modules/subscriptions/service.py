"""Memberships: what tier a member is on, what that unlocks, and activating a paid plan."""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.modules.opportunities.models import TIER_RANK, AccessTier
from app.modules.subscriptions.models import Plan, Subscription, SubStatus

FREE_FEATURES = {"monthly_applications": 3, "advanced_matching": False, "premium_opportunities": False,
                 "mentorship": False, "priority_support": False}


async def active_subscription(session: AsyncSession, user_id: str) -> tuple[Subscription, Plan] | None:
    row = (await session.execute(
        select(Subscription, Plan).join(Plan, Plan.id == Subscription.plan_id)
        .where(Subscription.user_id == user_id, Subscription.status == SubStatus.active,
               Subscription.ends_at > utcnow())
        .order_by(Subscription.ends_at.desc()).limit(1)
    )).first()
    return (row[0], row[1]) if row else None


async def free_plan(session: AsyncSession) -> Plan | None:
    return await session.scalar(select(Plan).where(Plan.tier == "free", Plan.active.is_(True)).order_by(Plan.sort))


async def current_membership(session: AsyncSession, user_id: str) -> dict:
    active = await active_subscription(session, user_id)
    if active:
        sub, plan = active
        return {"tier": plan.tier, "plan_code": plan.code, "plan_name": plan.name, "ends_at": sub.ends_at,
                "features": {**FREE_FEATURES, **(plan.features or {})}, "sponsored": sub.sponsored_by_id is not None}
    plan = await free_plan(session)
    return {"tier": "free", "plan_code": plan.code if plan else "free", "plan_name": plan.name if plan else "Free",
            "ends_at": None, "features": {**FREE_FEATURES, **((plan.features or {}) if plan else {})},
            "sponsored": False}


def tier_allows(member_tier: str, required: AccessTier | str) -> bool:
    required = AccessTier(required) if isinstance(required, str) else required
    return TIER_RANK[AccessTier(member_tier)] >= TIER_RANK[required]


async def activate(session: AsyncSession, user_id: str, plan: Plan, sponsored_by: str | None = None) -> Subscription:
    """Extends from the end of the current paid period, so renewing early never loses days."""
    now = utcnow()
    current = await active_subscription(session, user_id)
    start = current[0].ends_at if current and current[1].tier == plan.tier else now
    if current and current[1].tier != plan.tier:
        current[0].status = SubStatus.cancelled  # plan change: new period starts today
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
