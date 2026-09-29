import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app import models  # noqa: F401  (register all tables)
from app.core.config import settings
from app.core.headers import SecurityHeaders
from app.modules.admin import opportunities as admin_opportunities
from app.modules.admin import orgs as admin_orgs
from app.modules.admin import overview as admin_overview
from app.modules.admin import platform as admin_platform
from app.modules.admin import users as admin_users
from app.modules.applications.router import member_router as applications_router
from app.modules.applications.router import org_router as org_applications_router
from app.modules.content.router import router as content_router
from app.modules.directory.router import router as directory_router
from app.modules.files.router import router as files_router
from app.modules.identity.router import router as identity_router
from app.modules.moderation.router import router as reports_router
from app.modules.notifications.router import router as notifications_router
from app.modules.opportunities.router import router as discovery_router
from app.modules.orgs.portal_router import router as org_portal_router
from app.modules.orgs.router import router as organizations_router
from app.modules.privacy.router import router as privacy_router
from app.modules.search.router import router as search_router
from app.modules.subscriptions.router import router as membership_router
from app.modules.taxonomy.router import router as taxonomy_router
from app.modules.users.auth_router import router as auth_router
from app.modules.users.router import router as me_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.assert_production_safe()
    stop = asyncio.Event()
    task = None
    if settings.embedded_worker and not settings.testing:
        from app.worker import run_forever

        task = asyncio.create_task(run_forever(stop))
    yield
    stop.set()
    if task:
        await task


app = FastAPI(
    title="DEEN API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(SecurityHeaders)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Client"],
)

for r in (
    auth_router, me_router, privacy_router, taxonomy_router, discovery_router, applications_router,
    organizations_router, membership_router, notifications_router, files_router, content_router, reports_router,
    directory_router, identity_router, search_router,
    org_portal_router, org_applications_router,
    admin_overview.router, admin_opportunities.router, admin_orgs.router, admin_users.router, admin_platform.router,
):
    app.include_router(r)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "deen-api"}
