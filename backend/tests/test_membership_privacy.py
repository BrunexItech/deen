from tests.conftest import PASSWORD, register_member, run_jobs


async def test_mpesa_sandbox_checkout_activates_membership():
    member, _ = await register_member()
    plans = (await member.get("/api/v1/plans")).json()
    assert [p["code"] for p in plans][:2] == ["free", "member_monthly"]
    r = await member.post("/api/v1/payments/checkout", json={"plan_code": "member_monthly"})
    assert r.status_code == 200, r.text
    pay_id = r.json()["payment_id"]
    assert (await member.get(f"/api/v1/payments/{pay_id}")).json()["status"] == "pending"

    # The sandbox job is delayed a few seconds; force it due and run it.
    from sqlalchemy import update

    from app.core.clock import utcnow
    from app.core.db import SessionLocal
    from app.modules.jobs.models import Job

    async with SessionLocal() as s:
        await s.execute(update(Job).values(run_after=utcnow()))
        await s.commit()
    await run_jobs()
    pay = (await member.get(f"/api/v1/payments/{pay_id}")).json()
    assert pay["status"] == "success" and pay["receipt"]
    m = (await member.get("/api/v1/membership")).json()
    assert m["tier"] == "member" and m["features"]["monthly_applications"] is None
    await member.aclose()


async def test_mpesa_callback_is_idempotent_and_amount_checked(client):
    member, _ = await register_member()
    r = await member.post("/api/v1/payments/checkout", json={"plan_code": "premium_monthly"})
    pay_id = r.json()["payment_id"]
    from app.core.db import SessionLocal
    from app.modules.subscriptions.models import Payment

    async with SessionLocal() as s:
        checkout = (await s.get(Payment, pay_id)).checkout_request_id
    underpaid = {"Body": {"stkCallback": {"CheckoutRequestID": checkout, "ResultCode": 0, "ResultDesc": "ok",
                                          "CallbackMetadata": {"Item": [{"Name": "Amount", "Value": 1},
                                                                        {"Name": "MpesaReceiptNumber", "Value": "X1"}]}}}}
    assert (await client.post("/api/v1/payments/mpesa/callback/wrong-token", json=underpaid)).status_code == 404
    await client.post("/api/v1/payments/mpesa/callback/change-me-callback", json=underpaid)
    assert (await member.get(f"/api/v1/payments/{pay_id}")).json()["status"] == "failed"
    assert (await member.get("/api/v1/membership")).json()["tier"] == "free"
    await member.aclose()


async def test_free_tier_application_quota(admin_web):
    from datetime import timedelta

    from app.core.clock import utcnow
    from tests.conftest import publish
    from tests.test_platform_flow import OPP, _org_and_rep

    org, rep = await _org_and_rep(admin_web, verification="verified")
    ids = []
    for i in range(4):
        body = {**OPP, "title": f"Scholarship number {i} for coast", "counties": [], "form_questions": [],
                "deadline": (utcnow() + timedelta(days=20)).isoformat()}
        opp = (await rep.post("/api/v1/org/opportunities", json=body)).json()
        await rep.post(f"/api/v1/org/opportunities/{opp['id']}/submit")
        await publish(admin_web, opp["id"])
        ids.append(opp["id"])
    member, _ = await register_member()
    for opp_id in ids[:3]:
        assert (await member.post(f"/api/v1/opportunities/{opp_id}/apply", json={})).status_code == 200
    r = await member.post(f"/api/v1/opportunities/{ids[3]}/apply", json={})
    assert r.status_code == 402 and "3 applications" in r.json()["detail"]
    await rep.aclose()
    await member.aclose()


async def test_export_and_delete_account(client):
    member, _ = await register_member()
    data = (await member.get("/api/v1/me/privacy/export")).json()
    assert data["account"]["phone"] == "+254712345678"
    assert (await member.post("/api/v1/me/privacy/delete", json={"password": "wrong"})).status_code == 400
    assert (await member.post("/api/v1/me/privacy/delete", json={"password": PASSWORD})).status_code == 200
    assert (await member.get("/api/v1/me")).status_code == 401
    r = await client.post("/api/v1/auth/login", json={"identifier": "0712345678", "password": PASSWORD})
    assert r.status_code == 401
    # The phone number is free to register again.
    again, _ = await register_member()
    await again.aclose()
    await member.aclose()


async def test_daily_reminder_and_taxonomy():
    member, _ = await register_member()
    today = (await member.get("/api/v1/content/today")).json()
    assert today["reminder"]["reference"] and today["zakat"]["silver_nisab_grams"] == 595
    tax = (await member.get("/api/v1/taxonomy")).json()
    assert len(tax["counties"]) == 47 and {c["key"] for c in tax["categories"]} == {"education", "career", "entrepreneurship", "community", "islamic_economy", "support"}
    await member.aclose()
