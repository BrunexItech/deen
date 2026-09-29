from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.deps import DB, CurrentUser
from app.core.ratelimit import RateLimiter
from app.modules.directory.models import DirectoryListing
from app.modules.moderation.models import REPORT_REASONS, Report, ReportStatus
from app.modules.opportunities.models import Opportunity, OppStatus
from app.modules.opportunities.service import transition
from app.modules.orgs.models import Organization

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])
report_limiter = RateLimiter("report", 10, 3600)

TARGETS = {"opportunity": Opportunity, "organization": Organization, "directory": DirectoryListing}
# An opportunity reported by this many different members for fraud is pulled for review automatically.
AUTO_HOLD_THRESHOLD = 3


@router.get("/reasons")
async def reasons():
    return [{"key": k, "label": v} for k, v in REPORT_REASONS.items()]


class ReportIn(BaseModel):
    target_type: str
    target_id: str
    reason: str
    details: str | None = Field(None, max_length=2000)


@router.post("")
async def create_report(body: ReportIn, p: CurrentUser, session: DB):
    await report_limiter.hit(p.id)
    model = TARGETS.get(body.target_type)
    if not model or body.reason not in REPORT_REASONS:
        raise HTTPException(422, "Choose what you're reporting and why")
    target = await session.get(model, body.target_id)
    if not target:
        raise HTTPException(404, "Not found")
    dup = await session.scalar(select(Report.id).where(Report.reporter_id == p.id, Report.target_id == body.target_id,
                                                       Report.status == ReportStatus.open))
    if not dup:
        session.add(Report(reporter_id=p.id, target_type=body.target_type, target_id=body.target_id,
                           reason=body.reason, details=body.details))
        await session.flush()
    if body.target_type == "opportunity" and body.reason in ("scam", "fee"):
        reporters = await session.scalar(select(func.count(func.distinct(Report.reporter_id))).where(
            Report.target_id == target.id, Report.reason.in_(["scam", "fee"]), Report.status == ReportStatus.open))
        if reporters >= AUTO_HOLD_THRESHOLD and target.status.value == "published":
            await transition(session, target, OppStatus.under_review, None,
                             f"Automatically held: {reporters} members reported possible fraud")
    await session.commit()
    return {"ok": True, "message": "Thank you. Our trust & safety team will review this. JazakAllahu khayran."}
