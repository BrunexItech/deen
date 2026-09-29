"""Member identity verification: ID document + live selfie, reviewed by DEEN."""
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.audit import record
from app.core.crypto import encrypt_text
from app.core.deps import DB, Member
from app.modules.files.models import StoredFile
from app.modules.identity.models import IdentityVerification
from app.modules.users.models import IdentityStatus, User

router = APIRouter(prefix="/api/v1/identity", tags=["identity"])


class IdentityIn(BaseModel):
    id_type: str = Field("national_id", pattern="^(national_id|passport|alien_id)$")
    id_number: str = Field(min_length=5, max_length=20)
    id_front_file_id: str
    selfie_file_id: str


@router.get("")
async def status(p: Member, session: DB):
    latest = await session.scalar(select(IdentityVerification).where(IdentityVerification.user_id == p.id)
                                  .order_by(IdentityVerification.created_at.desc()).limit(1))
    return {"status": p.user.identity_status.value,
            "note": latest.review_note if latest and latest.status == "rejected" else None,
            "submitted_at": latest.created_at if latest else None}


@router.post("")
async def submit(body: IdentityIn, p: Member, session: DB):
    user = await session.get(User, p.id)
    if user.identity_status in (IdentityStatus.pending, IdentityStatus.verified):
        raise HTTPException(409, "Your identity is already " + user.identity_status.value)
    number = re.sub(r"[^A-Za-z0-9]", "", body.id_number).upper()
    for fid in (body.id_front_file_id, body.selfie_file_id):
        f = await session.get(StoredFile, fid)
        if not f or f.owner_id != p.id or f.purpose != "identity":
            raise HTTPException(422, "Upload your ID photo and selfie first")
    session.add(IdentityVerification(user_id=p.id, id_type=body.id_type, id_number_enc=encrypt_text(number),
                                     id_last4=number[-4:], id_front_file_id=body.id_front_file_id,
                                     selfie_file_id=body.selfie_file_id))
    user.identity_status = IdentityStatus.pending
    record(session, actor_id=p.id, action="identity.submitted", entity="user", entity_id=p.id, ip=p.ip)
    await session.commit()
    return {"status": "pending"}
