from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Job(Base):
    """Durable background job queue on Postgres (FOR UPDATE SKIP LOCKED). Any number
    of worker processes can drain it concurrently; no extra broker to operate."""

    __tablename__ = "jobs"

    kind: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(12), default="queued")  # queued | running | done | failed
    run_after: Mapped[datetime]
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    last_error: Mapped[str | None] = mapped_column(Text)
    locked_at: Mapped[datetime | None]
    dedupe_key: Mapped[str | None] = mapped_column(String(120), unique=True)

    __table_args__ = (Index("ix_jobs_ready", "status", "run_after"),)
