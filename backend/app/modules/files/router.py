from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.core.audit import record
from app.core.deps import DB, CurrentUser, MaybeUser
from app.core.roles import Perm, is_org, is_platform
from app.modules.files.models import StoredFile
from app.modules.files.service import read_file, save_upload

router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.post("")
async def upload(p: CurrentUser, session: DB, purpose: str = Form(...), file: UploadFile = File(...)):
    if purpose == "logo" and not (is_org(p.role) or is_platform(p.role)):
        raise HTTPException(403, "Only organizations can upload logos")
    org_id = p.user.organization_id if is_org(p.role) else None
    row = await save_upload(session, file, purpose=purpose, owner_id=p.id, organization_id=org_id)
    await session.commit()
    return {"id": row.id, "url": f"/api/v1/files/{row.id}", "filename": row.filename,
            "content_type": row.content_type, "size": row.size}


def _may_read(row: StoredFile, p) -> bool:
    if row.public:
        return True
    if p is None:
        return False
    if row.owner_id == p.id:
        return True
    if row.purpose == "identity":
        return p.can(Perm.identity_review)
    if is_platform(p.role):
        return p.can(Perm.users_view) or p.can(Perm.apps_view) or p.can(Perm.orgs_view)
    return bool(row.organization_id and is_org(p.role) and p.user.organization_id == row.organization_id)


@router.get("/{file_id}")
async def download(file_id: str, p: MaybeUser, session: DB):
    row = await session.get(StoredFile, file_id)
    if not row or not _may_read(row, p):
        raise HTTPException(404, "File not found")
    if row.purpose in {"identity", "application"} and p and row.owner_id != p.id:
        record(session, actor_id=p.id, action="file.viewed", entity="file", entity_id=row.id, ip=p.ip,
               purpose=row.purpose)
        await session.commit()
    headers = {"Content-Disposition": f'inline; filename="{row.filename}"',
               "Cache-Control": "public, max-age=86400" if row.public else "private, no-store"}
    return Response(read_file(row), media_type=row.content_type, headers=headers)
