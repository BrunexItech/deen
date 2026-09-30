from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (ARRAY, JSON, Boolean, Computed, ForeignKey, Index, Integer, Numeric, String, Text,
                        UniqueConstraint)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.ext.hybrid import hybrid_property
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
    suspended = "suspended"  # pulled by DEEN (e.g. fraud reports) pending investigation
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

    # Location. Empty counties + physical = anywhere in Kenya.
    country: Mapped[str] = mapped_column(String(60), default="Kenya", index=True)
    counties: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
    location_label: Mapped[str | None] = mapped_column(String(160))
    work_mode: Mapped[str] = mapped_column(String(10), default="physical", index=True)  # physical | remote | hybrid
    is_international: Mapped[bool] = mapped_column(Boolean, default=False)
    # Nationalities / residences that may apply; empty = no restriction stated.
    eligible_countries: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list)

    # The shape of the role (attachments, internships, jobs, volunteering).
    industry: Mapped[str | None] = mapped_column(String(60), index=True)
    department: Mapped[str | None] = mapped_column(String(120))
    responsibilities: Mapped[str] = mapped_column(Text, default="")
    duration_label: Mapped[str | None] = mapped_column(String(80))  # "3 months", "12 weeks"
    duration_weeks: Mapped[int | None] = mapped_column(Integer)  # normalised, for filtering
    time_commitment: Mapped[str | None] = mapped_column(String(120))  # "Weekends, 4 hrs/day"
    compensation: Mapped[str] = mapped_column(String(12), default="undisclosed")  # paid|stipend|unpaid|undisclosed
    allowances: Mapped[str | None] = mapped_column(String(200))  # transport / meals
    certificate_provided: Mapped[bool] = mapped_column(Boolean, default=False)
    weekend: Mapped[bool] = mapped_column(Boolean, default=False)
    student_friendly: Mapped[bool] = mapped_column(Boolean, default=False)
    causes: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list)  # volunteer causes
    contact_email: Mapped[str | None] = mapped_column(String(254))
    contact_phone: Mapped[str | None] = mapped_column(String(20))

    # Structured eligibility used by the matching engine.
    education_levels: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list)
    min_age: Mapped[int | None] = mapped_column(Integer)
    max_age: Mapped[int | None] = mapped_column(Integer)
    gender: Mapped[str | None] = mapped_column(String(10))  # None = everyone
    skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list)
    fields_of_study: Mapped[list[str]] = mapped_column(ARRAY(String(80)), default=list)  # course requirements
    min_experience_years: Mapped[int | None] = mapped_column(Integer)
    target_user_types: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list)  # student, woman_entrepreneur…
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
    # Paid placement. Always labelled "Sponsored" to members (spec section 29).
    sponsored: Mapped[bool] = mapped_column(Boolean, default=False)
    islamic_tags: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list)
    # Required before tagging "shariah_conscious": who/what certifies it.
    shariah_basis: Mapped[str | None] = mapped_column(Text)
    # Admin verification checklist: {item_key: "yes" | "na"} (spec section 14).
    verification_checklist: Mapped[dict | None] = mapped_column(JSON, default=dict)
    verified_at: Mapped[datetime | None]
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

    @hybrid_property
    def is_remote(self) -> bool:
        return self.work_mode == "remote"

    @is_remote.inplace.expression
    @classmethod
    def _is_remote_expr(cls):
        return cls.work_mode == "remote"

    __table_args__ = (
        Index("ix_opportunities_search", "search_tsv", postgresql_using="gin"),
        Index("ix_opportunities_islamic", "islamic_tags", postgresql_using="gin"),
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
    # Which deadline reminders have gone out: 0 none, 1 = 7 days, 2 = 3 days, 3 = 1 day.
    reminder_stage: Mapped[int] = mapped_column(Integer, default=0)

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


class QuestionStatus(str, enum.Enum):
    pending = "pending"
    answered = "answered"
    hidden = "hidden"


class OpportunityQuestion(Base):
    """Controlled Q&A (spec section 24): members ask, DEEN or the verified provider answers.
    Only answered questions are shown publicly."""

    __tablename__ = "opportunity_questions"

    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    asked_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)
    answered_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    answered_by_platform: Mapped[bool] = mapped_column(Boolean, default=False)
    answered_at: Mapped[datetime | None]
    status: Mapped[QuestionStatus] = mapped_column(pg_enum(QuestionStatus, "question_status"),
                                                   default=QuestionStatus.pending, index=True)
