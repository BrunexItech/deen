"""Notify users: an in-app row immediately, then push/email/SMS delivered by a
background job that honours each member's channel preferences and quiet hours."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import TZ, utcnow
from app.modules.jobs.service import enqueue, handler
from app.modules.notifications import channels
from app.modules.notifications.models import DEFAULT_PREFS, Notification, NotificationPreference, PushToken
from app.modules.users.models import User, UserStatus


def merged_prefs(stored: dict | None) -> dict:
    prefs = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULT_PREFS.items()}
    for key, value in (stored or {}).items():
        if isinstance(value, dict) and isinstance(prefs.get(key), dict):
            prefs[key].update(value)
        else:
            prefs[key] = value
    return prefs


def in_quiet_hours(prefs: dict, now: datetime | None = None) -> bool:
    q = prefs.get("quiet_hours") or {}
    if not q.get("enabled"):
        return False
    hour = (now or datetime.now(TZ)).astimezone(TZ).hour
    start, end = int(q.get("start", 22)), int(q.get("end", 6))
    return hour >= start or hour < end if start > end else start <= hour < end


async def notify(session: AsyncSession, user_ids: list[str], *, kind: str, title: str, body: str,
                 data: dict | None = None, channels_: tuple[str, ...] = ("push",)) -> None:
    """Joins the caller's transaction. Large audiences are chunked so one INSERT and
    one job never grow unbounded."""
    if not user_ids:
        return
    now = utcnow()
    for i in range(0, len(user_ids), 1000):
        chunk = user_ids[i:i + 1000]
        await session.execute(insert(Notification), [
            {"id": str(uuid4()), "user_id": uid, "kind": kind, "title": title, "body": body, "data": data or {},
             "created_at": now, "updated_at": now} for uid in chunk
        ])
        await enqueue(session, "deliver", {"user_ids": chunk, "kind": kind, "title": title, "body": body,
                                           "data": data or {}, "channels": list(channels_)})


@handler("deliver")
async def deliver(session: AsyncSession, p: dict) -> None:
    user_ids: list[str] = p["user_ids"]
    kind, title, body, data = p["kind"], p["title"], p["body"], p.get("data") or {}
    wanted = set(p.get("channels") or ["push"])

    prefs = {row.user_id: merged_prefs(row.prefs) for row in (await session.execute(
        select(NotificationPreference).where(NotificationPreference.user_id.in_(user_ids)))).scalars()}
    users = {u.id: u for u in (await session.execute(
        select(User).where(User.id.in_(user_ids), User.status == UserStatus.active))).scalars()}

    def allowed(uid: str, channel: str) -> bool:
        pr = prefs.get(uid) or merged_prefs(None)
        return bool((pr.get(channel) or {}).get(kind, False))

    if "push" in wanted:
        tokens = (await session.execute(
            select(PushToken).where(PushToken.user_id.in_(list(users)), PushToken.active.is_(True)))).scalars().all()
        messages = []
        for t in tokens:
            if not allowed(t.user_id, "push"):
                continue
            quiet = in_quiet_hours(prefs.get(t.user_id) or merged_prefs(None))
            messages.append({"to": t.token, "title": title, "body": body, "data": data,
                             "sound": None if quiet else "default", "channelId": "default", "priority": "high"})
        tickets = await channels.send_push(messages)
        # Expo tells us which tokens are dead; stop sending to them.
        for msg, ticket in zip(messages, tickets):
            if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                for t in tokens:
                    if t.token == msg["to"]:
                        t.active = False

    if "email" in wanted:
        for uid, user in users.items():
            if user.email and allowed(uid, "email"):
                await channels.send_email(user.email, title, body, channels.branded_email(title, body))

    if "sms" in wanted:
        for uid, user in users.items():
            if user.phone and allowed(uid, "sms"):
                await channels.send_sms(user.phone, f"DEEN: {title}. {body}"[:300])
