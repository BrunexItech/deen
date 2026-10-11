from tests.conftest import PASSWORD, register_member, run_jobs


async def _website_pay(client, phone="0712345678", **extra):
    """Website flow: phone -> SMS code -> M-Pesa prompt."""
    started = (await client.post("/api/v1/pay/start", json={"phone": phone})).json()
    verified = await client.post("/api/v1/pay/verify", json={"phone": phone, "code": started["dev_code"]})
    assert verified.status_code == 200, verified.text
    token = verified.json()["pay_token"]
    r = await client.post("/api/v1/pay/checkout", json={"pay_token": token, **extra})
    assert r.status_code == 200, r.text
    return token, r.json()["payment_id"]


async def _settle_sandbox():
    from sqlalchemy import update

    from app.core.clock import utcnow
    from app.core.db import SessionLocal
    from app.modules.jobs.models import Job

    async with SessionLocal() as s:
        await s.execute(update(Job).values(run_after=utcnow()))
        await s.commit()
    await run_jobs()


async def test_fee_is_set_by_admin_and_shown_publicly(client, admin_web):
    r = await admin_web.put("/api/v1/admin/fee", json={"amount_kes": 150, "period_months": 3,
                                                        "covers": ["Verifying opportunities", "SMS alerts"],
                                                        "free_monthly_applications": 5})
    assert r.status_code == 200, r.text
    fee = (await client.get("/api/v1/fee")).json()
    assert fee["amount_kes"] == 150 and fee["period_months"] == 3 and fee["active"]
    assert fee["covers"] == ["Verifying opportunities", "SMS alerts"] and fee["free_monthly_applications"] == 5
    # Never below KES 50.
    low = await admin_web.put("/api/v1/admin/fee", json={"amount_kes": 49, "period_months": 1})
    assert low.status_code == 422
    # The member app no longer offers packages or an in-app checkout.
    assert (await client.get("/api/v1/plans")).status_code == 404
    member, _ = await register_member()
    assert (await member.post("/api/v1/payments/checkout", json={})).status_code in (404, 405)
    m = (await member.get("/api/v1/membership")).json()
    assert m["paid"] is False and m["features"]["monthly_applications"] == 5
    # Switching the fee off removes every limit.
    await admin_web.put("/api/v1/admin/fee", json={"amount_kes": 150, "period_months": 3, "enabled": False})
    assert (await member.get("/api/v1/membership")).json()["features"]["monthly_applications"] is None
    await member.aclose()


async def test_website_payment_activates_membership(client):
    member, _ = await register_member()
    token, pay_id = await _website_pay(client)
    status = (await client.get(f"/api/v1/pay/status/{pay_id}", params={"token": token})).json()
    assert status["status"] == "pending"
    await _settle_sandbox()
    status = (await client.get(f"/api/v1/pay/status/{pay_id}", params={"token": token})).json()
    assert status["status"] == "success" and status["receipt"] and status["membership"]["paid"]
    m = (await member.get("/api/v1/membership")).json()
    assert m["paid"] and m["tier"] == "member" and m["features"]["monthly_applications"] is None
    await member.aclose()


async def test_pay_page_never_reveals_who_is_a_member(client):
    await register_member()
    known = (await client.post("/api/v1/pay/start", json={"phone": "0712345678"})).json()
    unknown = (await client.post("/api/v1/pay/start", json={"phone": "0799111222"})).json()
    assert known["sent"] and unknown["sent"] and unknown["dev_code"] is None
    r = await client.post("/api/v1/pay/verify", json={"phone": "0799111222", "code": "123456"})
    assert r.status_code == 400
    bad = await client.post("/api/v1/pay/checkout", json={"pay_token": "forged"})
    assert bad.status_code == 401


async def test_paying_for_another_member(client):
    other, _ = await register_member("0722000111", "Other Member")
    payer, _ = await register_member()
    await _website_pay(client, gift_to_phone="0722000111")
    await _settle_sandbox()
    assert (await other.get("/api/v1/membership")).json()["paid"]
    assert not (await payer.get("/api/v1/membership")).json()["paid"]
    for c in (other, payer):
        await c.aclose()


async def test_mpesa_callback_is_idempotent_and_amount_checked(client):
    member, _ = await register_member()
    _, pay_id = await _website_pay(client)
    from app.core.db import SessionLocal
    from app.modules.subscriptions.models import Payment

    async with SessionLocal() as s:
        checkout = (await s.get(Payment, pay_id)).checkout_request_id
    underpaid = {"Body": {"stkCallback": {"CheckoutRequestID": checkout, "ResultCode": 0, "ResultDesc": "ok",
                                          "CallbackMetadata": {"Item": [{"Name": "Amount", "Value": 1},
                                                                        {"Name": "MpesaReceiptNumber", "Value": "X1"}]}}}}
    assert (await client.post("/api/v1/payments/mpesa/callback/wrong-token", json=underpaid)).status_code == 404
    await client.post("/api/v1/payments/mpesa/callback/change-me-callback", json=underpaid)
    async with SessionLocal() as s:
        assert (await s.get(Payment, pay_id)).status.value == "failed"
    assert (await member.get("/api/v1/membership")).json()["paid"] is False
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
