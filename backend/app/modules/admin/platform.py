"""Moderation, billing, communications, content, taxonomy, directory and audit."""
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record
from app.core.clock import utcnow
from app.core.deps import DB, Principal, require
from app.core.roles import Perm, Role
from app.modules.announcements.models import Announcement
from app.modules.audit.models import AuditLog
from app.modules.content.data import DEFAULT_ZAKAT
from app.modules.content.models import PlatformSetting, Reminder
from app.modules.content.router import get_setting, reminder_out
from app.modules.directory.models import DirectoryListing, ListingStatus
from app.modules.directory.router import listing_out
from app.modules.jobs.service import enqueue, handler
from app.modules.moderation.models import REPORT_REASONS, Report, ReportStatus
from app.modules.notifications.service import notify
from app.modules.opportunities.models import Opportunity
from app.modules.orgs.models import Organization
from app.modules.subscriptions.models import Payment, PayStatus, Plan, Subscription, SubStatus
from app.modules.subscriptions.router import plan_out
from app.modules.taxonomy.models import Category, OpportunityType
from app.modules.taxonomy.router import categories_tree
from app.modules.users.models import MemberProfile, User, UserStatus

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# ---------- moderation ----------

@router.get("/reports")
async def reports(session: DB, p: Principal = require(Perm.reports_manage), status: str | None = "open"):
    stmt = select(Report, User.full_name).outerjoin(User, User.id == Report.reporter_id)
    if status:
        stmt = stmt.where(Report.status == status)
    rows = (await session.execute(stmt.order_by(Report.created_at.desc()).limit(300))).all()
    opp_ids = [r.target_id for r, _ in rows if r.target_type == "opportunity"]
    org_ids = [r.target_id for r, _ in rows if r.target_type == "organization"]
    names = {}
    if opp_ids:
        names.update(dict((await session.execute(select(Opportunity.id, Opportunity.title).where(
            Opportunity.id.in_(opp_ids)))).all()))
    if org_ids:
        names.update(dict((await session.execute(select(Organization.id, Organization.name).where(
            Organization.id.in_(org_ids)))).all()))
    # How many distinct members reported the same target: the strongest trust signal.
    counts = dict((await session.execute(select(Report.target_id, func.count(func.distinct(Report.reporter_id)))
                                         .group_by(Report.target_id))).all())
    return [{"id": r.id, "target_type": r.target_type, "target_id": r.target_id,
             "target_name": names.get(r.target_id, "Directory listing" if r.target_type == "directory" else "—"),
             "reason": r.reason, "reason_label": REPORT_REASONS.get(r.reason, r.reason), "details": r.details,
             "status": r.status.value, "reporter": name, "reports_on_target": counts.get(r.target_id, 1),
             "resolution_note": r.resolution_note, "created_at": r.created_at} for r, name in rows]


class ReportUpdateIn(BaseModel):
    status: ReportStatus
    resolution_note: str | None = Field(None, max_length=2000)


@router.post("/reports/{report_id}")
async def update_report(report_id: str, body: ReportUpdateIn, session: DB, p: Principal = require(Perm.reports_manage)):
    r = await session.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    r.status, r.resolution_note, r.handled_by_id, r.handled_at = body.status, body.resolution_note, p.id, utcnow()
    record(session, actor_id=p.id, action=f"report.{body.status.value}", entity="report", entity_id=r.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


# ---------- billing ----------

@router.get("/plans")
async def plans(session: DB, p: Principal = require(Perm.payments_view)):
    rows = (await session.execute(select(Plan).order_by(Plan.sort, Plan.price_kes))).scalars().all()
    subs = dict((await session.execute(select(Subscription.plan_id, func.count()).where(
        Subscription.status == SubStatus.active, Subscription.ends_at > utcnow()).group_by(Subscription.plan_id))).all())
    return [{**plan_out(pl), "active": pl.active, "sort": pl.sort, "subscribers": subs.get(pl.id, 0)} for pl in rows]


class PlanIn(BaseModel):
    code: str = Field(pattern=r"^[a-z0-9_]{2,40}$")
    name: str = Field(min_length=2, max_length=80)
    tagline: str | None = Field(None, max_length=200)
    tier: str = Field(pattern="^(free|member|premium)$")
    price_kes: float = Field(ge=0, le=1_000_000)
    interval_months: int = Field(1, ge=1, le=24)
    benefits: list[str] = Field(default_factory=list, max_length=15)
    features: dict = {}
    highlight: bool = False
    active: bool = True
    sort: int = 0


@router.post("/plans")
async def create_plan(body: PlanIn, session: DB, p: Principal = require(Perm.plans_manage)):
    plan = Plan(**body.model_dump())
    session.add(plan)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(409, "A plan with that code exists")
    record(session, actor_id=p.id, action="plan.created", entity="plan", entity_id=plan.id, ip=p.ip, **body.model_dump(
        include={"code", "price_kes"}))
    await session.commit()
    return plan_out(plan)


@router.put("/plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanIn, session: DB, p: Principal = require(Perm.plans_manage)):
    plan = await session.get(Plan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    before = float(plan.price_kes)
    for k, v in body.model_dump().items():
        setattr(plan, k, v)
    record(session, actor_id=p.id, action="plan.updated", entity="plan", entity_id=plan.id, ip=p.ip,
           price_before=before, price_after=body.price_kes)
    await session.commit()
    return plan_out(plan)


@router.get("/payments")
async def payments(session: DB, p: Principal = require(Perm.payments_view), status: str | None = None,
                   q: str | None = None, page: int = 1):
    stmt = (select(Payment, User.full_name, Plan.name).join(User, User.id == Payment.user_id)
            .join(Plan, Plan.id == Payment.plan_id))
    if status:
        stmt = stmt.where(Payment.status == status)
    if q:
        stmt = stmt.where(or_(User.full_name.ilike(f"%{q}%"), Payment.receipt.ilike(f"%{q}%"),
                              Payment.phone.ilike(f"%{q}%")))
    rows = (await session.execute(stmt.order_by(Payment.created_at.desc()).offset((max(page, 1) - 1) * 50)
                                  .limit(50))).all()
    now = utcnow()
    sums = {}
    for label, since in (("today", now - timedelta(days=1)), ("week", now - timedelta(days=7)),
                         ("month", now - timedelta(days=30))):
        sums[label] = float(await session.scalar(select(func.coalesce(func.sum(Payment.amount_kes), 0)).where(
            Payment.status == PayStatus.success, Payment.settled_at >= since)) or 0)
    return {"items": [{"id": x.id, "member": n, "plan": pl, "amount_kes": float(x.amount_kes), "phone": x.phone,
                       "status": x.status.value, "receipt": x.receipt, "provider": x.provider,
                       "gift": x.beneficiary_id not in (None, x.user_id), "result": x.result_desc,
                       "created_at": x.created_at, "settled_at": x.settled_at} for x, n, pl in rows],
            "totals": sums}


# ---------- announcements ----------

class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=3, max_length=2000)
    audience: str = Field("all", pattern="^(all|free|members|premium|county|organizations)$")
    counties: list[str] = []
    channels: list[str] = ["push"]


@router.get("/announcements")
async def announcements(session: DB, p: Principal = require(Perm.announce_send)):
    rows = (await session.execute(select(Announcement).order_by(Announcement.created_at.desc()).limit(100))).scalars()
    return [{"id": a.id, "title": a.title, "body": a.body, "audience": a.audience, "counties": a.counties,
             "channels": a.channels, "recipients": a.recipients, "sent_at": a.sent_at} for a in rows]


@router.post("/announcements")
async def send_announcement(body: AnnouncementIn, session: DB, p: Principal = require(Perm.announce_send)):
    channels = [c for c in body.channels if c in ("push", "email", "sms")] or ["push"]
    a = Announcement(title=body.title, body=body.body, audience=body.audience, counties=body.counties,
                     channels=channels, sent_by_id=p.id, sent_at=utcnow())
    session.add(a)
    await session.flush()
    await enqueue(session, "announcements.deliver", {"announcement_id": a.id})
    record(session, actor_id=p.id, action="announcement.sent", entity="announcement", entity_id=a.id, ip=p.ip,
           audience=body.audience)
    await session.commit()
    return {"ok": True, "id": a.id}


@handler("announcements.deliver")
async def deliver_announcement(session: AsyncSession, payload: dict) -> None:
    """Keyset-walks the audience in batches; each batch is its own job."""
    a = await session.get(Announcement, payload["announcement_id"])
    if not a:
        return
    after = payload.get("after") or ""
    now = utcnow()
    stmt = select(User.id).where(User.status == UserStatus.active, User.id > after)
    if a.audience == "organizations":
        stmt = stmt.where(User.role.in_([Role.org_admin, Role.org_staff]))
    else:
        stmt = stmt.where(User.role == Role.member)
        paying = select(Subscription.user_id).join(Plan, Plan.id == Subscription.plan_id).where(
            Subscription.status == SubStatus.active, Subscription.ends_at > now)
        if a.audience == "members":
            stmt = stmt.where(User.id.in_(paying))
        elif a.audience == "premium":
            stmt = stmt.where(User.id.in_(paying.where(Plan.tier == "premium")))
        elif a.audience == "free":
            stmt = stmt.where(User.id.notin_(paying))
        elif a.audience == "county" and a.counties:
            stmt = stmt.where(User.id.in_(select(MemberProfile.user_id).where(MemberProfile.county.in_(a.counties))))
    ids = list((await session.execute(stmt.order_by(User.id).limit(2000))).scalars())
    if ids:
        await notify(session, ids, kind="announcements", title=a.title, body=a.body,
                     data={"screen": "notifications"}, channels_=tuple(a.channels or ["push"]))
        a.recipients += len(ids)
    if len(ids) == 2000:
        await enqueue(session, "announcements.deliver", {"announcement_id": a.id, "after": ids[-1]})


# ---------- reminders (Qur'an, hadith, du'a) ----------

@router.get("/reminders")
async def all_reminders(session: DB, p: Principal = require(Perm.content_manage)):
    rows = (await session.execute(select(Reminder).order_by(Reminder.sort, Reminder.created_at))).scalars()
    return [{**reminder_out(r), "active": r.active, "sort": r.sort} for r in rows]


class ReminderIn(BaseModel):
    kind: str = Field(pattern="^(ayah|hadith|dua)$")
    arabic: str | None = Field(None, max_length=2000)
    text: str = Field(min_length=5, max_length=2000)
    reference: str = Field(min_length=3, max_length=160)
    theme: str | None = Field(None, max_length=40)
    active: bool = True
    sort: int = 0


@router.post("/reminders")
async def create_reminder(body: ReminderIn, session: DB, p: Principal = require(Perm.content_manage)):
    r = Reminder(**body.model_dump())
    session.add(r)
    record(session, actor_id=p.id, action="reminder.created", entity="reminder", ip=p.ip, reference=body.reference)
    await session.commit()
    return reminder_out(r)


@router.put("/reminders/{rid}")
async def update_reminder(rid: str, body: ReminderIn, session: DB, p: Principal = require(Perm.content_manage)):
    r = await session.get(Reminder, rid)
    if not r:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump().items():
        setattr(r, k, v)
    record(session, actor_id=p.id, action="reminder.updated", entity="reminder", entity_id=r.id, ip=p.ip)
    await session.commit()
    return reminder_out(r)


# ---------- settings ----------

@router.get("/settings/zakat")
async def zakat_settings(session: DB, p: Principal = require(Perm.analytics_view)):
    return await get_setting(session, "zakat", DEFAULT_ZAKAT)


class ZakatIn(BaseModel):
    gold_price_per_gram_kes: float = Field(gt=0)
    silver_price_per_gram_kes: float = Field(gt=0)
    nisab_basis: str = Field(pattern="^(gold|silver)$")


@router.put("/settings/zakat")
async def update_zakat(body: ZakatIn, session: DB, p: Principal = require(Perm.plans_manage)):
    row = await session.scalar(select(PlatformSetting).where(PlatformSetting.key == "zakat"))
    value = {**DEFAULT_ZAKAT, **(row.value if row else {}), **body.model_dump(), "updated_at": utcnow().isoformat()}
    if row:
        row.value = value
    else:
        session.add(PlatformSetting(key="zakat", value=value))
    record(session, actor_id=p.id, action="settings.zakat", entity="settings", ip=p.ip, **body.model_dump())
    await session.commit()
    return value


# ---------- taxonomy ----------

@router.get("/taxonomy")
async def taxonomy(session: DB, p: Principal = require(Perm.opps_view)):
    return await categories_tree(session, include_inactive=True)


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    tab_label: str = Field(min_length=2, max_length=40)
    description: str | None = Field(None, max_length=200)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    active: bool = True


@router.put("/taxonomy/{key}")
async def update_category(key: str, body: CategoryIn, session: DB, p: Principal = require(Perm.taxonomy_manage)):
    c = await session.scalar(select(Category).where(Category.key == key))
    if not c:
        raise HTTPException(404, "Category not found")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    record(session, actor_id=p.id, action="taxonomy.category", entity="category", entity_id=c.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


class TypeIn(BaseModel):
    key: str = Field(pattern=r"^[a-z0-9_]{2,40}$")
    name: str = Field(min_length=2, max_length=80)
    active: bool = True


@router.post("/taxonomy/{key}/types")
async def upsert_type(key: str, body: TypeIn, session: DB, p: Principal = require(Perm.taxonomy_manage)):
    t = await session.scalar(select(OpportunityType).where(OpportunityType.key == body.key))
    if t and t.category_key != key:
        raise HTTPException(409, "That type key belongs to another category")
    if t:
        t.name, t.active = body.name, body.active
    else:
        session.add(OpportunityType(key=body.key, category_key=key, name=body.name, active=body.active, sort=99))
    record(session, actor_id=p.id, action="taxonomy.type", entity="category", ip=p.ip, type=body.key)
    await session.commit()
    return {"ok": True}


# ---------- directory review ----------

@router.get("/directory")
async def directory(session: DB, p: Principal = require(Perm.directory_manage), status: str = "pending"):
    rows = (await session.execute(select(DirectoryListing, User.full_name).join(User, User.id == DirectoryListing.owner_id)
                                  .where(DirectoryListing.status == status)
                                  .order_by(DirectoryListing.created_at).limit(300))).all()
    return [{**listing_out(d, owner=True), "owner": n, "created_at": d.created_at} for d, n in rows]


class ListingDecisionIn(BaseModel):
    approve: bool
    verified: bool = False
    note: str | None = Field(None, max_length=500)


@router.post("/directory/{listing_id}")
async def decide_listing(listing_id: str, body: ListingDecisionIn, session: DB,
                         p: Principal = require(Perm.directory_manage)):
    d = await session.get(DirectoryListing, listing_id)
    if not d:
        raise HTTPException(404, "Listing not found")
    d.status = ListingStatus.approved if body.approve else ListingStatus.rejected
    d.verified, d.review_note, d.reviewed_at = body.approve and body.verified, body.note, utcnow()
    await notify(session, [d.owner_id], kind="announcements",
                 title="Your listing is live" if body.approve else "Listing needs changes",
                 body=f"{d.name} is now in the DEEN directory." if body.approve else f"{d.name}: {body.note or ''}",
                 data={"screen": "directory"})
    record(session, actor_id=p.id, action="directory." + d.status.value, entity="directory", entity_id=d.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


# ---------- audit ----------

@router.get("/audit")
async def audit(session: DB, p: Principal = require(Perm.audit_view), q: str | None = None,
                entity: str | None = None, actor_id: str | None = None, page: int = 1):
    stmt = select(AuditLog, User.full_name, User.role).outerjoin(User, User.id == AuditLog.actor_id)
    if q:
        stmt = stmt.where(AuditLog.action.ilike(f"%{q}%"))
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    rows = (await session.execute(stmt.order_by(AuditLog.created_at.desc()).offset((max(page, 1) - 1) * 50)
                                  .limit(50))).all()
    return [{"id": a.id, "action": a.action, "entity": a.entity, "entity_id": a.entity_id, "actor": n or "System",
             "actor_role": r.value if r else None, "ip": a.ip, "meta": a.meta, "at": a.created_at}
            for a, n, r in rows]
