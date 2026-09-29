import os
import tempfile

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL",
                                            "postgresql+asyncpg://deen:deen@localhost:5437/deen_test")
os.environ["TESTING"] = "true"
os.environ["EMBEDDED_WORKER"] = "false"
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="deen-tests-")
os.environ.update(SMS_PROVIDER="sandbox", PAYMENTS_PROVIDER="sandbox", SMTP_HOST="", REDIS_URL="")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.clock import utcnow  # noqa: E402
from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.core.ratelimit import RateLimiter  # noqa: E402
from app.core.roles import Role  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.users.models import User  # noqa: E402
from app.seed import seed_reference  # noqa: E402

ADMIN = ("admin@deen-test.co.ke", "AdminPass123")
PASSWORD = "Str0ngPass!"


@pytest.fixture(scope="session", autouse=True)
async def schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean():
    async with engine.begin() as conn:
        # DELETE (children first), not TRUNCATE: tiny tables, and TRUNCATE rewrites files.
        await conn.execute(text("UPDATE users SET organization_id = NULL"))
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    async with SessionLocal() as s:
        await seed_reference(s)
        s.add(User(full_name="Test Admin", email=ADMIN[0], password_hash=hash_password(ADMIN[1]),
                   role=Role.super_admin, consent_at=utcnow()))
        await s.commit()
    RateLimiter.reset_all()  # fresh rate-limit windows per test


def _client(web: bool = False) -> AsyncClient:
    headers = {"X-Client": "web", "X-Requested-With": "deen-web"} if web else {}
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=headers)


@pytest.fixture
async def client():
    async with _client() as c:
        yield c


@pytest.fixture
async def web():
    async with _client(web=True) as c:
        yield c


async def web_login(email: str, password: str) -> AsyncClient:
    c = _client(web=True)
    r = await c.post("/api/v1/auth/login", json={"identifier": email, "password": password})
    assert r.status_code == 200, r.text
    return c


@pytest.fixture
async def admin_web():
    c = await web_login(*ADMIN)
    yield c
    await c.aclose()


async def register_member(phone: str = "0712345678", name: str = "Test Member") -> tuple[AsyncClient, dict]:
    c = _client()
    r = await c.post("/api/v1/auth/register", json={"full_name": name, "phone": phone, "password": PASSWORD,
                                                    "consent": True})
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r = await c.post("/api/v1/auth/verify-phone", json={"phone": phone, "code": code,
                                                        "device": {"device_id": f"dev-{phone}",
                                                                   "device_name": "Test phone",
                                                                   "platform": "android"}})
    assert r.status_code == 200, r.text
    tokens = r.json()
    c.headers["Authorization"] = f"Bearer {tokens['access_token']}"
    return c, tokens


async def run_jobs() -> None:
    from app.modules.jobs.service import run_ready
    import app.worker  # noqa: F401  (register handlers)

    while await run_ready(50):
        pass
