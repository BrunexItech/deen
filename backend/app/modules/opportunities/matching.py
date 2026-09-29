"""DEEN's opportunity matching engine.

Pure functions (no I/O): given what we know about a member and an opportunity,
return a 0-100 relevance score, the human reasons behind it, and any hard
eligibility blockers. The engine assists; it never decides eligibility on an
organization's behalf. Blockers only keep an opportunity out of "For You"; the
member still sees it in Explore with a clear explanation.

Weights (sum = 100):
  interest in category 22, preferred type 10, location 15, education 15,
  skills 18, field/profession keywords 8, learned affinity 7, urgency 5
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.core.clock import age_on, utcnow
from app.modules.taxonomy.data import EDUCATION_LEVELS

_EDU_LABEL = dict(EDUCATION_LEVELS)
_WORD = re.compile(r"[a-z][a-z+#']{2,}")
_STOP = {"and", "the", "for", "with", "of", "in", "at", "studies", "student", "general", "other"}

_PHRASES = {
    "education": "scholarships & education", "employment": "jobs & careers", "business": "business & funding",
    "support": "financial support", "learning": "learning & growth", "community": "community programmes",
}


@dataclass
class MemberSignals:
    county: str | None = None
    age: int | None = None
    gender: str | None = None
    education_level: str | None = None
    skills: set[str] = field(default_factory=set)
    interests: set[str] = field(default_factory=set)
    types: set[str] = field(default_factory=set)
    keywords: set[str] = field(default_factory=set)
    affinity: dict[str, float] = field(default_factory=dict)

    @classmethod
    def from_profile(cls, profile) -> "MemberSignals":
        if profile is None:
            return cls()
        words: set[str] = set()
        for text in (profile.field_of_study, profile.profession, *(profile.career_interests or []),
                     *(profile.business_interests or [])):
            words |= {w for w in _WORD.findall((text or "").lower()) if w not in _STOP}
        return cls(
            county=profile.county,
            age=age_on(profile.date_of_birth),
            gender=profile.gender,
            education_level=profile.education_level,
            skills={s.lower() for s in (profile.skills or [])},
            interests=set(profile.interests or []),
            types=set(profile.opportunity_types or []),
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
    if opp.counties and not (opp.is_remote or opp.is_international) and m.county and m.county not in opp.counties:
        more = "..." if len(opp.counties) > 3 else ""
        out.append("Only open to applicants in " + ", ".join(opp.counties[:3]) + more)
    if opp.education_levels and m.education_level and m.education_level not in opp.education_levels:
        out.append("For " + ", ".join(_EDU_LABEL.get(e, e) for e in opp.education_levels[:3]) + " applicants")
    if m.age is not None:
        if opp.min_age and m.age < opp.min_age:
            out.append(f"Minimum age is {opp.min_age}")
        if opp.max_age and m.age > opp.max_age:
            out.append(f"Maximum age is {opp.max_age}")
    if opp.gender and m.gender and opp.gender != m.gender:
        out.append("For " + ("sisters" if opp.gender == "female" else "brothers") + " only")
    return out


def evaluate(opp, m: MemberSignals, now: datetime | None = None) -> Match:
    now = now or utcnow()
    score = 0.0
    reasons: list[tuple[float, str]] = []

    if opp.category in m.interests:
        score += 22
        reasons.append((22, "You're interested in " + _PHRASES.get(opp.category, opp.category)))
    if opp.type in m.types:
        score += 10
        reasons.append((10, "A type of opportunity you asked for"))

    if opp.is_international:
        score += 5
    elif opp.is_remote:
        score += 8
        reasons.append((4, "Remote: apply from anywhere"))
    elif not opp.counties:
        score += 10
    elif m.county and m.county in opp.counties:
        score += 15
        reasons.append((15, f"In {m.county}, near you"))

    if not opp.education_levels:
        score += 6
    elif m.education_level in opp.education_levels:
        score += 15
        reasons.append((15, "Matches your education: " + _EDU_LABEL.get(m.education_level, m.education_level)))

    text = " ".join([opp.title or "", opp.summary or "", " ".join(opp.tags or []), " ".join(opp.skills or [])]).lower()
    opp_skills = {s.lower() for s in (opp.skills or [])}
    matched = (m.skills & opp_skills) | {s for s in m.skills if len(s) > 3 and s in text}
    if matched:
        pts = min(18.0, 18.0 * len(matched) / max(len(opp_skills), 3) + 4)
        score += pts
        names = ", ".join(n.title() for n in sorted(matched)[:2])
        reasons.append((pts, ("Uses your skills: " if len(matched) > 1 else "Uses your skill: ") + names))

    hits = {w for w in m.keywords if w in text}
    if hits:
        score += 8
        reasons.append((8, "Related to " + max(hits, key=len)))

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


def bump_affinity(affinity: dict | None, category: str, weight: float) -> dict:
    """Exponential decay keeps recent behaviour dominant and bounds the values."""
    aff = {k: round(v * 0.97, 3) for k, v in (affinity or {}).items() if v * 0.97 > 0.05}
    aff[category] = round(min(100.0, aff.get(category, 0) + weight), 3)
    return aff
