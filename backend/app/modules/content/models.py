from __future__ import annotations

from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Reminder(Base):
    """Curated daily reflections (Qur'an, hadith, du'a) shown on the home screen.
    Managed by content managers; every item carries its source reference."""

    __tablename__ = "reminders"

    kind: Mapped[str] = mapped_column(String(10))  # ayah | hadith | dua
    arabic: Mapped[str | None] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)  # English meaning
    reference: Mapped[str] = mapped_column(String(160))
    theme: Mapped[str | None] = mapped_column(String(40))  # knowledge | provision | work | patience | charity
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class PlatformSetting(Base):
    """Small key/value store for values admins change without a deploy
    (zakat nisab prices, support contacts, feature switches)."""

    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(60), unique=True)
    value: Mapped[dict | None] = mapped_column(JSON)
