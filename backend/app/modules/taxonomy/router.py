from fastapi import APIRouter, Response
from sqlalchemy import select

from app.core.deps import DB
from app.modules.opportunities.service import counts_by_category
from app.modules.taxonomy.data import COUNTIES, EDUCATION_LEVELS, EMPLOYMENT_STATUSES, LANGUAGES, SKILL_SUGGESTIONS
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
    }
