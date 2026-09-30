from tests.conftest import ADMIN, PASSWORD, _client, register_member, web_login


async def test_register_verify_and_me(client):
    c, tokens = await register_member()
    assert tokens["refresh_token"] and tokens["user"]["portal"] == "member"
    r = await c.get("/api/v1/me")
    assert r.status_code == 200 and r.json()["phone_verified"] is True
    assert r.json()["membership"]["tier"] == "free"
    await c.aclose()


async def test_register_requires_consent_and_strong_password(client):
    r = await client.post("/api/v1/auth/register", json={"full_name": "A B C", "phone": "0712345678",
                                                         "password": PASSWORD, "consent": False})
    assert r.status_code == 422
    r = await client.post("/api/v1/auth/register", json={"full_name": "A B C", "phone": "0712345678",
                                                         "password": "password1", "consent": True})
    assert r.status_code == 422


async def test_wrong_otp_is_rejected(client):
    await client.post("/api/v1/auth/register", json={"full_name": "A B C", "phone": "0712345678",
                                                     "password": PASSWORD, "consent": True})
    r = await client.post("/api/v1/auth/verify-phone", json={"phone": "0712345678", "code": "000000"})
    assert r.status_code == 400


async def test_refresh_rotates_and_replay_revokes_session():
    c, tokens = await register_member()
    old = tokens["refresh_token"]
    r = await c.post("/api/v1/auth/refresh", json={"refresh_token": old})
    assert r.status_code == 200
    new = r.json()["refresh_token"]
    assert new != old
    # Replaying the rotated token = stolen token: the whole session dies.
    r = await c.post("/api/v1/auth/refresh", json={"refresh_token": old})
    assert r.status_code == 401
    r = await c.post("/api/v1/auth/refresh", json={"refresh_token": new})
    assert r.status_code == 401
    await c.aclose()


async def test_lockout_after_repeated_failures(client):
    c, _ = await register_member()
    for _ in range(6):
        await client.post("/api/v1/auth/login", json={"identifier": "0712345678", "password": "wrong-pass1"})
    r = await client.post("/api/v1/auth/login", json={"identifier": "0712345678", "password": PASSWORD})
    assert r.status_code == 423
    await c.aclose()


async def test_members_cannot_use_web_portal_and_staff_cannot_use_app(client, web):
    c, _ = await register_member()
    r = await web.post("/api/v1/auth/login", json={"identifier": "0712345678", "password": PASSWORD})
    assert r.status_code == 403
    r = await client.post("/api/v1/auth/login", json={"identifier": ADMIN[0], "password": ADMIN[1]})
    assert r.status_code == 403
    await c.aclose()


async def test_cookie_writes_require_csrf_header():
    c = await web_login(*ADMIN)
    del c.headers["X-Requested-With"]
    r = await c.post("/api/v1/auth/logout")
    assert r.status_code == 403
    await c.aclose()


async def test_revoked_session_is_rejected_immediately():
    c, _ = await register_member()
    sessions = (await c.get("/api/v1/auth/sessions")).json()
    assert len(sessions) == 1 and sessions[0]["current"]
    await c.post("/api/v1/auth/logout-all")
    assert (await c.get("/api/v1/me")).status_code == 401
    await c.aclose()


async def test_password_reset_via_otp(client):
    c, _ = await register_member()
    r = await client.post("/api/v1/auth/forgot", json={"identifier": "0712345678"})
    code = r.json()["dev_code"]
    r = await client.post("/api/v1/auth/reset", json={"identifier": "0712345678", "code": code,
                                                      "new_password": "NewPass4567"})
    assert r.status_code == 200
    # Old sessions are gone, new password works: on the already-known phone, no extra code needed.
    assert (await c.get("/api/v1/me")).status_code == 401
    known = {"device_id": "dev-0712345678", "device_name": "Test phone", "platform": "android"}
    r = await client.post("/api/v1/auth/login", json={"identifier": "0712345678", "password": "NewPass4567",
                                                      "device": known})
    assert r.status_code == 200 and r.json()["access_token"]
    await c.aclose()


async def test_totp_mfa_flow(admin_web):
    import pyotp

    setup = (await admin_web.post("/api/v1/auth/totp/setup")).json()
    code = pyotp.TOTP(setup["secret"]).now()
    assert (await admin_web.post("/api/v1/auth/totp/enable", json={"code": code})).status_code == 200
    c = _client(web=True)
    r = await c.post("/api/v1/auth/login", json={"identifier": ADMIN[0], "password": ADMIN[1]})
    assert r.json()["mfa_required"] is True
    r = await c.post("/api/v1/auth/mfa", json={"mfa_token": r.json()["mfa_token"],
                                               "code": pyotp.TOTP(setup["secret"]).now()})
    assert r.status_code == 200 and r.json()["user"]["portal"] == "admin"
    await c.aclose()


async def test_new_device_requires_sms_code(client):
    """Two-factor: the right password on an unknown phone still needs the SMS code."""
    c, _ = await register_member()
    new_phone = {"device_id": "stolen-phone", "device_name": "Unknown", "platform": "android"}
    r = await client.post("/api/v1/auth/login", json={"identifier": "0712345678", "password": PASSWORD,
                                                      "device": new_phone})
    body = r.json()
    assert body.get("device_verify_required") and "access_token" not in body
    bad = await client.post("/api/v1/auth/verify-device", json={"phone": "0712345678", "code": "000000",
                                                                "device": new_phone})
    assert bad.status_code == 400
    ok = await client.post("/api/v1/auth/verify-device", json={"phone": "0712345678", "code": body["dev_code"],
                                                               "device": new_phone})
    assert ok.status_code == 200 and ok.json()["access_token"]
    # The member is warned about the new sign-in.
    notes = (await c.get("/api/v1/notifications")).json()["items"]
    assert any("New sign-in" in n["title"] for n in notes)
    await c.aclose()
