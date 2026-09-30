"""Validated input for creating/editing opportunities (organizations and DEEN staff)."""
from __future__ import annotations

import re
from datetime import datetime
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.opportunities.models import AccessTier, ApplyMode
from app.modules.taxonomy.data import (CATEGORIES, COMPENSATION, COUNTIES, COUNTRIES, EDUCATION_KEYS, INDUSTRIES,
                                       ISLAMIC_TAG_KEYS, USER_TYPE_KEYS, VOLUNTEER_CAUSES, WORK_MODES)

_TYPES = {t: c["key"] for c in CATEGORIES for t, _ in c["types"]}
_URL = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)
QUESTION_KINDS = {"short_text", "long_text", "single_choice", "multi_choice", "yes_no", "number", "date"}
_WORK_MODES = {k for k, _ in WORK_MODES}
_COMPENSATION = {k for k, _ in COMPENSATION}
_CAUSES = {k for k, _ in VOLUNTEER_CAUSES}
EVENT_TYPES = {"event", "workshop", "seminar"}


class Question(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:8], max_length=16)
    label: str = Field(min_length=2, max_length=200)
    kind: str = "short_text"
    required: bool = True
    options: list[str] = []

    @field_validator("kind")
    @classmethod
    def _kind(cls, v: str) -> str:
        if v not in QUESTION_KINDS:
            raise ValueError("Unknown question type")
        return v


class OpportunityIn(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    summary: str = Field("", max_length=400)
    description: str = Field("", max_length=20000)
    category: str
    type: str
    tags: list[str] = Field(default_factory=list, max_length=15)
    eligibility: str = Field("", max_length=8000)
    benefits: str = Field("", max_length=8000)
    requirements: str = Field("", max_length=8000)
    application_process: str = Field("", max_length=8000)
    country: str = "Kenya"
    counties: list[str] = []
    location_label: str | None = Field(None, max_length=160)
    work_mode: str = "physical"
    is_international: bool = False
    eligible_countries: list[str] = []
    industry: str | None = None
    department: str | None = Field(None, max_length=120)
    responsibilities: str = Field("", max_length=8000)
    duration_label: str | None = Field(None, max_length=80)
    duration_weeks: int | None = Field(None, ge=0, le=520)
    time_commitment: str | None = Field(None, max_length=120)
    compensation: str = "undisclosed"
    allowances: str | None = Field(None, max_length=200)
    certificate_provided: bool = False
    weekend: bool = False
    student_friendly: bool = False
    causes: list[str] = []
    contact_email: str | None = Field(None, max_length=254)
    contact_phone: str | None = Field(None, max_length=20)
    fields_of_study: list[str] = Field(default_factory=list, max_length=20)
    min_experience_years: int | None = Field(None, ge=0, le=50)
    target_user_types: list[str] = []
    islamic_tags: list[str] = []
    shariah_basis: str | None = Field(None, max_length=2000)
    education_levels: list[str] = []
    min_age: int | None = Field(None, ge=10, le=100)
    max_age: int | None = Field(None, ge=10, le=100)
    gender: str | None = None
    skills: list[str] = Field(default_factory=list, max_length=20)
    requires_verified_identity: bool = False
    deadline: datetime | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    venue: str | None = Field(None, max_length=200)
    is_event: bool = False
    amount_min: float | None = Field(None, ge=0)
    amount_max: float | None = Field(None, ge=0)
    amount_label: str | None = Field(None, max_length=80)
    slots: int | None = Field(None, ge=1)
    apply_mode: ApplyMode = ApplyMode.external
    external_url: str | None = Field(None, max_length=500)
    form_questions: list[Question] = Field(default_factory=list, max_length=25)
    required_documents: list[str] = Field(default_factory=list, max_length=10)
    attachments: list[dict] = Field(default_factory=list, max_length=10)
    access_tier: AccessTier = AccessTier.free
    feature_requested: bool = False

    @field_validator("tags", "skills", "required_documents", "fields_of_study")
    @classmethod
    def _clean_list(cls, v: list[str]) -> list[str]:
        seen, out = set(), []
        for item in v:
            item = item.strip()[:60]
            if item and item.lower() not in seen:
                seen.add(item.lower())
                out.append(item)
        return out

    @model_validator(mode="after")
    def _check(self):
        if self.type not in _TYPES or _TYPES[self.type] != self.category:
            raise ValueError("Choose a valid category and type")
        if bad := [c for c in self.counties if c not in COUNTIES]:
            raise ValueError(f"Unknown county: {bad[0]}")
        if bad := [e for e in self.education_levels if e not in EDUCATION_KEYS]:
            raise ValueError(f"Unknown education level: {bad[0]}")
        if self.work_mode not in _WORK_MODES:
            raise ValueError("Work mode must be physical, remote or hybrid")
        if self.compensation not in _COMPENSATION:
            raise ValueError("Choose paid, stipend, unpaid or not disclosed")
        if self.industry and self.industry not in INDUSTRIES:
            raise ValueError(f"Unknown industry: {self.industry}")
        if self.country not in COUNTRIES:
            raise ValueError(f"Unknown country: {self.country}")
        if bad := [c for c in self.eligible_countries if c not in COUNTRIES]:
            raise ValueError(f"Unknown country: {bad[0]}")
        if bad := [c for c in self.causes if c not in _CAUSES]:
            raise ValueError(f"Unknown cause: {bad[0]}")
        if bad := [t for t in self.target_user_types if t not in USER_TYPE_KEYS]:
            raise ValueError(f"Unknown user category: {bad[0]}")
        if bad := [t for t in self.islamic_tags if t not in ISLAMIC_TAG_KEYS]:
            raise ValueError(f"Unknown Islamic-friendly tag: {bad[0]}")
        # Spec section 25: never label Shariah-conscious without a credible, recorded basis.
        if "shariah_conscious" in self.islamic_tags and len((self.shariah_basis or "").strip()) < 20:
            raise ValueError("Explain the basis for the Shariah-conscious label (e.g. the certifying Shariah board)")
        if self.country != "Kenya":
            self.is_international = True
        if self.gender not in (None, "male", "female"):
            raise ValueError("Gender must be male, female or empty")
        if self.min_age and self.max_age and self.min_age > self.max_age:
            raise ValueError("Minimum age is above maximum age")
        if self.amount_min and self.amount_max and self.amount_min > self.amount_max:
            raise ValueError("Minimum amount is above maximum amount")
        if self.apply_mode == ApplyMode.external and self.external_url and not _URL.match(self.external_url):
            raise ValueError("Enter a full application link starting with https://")
        if self.starts_at and self.ends_at and self.ends_at < self.starts_at:
            raise ValueError("The event ends before it starts")
        if self.type in EVENT_TYPES:
            self.is_event = True
        for q in self.form_questions:
            if q.kind in ("single_choice", "multi_choice") and len(q.options) < 2:
                raise ValueError(f'Add at least two options to "{q.label}"')
        return self

    def to_columns(self) -> dict:
        data = self.model_dump()
        data["form_questions"] = [q.model_dump() for q in self.form_questions]
        data["attachments"] = [{"file_id": a.get("file_id"), "label": str(a.get("label") or "Attachment")[:80]}
                               for a in self.attachments if a.get("file_id")]
        return data


def submission_problems(opp) -> list[str]:
    """What must be filled in before an organization can submit for review."""
    missing = []
    if len(opp.summary or "") < 20:
        missing.append("a short summary")
    if len(opp.description or "") < 80:
        missing.append("a description")
    if opp.apply_mode == ApplyMode.external and not opp.external_url:
        missing.append("the application link")
    if not opp.deadline and not opp.is_event:
        missing.append("a deadline")
    if opp.is_event and not opp.starts_at:
        missing.append("the event date")
    return missing
