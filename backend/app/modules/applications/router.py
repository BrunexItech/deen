"""Applications: members apply (in-app or track external ones), organizations review."""
import csv
import io
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.core.audit import record
from app.core.clock import age_on, utcnow
from app.core.deps import DB, Member, OrgUser
from app.core.pagination import finish, keyset
from app.modules.applications.models import AppStatus, Application, ApplicationEvent, Outcome
from app.modules.files.models import StoredFile
from app.modules.notifications.service import notify
from app.modules.opportunities.matching import evaluate
from app.modules.opportunities.models import ApplyMode, Opportunity
from app.modules.opportunities.service import card, is_locked, live_filter, member_context, orgs_by_id, track
from app.modules.orgs.models import Organization
from app.modules.users.models import IdentityStatus, MemberProfile, User

member_router = APIRouter(prefix="/api/v1", tags=["applications"])
org_router = APIRouter(prefix="/api/v1/org/applications", tags=["org-applications"])

STATUS_COPY = {
    AppStatus.in_review: ("Application in review", "is reviewing your application"),
    AppStatus.shortlisted: ("You've been shortlisted", "shortlisted you. Alhamdulillah, keep going!"),
    AppStatus.interview: ("Interview invitation", "would like to interview you"),
    AppStatus.accepted: ("Congratulations, you were accepted", "accepted your application. Mabrook!"),
    AppStatus.rejected: ("Application update", "has completed its review. This one wasn't successful, but "
                                               "better is written for you. Keep applying."),
}


def _snapshot(user: User, profile: MemberProfile | None) -> dict:
    p = profile
    return {
        "full_name": user.full_name, "phone": user.phone, "email": user.email,
        "identity_verified": user.identity_status == IdentityStatus.verified,
        "county": p.county if p else None, "town": p.town if p else None,
        "age": age_on(p.date_of_birth) if p else None, "gender": p.gender if p else None,
        "education_level": p.education_level if p else None, "field_of_study": p.field_of_study if p else None,
        "institution": p.institution if p else None, "profession": p.profession if p else None,
        "employment_status": p.employment_status if p else None, "skills": p.skills if p else [],
        "languages": p.languages if p else [], "bio": p.bio if p else None,
    }


def _app_out(a: Application, opp_card: dict | None = None, events: list | None = None) -> dict:
    return {"id": a.id, "status": a.status.value, "cover_note": a.cover_note, "answers": a.answers or {},
            "documents": [{**d, "url": f"/api/v1/files/{d['file_id']}"} for d in (a.documents or [])],
            "source": a.source, "external": a.source != "deen", "match_score": a.match_score,
            "manual": {"title": a.manual_title, "organization": a.manual_organization, "url": a.manual_url,
                       "deadline": a.manual_deadline} if a.source == "manual" else None,
            "notes": a.member_notes, "created_at": a.created_at, "updated_at": a.updated_at,
            "opportunity": opp_card, "events": events}


# ---------- member ----------

class ApplyIn(BaseModel):
    cover_note: str | None = Field(None, max_length=4000)
    answers: dict[str, str | list[str] | None] = {}
    documents: list[dict] = []


@member_router.post("/opportunities/{opp_id}/apply")
async def apply(opp_id: str, body: ApplyIn, p: Member, session: DB):
    opp = await session.scalar(select(Opportunity).where(Opportunity.id == opp_id, live_filter()))
    if not opp:
        raise HTTPException(404, "This opportunity is closed")
    if opp.apply_mode != ApplyMode.internal:
        raise HTTPException(409, "Apply on the organization's website for this one")
    ctx = await member_context(session, p.user)
    if is_locked(opp, ctx):
        raise HTTPException(402, "This opportunity is for paid-up DEEN members")
    await _check_quota(session, p.id, ctx.tier)
    if opp.requires_verified_identity and p.user.identity_status != IdentityStatus.verified:
        raise HTTPException(409, "Verify your identity first: this organization only accepts verified members")
    for q in opp.form_questions or []:
        if q.get("required") and not body.answers.get(q["id"]):
            raise HTTPException(422, f"Please answer: {q.get('label')}")
    docs = await _own_documents(session, p.id, body.documents, opp.organization_id)
    match = evaluate(opp, ctx.signals)
    app = Application(opportunity_id=opp.id, organization_id=opp.organization_id, user_id=p.id,
                      cover_note=body.cover_note, answers=body.answers, documents=docs,
                      profile_snapshot=_snapshot(p.user, ctx.profile), match_score=match.score)
    session.add(app)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "You've already applied for this opportunity")
    session.add(ApplicationEvent(application_id=app.id, actor_id=p.id, status=AppStatus.submitted.value))
    await track(session, opp, "apply", p.user, ctx.profile)
    org_users = (await session.execute(select(User.id).where(User.organization_id == opp.organization_id))).scalars().all()
    await notify(session, list(org_users), kind="applications", title="New application",
                 body=f"{p.user.full_name} applied for {opp.title}", data={"application_id": app.id})
    await notify(session, [p.id], kind="applications", title="Application sent",
                 body=f"Your application for {opp.title} was delivered. We'll let you know when it moves.",
                 data={"screen": "application", "id": app.id})
    await session.commit()
    return _app_out(app)


async def _check_quota(session, user_id: str, tier: str) -> None:
    from app.modules.subscriptions.service import applications_this_month, current_membership

    limit = (await current_membership(session, user_id))["features"].get("monthly_applications")
    if limit is not None and await applications_this_month(session, user_id) >= int(limit):
        raise HTTPException(402, f"You've used your {limit} applications through DEEN this month. "
                                 "Paid-up members apply without a limit.")


async def _own_documents(session, user_id: str, docs: list[dict], org_id: str) -> list[dict]:
    out = []
    for d in docs[:10]:
        f = await session.get(StoredFile, d.get("file_id"))
        if not f or f.owner_id != user_id:
            raise HTTPException(422, "One of the documents could not be attached")
        f.organization_id = org_id  # lets that organization (only) open it
        out.append({"file_id": f.id, "label": (d.get("label") or f.filename)[:80], "filename": f.filename})
    return out


@member_router.post("/opportunities/{opp_id}/applied-externally")
async def applied_externally(opp_id: str, p: Member, session: DB):
    """Keeps every application in one tracker, even ones submitted on another website."""
    opp = await session.get(Opportunity, opp_id)
    if not opp or opp.apply_mode != ApplyMode.external:
        raise HTTPException(404, "Opportunity not found")
    ctx = await member_context(session, p.user)
    app = Application(opportunity_id=opp.id, organization_id=opp.organization_id, user_id=p.id, source="external",
                      answers={}, profile_snapshot=_snapshot(p.user, ctx.profile),
                      match_score=evaluate(opp, ctx.signals).score)
    session.add(app)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "Already in your applications")
    session.add(ApplicationEvent(application_id=app.id, actor_id=p.id, status="submitted",
                                 message="Applied on the organization's website"))
    await track(session, opp, "apply", p.user, ctx.profile)
    await session.commit()
    return _app_out(app)


@member_router.get("/applications")
async def my_applications(p: Member, session: DB, status: str | None = None):
    stmt = select(Application).where(Application.user_id == p.id)
    if status:
        stmt = stmt.where(Application.status == status)
    apps = (await session.execute(stmt.order_by(Application.updated_at.desc()).limit(200))).scalars().all()
    opp_ids = [a.opportunity_id for a in apps if a.opportunity_id]
    opps = {o.id: o for o in (await session.execute(
        select(Opportunity).where(Opportunity.id.in_(opp_ids)))).scalars()} if opp_ids else {}
    orgs = await orgs_by_id(session, {o.organization_id for o in opps.values()})
    out = []
    for a in apps:
        o = opps.get(a.opportunity_id) if a.opportunity_id else None
        if a.opportunity_id and not o:
            continue
        out.append(_app_out(a, card(o, orgs.get(o.organization_id)) if o else None))
    return out


@member_router.get("/applications/{app_id}")
async def my_application(app_id: str, p: Member, session: DB):
    a = await session.get(Application, app_id)
    if not a or a.user_id != p.id:
        raise HTTPException(404, "Application not found")
    opp = await session.get(Opportunity, a.opportunity_id) if a.opportunity_id else None
    orgs = await orgs_by_id(session, {opp.organization_id}) if opp else {}
    events = (await session.execute(select(ApplicationEvent).where(ApplicationEvent.application_id == a.id)
                                    .order_by(ApplicationEvent.created_at))).scalars().all()
    outcome = await session.scalar(select(Outcome.id).where(Outcome.user_id == p.id,
                                                            Outcome.opportunity_id == opp.id)) if opp else None
    out = _app_out(a, card(opp, orgs.get(opp.organization_id)) if opp else None,
                   [{"status": e.status, "message": e.message, "at": e.created_at} for e in events])
    out["outcome_shared"] = outcome is not None
    return out


@member_router.post("/applications/{app_id}/withdraw")
async def withdraw(app_id: str, p: Member, session: DB):
    a = await session.get(Application, app_id)
    if not a or a.user_id != p.id:
        raise HTTPException(404, "Application not found")
    if a.source != "deen" or a.status in (AppStatus.accepted, AppStatus.rejected, AppStatus.withdrawn):
        raise HTTPException(409, "This application can no longer be withdrawn")
    a.status = AppStatus.withdrawn
    session.add(ApplicationEvent(application_id=a.id, actor_id=p.id, status="withdrawn"))
    await session.commit()
    return {"ok": True}


class OutcomeIn(BaseModel):
    story: str | None = Field(None, max_length=2000)
    share_publicly: bool = False


@member_router.post("/opportunities/{opp_id}/outcome")
async def share_outcome(opp_id: str, body: OutcomeIn, p: Member, session: DB):
    """"I got it!": the metric DEEN measures itself by."""
    opp = await session.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    session.add(Outcome(user_id=p.id, opportunity_id=opp.id, organization_id=opp.organization_id,
                        story=body.story, share_publicly=body.share_publicly))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
    return {"ok": True}


# ---------- organization ----------

async def _org_app(session, app_id: str, p) -> Application:
    a = await session.get(Application, app_id)
    if not a or a.organization_id != p.user.organization_id:
        raise HTTPException(404, "Application not found")
    return a


@org_router.get("")
async def org_list(p: OrgUser, session: DB, opportunity_id: str | None = None, status: str | None = None,
                   cursor: str | None = None, limit: int = 30):
    limit = max(1, min(limit, 100))
    stmt = select(Application).where(Application.organization_id == p.user.organization_id)
    if opportunity_id:
        stmt = stmt.where(Application.opportunity_id == opportunity_id)
    if status:
        stmt = stmt.where(Application.status == status)
    rows, nxt = finish((await session.execute(keyset(stmt, Application, cursor, limit))).scalars().all(), limit)
    titles = dict((await session.execute(select(Opportunity.id, Opportunity.title).where(
        Opportunity.id.in_({r.opportunity_id for r in rows})))).all()) if rows else {}
    count_stmt = select(Application.status, func.count()).where(
        Application.organization_id == p.user.organization_id)
    if opportunity_id:
        count_stmt = count_stmt.where(Application.opportunity_id == opportunity_id)
    counts = dict((await session.execute(count_stmt.group_by(Application.status))).all())
    return {
        "items": [{"id": r.id, "status": r.status.value, "applicant": (r.profile_snapshot or {}).get("full_name"),
                   "county": (r.profile_snapshot or {}).get("county"),
                   "education_level": (r.profile_snapshot or {}).get("education_level"),
                   "match_score": r.match_score, "external": r.source == "external",
                   "opportunity": {"id": r.opportunity_id, "title": titles.get(r.opportunity_id)},
                   "created_at": r.created_at} for r in rows],
        "next_cursor": nxt,
        "counts": {k.value if hasattr(k, "value") else k: v for k, v in counts.items()},
    }


@org_router.get("/export")
async def org_export(opportunity_id: str, p: OrgUser, session: DB):
    opp = await session.get(Opportunity, opportunity_id)
    if not opp or opp.organization_id != p.user.organization_id:
        raise HTTPException(404, "Opportunity not found")
    rows = (await session.execute(select(Application).where(Application.opportunity_id == opp.id)
                                  .order_by(Application.created_at))).scalars().all()
    questions = opp.form_questions or []
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Applied", "Status", "Name", "Phone", "Email", "County", "Education", "Field", "Match",
                *[q.get("label") for q in questions]])
    for r in rows:
        s = r.profile_snapshot or {}
        w.writerow([r.created_at.date(), r.status.value, s.get("full_name"), s.get("phone"), s.get("email"),
                    s.get("county"), s.get("education_level"), s.get("field_of_study"), r.match_score,
                    *[(r.answers or {}).get(q["id"], "") for q in questions]])
    record(session, actor_id=p.id, action="applications.exported", entity="opportunity", entity_id=opp.id, ip=p.ip,
           rows=len(rows))
    await session.commit()
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="applications-{opp.id[:8]}.csv"'})


@org_router.get("/{app_id}")
async def org_get(app_id: str, p: OrgUser, session: DB):
    a = await _org_app(session, app_id, p)
    opp = await session.get(Opportunity, a.opportunity_id)
    events = (await session.execute(select(ApplicationEvent).where(ApplicationEvent.application_id == a.id)
                                    .order_by(ApplicationEvent.created_at))).scalars().all()
    out = _app_out(a, {"id": opp.id, "title": opp.title, "form_questions": opp.form_questions or []},
                   [{"status": e.status, "message": e.message, "at": e.created_at} for e in events])
    out.update({"applicant": a.profile_snapshot or {}, "org_notes": a.org_notes})
    return out


class StatusIn(BaseModel):
    status: Literal["in_review", "shortlisted", "interview", "accepted", "rejected"]
    message: str | None = Field(None, max_length=2000)


@org_router.post("/{app_id}/status")
async def org_status(app_id: str, body: StatusIn, p: OrgUser, session: DB):
    a = await _org_app(session, app_id, p)
    if a.status == AppStatus.withdrawn:
        raise HTTPException(409, "The applicant withdrew this application")
    new = AppStatus(body.status)
    a.status = new
    session.add(ApplicationEvent(application_id=a.id, actor_id=p.id, status=new.value, message=body.message))
    opp = await session.get(Opportunity, a.opportunity_id)
    org = await session.get(Organization, a.organization_id)
    title, verb = STATUS_COPY[new]
    text = f"{org.name} {verb}" + (f": {body.message}" if body.message else ".")
    await notify(session, [a.user_id], kind="applications", title=title, body=f"{opp.title}: {text}",
                 data={"screen": "application", "id": a.id},
                 channels_=("push", "email", "sms") if new in (AppStatus.accepted, AppStatus.interview) else ("push",))
    record(session, actor_id=p.id, action="application.status", entity="application", entity_id=a.id, ip=p.ip,
           status=new.value)
    await session.commit()
    return {"ok": True, "status": new.value}


class NotesIn(BaseModel):
    org_notes: str = Field("", max_length=4000)


@org_router.patch("/{app_id}/notes")
async def org_notes(app_id: str, body: NotesIn, p: OrgUser, session: DB):
    a = await _org_app(session, app_id, p)
    await session.execute(update(Application).where(Application.id == a.id).values(org_notes=body.org_notes))
    await session.commit()
    return {"ok": True}
