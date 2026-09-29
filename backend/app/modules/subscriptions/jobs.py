from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.modules.jobs.service import handler
from app.modules.notifications.service import notify
from app.modules.subscriptions.models import Plan, Subscription, SubStatus


@handler("subscriptions.maintenance")
async def maintenance(session: AsyncSession, payload: dict) -> None:
    now = utcnow()
    ended = (await session.execute(select(Subscription).where(
        Subscription.status == SubStatus.active, Subscription.ends_at <= now).limit(5000))).scalars().all()
    for sub in ended:
        sub.status = SubStatus.expired
    if ended:
        await notify(session, [s.user_id for s in ended], kind="subscription", title="Your membership has ended",
                     body="Renew anytime to keep full access to opportunities and matching.",
                     data={"screen": "membership"})
    expiring = (await session.execute(
        select(Subscription, Plan.name).join(Plan, Plan.id == Subscription.plan_id).where(
            Subscription.status == SubStatus.active, Subscription.renewal_reminded_at.is_(None),
            Subscription.ends_at.between(now, now + timedelta(days=3))).limit(5000))).all()
    for sub, _ in expiring:
        sub.renewal_reminded_at = now
    if expiring:
        await notify(session, [s.user_id for s, _ in expiring], kind="subscription",
                     title="Membership ending soon", body="Your DEEN membership ends in 3 days. Renew to stay covered.",
                     data={"screen": "membership"}, channels_=("push", "sms"))
