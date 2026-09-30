"""Pure unit tests for the matching engine and the risk scanner."""
from datetime import timedelta
from types import SimpleNamespace

from app.core.clock import utcnow
from app.modules.opportunities.matching import MemberSignals, bump_affinity, evaluate
from app.modules.opportunities.models import ApplyMode
from app.modules.opportunities.risk import scan


def opp(**kw):
    base = dict(id="o1", title="Data Science Scholarship", summary="For data students", description="x" * 200,
                category="education", type="scholarship", tags=[], skills=["data analysis"], counties=[],
                work_mode="physical", is_international=False, eligible_countries=[], education_levels=[],
                min_age=None, max_age=None, fields_of_study=[], industry=None, min_experience_years=None,
                target_user_types=[],
                gender=None, deadline=utcnow() + timedelta(days=30), is_event=False, eligibility="Anyone",
                apply_mode=ApplyMode.external, external_url="https://example.org/apply", requirements="",
                application_process="")
    base.update(kw)
    return SimpleNamespace(**base)


def member(**kw):
    base = dict(county="Mombasa", age=21, gender="female", education_level="undergraduate",
                skills={"data analysis"}, interests={"education"}, types={"scholarship"}, keywords={"data"})
    base.update(kw)
    return MemberSignals(**base)


def test_strong_match_explains_itself():
    m = evaluate(opp(counties=["Mombasa"], education_levels=["undergraduate"], target_user_types=["student"],
                     industry="Research"), member(user_types={"student"}, industry="Research"))
    assert m.eligible and m.score >= 80
    assert len(m.reasons) == 3 and any("Mombasa" in r for r in m.reasons)


def test_blockers_hide_but_explain():
    m = evaluate(opp(counties=["Nairobi"], max_age=18, gender="male"), member())
    assert not m.eligible and m.score <= 25
    assert len(m.blockers) == 3


def test_unknown_profile_fields_never_block():
    m = evaluate(opp(counties=["Nairobi"], education_levels=["postgraduate"], min_age=30), MemberSignals())
    assert m.eligible


def test_remote_ignores_county_restriction():
    assert evaluate(opp(counties=["Nairobi"], work_mode="remote"), member()).eligible


def test_country_and_experience_blockers():
    m = evaluate(opp(eligible_countries=["Uganda"], min_experience_years=3), member(experience_years=1))
    assert not m.eligible and len(m.blockers) == 2


def test_member_category_and_industry_boost():
    base = evaluate(opp(), member()).score
    boosted = evaluate(opp(target_user_types=["woman_entrepreneur"], industry="Fashion & Textiles"),
                       member(user_types={"woman_entrepreneur"}, industry="Fashion & Textiles"))
    assert boosted.score > base and any("women entrepreneurs" in r for r in boosted.reasons)


def test_affinity_decays_and_is_bounded():
    aff = {}
    for _ in range(200):
        aff = bump_affinity(aff, "business", 5)
    assert aff["business"] <= 100
    aff = bump_affinity(aff, "education", 1)
    assert aff["business"] < 100


def test_risk_scan_flags_scams():
    org = SimpleNamespace(website="https://real-org.org", verification=SimpleNamespace(value="verified"))
    o = opp(external_url="http://bit.ly/abc", description="Pay a registration fee of KES 500 via M-Pesa to apply")
    flags, score = scan(o, org, [("o2", "Data Science Scholarship!")])
    codes = {f["code"] for f in flags}
    assert {"shortened_link", "insecure_link", "asks_for_money", "possible_duplicate"} <= codes
    assert score >= 80


def test_risk_scan_clean_listing():
    org = SimpleNamespace(website="https://example.org", verification=SimpleNamespace(value="trusted"))
    flags, score = scan(opp(), org, [])
    assert score == 0, flags
