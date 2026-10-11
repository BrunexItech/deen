from __future__ import annotations

from datetime import datetime

from sqlalchemy import ARRAY, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Announcement(Base):
    __tablename__ = "announcements"

    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    # all | members (paid) | free (not paid) | county | organizations
    audience: Mapped[str] = mapped_column(String(20), default="all")
    counties: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
    channels: Mapped[list[str]] = mapped_column(ARRAY(String(10)), default=list)
    sent_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    sent_at: Mapped[datetime | None]
    recipients: Mapped[int] = mapped_column(Integer, default=0)
