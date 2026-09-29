"""File storage behind a tiny interface: local disk today, object storage (S3/R2)
tomorrow by swapping `_Backend` — callers only see save/read."""
import io
import os
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_bytes, encrypt_bytes
from app.modules.files.models import StoredFile

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
DOC_TYPES = {"application/pdf"}
PURPOSES = {"avatar", "logo", "attachment", "application", "identity", "directory", "org_document"}
# Purposes whose files are sensitive: encrypted at rest and never public.
SENSITIVE = {"identity", "application"}
PUBLIC = {"avatar", "logo", "attachment", "directory"}


class _Backend:
    def __init__(self, root: str):
        self.root = Path(root) / "files"

    def write(self, key: str, data: bytes) -> None:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, path)

    def read(self, key: str) -> bytes:
        return (self.root / key).read_bytes()

    def delete(self, key: str) -> None:
        (self.root / key).unlink(missing_ok=True)


storage = _Backend(settings.data_dir)


def _sniff(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:5] == b"%PDF-":
        return "application/pdf"
    return None


def _clean_image(data: bytes, max_side: int) -> tuple[bytes, str]:
    """Re-encodes the image: strips EXIF (GPS location!) and caps its size."""
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im)
        im.thumbnail((max_side, max_side))
        has_alpha = im.mode in ("RGBA", "LA", "P")
        out = io.BytesIO()
        if has_alpha:
            im.convert("RGBA").save(out, "PNG", optimize=True)
            return out.getvalue(), "image/png"
        im.convert("RGB").save(out, "JPEG", quality=85, optimize=True)
        return out.getvalue(), "image/jpeg"


async def save_upload(session: AsyncSession, upload: UploadFile, *, purpose: str, owner_id: str | None,
                      organization_id: str | None = None) -> StoredFile:
    if purpose not in PURPOSES:
        raise HTTPException(422, "Unknown upload purpose")
    data = await upload.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Files must be smaller than {settings.max_upload_mb} MB")
    kind = _sniff(data)
    allowed = IMAGE_TYPES if purpose in {"avatar", "logo", "directory"} else IMAGE_TYPES | DOC_TYPES
    if kind not in allowed:
        raise HTTPException(415, "Upload a JPG, PNG, WEBP" + ("" if allowed == IMAGE_TYPES else " or PDF") + " file")
    if kind in IMAGE_TYPES:
        try:
            data, kind = _clean_image(data, 512 if purpose in {"avatar", "logo"} else 2000)
        except Exception:
            raise HTTPException(415, "That image could not be read")
    encrypted = purpose in SENSITIVE
    key = f"{purpose}/{uuid4().hex}"
    storage.write(key, encrypt_bytes(data) if encrypted else data)
    name = (upload.filename or "file").replace("/", "_")[-150:]
    row = StoredFile(owner_id=owner_id, organization_id=organization_id, purpose=purpose, filename=name,
                     content_type=kind, size=len(data), storage_key=key, public=purpose in PUBLIC,
                     encrypted=encrypted)
    session.add(row)
    await session.flush()
    return row


def read_file(row: StoredFile) -> bytes:
    data = storage.read(row.storage_key)
    return decrypt_bytes(data) if row.encrypted else data
