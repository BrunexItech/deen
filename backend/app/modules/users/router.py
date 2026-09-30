"""The signed-in user's account and member profile."""
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, select

from app.core.clock import age_on
from app.core.deps import DB, CurrentUser, Member
from app.modules.applications.models import Application, Outcome
from app.modules.files.models import StoredFile
from app.modules.opportunities.models import SavedOpportunity
from app.modules.taxonomy.data import (CATEGORIES, CATEGORY_KEYS, COUNTIES, COUNTRIES, EDUCATION_KEYS,
                                       EMPLOYMENT_STATUSES, INDUSTRIES, USER_TYPE_KEYS)
from app.modules.users.models import MemberProfile, User
from app.modules.users.service import user_payload

router = APIRouter(prefix="/api/v1/me", tags=["me"])

_TYPE_KEYS = {t for c in CATEGORIES for t, _ in c["types"]}
_EMPLOYMENT = {k for k, _ in EMPLOYMENT_STATUSES}


@router.get("")
async def me(p: CurrentUser, session: DB):
    return await user_payload(session, p.user)


class AccountIn(BaseModel):
    full_name: str | None = Field(None, min_length=3, max_length=120)
    email: EmailStr | None = None
    avatar_file_id: str | None = None


@router.patch("")
async def update_me(body: AccountIn, p: CurrentUser, session: DB):
    user = await session.get(User, p.id)
    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"]:
        email = data["email"].lower()
        if email != user.email and await session.scalar(select(User.id).where(User.email == email)):
            raise HTTPException(409, "That email is already used by another account")
        if email != user.email:
            user.email, user.email_verified_at = email, None
    if data.get("full_name"):
        user.full_name = data["full_name"].strip()
    if "avatar_file_id" in data:
        f = await session.get(StoredFile, data["avatar_file_id"]) if data["avatar_file_id"] else None
        if data["avatar_file_id"] and (not f or f.owner_id != p.id or f.purpose != "avatar"):
            raise HTTPException(422, "Upload the photo first")
        user.avatar_file_id = data["avatar_file_id"]
    await session.commit()
    return await user_payload(session, user)


# ---------- member profile ----------

PROFILE_FIELDS = ("country", "county", "town", "date_of_birth", "gender", "education_level", "field_of_study",
                  "institution", "profession", "employment_status", "user_types", "industry", "business_sector",
                  "years_in_business", "experience_years", "bio", "skills", "interests", "opportunity_types",
                  "career_interests", "business_interests", "languages", "whatsapp_opt_in")


def completeness(p: MemberProfile | None) -> tuple[int, list[str]]:
    if not p:
        return 0, ["location", "education", "interests", "skills"]
    checks = {
        "location": bool(p.county or (p.country and p.country != "Kenya")), "age": bool(p.date_of_birth),
        "who you are": len(p.user_types or []) >= 1, "education": bool(p.education_level),
        "field of study or profession": bool(p.field_of_study or p.profession),
        "work status": bool(p.employment_status), "skills": len(p.skills or []) >= 2,
        "interests": len(p.interests or []) >= 1, "opportunity types": len(p.opportunity_types or []) >= 1,
        "languages": len(p.languages or []) >= 1, "short bio": bool(p.bio),
    }
    done = sum(checks.values())
    return round(100 * done / len(checks)), [k for k, v in checks.items() if not v]


def profile_out(p: MemberProfile | None) -> dict:
    pct, missing = completeness(p)
    data = {f: getattr(p, f) if p else None for f in PROFILE_FIELDS}
    for f in ("skills", "interests", "opportunity_types", "career_interests", "business_interests", "languages",
              "user_types"):
        data[f] = data[f] or []
    data.update({"age": age_on(p.date_of_birth) if p else None, "completeness": pct, "missing": missing,
                 "onboarding_completed": bool(p and p.onboarding_completed)})
    return data


class ProfileIn(BaseModel):
    country: str | None = None
    county: str | None = None
    town: str | None = Field(None, max_length=80)
    date_of_birth: date | None = None
    gender: str | None = None
    education_level: str | None = None
    field_of_study: str | None = Field(None, max_length=120)
    institution: str | None = Field(None, max_length=160)
    profession: str | None = Field(None, max_length=120)
    employment_status: str | None = None
    user_types: list[str] | None = None
    industry: str | None = None
    business_sector: str | None = Field(None, max_length=80)
    years_in_business: int | None = Field(None, ge=0, le=80)
    experience_years: int | None = Field(None, ge=0, le=60)
    whatsapp_opt_in: bool | None = None
    bio: str | None = Field(None, max_length=600)
    skills: list[str] | None = Field(None, max_length=30)
    interests: list[str] | None = None
    opportunity_types: list[str] | None = None
    career_interests: list[str] | None = Field(None, max_length=10)
    business_interests: list[str] | None = Field(None, max_length=10)
    languages: list[str] | None = Field(None, max_length=10)
    onboarding_completed: bool | None = None

    @field_validator("county")
    @classmethod
    def _county(cls, v):
        if v and v not in COUNTIES:
            raise ValueError("Choose a Kenyan county")
        return v

    @field_validator("country")
    @classmethod
    def _country(cls, v):
        if v and v not in COUNTRIES:
            raise ValueError("Choose a country")
        return v

    @field_validator("industry")
    @classmethod
    def _industry(cls, v):
        if v and v not in INDUSTRIES:
            raise ValueError("Choose an industry")
        return v

    @field_validator("user_types")
    @classmethod
    def _user_types(cls, v):
        return [t for t in (v or []) if t in USER_TYPE_KEYS] if v is not None else None

    @field_validator("gender")
    @classmethod
    def _gender(cls, v):
        if v and v not in ("male", "female"):
            raise ValueError("Choose male or female")
        return v

    @field_validator("education_level")
    @classmethod
    def _edu(cls, v):
        if v and v not in EDUCATION_KEYS:
            raise ValueError("Choose an education level")
        return v

    @field_validator("employment_status")
    @classmethod
    def _emp(cls, v):
        if v and v not in _EMPLOYMENT:
            raise ValueError("Choose a work status")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def _dob(cls, v):
        if v and not (12 <= (age_on(v) or 0) <= 100):
            raise ValueError("Enter a valid date of birth")
        return v

    @field_validator("interests")
    @classmethod
    def _interests(cls, v):
        return [i for i in (v or []) if i in CATEGORY_KEYS] if v is not None else None

    @field_validator("opportunity_types")
    @classmethod
    def _types(cls, v):
        return [t for t in (v or []) if t in _TYPE_KEYS] if v is not None else None

    @field_validator("skills", "career_interests", "business_interests", "languages")
    @classmethod
    def _tags(cls, v):
        if v is None:
            return None
        seen, out = set(), []
        for s in v:
            s = s.strip()[:60]
            if s and s.lower() not in seen:
                seen.add(s.lower())
                out.append(s)
        return out


@router.get("/profile")
async def get_profile(p: Member, session: DB):
    return profile_out(await session.scalar(select(MemberProfile).where(MemberProfile.user_id == p.id)))


@router.put("/profile")
async def put_profile(body: ProfileIn, p: Member, session: DB):
    prof = await session.scalar(select(MemberProfile).where(MemberProfile.user_id == p.id))
    if not prof:
        prof = MemberProfile(user_id=p.id)
        session.add(prof)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(prof, k, v)
    await session.commit()
    return profile_out(prof)


@router.get("/stats")
async def stats(p: Member, session: DB):
    by_status = dict((await session.execute(select(Application.status, func.count()).where(
        Application.user_id == p.id).group_by(Application.status))).all())
    saved = await session.scalar(select(func.count()).select_from(SavedOpportunity).where(
        SavedOpportunity.user_id == p.id))
    outcomes = await session.scalar(select(func.count()).select_from(Outcome).where(Outcome.user_id == p.id))
    return {"applications": sum(by_status.values()),
            "by_status": {k.value: v for k, v in by_status.items()},
            "saved": saved or 0, "outcomes": outcomes or 0}
