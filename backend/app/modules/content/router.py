from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.clock import today_local
from app.core.deps import DB, CurrentUser
from app.modules.announcements.models import Announcement
from app.modules.content.data import DEFAULT_ZAKAT
from app.modules.content.models import PlatformSetting, Reminder

router = APIRouter(prefix="/api/v1/content", tags=["content"])


def reminder_out(r: Reminder) -> dict:
    return {"id": r.id, "kind": r.kind, "arabic": r.arabic, "text": r.text, "reference": r.reference,
            "theme": r.theme}


async def get_setting(session, key: str, default):
    row = await session.scalar(select(PlatformSetting).where(PlatformSetting.key == key))
    return {**default, **(row.value or {})} if row and isinstance(default, dict) else (row.value if row else default)


@router.get("/today")
async def today(p: CurrentUser, session: DB):
    """Reminder of the day: the same for everyone on a given day, rotating through the library."""
    total = await session.scalar(select(func.count()).select_from(Reminder).where(Reminder.active.is_(True))) or 0
    reminder = None
    if total:
        idx = today_local().toordinal() % total
        reminder = await session.scalar(select(Reminder).where(Reminder.active.is_(True))
                                        .order_by(Reminder.sort, Reminder.id).offset(idx).limit(1))
    return {"reminder": reminder_out(reminder) if reminder else None,
            "zakat": await get_setting(session, "zakat", DEFAULT_ZAKAT)}


@router.get("/reminders")
async def reminders(p: CurrentUser, session: DB, kind: str | None = None):
    stmt = select(Reminder).where(Reminder.active.is_(True))
    if kind:
        stmt = stmt.where(Reminder.kind == kind)
    return [reminder_out(r) for r in (await session.execute(stmt.order_by(Reminder.sort))).scalars()]


@router.get("/zakat")
async def zakat(p: CurrentUser, session: DB):
    return await get_setting(session, "zakat", DEFAULT_ZAKAT)


@router.get("/announcements")
async def announcements(p: CurrentUser, session: DB):
    rows = (await session.execute(select(Announcement).where(Announcement.sent_at.is_not(None))
                                  .order_by(Announcement.sent_at.desc()).limit(10))).scalars()
    return [{"id": a.id, "title": a.title, "body": a.body, "sent_at": a.sent_at} for a in rows]
