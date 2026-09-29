"""The core loop end-to-end:
ORGANIZATION -> SUBMIT -> DEEN VERIFIES -> PUBLISH -> MEMBER DISCOVERS -> APPLIES -> ORG DECIDES."""
from datetime import timedelta

from app.core.clock import utcnow
from tests.conftest import _client, register_member, run_jobs

OPP = {
    "title": "Mombasa Engineering Scholarship",
    "summary": "Full tuition for engineering students from the Coast region.",
    "description": "A generous scholarship for first-year engineering students. " * 5,
    "category": "education", "type": "scholarship",
    "counties": ["Mombasa"], "education_levels": ["undergraduate"],
    "apply_mode": "internal",
    "form_questions": [{"label": "Why engineering?", "kind": "long_text", "required": True}],
}


async def _org_and_rep(admin_web, verification="pending"):
    r = await admin_web.post("/api/v1/admin/organizations", json={
        "name": "Test Foundation", "org_type": "foundation", "verification": verification,
        "admin_email": "rep@foundation.co.ke", "admin_name": "Rep One"})
    assert r.status_code == 200, r.text
    org = r.json()
    token = org["invite"]["link"].rsplit("/", 1)[1]
    rep = _client(web=True)
    r = await rep.post(f"/api/v1/auth/invites/{token}/accept", json={"full_name": "Rep One",
                                                                      "password": "RepPass12345"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["portal"] == "org"
    return org, rep


async def test_full_loop(admin_web):
    org, rep = await _org_and_rep(admin_web)
    body = {**OPP, "deadline": (utcnow() + timedelta(days=20)).isoformat()}
    r = await rep.post("/api/v1/org/opportunities", json=body)
    assert r.status_code == 200, r.text
    opp_id = r.json()["id"]
    assert r.json()["status"] == "draft"

    r = await rep.post(f"/api/v1/org/opportunities/{opp_id}/submit")
    assert r.status_code == 200 and r.json()["status"] == "submitted"

    queue = (await admin_web.get("/api/v1/admin/opportunities", params={"queue": True})).json()
    item = next(i for i in queue["items"] if i["id"] == opp_id)
    assert any(f["code"] == "org_unverified" for f in item["flags"])

    # Publishing is blocked until the organization itself is verified.
    r = await admin_web.post(f"/api/v1/admin/opportunities/{opp_id}/actions", json={"action": "publish"})
    assert r.status_code == 409
    await admin_web.post(f"/api/v1/admin/organizations/{org['id']}/verification", json={"verification": "verified"})
    r = await admin_web.post(f"/api/v1/admin/opportunities/{opp_id}/actions", json={"action": "publish"})
    assert r.status_code == 200 and r.json()["status"] == "published"

    # A matching member discovers it with an explanation...
    member, _ = await register_member()
    await member.put("/api/v1/me/profile", json={"county": "Mombasa", "education_level": "undergraduate",
                                                  "interests": ["education"], "opportunity_types": ["scholarship"],
                                                  "onboarding_completed": True})
    feed = (await member.get("/api/v1/opportunities/feed")).json()
    card = next(c for c in feed["for_you"] if c["id"] == opp_id)
    assert card["match"]["eligible"] and card["match"]["score"] >= 60
    assert any("Mombasa" in r for r in card["match"]["reasons"])

    # ...while a member elsewhere sees why they're not eligible.
    other, _ = await register_member("0722000111", "Other Member")
    await other.put("/api/v1/me/profile", json={"county": "Turkana", "education_level": "undergraduate"})
    detail = (await other.get(f"/api/v1/opportunities/{opp_id}")).json()
    assert detail["match"]["eligible"] is False and "Mombasa" in detail["match"]["blockers"][0]

    # Apply: required questions enforced, duplicates blocked.
    r = await member.post(f"/api/v1/opportunities/{opp_id}/apply", json={"answers": {}})
    assert r.status_code == 422
    qid = detail["form_questions"][0]["id"]
    r = await member.post(f"/api/v1/opportunities/{opp_id}/apply", json={"answers": {qid: "I love building."}})
    assert r.status_code == 200, r.text
    app_id = r.json()["id"]
    assert (await member.post(f"/api/v1/opportunities/{opp_id}/apply",
                              json={"answers": {qid: "again"}})).status_code == 409

    # The organization sees it and moves it forward; the member is told.
    apps = (await rep.get("/api/v1/org/applications")).json()
    assert apps["items"][0]["id"] == app_id
    r = await rep.post(f"/api/v1/org/applications/{app_id}/status", json={"status": "shortlisted",
                                                                          "message": "Interview on Monday"})
    assert r.status_code == 200
    mine = (await member.get(f"/api/v1/applications/{app_id}")).json()
    assert mine["status"] == "shortlisted" and mine["events"][-1]["message"] == "Interview on Monday"
    notes = (await member.get("/api/v1/notifications")).json()["items"]
    assert any(n["title"] == "You've been shortlisted" for n in notes)

    # Analytics reflect the activity.
    dash = (await rep.get("/api/v1/org/dashboard")).json()
    assert dash["totals"]["applications"] == 1 and dash["totals"]["views"] >= 1
    overview = (await admin_web.get("/api/v1/admin/overview")).json()
    assert overview["kpis"]["applications"] == 1

    await run_jobs()  # fan-out of the published opportunity must succeed
    for c in (rep, member, other):
        await c.aclose()


async def test_request_info_and_resubmit(admin_web):
    org, rep = await _org_and_rep(admin_web, verification="verified")
    opp = (await rep.post("/api/v1/org/opportunities", json={
        **OPP, "deadline": (utcnow() + timedelta(days=20)).isoformat()})).json()
    await rep.post(f"/api/v1/org/opportunities/{opp['id']}/submit")
    r = await admin_web.post(f"/api/v1/admin/opportunities/{opp['id']}/actions", json={"action": "request_info"})
    assert r.status_code == 422  # a note is required
    r = await admin_web.post(f"/api/v1/admin/opportunities/{opp['id']}/actions",
                             json={"action": "request_info", "note": "Add the selection criteria"})
    assert r.json()["status"] == "info_requested"
    msgs = (await rep.get(f"/api/v1/org/opportunities/{opp['id']}/messages")).json()
    assert msgs[0]["body"] == "Add the selection criteria" and msgs[0]["author"] == "DEEN Review Team"
    body = {**OPP, "eligibility": "Top 10% of class", "deadline": (utcnow() + timedelta(days=20)).isoformat()}
    assert (await rep.put(f"/api/v1/org/opportunities/{opp['id']}", json=body)).status_code == 200
    assert (await rep.post(f"/api/v1/org/opportunities/{opp['id']}/submit")).json()["status"] == "submitted"
    await rep.aclose()


async def test_org_isolation(admin_web):
    _, rep1 = await _org_and_rep(admin_web)
    opp = (await rep1.post("/api/v1/org/opportunities", json=OPP)).json()
    r = await admin_web.post("/api/v1/admin/organizations", json={
        "name": "Another Org", "org_type": "ngo", "admin_email": "rep2@other.co.ke"})
    token = r.json()["invite"]["link"].rsplit("/", 1)[1]
    rep2 = _client(web=True)
    await rep2.post(f"/api/v1/auth/invites/{token}/accept", json={"full_name": "Rep Two", "password": "RepPass12345"})
    assert (await rep2.get(f"/api/v1/org/opportunities/{opp['id']}")).status_code == 404
    assert (await rep2.put(f"/api/v1/org/opportunities/{opp['id']}", json=OPP)).status_code == 404
    for c in (rep1, rep2):
        await c.aclose()


async def test_members_cannot_reach_admin_or_org_apis():
    member, _ = await register_member()
    assert (await member.get("/api/v1/admin/overview")).status_code == 403
    assert (await member.get("/api/v1/org/opportunities")).status_code == 403
    await member.aclose()


async def test_invite_link_works_once(admin_web):
    r = await admin_web.post("/api/v1/admin/staff/invite", json={"email": "officer@deen-test.co.ke",
                                                                 "role": "verification_officer"})
    token = r.json()["link"].rsplit("/", 1)[1]
    c = _client(web=True)
    ok = await c.post(f"/api/v1/auth/invites/{token}/accept", json={"full_name": "Officer", "password": "Officer12345"})
    assert ok.status_code == 200 and ok.json()["user"]["role"] == "verification_officer"
    again = await c.post(f"/api/v1/auth/invites/{token}/accept", json={"full_name": "Someone Else", "password": "Officer12345"})
    assert again.status_code == 404
    # A verification officer can review but cannot manage staff.
    assert (await c.get("/api/v1/admin/opportunities", params={"queue": True})).status_code == 200
    assert (await c.post("/api/v1/admin/staff/invite", json={"email": "x@deen-test.co.ke",
                                                             "role": "support_agent"})).status_code == 403
    await c.aclose()
