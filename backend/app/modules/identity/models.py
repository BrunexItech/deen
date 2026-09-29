from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class IdentityVerification(Base):
    """ID + selfie check. The ID number is encrypted; images are stored encrypted and
    only verification officers can open them (every view is audited)."""

    __tablename__ = "identity_verifications"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    id_type: Mapped[str] = mapped_column(String(20), default="national_id")  # national_id | passport | alien_id
    id_number_enc: Mapped[str] = mapped_column(Text)
    id_last4: Mapped[str] = mapped_column(String(4))
    id_front_file_id: Mapped[str] = mapped_column(String(36))
    selfie_file_id: Mapped[str] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)  # pending | verified | rejected
    reviewer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    review_note: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None]
