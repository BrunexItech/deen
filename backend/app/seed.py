"""Idempotent seed: reference data, plans, reminders and the first super admin.

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

PLANS = [
    dict(code="free", name="Free", tier="free", price_kes=0, interval_months=1, sort=0,
         tagline="Start discovering opportunities",
         benefits=["Browse verified opportunities", "3 applications a month", "Daily reminders & zakat tools"],
         features={"monthly_applications": 3}),
    dict(code="member_monthly", name="Member", tier="member", price_kes=199, interval_months=1, sort=1, highlight=True,
         tagline="Everything you need to grow",
         benefits=["Unlimited in-app applications", "Personalised matching & alerts", "Member-only opportunities",
                   "Weekly opportunities digest"],
         features={"monthly_applications": None, "advanced_matching": True}),
    dict(code="member_yearly", name="Member · Annual", tier="member", price_kes=1990, interval_months=12, sort=2,
         tagline="Two months free", benefits=["Everything in Member", "Pay once a year, save 17%"],
         features={"monthly_applications": None, "advanced_matching": True}),
    dict(code="premium_monthly", name="Premium", tier="premium", price_kes=499, interval_months=1, sort=3,
         tagline="For serious career & business growth",
         benefits=["Everything in Member", "Advanced matching & premium alerts", "Exclusive opportunities",
                   "CV support", "Application & business proposal support", "Priority support"],
         features={"monthly_applications": None, "advanced_matching": True, "premium_opportunities": True,
                   "mentorship": True, "priority_support": True}),
    dict(code="premium_yearly", name="Premium · Annual", tier="premium", price_kes=4990, interval_months=12, sort=4,
         tagline="Best value", benefits=["Everything in Premium", "Pay once a year, save 17%"],
         features={"monthly_applications": None, "advanced_matching": True, "premium_opportunities": True,
                   "mentorship": True, "priority_support": True}),
]


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
    for p in PLANS:
        if not await session.scalar(select(Plan.id).where(Plan.code == p["code"])):
            session.add(Plan(**p))
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
        print("✓ Reference data, plans and reminders ready")
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
