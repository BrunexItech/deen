from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

# Notification kinds a member can switch per channel.
KINDS = ("matches", "deadlines", "applications", "subscription", "announcements", "organizations", "reminders")
CHANNELS = ("push", "email", "sms")

DEFAULT_PREFS = {
    "push": {k: True for k in KINDS},
    "email": {k: k in ("applications", "subscription", "announcements") for k in KINDS},
    "sms": {k: k in ("subscription",) for k in KINDS},
    "quiet_hours": {"enabled": True, "start": 22, "end": 6},
    "digest": "instant",  # instant | daily
}


class Notification(Base):
    __tablename__ = "notifications"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    data: Mapped[dict | None] = mapped_column(JSON, default=dict)  # deep link target, ids
    read_at: Mapped[datetime | None]

    __table_args__ = (Index("ix_notifications_user_created", "user_id", "created_at"),)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    prefs: Mapped[dict] = mapped_column(JSON, default=lambda: dict(DEFAULT_PREFS))


class PushToken(Base):
    __tablename__ = "push_tokens"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(200), unique=True)
    platform: Mapped[str] = mapped_column(String(20), default="android")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
