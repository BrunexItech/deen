"""Controlled Q&A on opportunities (spec section 24).

Members ask; DEEN staff or the verified provider answer. Only answered questions are
public, and staff can hide anything inappropriate. Nothing a member writes appears
on the listing until someone accountable has answered it."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.audit import record
from app.core.clock import utcnow
from app.core.deps import DB, Member, OrgUser, Principal, require
from app.core.ratelimit import RateLimiter
from app.core.roles import Perm
from app.modules.notifications.service import notify
from app.modules.opportunities.models import Opportunity, OpportunityQuestion, QuestionStatus
from app.modules.users.models import User

member_router = APIRouter(prefix="/api/v1/opportunities", tags=["questions"])
org_router = APIRouter(prefix="/api/v1/org/questions", tags=["questions"])
admin_router = APIRouter(prefix="/api/v1/admin/questions", tags=["questions"])
ask_limiter = RateLimiter("ask", 10, 3600)


def _out(q: OpportunityQuestion, opp_title: str | None = None, asker: str | None = None) -> dict:
    return {"id": q.id, "opportunity_id": q.opportunity_id, "opportunity": opp_title, "question": q.question,
            "answer": q.answer, "status": q.status.value, "answered_at": q.answered_at,
            "answered_by": "DEEN" if q.answered_by_platform else "Organization" if q.answer else None,
            "asker": asker, "created_at": q.created_at}


@member_router.get("/{opp_id}/questions")
async def list_questions(opp_id: str, p: Member, session: DB):
    rows = (await session.execute(select(OpportunityQuestion).where(
        OpportunityQuestion.opportunity_id == opp_id,
        (OpportunityQuestion.status == QuestionStatus.answered) | (OpportunityQuestion.asked_by_id == p.id),
    ).order_by(OpportunityQuestion.created_at.desc()).limit(100))).scalars().all()
    return [{**_out(q), "mine": q.asked_by_id == p.id} for q in rows]


class AskIn(BaseModel):
    question: str = Field(min_length=8, max_length=600)


@member_router.post("/{opp_id}/questions")
async def ask(opp_id: str, body: AskIn, p: Member, session: DB):
    await ask_limiter.hit(p.id)
    opp = await session.get(Opportunity, opp_id)
    if not opp or opp.status.value != "published":
        raise HTTPException(404, "Opportunity not found")
    q = OpportunityQuestion(opportunity_id=opp.id, asked_by_id=p.id, question=body.question.strip())
    session.add(q)
    org_users = (await session.execute(select(User.id).where(User.organization_id == opp.organization_id))).scalars()
    await notify(session, list(org_users), kind="questions", title="New question from a member",
                 body=f'About "{opp.title}": {q.question[:160]}', data={"opportunity_id": opp.id},
                 channels_=("email",))
    await session.commit()
    return {**_out(q), "mine": True}


class AnswerIn(BaseModel):
    answer: str = Field(min_length=2, max_length=2000)


async def _answer(session, q: OpportunityQuestion, answer: str, actor_id: str, platform: bool) -> None:
    q.answer, q.answered_by_id, q.answered_by_platform = answer.strip(), actor_id, platform
    q.answered_at, q.status = utcnow(), QuestionStatus.answered
    opp = await session.get(Opportunity, q.opportunity_id)
    if q.asked_by_id:
        await notify(session, [q.asked_by_id], kind="questions", title="Your question was answered",
                     body=f"{opp.title}: {q.answer[:180]}", data={"screen": "opportunity", "id": opp.id})


# ---------- organization ----------

@org_router.get("")
async def org_questions(p: OrgUser, session: DB, status: str = "pending"):
    rows = (await session.execute(
        select(OpportunityQuestion, Opportunity.title).join(Opportunity, Opportunity.id == OpportunityQuestion.opportunity_id)
        .where(Opportunity.organization_id == p.user.organization_id, OpportunityQuestion.status == status)
        .order_by(OpportunityQuestion.created_at.desc()).limit(200))).all()
    pending = await session.scalar(select(func.count()).select_from(OpportunityQuestion).join(
        Opportunity, Opportunity.id == OpportunityQuestion.opportunity_id).where(
        Opportunity.organization_id == p.user.organization_id, OpportunityQuestion.status == QuestionStatus.pending))
    return {"items": [_out(q, t) for q, t in rows], "pending": pending or 0}


@org_router.post("/{qid}/answer")
async def org_answer(qid: str, body: AnswerIn, p: OrgUser, session: DB):
    q = await session.get(OpportunityQuestion, qid)
    opp = await session.get(Opportunity, q.opportunity_id) if q else None
    if not q or opp.organization_id != p.user.organization_id or q.status == QuestionStatus.hidden:
        raise HTTPException(404, "Question not found")
    await _answer(session, q, body.answer, p.id, platform=False)
    record(session, actor_id=p.id, action="question.answered", entity="opportunity", entity_id=opp.id, ip=p.ip)
    await session.commit()
    return _out(q, opp.title)


# ---------- DEEN staff ----------

@admin_router.get("")
async def admin_questions(session: DB, p: Principal = require(Perm.opps_view), status: str = "pending"):
    rows = (await session.execute(
        select(OpportunityQuestion, Opportunity.title, User.full_name)
        .join(Opportunity, Opportunity.id == OpportunityQuestion.opportunity_id)
        .outerjoin(User, User.id == OpportunityQuestion.asked_by_id)
        .where(OpportunityQuestion.status == status).order_by(OpportunityQuestion.created_at.desc()).limit(300))).all()
    return [_out(q, t, n) for q, t, n in rows]


@admin_router.post("/{qid}/answer")
async def admin_answer(qid: str, body: AnswerIn, session: DB, p: Principal = require(Perm.opps_review)):
    q = await session.get(OpportunityQuestion, qid)
    if not q:
        raise HTTPException(404, "Question not found")
    await _answer(session, q, body.answer, p.id, platform=True)
    record(session, actor_id=p.id, action="question.answered", entity="question", entity_id=q.id, ip=p.ip)
    await session.commit()
    return _out(q)


@admin_router.post("/{qid}/hide")
async def admin_hide(qid: str, session: DB, p: Principal = require(Perm.reports_manage)):
    q = await session.get(OpportunityQuestion, qid)
    if not q:
        raise HTTPException(404, "Question not found")
    q.status = QuestionStatus.hidden
    record(session, actor_id=p.id, action="question.hidden", entity="question", entity_id=q.id, ip=p.ip)
    await session.commit()
    return {"ok": True}
