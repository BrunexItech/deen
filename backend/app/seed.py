"""Idempotent seed: reference data, the community fee, reminders and the first super admin.

    python -m app.seed                 # reference data + super admin
    python -m app.seed --demo          # + fictional demo organizations, opportunities and members
"""
import argparse
import asyncio
import os
import secrets

from sqlalchemy import select

from app import models  # noqa: F401
from app.core.clock import utcnow
from app.core.db import SessionLocal
from app.core.roles import Role
from app.core.security import hash_password
from app.modules.content.data import DEFAULT_ZAKAT, REMINDERS
from app.modules.content.models import PlatformSetting, Reminder
from app.modules.subscriptions.models import Plan
from app.modules.taxonomy.data import CATEGORIES
from app.modules.taxonomy.models import Category, OpportunityType
from app.modules.users.models import User

# The one community maintenance fee. These are starting values only: the super admin
# sets the real amount, period and what it covers in the Control Center.
COMMUNITY_FEE = dict(
    code="community", name="Community maintenance fee", tier="member", price_kes=50, interval_months=1,
    benefits=["Checking every organization and opportunity", "Keeping DEEN free of scams",
              "SMS alerts, servers and member support"],
    features={"free_monthly_applications": 3},
)


async def seed_reference(session) -> None:
    for i, c in enumerate(CATEGORIES):
        cat = await session.scalar(select(Category).where(Category.key == c["key"]))
        if not cat:
            session.add(Category(key=c["key"], name=c["name"], tab_label=c["tab_label"], icon=c["icon"],
                                 color=c["color"], description=c["description"], sort=i))
        for j, (key, name) in enumerate(c["types"]):
            if not await session.scalar(select(OpportunityType.id).where(OpportunityType.key == key)):
                session.add(OpportunityType(key=key, category_key=c["key"], name=name, sort=j))
        await session.flush()
    if not await session.scalar(select(Plan.id).where(Plan.code == COMMUNITY_FEE["code"])):
        session.add(Plan(**COMMUNITY_FEE))
    if not await session.scalar(select(Reminder.id).limit(1)):
        for i, (kind, arabic, text, ref, theme) in enumerate(REMINDERS):
            session.add(Reminder(kind=kind, arabic=arabic, text=text, reference=ref, theme=theme, sort=i))
    if not await session.scalar(select(PlatformSetting.id).where(PlatformSetting.key == "zakat")):
        session.add(PlatformSetting(key="zakat", value={**DEFAULT_ZAKAT, "updated_at": utcnow().isoformat()}))
    await session.commit()


async def seed_admin(session) -> tuple[str, str | None]:
    email = os.environ.get("SEED_ADMIN_EMAIL", "admin@deen.africa").lower()
    existing = await session.scalar(select(User).where(User.email == email))
    if existing:
        return email, None
    password = os.environ.get("SEED_ADMIN_PASSWORD") or f"Deen-{secrets.token_urlsafe(9)}"
    session.add(User(full_name="DEEN Super Admin", email=email, role=Role.super_admin,
                     password_hash=hash_password(password), email_verified_at=utcnow(), consent_at=utcnow()))
    await session.commit()
    return email, password


async def main(demo: bool) -> None:
    async with SessionLocal() as session:
        await seed_reference(session)
        email, password = await seed_admin(session)
        print("✓ Reference data, community fee and reminders ready")
        if password:
            print(f"✓ Super admin created: {email} / {password}  (change it after first sign-in)")
        else:
            print(f"✓ Super admin exists: {email}")
        if demo:
            from app.demo import seed_demo

            await seed_demo(session)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true")
    asyncio.run(main(parser.parse_args().demo))
