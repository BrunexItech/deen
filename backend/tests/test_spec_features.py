"""Features from the DEEN APP specification: attachments/volunteer fields and filters,
verification checklist, suspension, Q&A, tracker, reminders, digest, hub, experience."""
from datetime import timedelta

from app.core.clock import utcnow
from app.core.db import SessionLocal
from tests.conftest import publish, register_member, run_jobs
from tests.test_platform_flow import _org_and_rep

ATTACHMENT = {
    "title": "Health Records Attachment", "summary": "Three-month attachment in health records at our clinics.",
    "description": "Hands-on attachment in health records and information management. " * 4,
    "category": "career", "type": "attachment", "industry": "Healthcare", "department": "Health Records",
    "counties": ["Kisumu"], "work_mode": "physical", "duration_label": "3 months", "duration_weeks": 12,
    "compensation": "stipend", "fields_of_study": ["Health Records"], "student_friendly": True,
    "apply_mode": "external", "external_url": "https://example.org/apply",
}
VOLUNTEER = {
    "title": "Beach clean-up volunteers", "summary": "Monthly beach clean-up with a certificate for volunteers.",
    "description": "Join our monthly beach clean-up and community meal, open to everyone. " * 3,
    "category": "career", "type": "volunteer", "causes": ["environment"], "weekend": True,
    "certificate_provided": True, "work_mode": "physical", "duration_weeks": 0,
    "apply_mode": "external", "external_url": "https://example.org/volunteer",
}


async def _live(admin_web, rep, body, days=20):
    opp = (await rep.post("/api/v1/org/opportunities", json={**body, "deadline": (utcnow() + timedelta(days=days)).isoformat()})).json()
    assert "id" in opp, opp
    await rep.post(f"/api/v1/org/opportunities/{opp['id']}/submit")
    r = await publish(admin_web, opp["id"])
    assert r.status_code == 200, r.text
    return opp["id"]


async def test_attachment_and_volunteer_filters(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    att = await _live(admin_web, rep, ATTACHMENT)
    vol = await _live(admin_web, rep, VOLUNTEER)
    member, _ = await register_member()

    async def ids(**params):
        r = await member.get("/api/v1/opportunities", params=params)
        assert r.status_code == 200, r.text
        return {i["id"] for i in r.json()["items"]}

    assert await ids(type="attachment", county="Kisumu", industry="Healthcare", compensation="paid") == {att}
    assert await ids(field_of_study="health records", duration="medium") == {att}
    assert await ids(cause="environment", weekend=True, certificate=True) == {vol}
    assert await ids(types="attachment,volunteer", work_mode="physical") == {att, vol}
    assert await ids(scope="international") == set()
    detail = (await member.get(f"/api/v1/opportunities/{att}")).json()
    assert detail["verified_by_deen"] and detail["status_label"] == "Application open"
    assert detail["department"] == "Health Records" and detail["compensation"] == "stipend"
    assert "Preliminary match" in detail["match"]["disclaimer"]
    for c in (rep, member):
        await c.aclose()


async def test_suspend_and_reinstate(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    opp_id = await _live(admin_web, rep, ATTACHMENT)
    r = await admin_web.post(f"/api/v1/admin/opportunities/{opp_id}/actions", json={"action": "suspend"})
    assert r.status_code == 422  # a reason is required
    r = await admin_web.post(f"/api/v1/admin/opportunities/{opp_id}/actions",
                             json={"action": "suspend", "note": "Investigating a fraud report"})
    assert r.json()["status"] == "suspended"
    member, _ = await register_member()
    assert (await member.get(f"/api/v1/opportunities/{opp_id}")).status_code == 404
    r = await admin_web.post(f"/api/v1/admin/opportunities/{opp_id}/actions", json={"action": "reinstate"})
    assert r.json()["status"] == "published"
    for c in (rep, member):
        await c.aclose()


async def test_shariah_label_needs_basis(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    body = {**ATTACHMENT, "islamic_tags": ["shariah_conscious"]}
    r = await rep.post("/api/v1/org/opportunities", json=body)
    assert r.status_code == 422 and "basis" in r.text
    body["shariah_basis"] = "Certified by the bank's independent Shariah Supervisory Board, ref SSB/2026/14."
    assert (await rep.post("/api/v1/org/opportunities", json=body)).status_code == 200
    await rep.aclose()


async def test_questions_and_answers(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    opp_id = await _live(admin_web, rep, ATTACHMENT)
    member, _ = await register_member()
    other, _ = await register_member("0722000111", "Other Member")
    q = (await member.post(f"/api/v1/opportunities/{opp_id}/questions",
                           json={"question": "Is this open to diploma students?"})).json()
    # Unanswered questions are private to the asker.
    assert len((await other.get(f"/api/v1/opportunities/{opp_id}/questions")).json()) == 0
    pending = (await rep.get("/api/v1/org/questions")).json()
    assert pending["pending"] == 1
    r = await rep.post(f"/api/v1/org/questions/{q['id']}/answer", json={"answer": "Yes, diploma students are welcome."})
    assert r.status_code == 200
    public = (await other.get(f"/api/v1/opportunities/{opp_id}/questions")).json()
    assert public[0]["answer"].startswith("Yes") and public[0]["answered_by"] == "Organization"
    notes = (await member.get("/api/v1/notifications")).json()["items"]
    assert any(n["title"] == "Your question was answered" for n in notes)
    for c in (rep, member, other):
        await c.aclose()


async def test_tracker_manual_and_external(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    opp_id = await _live(admin_web, rep, ATTACHMENT)
    member, _ = await register_member()
    r = await member.post("/api/v1/applications/manual", json={"title": "County bursary", "organization": "Mombasa County",
                                                              "status": "started"})
    manual_id = r.json()["id"]
    await member.patch(f"/api/v1/applications/{manual_id}/self", json={"status": "submitted"})
    ext = (await member.post(f"/api/v1/opportunities/{opp_id}/applied-externally")).json()
    await member.patch(f"/api/v1/applications/{ext['id']}/self", json={"status": "shortlisted"})
    apps = {a["id"]: a for a in (await member.get("/api/v1/applications")).json()}
    assert apps[manual_id]["status"] == "submitted" and apps[manual_id]["manual"]["title"] == "County bursary"
    assert apps[ext["id"]]["status"] == "shortlisted" and apps[ext["id"]]["source"] == "external"
    # Self-tracked entries never use up the free plan's application quota.
    assert (await member.get("/api/v1/membership")).json()["applications_this_month"] == 0
    for c in (rep, member):
        await c.aclose()


async def test_deadline_reminders_7_3_1(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    opp_id = await _live(admin_web, rep, ATTACHMENT, days=6)
    member, _ = await register_member()
    await member.post(f"/api/v1/opportunities/{opp_id}/save")

    async def maintenance():
        from app.modules.jobs.service import enqueue

        async with SessionLocal() as s:
            await enqueue(s, "opportunities.maintenance", {})
            await s.commit()
        await run_jobs()

    await maintenance()
    await maintenance()  # idempotent: the same stage is never sent twice
    titles = [n["title"] for n in (await member.get("/api/v1/notifications")).json()["items"]]
    assert titles.count("Your saved attachment closes in 7 days") == 1
    # The provider brings the deadline forward: reminders restart at the right stage.
    await rep.post(f"/api/v1/org/opportunities/{opp_id}/deadline",
                   json={"deadline": (utcnow() + timedelta(hours=20)).isoformat()})
    await maintenance()
    titles = [n["title"] for n in (await member.get("/api/v1/notifications")).json()["items"]]
    assert "Your saved attachment closes tomorrow" in titles
    for c in (rep, member):
        await c.aclose()


async def test_weekly_digest_and_hub(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    await _live(admin_web, rep, ATTACHMENT)
    await _live(admin_web, rep, VOLUNTEER)
    member, _ = await register_member()
    await member.put("/api/v1/me/profile", json={"county": "Kisumu", "interests": ["career"],
                                                  "user_types": ["student"], "onboarding_completed": True})
    async with SessionLocal() as s:
        from app.modules.jobs.service import enqueue

        await enqueue(s, "digest.weekly", {})
        await s.commit()
    await run_jobs()
    notes = (await member.get("/api/v1/notifications")).json()["items"]
    digest = next(n for n in notes if n["kind"] == "digest")
    assert digest["title"] == "This week on DEEN: 2 new opportunities" and "Attachment" in digest["body"]
    hub = (await member.get("/api/v1/opportunities/hub")).json()
    experience = next(s for s in hub["sections"] if s["key"] == "experience")
    assert {t["key"]: t["count"] for t in experience["types"]} == {"attachment": 1, "internship": 0, "volunteer": 1}
    for c in (rep, member):
        await c.aclose()


async def test_experience_builder_verifies_deen_outcomes(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    body = {**ATTACHMENT, "apply_mode": "internal", "external_url": None, "counties": []}
    opp_id = await _live(admin_web, rep, body)
    member, _ = await register_member()
    app = (await member.post(f"/api/v1/opportunities/{opp_id}/apply", json={})).json()
    await rep.post(f"/api/v1/org/applications/{app['id']}/status", json={"status": "accepted"})
    data = (await member.get("/api/v1/me/experience")).json()
    assert data["suggestions"][0]["opportunity_id"] == opp_id
    e = (await member.post("/api/v1/me/experience", json={"kind": "attachment", "title": "Health Records Attachment",
                                                           "organization": "Test Foundation", "opportunity_id": opp_id})).json()
    assert e["verified"] is True
    manual = (await member.post("/api/v1/me/experience", json={"kind": "volunteer", "title": "Mosque youth tutor",
                                                                "organization": "Local masjid"})).json()
    assert manual["verified"] is False
    for c in (rep, member):
        await c.aclose()


async def test_feed_sections(admin_web):
    _, rep = await _org_and_rep(admin_web, verification="verified")
    await _live(admin_web, rep, ATTACHMENT)
    member, _ = await register_member()
    await member.put("/api/v1/me/profile", json={"county": "Kisumu", "user_types": ["student"],
                                                  "field_of_study": "Health Records", "onboarding_completed": True})
    feed = (await member.get("/api/v1/opportunities/feed")).json()
    assert len(feed["new"]) == 1 and feed["headline"].startswith("You are a student in Health Records in Kisumu")
    await rep.aclose()
    await member.aclose()


async def test_category_and_location_alerts(admin_web):
    """Spec section 21: new opportunity in a selected category / location notifies the member."""
    _, rep = await _org_and_rep(admin_web, verification="verified")
    member, _ = await register_member()
    await member.put("/api/v1/me/profile", json={"county": "Kisumu", "interests": ["career"], "onboarding_completed": True})
    await _live(admin_web, rep, ATTACHMENT)
    await run_jobs()
    titles = [n["title"] for n in (await member.get("/api/v1/notifications")).json()["items"]]
    assert "New in a category you follow in Kisumu" in titles or "New opportunity matching your profile" in titles
    for c in (rep, member):
        await c.aclose()
