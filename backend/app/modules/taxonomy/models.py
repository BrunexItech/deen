from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Category(Base):
    __tablename__ = "categories"

    key: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    tab_label: Mapped[str] = mapped_column(String(40))  # label in the app's discovery tabs
    description: Mapped[str | None] = mapped_column(String(200))
    icon: Mapped[str] = mapped_column(String(40))
    color: Mapped[str] = mapped_column(String(9))
    sort: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class OpportunityType(Base):
    __tablename__ = "opportunity_types"

    key: Mapped[str] = mapped_column(String(40), unique=True)
    category_key: Mapped[str] = mapped_column(ForeignKey("categories.key", ondelete="CASCADE", onupdate="CASCADE"),
                                              index=True)
    name: Mapped[str] = mapped_column(String(80))
    sort: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
