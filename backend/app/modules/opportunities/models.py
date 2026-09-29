from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (ARRAY, JSON, Boolean, Computed, ForeignKey, Index, Integer, Numeric, String, Text,
                        UniqueConstraint)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum


class OppStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    info_requested = "info_requested"
    verification = "verification"
    approved = "approved"
    published = "published"
    rejected = "rejected"
    expired = "expired"
    archived = "archived"


class ApplyMode(str, enum.Enum):
    external = "external"
    internal = "internal"


class AccessTier(str, enum.Enum):
    free = "free"
    member = "member"
    premium = "premium"


TIER_RANK = {AccessTier.free: 0, AccessTier.member: 1, AccessTier.premium: 2}


class Opportunity(Base):
    __tablename__ = "opportunities"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(String(400), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list)

    eligibility: Mapped[str] = mapped_column(Text, default="")
    benefits: Mapped[str] = mapped_column(Text, default="")
    requirements: Mapped[str] = mapped_column(Text, default="")
    application_process: Mapped[str] = mapped_column(Text, default="")

    # Location: empty counties + not remote = anywhere in Kenya.
    counties: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
    location_label: Mapped[str | None] = mapped_column(String(160))
    is_remote: Mapped[bool] = mapped_column(Boolean, default=False)
    is_international: Mapped[bool] = mapped_column(Boolean, default=False)

    # Structured eligibility used by the matching engine.
    education_levels: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list)
    min_age: Mapped[int | None] = mapped_column(Integer)
    max_age: Mapped[int | None] = mapped_column(Integer)
    gender: Mapped[str | None] = mapped_column(String(10))  # None = everyone
    skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list)
    requires_verified_identity: Mapped[bool] = mapped_column(Boolean, default=False)

    deadline: Mapped[datetime | None] = mapped_column(index=True)
    starts_at: Mapped[datetime | None]  # events / programme start
    ends_at: Mapped[datetime | None]
    venue: Mapped[str | None] = mapped_column(String(200))
    is_event: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    amount_min: Mapped[float | None] = mapped_column(Numeric(14, 2))
    amount_max: Mapped[float | None] = mapped_column(Numeric(14, 2))
    amount_label: Mapped[str | None] = mapped_column(String(80))  # "Full tuition", "KES 40k–60k / month"
    slots: Mapped[int | None] = mapped_column(Integer)

    apply_mode: Mapped[ApplyMode] = mapped_column(pg_enum(ApplyMode, "apply_mode"), default=ApplyMode.external)
    external_url: Mapped[str | None] = mapped_column(String(500))
    form_questions: Mapped[list | None] = mapped_column(JSON, default=list)  # [{id,label,kind,required,options}]
    required_documents: Mapped[list[str]] = mapped_column(ARRAY(String(80)), default=list)
    attachments: Mapped[list | None] = mapped_column(JSON, default=list)  # [{file_id, label}]

    access_tier: Mapped[AccessTier] = mapped_column(pg_enum(AccessTier, "access_tier"), default=AccessTier.free)
    status: Mapped[OppStatus] = mapped_column(pg_enum(OppStatus, "opp_status"), default=OppStatus.draft, index=True)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    featured_until: Mapped[datetime | None]
    feature_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    flags: Mapped[list | None] = mapped_column(JSON, default=list)  # automated risk flags [{code,severity,message}]
    risk_score: Mapped[int] = mapped_column(Integer, default=0)

    submitted_at: Mapped[datetime | None]
    published_at: Mapped[datetime | None] = mapped_column(index=True)
    reviewed_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    # Denormalised counters: cheap reads on hot lists, updated with atomic UPDATE ... +1.
    views_count: Mapped[int] = mapped_column(Integer, default=0)
    clicks_count: Mapped[int] = mapped_column(Integer, default=0)
    saves_count: Mapped[int] = mapped_column(Integer, default=0)
    applications_count: Mapped[int] = mapped_column(Integer, default=0)

    search_tsv = mapped_column(
        TSVECTOR,
        Computed(
            "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
            "setweight(to_tsvector('english', coalesce(summary, '')), 'B') || "
            "setweight(to_tsvector('english', coalesce(description, '')), 'C')",
            persisted=True,
        ),
    )

    __table_args__ = (
        Index("ix_opportunities_search", "search_tsv", postgresql_using="gin"),
        Index("ix_opportunities_counties", "counties", postgresql_using="gin"),
        Index("ix_opportunities_live", "status", "category", "deadline"),
    )


class ReviewEvent(Base):
    """Immutable history of every status change (who, when, why)."""

    __tablename__ = "opportunity_review_events"

    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text)


class ReviewMessage(Base):
    """Conversation between DEEN reviewers and the organization about a submission.
    `internal` notes are visible to DEEN staff only."""

    __tablename__ = "opportunity_review_messages"

    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(Text)
    internal: Mapped[bool] = mapped_column(Boolean, default=False)
    from_platform: Mapped[bool] = mapped_column(Boolean, default=False)


class SavedOpportunity(Base):
    __tablename__ = "saved_opportunities"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    reminded_at: Mapped[datetime | None]

    __table_args__ = (UniqueConstraint("user_id", "opportunity_id"),)


class EngagementEvent(Base):
    """Append-only engagement stream (view/click/save/share/apply) for analytics and
    the intelligence layer. At scale this table is partitioned by month (see docs)."""

    __tablename__ = "engagement_events"

    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    organization_id: Mapped[str] = mapped_column(String(36), index=True)
    kind: Mapped[str] = mapped_column(String(12), index=True)
    county: Mapped[str | None] = mapped_column(String(40))
