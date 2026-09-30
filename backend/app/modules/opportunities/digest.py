"""Weekly "DEEN Opportunities Digest" (spec section 22).

Every Monday morning each member gets: what was newly verified this week, by type
("5 Scholarships · 3 Business grants · 4 Internships"), plus how many of those match
their own profile. Delivered in-app + push, and by email / WhatsApp per preferences."""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.roles import Role
from app.modules.jobs.service import enqueue, handler
from app.modules.notifications.service import notify
from app.modules.opportunities.matching import MemberSignals, evaluate
from app.modules.opportunities.models import Opportunity, OppStatus
from app.modules.taxonomy.models import OpportunityType
from app.modules.users.models import MemberProfile, User, UserStatus

BATCH = 2000


async def weekly_summary(session: AsyncSession) -> tuple[list[Opportunity], list[tuple[str, int]]]:
    since = utcnow() - timedelta(days=7)
    opps = (await session.execute(select(Opportunity).where(
        Opportunity.status == OppStatus.published, Opportunity.published_at >= since)
        .order_by(Opportunity.published_at.desc()).limit(500))).scalars().all()
    names = dict((await session.execute(select(OpportunityType.key, OpportunityType.name))).all())
    counts: dict[str, int] = {}
    for o in opps:
        counts[o.type] = counts.get(o.type, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: -kv[1])
    return opps, [(names.get(k, k), n) for k, n in ranked]


def _plural(name: str, n: int) -> str:
    if n == 1:
        return name
    return name[:-1] + "ies" if name.endswith("y") and not name.endswith("ey") else name + "s"


@handler("digest.weekly")
async def weekly_digest(session: AsyncSession, payload: dict) -> None:
    opps, summary = await weekly_summary(session)
    if not opps:
        return
    after = payload.get("after") or ""
    rows = (await session.execute(
        select(MemberProfile).join(User, User.id == MemberProfile.user_id)
        .where(User.role == Role.member, User.status == UserStatus.active, MemberProfile.user_id > after)
        .order_by(MemberProfile.user_id).limit(BATCH))).scalars().all()
    lines = " · ".join(f"{n} {_plural(name, n)}" for name, n in summary[:6])
    # Group members by their personal match count so each distinct message is one notify() call.
    groups: dict[int, list[str]] = {}
    for profile in rows:
        sig = MemberSignals.from_profile(profile)
        mine = sum(1 for o in opps if (m := evaluate(o, sig)).eligible and m.score >= 45)
        groups.setdefault(mine, []).append(profile.user_id)
    for mine, users in groups.items():
        personal = f"{mine} match your profile. " if mine else ""
        await notify(session, users, kind="digest", title=f"This week on DEEN: {len(opps)} new opportunities",
                     body=f"{personal}{lines}", data={"screen": "explore", "sort": "newest"},
                     channels_=("push", "email", "whatsapp"))
    if len(rows) == BATCH:
        await enqueue(session, "digest.weekly", {"after": rows[-1].user_id})


async def digest_preview(session: AsyncSession) -> dict:
    opps, summary = await weekly_summary(session)
    total = await session.scalar(select(func.count()).select_from(User).where(User.role == Role.member,
                                                                              User.status == UserStatus.active))
    return {"new_this_week": len(opps), "by_type": [{"type": n, "count": c} for n, c in summary],
            "recipients": total or 0}
