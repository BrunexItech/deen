"""Muslim business & professional directory (member side)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import or_, select

from app.core.deps import DB, Member
from app.core.phone import to_e164
from app.modules.directory.models import DIRECTORY_CATEGORIES, DirectoryListing, ListingStatus
from app.modules.taxonomy.data import COUNTIES

router = APIRouter(prefix="/api/v1/directory", tags=["directory"])


def listing_out(d: DirectoryListing, owner: bool = False) -> dict:
    out = {"id": d.id, "kind": d.kind, "name": d.name, "headline": d.headline, "category": d.category,
           "category_label": DIRECTORY_CATEGORIES.get(d.category, d.category), "description": d.description,
           "county": d.county, "town": d.town, "phone": d.phone, "whatsapp": d.whatsapp, "email": d.email,
           "website": d.website, "services": d.services, "halal_certified": d.halal_certified,
           "logo_url": f"/api/v1/files/{d.logo_file_id}" if d.logo_file_id else None, "verified": d.verified,
           "logo_file_id": d.logo_file_id}
    if owner:
        out.update({"status": d.status.value, "review_note": d.review_note})
    return out


@router.get("/categories")
async def categories():
    return [{"key": k, "label": v} for k, v in DIRECTORY_CATEGORIES.items()]


@router.get("")
async def search(p: Member, session: DB, q: str | None = None, category: str | None = None,
                 county: str | None = None, kind: str | None = None, page: int = 1):
    stmt = select(DirectoryListing).where(DirectoryListing.status == ListingStatus.approved)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(DirectoryListing.name.ilike(like), DirectoryListing.headline.ilike(like),
                              DirectoryListing.services.any(q.strip())))
    if category:
        stmt = stmt.where(DirectoryListing.category == category)
    if county:
        stmt = stmt.where(DirectoryListing.county == county)
    if kind:
        stmt = stmt.where(DirectoryListing.kind == kind)
    page = max(1, min(page, 50))
    rows = (await session.execute(stmt.order_by(DirectoryListing.verified.desc(), DirectoryListing.name)
                                  .offset((page - 1) * 30).limit(30))).scalars()
    return [listing_out(d) for d in rows]


@router.get("/mine")
async def mine(p: Member, session: DB):
    rows = (await session.execute(select(DirectoryListing).where(DirectoryListing.owner_id == p.id))).scalars()
    return [listing_out(d, owner=True) for d in rows]


@router.get("/{listing_id}")
async def get_listing(listing_id: str, p: Member, session: DB):
    d = await session.get(DirectoryListing, listing_id)
    if not d or (d.status != ListingStatus.approved and d.owner_id != p.id):
        raise HTTPException(404, "Listing not found")
    return listing_out(d, owner=d.owner_id == p.id)


class ListingIn(BaseModel):
    kind: str = Field(pattern="^(business|professional)$")
    name: str = Field(min_length=2, max_length=160)
    headline: str = Field(min_length=5, max_length=200)
    category: str
    description: str | None = Field(None, max_length=3000)
    county: str | None = None
    town: str | None = Field(None, max_length=80)
    phone: str | None = None
    whatsapp: str | None = None
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=300)
    services: list[str] = Field(default_factory=list, max_length=15)
    halal_certified: bool = False
    logo_file_id: str | None = None

    @field_validator("category")
    @classmethod
    def _cat(cls, v):
        if v not in DIRECTORY_CATEGORIES:
            raise ValueError("Choose a category")
        return v

    @field_validator("county")
    @classmethod
    def _county(cls, v):
        if v and v not in COUNTIES:
            raise ValueError("Choose a Kenyan county")
        return v

    @field_validator("phone", "whatsapp")
    @classmethod
    def _phone(cls, v):
        return to_e164(v) if v else None


@router.post("")
async def create_listing(body: ListingIn, p: Member, session: DB):
    count = len((await session.execute(select(DirectoryListing.id).where(DirectoryListing.owner_id == p.id))).all())
    if count >= 3:
        raise HTTPException(409, "You can list up to 3 businesses or profiles")
    d = DirectoryListing(owner_id=p.id, **body.model_dump())
    session.add(d)
    await session.commit()
    return listing_out(d, owner=True)


@router.put("/{listing_id}")
async def update_listing(listing_id: str, body: ListingIn, p: Member, session: DB):
    d = await session.get(DirectoryListing, listing_id)
    if not d or d.owner_id != p.id:
        raise HTTPException(404, "Listing not found")
    for k, v in body.model_dump().items():
        setattr(d, k, v)
    d.status, d.verified = ListingStatus.pending, False  # changes are re-reviewed
    await session.commit()
    return listing_out(d, owner=True)


@router.delete("/{listing_id}")
async def delete_listing(listing_id: str, p: Member, session: DB):
    d = await session.get(DirectoryListing, listing_id)
    if not d or d.owner_id != p.id:
        raise HTTPException(404, "Listing not found")
    await session.delete(d)
    await session.commit()
    return {"ok": True}
