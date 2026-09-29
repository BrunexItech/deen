"""Enqueue and run background jobs.

Handlers register with @handler("kind"). Workers claim ready jobs with
FOR UPDATE SKIP LOCKED, so any number of worker processes share the queue safely.
Failed jobs retry with exponential backoff up to max_attempts."""
import logging
import traceback
from datetime import datetime, timedelta
from typing import Awaitable, Callable
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.db import SessionLocal
from app.modules.jobs.models import Job

log = logging.getLogger("deen.jobs")

Handler = Callable[[AsyncSession, dict], Awaitable[None]]
_HANDLERS: dict[str, Handler] = {}


def handler(kind: str):
    def wrap(fn: Handler) -> Handler:
        _HANDLERS[kind] = fn
        return fn

    return wrap


async def enqueue(session: AsyncSession, kind: str, payload: dict | None = None, *, delay_seconds: int = 0,
                  run_after: datetime | None = None, dedupe_key: str | None = None) -> None:
    """Joins the caller's transaction: the job exists only if the change that caused it commits."""
    stmt = insert(Job).values(
        kind=kind, payload=payload or {}, status="queued",
        run_after=run_after or (utcnow() + timedelta(seconds=delay_seconds)),
        dedupe_key=dedupe_key, created_at=utcnow(), updated_at=utcnow(),
        id=str(uuid4()),
    )
    if dedupe_key:
        stmt = stmt.on_conflict_do_nothing(index_elements=["dedupe_key"])
    await session.execute(stmt)


async def run_ready(limit: int = 20) -> int:
    """Claims and runs up to `limit` ready jobs. Returns how many ran."""
    async with SessionLocal() as session:
        jobs = (await session.execute(
            select(Job).where(Job.status == "queued", Job.run_after <= utcnow())
            .order_by(Job.run_after).limit(limit).with_for_update(skip_locked=True)
        )).scalars().all()
        for job in jobs:
            job.status = "running"
            job.locked_at = utcnow()
            job.attempts += 1
        await session.commit()

    for job in jobs:
        fn = _HANDLERS.get(job.kind)
        async with SessionLocal() as session:
            try:
                if not fn:
                    raise RuntimeError(f"No handler for job kind {job.kind!r}")
                await fn(session, job.payload or {})
                await session.commit()
                status, error, run_after = "done", None, job.run_after
            except Exception as exc:  # noqa: BLE001 — a job must never kill the worker
                await session.rollback()
                log.warning("job %s (%s) failed: %s", job.id, job.kind, exc)
                error = "".join(traceback.format_exception_only(type(exc), exc))[-2000:]
                retry = job.attempts < job.max_attempts
                status = "queued" if retry else "failed"
                run_after = utcnow() + timedelta(seconds=min(3600, 15 * 2 ** job.attempts))
            await session.execute(update(Job).where(Job.id == job.id).values(
                status=status, last_error=error, run_after=run_after, locked_at=None))
            await session.commit()
    return len(jobs)
