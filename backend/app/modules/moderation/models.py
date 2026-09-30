from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum


class ReportStatus(str, enum.Enum):
    open = "open"
    investigating = "investigating"
    resolved = "resolved"
    dismissed = "dismissed"


# Spec section 23.
REPORT_REASONS = {
    "scam": "Fake opportunity",
    "fee": "Suspicious payment request",
    "fake_org": "Fake organization",
    "incorrect": "Incorrect information",
    "expired": "Expired opportunity",
    "misleading": "Misleading information",
    "other": "Something else",
}


class Report(Base):
    __tablename__ = "reports"

    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    target_type: Mapped[str] = mapped_column(String(20), index=True)  # opportunity | organization | directory
    target_id: Mapped[str] = mapped_column(String(36), index=True)
    reason: Mapped[str] = mapped_column(String(20))
    details: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ReportStatus] = mapped_column(pg_enum(ReportStatus, "report_status"), default=ReportStatus.open,
                                                 index=True)
    resolution_note: Mapped[str | None] = mapped_column(Text)
    handled_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    handled_at: Mapped[datetime | None]
