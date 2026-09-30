from fastapi import APIRouter, Response
from sqlalchemy import select

from app.core.deps import DB
from app.modules.opportunities.service import counts_by_category
from app.modules.taxonomy.data import (COMPENSATION, COUNTIES, COUNTRIES, EDUCATION_LEVELS, EMPLOYMENT_STATUSES,
                                       INDUSTRIES, ISLAMIC_TAGS, LANGUAGES, SKILL_SUGGESTIONS, STUDENT_HUB,
                                       USER_TYPES, VERIFICATION_CHECKLIST, VOLUNTEER_CAUSES, WORK_MODES)
from app.modules.taxonomy.models import Category, OpportunityType

router = APIRouter(prefix="/api/v1/taxonomy", tags=["taxonomy"])


async def categories_tree(session, include_inactive: bool = False) -> list[dict]:
    cstmt = select(Category).order_by(Category.sort)
    tstmt = select(OpportunityType).order_by(OpportunityType.sort)
    if not include_inactive:
        cstmt = cstmt.where(Category.active.is_(True))
        tstmt = tstmt.where(OpportunityType.active.is_(True))
    types: dict[str, list] = {}
    for t in (await session.execute(tstmt)).scalars():
        types.setdefault(t.category_key, []).append({"key": t.key, "name": t.name, "active": t.active})
    return [{"key": c.key, "name": c.name, "tab_label": c.tab_label, "description": c.description, "icon": c.icon,
             "color": c.color, "active": c.active, "types": types.get(c.key, [])}
            for c in (await session.execute(cstmt)).scalars()]


@router.get("")
async def taxonomy(response: Response, session: DB):
    # Reference data changes rarely: let clients and CDNs cache it.
    response.headers["Cache-Control"] = "public, max-age=900"
    counts = await counts_by_category(session)
    cats = await categories_tree(session)
    for c in cats:
        c["live_count"] = counts.get(c["key"], 0)
    return {
        "categories": cats,
        "counties": COUNTIES,
        "education_levels": [{"key": k, "name": n} for k, n in EDUCATION_LEVELS],
        "employment_statuses": [{"key": k, "name": n} for k, n in EMPLOYMENT_STATUSES],
        "languages": LANGUAGES,
        "skills": SKILL_SUGGESTIONS,
        "countries": COUNTRIES,
        "industries": INDUSTRIES,
        "user_types": pairs(USER_TYPES),
        "work_modes": pairs(WORK_MODES),
        "compensation": pairs(COMPENSATION),
        "causes": pairs(VOLUNTEER_CAUSES),
        "islamic_tags": pairs(ISLAMIC_TAGS),
        "verification_checklist": pairs(VERIFICATION_CHECKLIST),
        "student_hub": [{"key": k, "label": l, "types": t} for k, l, t in STUDENT_HUB],
    }


def pairs(items) -> list[dict]:
    return [{"key": k, "name": n} for k, n in items]
