from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import ARRAY, JSON, Boolean, Date, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum
from app.core.roles import Role


class UserStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    deleted = "deleted"


class IdentityStatus(str, enum.Enum):
    none = "none"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(pg_enum(Role, "user_role"), default=Role.member, index=True)
    status: Mapped[UserStatus] = mapped_column(pg_enum(UserStatus, "user_status"), default=UserStatus.active, index=True)
    organization_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL", use_alter=True), index=True)

    phone_verified_at: Mapped[datetime | None]
    email_verified_at: Mapped[datetime | None]
    identity_status: Mapped[IdentityStatus] = mapped_column(
        pg_enum(IdentityStatus, "identity_status"), default=IdentityStatus.none)

    totp_secret_enc: Mapped[str | None] = mapped_column(Text)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None]
    last_login_at: Mapped[datetime | None]
    last_active_at: Mapped[datetime | None] = mapped_column(index=True)
    avatar_file_id: Mapped[str | None] = mapped_column(String(36))
    consent_at: Mapped[datetime | None]  # explicit consent to process sensitive data (DPA 2019)


class UserSession(Base):
    """One signed-in device. Refresh tokens rotate on every use; presenting an already
    rotated token means it leaked, and the whole session is revoked."""

    __tablename__ = "user_sessions"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[str] = mapped_column(String(80))
    device_name: Mapped[str] = mapped_column(String(120), default="Unknown device")
    platform: Mapped[str] = mapped_column(String(20), default="web")
    refresh_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    previous_refresh_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]
    last_seen_at: Mapped[datetime | None]
    ip: Mapped[str | None] = mapped_column(String(64))
    biometric_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (Index("ix_user_sessions_user_active", "user_id", "revoked_at"),)


class OtpPurpose(str, enum.Enum):
    verify_phone = "verify_phone"
    reset_password = "reset_password"
    verify_email = "verify_email"
    new_device = "new_device"
    payment = "payment"


class OtpCode(Base):
    __tablename__ = "otp_codes"

    target: Mapped[str] = mapped_column(String(254), index=True)  # phone or email
    purpose: Mapped[OtpPurpose] = mapped_column(pg_enum(OtpPurpose, "otp_purpose"))
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime]
    used_at: Mapped[datetime | None]


class MemberProfile(Base):
    """Everything the matching engine reads. Kept separate from User so auth rows stay
    small and hot, and profile columns can grow without touching the auth path."""

    __tablename__ = "member_profiles"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    country: Mapped[str] = mapped_column(String(60), default="Kenya")
    county: Mapped[str | None] = mapped_column(String(40), index=True)
    town: Mapped[str | None] = mapped_column(String(80))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(10))  # male | female
    education_level: Mapped[str | None] = mapped_column(String(30), index=True)
    field_of_study: Mapped[str | None] = mapped_column(String(120))
    institution: Mapped[str | None] = mapped_column(String(160))
    profession: Mapped[str | None] = mapped_column(String(120))
    employment_status: Mapped[str | None] = mapped_column(String(30))
    user_types: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list)  # student, entrepreneur…
    industry: Mapped[str | None] = mapped_column(String(60))
    business_sector: Mapped[str | None] = mapped_column(String(80))
    years_in_business: Mapped[int | None] = mapped_column(Integer)
    experience_years: Mapped[int | None] = mapped_column(Integer)
    whatsapp_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    bio: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list)
    interests: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)  # category keys
    opportunity_types: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)  # type keys
    career_interests: Mapped[list[str]] = mapped_column(ARRAY(String(80)), default=list)
    business_interests: Mapped[list[str]] = mapped_column(ARRAY(String(80)), default=list)
    languages: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    # Matching signal learnt from behaviour: {category: weight}. Updated incrementally.
    affinity: Mapped[dict | None] = mapped_column(JSON, default=dict)

    __table_args__ = (
        Index("ix_member_profiles_interests", "interests", postgresql_using="gin"),
    )
