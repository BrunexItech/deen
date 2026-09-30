"""Member-side tracking beyond DEEN applications (spec sections 18 and 27):
applications made outside DEEN, self-reported statuses, and the Experience Builder."""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.deps import DB, Member
from app.modules.applications.models import AppStatus, Application, ApplicationEvent, Experience
from app.modules.opportunities.models import Opportunity
from app.modules.orgs.models import Organization

router = APIRouter(prefix="/api/v1", tags=["tracker"])

# Statuses a member may set themselves (only for applications DEEN doesn't manage).
SelfStatus = Literal["started", "submitted", "in_review", "shortlisted", "interview", "accepted", "rejected", "closed"]


class ManualIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    organization: str = Field(min_length=2, max_length=160)
    url: str | None = Field(None, max_length=500)
    deadline: datetime | None = None
    status: SelfStatus = "submitted"
    notes: str | None = Field(None, max_length=2000)


@router.post("/applications/manual")
async def add_manual(body: ManualIn, p: Member, session: DB):
    """Record an application made entirely outside DEEN, so every application lives in one tracker."""
    a = Application(user_id=p.id, source="manual", manual_title=body.title.strip(),
                    manual_organization=body.organization.strip(), manual_url=body.url, manual_deadline=body.deadline,
                    status=AppStatus(body.status), member_notes=body.notes, answers={})
    session.add(a)
    await session.flush()
    session.add(ApplicationEvent(application_id=a.id, actor_id=p.id, status=a.status.value, message="Added by you"))
    await session.commit()
    return {"id": a.id}


class SelfUpdateIn(BaseModel):
    status: SelfStatus | None = None
    notes: str | None = Field(None, max_length=2000)


@router.patch("/applications/{app_id}/self")
async def self_update(app_id: str, body: SelfUpdateIn, p: Member, session: DB):
    a = await session.get(Application, app_id)
    if not a or a.user_id != p.id:
        raise HTTPException(404, "Application not found")
    if body.status and a.source == "deen":
        raise HTTPException(409, "The organization updates the status of applications sent through DEEN")
    if body.status and body.status != a.status.value:
        a.status = AppStatus(body.status)
        session.add(ApplicationEvent(application_id=a.id, actor_id=p.id, status=a.status.value, message="Updated by you"))
    if body.notes is not None:
        a.member_notes = body.notes
    await session.commit()
    return {"ok": True, "status": a.status.value}


@router.delete("/applications/{app_id}")
async def delete_manual(app_id: str, p: Member, session: DB):
    a = await session.get(Application, app_id)
    if not a or a.user_id != p.id or a.source == "deen":
        raise HTTPException(404, "Application not found")
    await session.delete(a)
    await session.commit()
    return {"ok": True}


# ---------- Experience Builder ----------

KINDS = ("volunteer", "attachment", "internship", "job", "training", "workshop", "fellowship", "competition",
         "mentorship", "education", "other")


class ExperienceIn(BaseModel):
    kind: str
    title: str = Field(min_length=2, max_length=160)
    organization: str = Field(min_length=2, max_length=160)
    location: str | None = Field(None, max_length=120)
    start_date: datetime | None = None
    end_date: datetime | None = None
    description: str | None = Field(None, max_length=3000)
    skills: list[str] = Field(default_factory=list, max_length=20)
    opportunity_id: str | None = None


def _exp_out(e: Experience) -> dict:
    return {"id": e.id, "kind": e.kind, "title": e.title, "organization": e.organization, "location": e.location,
            "start_date": e.start_date, "end_date": e.end_date, "description": e.description, "skills": e.skills or [],
            "verified": e.verified, "opportunity_id": e.opportunity_id}


@router.get("/me/experience")
async def list_experience(p: Member, session: DB):
    rows = (await session.execute(select(Experience).where(Experience.user_id == p.id)
                                  .order_by(Experience.start_date.desc().nullsfirst(), Experience.created_at.desc()))).scalars()
    # Suggestions: accepted DEEN opportunities not yet added.
    have = {e.opportunity_id for e in (await session.execute(select(Experience).where(
        Experience.user_id == p.id))).scalars() if e.opportunity_id}
    accepted = (await session.execute(
        select(Opportunity, Organization.name).join(Application, Application.opportunity_id == Opportunity.id)
        .join(Organization, Organization.id == Opportunity.organization_id)
        .where(Application.user_id == p.id, Application.status == AppStatus.accepted))).all()
    return {"items": [_exp_out(e) for e in rows],
            "suggestions": [{"opportunity_id": o.id, "title": o.title, "organization": n, "type": o.type}
                            for o, n in accepted if o.id not in have]}


@router.post("/me/experience")
async def add_experience(body: ExperienceIn, p: Member, session: DB):
    if body.kind not in KINDS:
        raise HTTPException(422, "Choose a type of experience")
    verified = False
    if body.opportunity_id:
        # Verified only if DEEN saw the organization accept this member.
        verified = bool(await session.scalar(select(Application.id).where(
            Application.user_id == p.id, Application.opportunity_id == body.opportunity_id,
            Application.status == AppStatus.accepted)))
    e = Experience(user_id=p.id, verified=verified, **body.model_dump())
    session.add(e)
    await session.commit()
    return _exp_out(e)


@router.put("/me/experience/{exp_id}")
async def update_experience(exp_id: str, body: ExperienceIn, p: Member, session: DB):
    e = await session.get(Experience, exp_id)
    if not e or e.user_id != p.id:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude={"opportunity_id"}).items():
        setattr(e, k, v)
    await session.commit()
    return _exp_out(e)


@router.delete("/me/experience/{exp_id}")
async def delete_experience(exp_id: str, p: Member, session: DB):
    e = await session.get(Experience, exp_id)
    if not e or e.user_id != p.id:
        raise HTTPException(404, "Not found")
    await session.delete(e)
    await session.commit()
    return {"ok": True}
