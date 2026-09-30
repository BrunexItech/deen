"""DEEN's opportunity matching engine.

Pure functions (no I/O): given what we know about a member and an opportunity,
return a 0-100 *preliminary* profile match, the human reasons behind it, and any
hard eligibility blockers. The engine assists; it never decides eligibility on an
organization's behalf (spec section 13): blockers only keep an opportunity out of
"For You", and the member still sees it in Explore with a clear explanation.

Weights (sum = 100):
  interest in category 16, preferred type 8, location 12, education 12, skills 14,
  field/profession keywords 8, industry 8, member category 10, learned affinity 7,
  urgency 5
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.core.clock import age_on, utcnow
from app.modules.taxonomy.data import EDUCATION_LEVELS, USER_TYPES

_EDU_LABEL = dict(EDUCATION_LEVELS)
_USER_TYPE_LABEL = dict(USER_TYPES)
_PLURAL = {"student": "students", "graduate": "graduates", "entrepreneur": "entrepreneurs",
           "professional": "professionals", "job_seeker": "job seekers", "young_person": "young people",
           "woman_entrepreneur": "women entrepreneurs", "researcher": "researchers",
           "community_worker": "community workers", "other": "people"}
_WORD = re.compile(r"[a-z][a-z+#']{2,}")
_STOP = {"and", "the", "for", "with", "of", "in", "at", "studies", "student", "general", "other"}

_PHRASES = {
    "education": "education & scholarships", "career": "careers & experience", "entrepreneurship": "business & funding",
    "community": "community & development", "islamic_economy": "the Islamic economy", "support": "support programmes",
}

DISCLAIMER = ("Preliminary match based on your profile. The organization makes the final eligibility "
              "and selection decision.")


@dataclass
class MemberSignals:
    country: str | None = "Kenya"
    county: str | None = None
    age: int | None = None
    gender: str | None = None
    education_level: str | None = None
    skills: set[str] = field(default_factory=set)
    interests: set[str] = field(default_factory=set)
    types: set[str] = field(default_factory=set)
    user_types: set[str] = field(default_factory=set)
    industry: str | None = None
    experience_years: int | None = None
    keywords: set[str] = field(default_factory=set)
    affinity: dict[str, float] = field(default_factory=dict)

    @classmethod
    def from_profile(cls, profile) -> "MemberSignals":
        if profile is None:
            return cls()
        words: set[str] = set()
        for text in (profile.field_of_study, profile.profession, profile.business_sector,
                     *(profile.career_interests or []), *(profile.business_interests or [])):
            words |= {w for w in _WORD.findall((text or "").lower()) if w not in _STOP}
        return cls(
            country=profile.country or "Kenya",
            county=profile.county,
            age=age_on(profile.date_of_birth),
            gender=profile.gender,
            education_level=profile.education_level,
            skills={s.lower() for s in (profile.skills or [])},
            interests=set(profile.interests or []),
            types=set(profile.opportunity_types or []),
            user_types=set(profile.user_types or []),
            industry=profile.industry,
            experience_years=profile.experience_years,
            keywords=words,
            affinity=dict(profile.affinity or {}),
        )


@dataclass
class Match:
    score: int
    eligible: bool
    reasons: list[str]
    blockers: list[str]


def _blockers(opp, m: MemberSignals) -> list[str]:
    out: list[str] = []
    localised = opp.counties and opp.work_mode != "remote" and not opp.is_international
    if localised and m.county and m.county not in opp.counties:
        more = "..." if len(opp.counties) > 3 else ""
        out.append("Only open to applicants in " + ", ".join(opp.counties[:3]) + more)
    if opp.eligible_countries and m.country and m.country not in opp.eligible_countries:
        out.append("Not open to applicants from " + m.country)
    if opp.education_levels and m.education_level and m.education_level not in opp.education_levels:
        out.append("For " + ", ".join(_EDU_LABEL.get(e, e) for e in opp.education_levels[:3]) + " applicants")
    if m.age is not None:
        if opp.min_age and m.age < opp.min_age:
            out.append(f"Minimum age is {opp.min_age}")
        if opp.max_age and m.age > opp.max_age:
            out.append(f"Maximum age is {opp.max_age}")
    if opp.gender and m.gender and opp.gender != m.gender:
        out.append("For " + ("women" if opp.gender == "female" else "men") + " only")
    if opp.min_experience_years and m.experience_years is not None and m.experience_years < opp.min_experience_years:
        out.append(f"Needs at least {opp.min_experience_years} year{'s' if opp.min_experience_years > 1 else ''} of experience")
    return out


def evaluate(opp, m: MemberSignals, now: datetime | None = None) -> Match:
    now = now or utcnow()
    score = 0.0
    reasons: list[tuple[float, str]] = []

    if opp.category in m.interests:
        score += 16
        reasons.append((16, "You're interested in " + _PHRASES.get(opp.category, opp.category)))
    if opp.type in m.types:
        score += 8
        reasons.append((8, "A type of opportunity you asked for"))

    targets = set(opp.target_user_types or [])
    if targets & m.user_types:
        score += 10
        reasons.append((10, f"Aimed at {_PLURAL[sorted(targets & m.user_types)[0]]} like you"))
    elif not targets:
        score += 4

    if opp.work_mode == "remote":
        score += 9
        reasons.append((4, "Remote: take part from anywhere"))
    elif opp.is_international:
        score += 5
    elif not opp.counties:
        score += 9
    elif m.county and m.county in opp.counties:
        score += 12
        reasons.append((12, f"In {m.county}, near you"))

    if not opp.education_levels:
        score += 5
    elif m.education_level in opp.education_levels:
        score += 12
        reasons.append((12, "Matches your education: " + _EDU_LABEL.get(m.education_level, m.education_level)))

    text = " ".join([opp.title or "", opp.summary or "", " ".join(opp.tags or []), " ".join(opp.skills or []),
                     " ".join(opp.fields_of_study or [])]).lower()
    opp_skills = {s.lower() for s in (opp.skills or [])}
    matched = (m.skills & opp_skills) | {s for s in m.skills if len(s) > 3 and s in text}
    if matched:
        pts = min(14.0, 14.0 * len(matched) / max(len(opp_skills), 3) + 3)
        score += pts
        names = ", ".join(n.title() for n in sorted(matched)[:2])
        reasons.append((pts, ("Uses your skills: " if len(matched) > 1 else "Uses your skill: ") + names))

    hits = {w for w in m.keywords if w in text}
    if hits:
        score += 8
        reasons.append((8, "Related to your field: " + max(hits, key=len)))

    if opp.industry and m.industry and opp.industry == m.industry:
        score += 8
        reasons.append((8, f"In your industry: {opp.industry}"))

    if m.affinity:
        top = max(m.affinity.values()) or 1
        score += 7 * min(1.0, m.affinity.get(opp.category, 0) / top)

    if opp.deadline and now < opp.deadline <= now + timedelta(days=10):
        score += 5

    blockers = _blockers(opp, m)
    final = int(round(min(100.0, score)))
    ordered = [r for _, r in sorted(reasons, key=lambda x: -x[0])][:3]
    return Match(score=min(final, 25) if blockers else final, eligible=not blockers, reasons=ordered,
                 blockers=blockers)


def headline(m: MemberSignals, profile) -> str | None:
    """The spec's framing sentence: "You are a student studying Business Administration in
    Mombasa. Here are opportunities that may match your profile." """
    if profile is None:
        return None
    who = None
    for key in ("woman_entrepreneur", "student", "graduate", "entrepreneur", "professional", "researcher",
                "job_seeker", "community_worker", "young_person"):
        if key in m.user_types:
            who = _USER_TYPE_LABEL[key].lower()
            break
    parts = [f"You are a {who}" if who else "Based on your profile"]
    if profile.field_of_study and who in ("student", "graduate", "researcher"):
        parts.append(f"in {profile.field_of_study}")
    elif profile.business_sector and who and "entrepreneur" in who:
        parts.append(f"in the {profile.business_sector.lower()} sector")
    if m.county:
        parts.append(f"in {m.county}")
    return " ".join(parts) + ". Here are opportunities that may match your profile."


def bump_affinity(affinity: dict | None, category: str, weight: float) -> dict:
    """Exponential decay keeps recent behaviour dominant and bounds the values."""
    aff = {k: round(v * 0.97, 3) for k, v in (affinity or {}).items() if v * 0.97 > 0.05}
    aff[category] = round(min(100.0, aff.get(category, 0) + weight), 3)
    return aff
