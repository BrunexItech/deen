from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum


class ListingStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


DIRECTORY_CATEGORIES = {
    "healthcare": "Healthcare",
    "legal": "Legal",
    "engineering": "Engineering",
    "technology": "Technology",
    "design": "Design & Creative",
    "finance": "Finance & Accounting",
    "education": "Education & Tutoring",
    "halal_food": "Halal Food",
    "retail": "Retail & Trade",
    "consulting": "Consulting",
    "construction": "Construction",
    "transport": "Transport & Logistics",
    "islamic_services": "Islamic Services",
    "other": "Other",
}


class DirectoryListing(Base):
    """Muslim-owned businesses and professionals. Member-submitted, DEEN-approved."""

    __tablename__ = "directory_listings"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # business | professional
    name: Mapped[str] = mapped_column(String(160))
    headline: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    county: Mapped[str | None] = mapped_column(String(40), index=True)
    town: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(20))
    whatsapp: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(254))
    website: Mapped[str | None] = mapped_column(String(300))
    services: Mapped[list[str]] = mapped_column(ARRAY(String(80)), default=list)
    halal_certified: Mapped[bool] = mapped_column(Boolean, default=False)
    logo_file_id: Mapped[str | None] = mapped_column(String(36))
    status: Mapped[ListingStatus] = mapped_column(pg_enum(ListingStatus, "listing_status"),
                                                  default=ListingStatus.pending, index=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    review_note: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None]

    __table_args__ = (Index("ix_directory_live", "status", "category", "county"),)
