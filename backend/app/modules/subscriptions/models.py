from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import ARRAY, JSON, Boolean, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum


class Plan(Base):
    """Membership plans are data, not code: prices, benefits and feature switches are
    edited from the control center."""

    __tablename__ = "plans"

    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    tagline: Mapped[str | None] = mapped_column(String(200))
    tier: Mapped[str] = mapped_column(String(20), default="member")  # free | member | premium
    price_kes: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    interval_months: Mapped[int] = mapped_column(Integer, default=1)
    benefits: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list)
    # {"advanced_matching": true, "premium_opportunities": true, "monthly_applications": null, ...}
    features: Mapped[dict | None] = mapped_column(JSON, default=dict)
    highlight: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class SubStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


class Subscription(Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"))
    status: Mapped[SubStatus] = mapped_column(pg_enum(SubStatus, "sub_status"), default=SubStatus.active)
    starts_at: Mapped[datetime]
    ends_at: Mapped[datetime] = mapped_column(index=True)
    renewal_reminded_at: Mapped[datetime | None]
    sponsored_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    __table_args__ = (Index("ix_subscriptions_user_status", "user_id", "status"),)


class PayStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"


class Payment(Base):
    __tablename__ = "payments"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"))
    # A member may gift a membership to someone else (sadaqah jariyah): beneficiary != payer.
    beneficiary_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    amount_kes: Mapped[float] = mapped_column(Numeric(10, 2))
    phone: Mapped[str] = mapped_column(String(20))
    provider: Mapped[str] = mapped_column(String(20))
    status: Mapped[PayStatus] = mapped_column(pg_enum(PayStatus, "pay_status"), default=PayStatus.pending, index=True)
    checkout_request_id: Mapped[str | None] = mapped_column(String(80), unique=True)
    receipt: Mapped[str | None] = mapped_column(String(40))
    result_desc: Mapped[str | None] = mapped_column(Text)
    settled_at: Mapped[datetime | None]
    raw_callback: Mapped[dict | None] = mapped_column(JSON)
