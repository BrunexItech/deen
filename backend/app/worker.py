"""Background worker: drains the job queue and schedules periodic maintenance.

Run standalone in production (`python -m app.worker`, as many replicas as needed),
or embedded in the API process in development (EMBEDDED_WORKER=true)."""
import asyncio
import logging

from app import models  # noqa: F401  (register tables)
from app.core.clock import utcnow
from app.core.db import SessionLocal
from app.modules.jobs.service import enqueue, run_ready

# Importing these modules registers their job handlers.
from app.modules.admin import platform as _announcements  # noqa: F401,E402
from app.modules.notifications import service as _notifications  # noqa: F401,E402
from app.modules.opportunities import service as _opportunities  # noqa: F401,E402
from app.modules.subscriptions import jobs as _subscription_jobs  # noqa: F401,E402
from app.modules.subscriptions import router as _payments  # noqa: F401,E402

log = logging.getLogger("deen.worker")
MAINTENANCE_EVERY_MINUTES = 10


async def schedule_maintenance() -> None:
    """One maintenance run per window, however many workers are alive (dedupe key)."""
    now = utcnow()
    window = now.replace(minute=now.minute - now.minute % MAINTENANCE_EVERY_MINUTES, second=0, microsecond=0)
    async with SessionLocal() as session:
        for kind in ("opportunities.maintenance", "subscriptions.maintenance"):
            await enqueue(session, kind, {}, dedupe_key=f"{kind}:{window.isoformat()}")
        await session.commit()


async def run_forever(stop: asyncio.Event | None = None) -> None:
    stop = stop or asyncio.Event()
    last_schedule = 0.0
    loop = asyncio.get_running_loop()
    while not stop.is_set():
        try:
            if loop.time() - last_schedule > 60:
                await schedule_maintenance()
                last_schedule = loop.time()
            ran = await run_ready()
        except Exception:  # noqa: BLE001 — keep the worker alive through DB blips
            log.exception("worker loop error")
            ran = 0
        if not ran:
            try:
                await asyncio.wait_for(stop.wait(), timeout=1.0)
            except asyncio.TimeoutError:
                pass


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    asyncio.run(run_forever())
