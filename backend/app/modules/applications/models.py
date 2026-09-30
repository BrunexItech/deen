from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum


class AppStatus(str, enum.Enum):
    started = "started"  # member is preparing it (self-tracked)
    submitted = "submitted"
    in_review = "in_review"
    shortlisted = "shortlisted"
    interview = "interview"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"
    closed = "closed"  # application window ended without a decision recorded


class Application(Base):
    __tablename__ = "applications"

    # Null for applications the member made entirely outside DEEN and records manually.
    opportunity_id: Mapped[str | None] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(10), default="deen")  # deen | external | manual
    manual_title: Mapped[str | None] = mapped_column(String(200))
    manual_organization: Mapped[str | None] = mapped_column(String(160))
    manual_url: Mapped[str | None] = mapped_column(String(500))
    manual_deadline: Mapped[datetime | None]
    member_notes: Mapped[str | None] = mapped_column(Text)
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


class Experience(Base):
    """DEEN Experience Builder (spec section 27): the member's record of what they have done,
    optionally linked to a DEEN opportunity (then shown as verified-through-DEEN)."""

    __tablename__ = "experiences"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # volunteer|attachment|internship|job|training|workshop|fellowship|competition|mentorship|education|other
    title: Mapped[str] = mapped_column(String(160))
    organization: Mapped[str] = mapped_column(String(160))
    location: Mapped[str | None] = mapped_column(String(120))
    start_date: Mapped[datetime | None]
    end_date: Mapped[datetime | None]
    description: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[list | None] = mapped_column(JSON, default=list)
    opportunity_id: Mapped[str | None] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"))
    verified: Mapped[bool] = mapped_column(default=False)  # accepted through DEEN
