from __future__ import annotations

from datetime import datetime
from typing import AsyncIterator
from uuid import uuid4

from sqlalchemy import DateTime, Enum, MetaData
from sqlalchemy.ext.asyncio import AsyncAttrs, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.pool import NullPool

from app.core.clock import utcnow
from app.core.config import settings

engine = (
    create_async_engine(settings.database_url, poolclass=NullPool)
    if settings.testing
    else create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=1800,
    )
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


# Deterministic constraint names keep Alembic autogenerate diffs stable.
NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(AsyncAttrs, DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)
    type_annotation_map = {datetime: DateTime(timezone=True)}

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid4()))
    # Python-side defaults: async serialisation must never lazy-load a server default.
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


def pg_enum(enum_cls, name: str):
    """Postgres ENUM persisted by member *value*."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])
