from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum
from app.core.roles import Role


class OrgType(str, enum.Enum):
    ngo = "ngo"
    foundation = "foundation"
    university = "university"
    business = "business"
    islamic_org = "islamic_org"
    mosque = "mosque"
    charity = "charity"
    government = "government"
    scholarship_provider = "scholarship_provider"
    employer = "employer"
    training_institution = "training_institution"
    financial_institution = "financial_institution"
    community = "community"


class Verification(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    trusted = "trusted"


class OrgStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"


class Organization(Base):
    """Created only by DEEN administrators — organizations never self-register."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(160), index=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True)
    org_type: Mapped[OrgType] = mapped_column(pg_enum(OrgType, "org_type"))
    tagline: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(300))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(20))
    county: Mapped[str | None] = mapped_column(String(40), index=True)
    address: Mapped[str | None] = mapped_column(String(300))
    registration_number: Mapped[str | None] = mapped_column(String(80))
    logo_file_id: Mapped[str | None] = mapped_column(String(36))
    verification: Mapped[Verification] = mapped_column(pg_enum(Verification, "org_verification"),
                                                       default=Verification.pending, index=True)
    status: Mapped[OrgStatus] = mapped_column(pg_enum(OrgStatus, "org_status"), default=OrgStatus.active, index=True)
    premium: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime | None]
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    followers_count: Mapped[int] = mapped_column(Integer, default=0)


class Invite(Base):
    """One-time, email-bound link that creates an account with a fixed role:
    DEEN staff invited by a super admin, or organization representatives."""

    __tablename__ = "invites"

    email: Mapped[str] = mapped_column(String(254), index=True)
    full_name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(pg_enum(Role, "user_role"))
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime]
    accepted_at: Mapped[datetime | None]
    revoked_at: Mapped[datetime | None]
    invited_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class OrgFollow(Base):
    __tablename__ = "org_follows"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    __table_args__ = (UniqueConstraint("user_id", "organization_id"),)


class OrgDocument(Base):
    __tablename__ = "org_documents"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    file_id: Mapped[str] = mapped_column(String(36))
    label: Mapped[str] = mapped_column(String(120))
