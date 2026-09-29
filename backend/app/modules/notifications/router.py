from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update

from app.core.clock import utcnow
from app.core.deps import DB, CurrentUser
from app.core.pagination import finish, keyset
from app.modules.notifications.models import CHANNELS, KINDS, Notification, NotificationPreference, PushToken
from app.modules.notifications.service import merged_prefs

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


def _out(n: Notification) -> dict:
    return {"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "data": n.data or {},
            "read": n.read_at is not None, "created_at": n.created_at}


@router.get("")
async def list_notifications(p: CurrentUser, session: DB, cursor: str | None = None, limit: int = 30):
    limit = max(1, min(limit, 100))
    stmt = keyset(select(Notification).where(Notification.user_id == p.id), Notification, cursor, limit)
    rows, nxt = finish((await session.execute(stmt)).scalars().all(), limit)
    return {"items": [_out(n) for n in rows], "next_cursor": nxt}


@router.get("/unread-count")
async def unread_count(p: CurrentUser, session: DB):
    count = await session.scalar(select(func.count()).select_from(Notification).where(
        Notification.user_id == p.id, Notification.read_at.is_(None)))
    return {"count": count or 0}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, p: CurrentUser, session: DB):
    await session.execute(update(Notification).where(
        Notification.id == notification_id, Notification.user_id == p.id).values(read_at=utcnow()))
    await session.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(p: CurrentUser, session: DB):
    await session.execute(update(Notification).where(
        Notification.user_id == p.id, Notification.read_at.is_(None)).values(read_at=utcnow()))
    await session.commit()
    return {"ok": True}


@router.get("/preferences")
async def get_prefs(p: CurrentUser, session: DB):
    row = await session.scalar(select(NotificationPreference).where(NotificationPreference.user_id == p.id))
    return {"prefs": merged_prefs(row.prefs if row else None), "kinds": KINDS, "channels": CHANNELS}


class PrefsIn(BaseModel):
    prefs: dict


@router.put("/preferences")
async def put_prefs(body: PrefsIn, p: CurrentUser, session: DB):
    clean: dict = {}
    for ch in CHANNELS:
        if isinstance(body.prefs.get(ch), dict):
            clean[ch] = {k: bool(v) for k, v in body.prefs[ch].items() if k in KINDS}
    q = body.prefs.get("quiet_hours")
    if isinstance(q, dict):
        clean["quiet_hours"] = {"enabled": bool(q.get("enabled")), "start": int(q.get("start", 22)) % 24,
                                "end": int(q.get("end", 6)) % 24}
    if body.prefs.get("digest") in ("instant", "daily"):
        clean["digest"] = body.prefs["digest"]
    row = await session.scalar(select(NotificationPreference).where(NotificationPreference.user_id == p.id))
    merged = merged_prefs({**(row.prefs if row else {}), **clean})
    if row:
        row.prefs = merged
    else:
        session.add(NotificationPreference(user_id=p.id, prefs=merged))
    await session.commit()
    return {"prefs": merged}


class PushIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    platform: str = "android"


@router.post("/push-tokens")
async def register_push(body: PushIn, p: CurrentUser, session: DB):
    if not body.token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        raise HTTPException(422, "Unrecognised push token")
    row = await session.scalar(select(PushToken).where(PushToken.token == body.token))
    if row:  # a phone changing hands moves its token to the new account
        row.user_id, row.active, row.platform = p.id, True, body.platform
    else:
        session.add(PushToken(user_id=p.id, token=body.token, platform=body.platform))
    await session.commit()
    return {"ok": True}


@router.delete("/push-tokens")
async def unregister_push(body: PushIn, p: CurrentUser, session: DB):
    await session.execute(update(PushToken).where(PushToken.token == body.token, PushToken.user_id == p.id)
                          .values(active=False))
    await session.commit()
    return {"ok": True}
