from __future__ import annotations

import enum

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum


class AppStatus(str, enum.Enum):
    submitted = "submitted"
    in_review = "in_review"
    shortlisted = "shortlisted"
    interview = "interview"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"


class Application(Base):
    __tablename__ = "applications"

    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[AppStatus] = mapped_column(pg_enum(AppStatus, "app_status"), default=AppStatus.submitted, index=True)
    cover_note: Mapped[str | None] = mapped_column(Text)
    answers: Mapped[dict | None] = mapped_column(JSON, default=dict)
    documents: Mapped[list | None] = mapped_column(JSON, default=list)  # [{file_id, label}]
    # Snapshot of the profile at submission: orgs see what the member sent, even if it changes later.
    profile_snapshot: Mapped[dict | None] = mapped_column(JSON)
    match_score: Mapped[int | None]
    org_notes: Mapped[str | None] = mapped_column(Text)  # private to the organization

    __table_args__ = (UniqueConstraint("opportunity_id", "user_id"),)


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20))
    message: Mapped[str | None] = mapped_column(Text)  # shown to the applicant


class Outcome(Base):
    """"This opportunity changed my life" — the impact metric DEEN measures itself by."""

    __tablename__ = "outcomes"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[str] = mapped_column(String(36), index=True)
    story: Mapped[str | None] = mapped_column(Text)
    share_publicly: Mapped[bool] = mapped_column(default=False)

    __table_args__ = (UniqueConstraint("user_id", "opportunity_id"),)
