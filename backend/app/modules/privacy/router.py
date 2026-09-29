"""Data subject rights (Kenya Data Protection Act 2019): access (export) and erasure."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select

from app.core.audit import record
from app.core.clock import utcnow
from app.core.deps import DB, CurrentUser
from app.core.roles import Role
from app.core.security import verify_password
from app.modules.applications.models import Application
from app.modules.directory.models import DirectoryListing
from app.modules.identity.models import IdentityVerification
from app.modules.notifications.models import Notification, PushToken
from app.modules.opportunities.models import SavedOpportunity
from app.modules.subscriptions.models import Payment
from app.modules.users.models import MemberProfile, User, UserStatus
from app.modules.users.router import profile_out
from app.modules.users.service import revoke_all

router = APIRouter(prefix="/api/v1/me/privacy", tags=["privacy"])


@router.get("/export")
async def export(p: CurrentUser, session: DB):
    user = await session.get(User, p.id)
    profile = await session.scalar(select(MemberProfile).where(MemberProfile.user_id == p.id))
    apps = (await session.execute(select(Application).where(Application.user_id == p.id))).scalars().all()
    pays = (await session.execute(select(Payment).where(Payment.user_id == p.id))).scalars().all()
    saved = (await session.execute(select(SavedOpportunity.opportunity_id).where(
        SavedOpportunity.user_id == p.id))).scalars().all()
    record(session, actor_id=p.id, action="privacy.exported", entity="user", entity_id=p.id, ip=p.ip)
    await session.commit()
    return {
        "exported_at": utcnow(),
        "account": {"full_name": user.full_name, "phone": user.phone, "email": user.email, "role": user.role.value,
                    "created_at": user.created_at, "identity_status": user.identity_status.value},
        "profile": profile_out(profile),
        "applications": [{"opportunity_id": a.opportunity_id, "status": a.status.value, "cover_note": a.cover_note,
                          "answers": a.answers, "created_at": a.created_at} for a in apps],
        "payments": [{"amount_kes": float(x.amount_kes), "status": x.status.value, "receipt": x.receipt,
                      "created_at": x.created_at} for x in pays],
        "saved_opportunities": list(saved),
    }


class DeleteIn(BaseModel):
    password: str
    reason: str | None = None


@router.post("/delete")
async def delete_account(body: DeleteIn, p: CurrentUser, session: DB):
    """Erases personal data and keeps only what the law requires (payment records,
    de-identified). Applications stay with organizations as an anonymised record."""
    user = await session.get(User, p.id)
    if user.role != Role.member:
        raise HTTPException(403, "Staff accounts are removed by a DEEN administrator")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(400, "Your password is not correct")
    await revoke_all(session, user.id)
    owned = ((MemberProfile, MemberProfile.user_id), (SavedOpportunity, SavedOpportunity.user_id),
             (Notification, Notification.user_id), (PushToken, PushToken.user_id),
             (IdentityVerification, IdentityVerification.user_id), (DirectoryListing, DirectoryListing.owner_id))
    for model, owner_col in owned:
        await session.execute(delete(model).where(owner_col == user.id))
    for a in (await session.execute(select(Application).where(Application.user_id == user.id))).scalars():
        a.profile_snapshot = {"full_name": "Deleted member"}
        a.cover_note, a.answers, a.documents = None, {}, []
    user.full_name = "Deleted member"
    user.phone = user.email = user.password_hash = user.totp_secret_enc = user.avatar_file_id = None
    user.status = UserStatus.deleted
    record(session, actor_id=user.id, action="privacy.account_deleted", entity="user", entity_id=user.id,
           ip=p.ip, reason=(body.reason or "")[:200])
    await session.commit()
    return {"ok": True}
