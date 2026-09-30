"""Sign-up, sign-in, MFA, refresh, sessions, password reset, invitations.

Web portal clients send `X-Client: web` and receive httpOnly cookies; the mobile
app receives bearer + refresh tokens and keeps them in the device keystore."""
from datetime import timedelta

import jwt
import segno
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_, select

from app.core.audit import record
from app.core.clock import utcnow
from app.core.config import settings
from app.core.crypto import decrypt_text, encrypt_text
from app.core.deps import DB, CurrentUser
from app.core.phone import mask_phone, to_e164
from app.core.ratelimit import RateLimiter, client_ip
from app.core.roles import Role, is_org, is_platform
from app.core.security import (burn_password_check, create_mfa_token, decode_token, hash_password, keyed_hash,
                               new_totp_secret, password_problems, totp_uri, verify_password, verify_totp)
from app.modules.notifications.service import notify
from app.modules.orgs.models import Invite, Organization
from app.modules.users.models import MemberProfile, OtpPurpose, User, UserSession, UserStatus
from app.modules.users.service import (DeviceIn, check_otp, clear_web_cookies, issue_session, revoke_all,
                                       rotate_refresh, send_otp, set_web_cookies, user_payload)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

login_limiter = RateLimiter("login", 10, 300)
otp_limiter = RateLimiter("otp", 5, 600)
verify_limiter = RateLimiter("verify", 15, 600)


def _is_web(request: Request) -> bool:
    return request.headers.get("x-client") == "web"


def _phone(raw: str) -> str:
    try:
        return to_e164(raw)
    except ValueError as exc:
        raise HTTPException(422, str(exc))


# ---------- member sign-up ----------

class RegisterIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    phone: str
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)
    consent: bool


@router.post("/register")
async def register(body: RegisterIn, request: Request, session: DB):
    await otp_limiter.hit(client_ip(request))
    if not body.consent:
        raise HTTPException(422, "Please accept the terms and privacy policy to continue")
    if problem := password_problems(body.password):
        raise HTTPException(422, problem)
    phone = _phone(body.phone)
    email = body.email.lower() if body.email else None
    user = await session.scalar(select(User).where(User.phone == phone))
    if user and user.phone_verified_at:
        raise HTTPException(409, "An account with this phone number already exists. Sign in instead.")
    if email:
        clash = await session.scalar(select(User).where(User.email == email))
        if clash and (not user or clash.id != user.id):
            raise HTTPException(409, "That email is already used by another account")
    if not user:
        user = User(phone=phone, role=Role.member)
        session.add(user)
    # An unverified sign-up can be retried: the phone owner proves themselves with the OTP.
    user.full_name, user.email = body.full_name.strip(), email
    user.password_hash = hash_password(body.password)
    user.consent_at = utcnow()
    await session.flush()
    if not await session.scalar(select(MemberProfile.id).where(MemberProfile.user_id == user.id)):
        session.add(MemberProfile(user_id=user.id))
    await session.commit()
    dev_code = await send_otp(session, phone, OtpPurpose.verify_phone)
    return {"phone": phone, "phone_masked": mask_phone(phone), "dev_code": dev_code}


class ResendIn(BaseModel):
    phone: str
    purpose: OtpPurpose = OtpPurpose.verify_phone


@router.post("/otp/resend")
async def resend(body: ResendIn, request: Request, session: DB):
    phone = _phone(body.phone)
    await otp_limiter.hit(f"{client_ip(request)}:{phone}")
    user = await session.scalar(select(User).where(User.phone == phone))
    dev_code = None
    if user:  # silent otherwise: never reveal which numbers have accounts
        dev_code = await send_otp(session, phone, body.purpose)
    return {"ok": True, "phone_masked": mask_phone(phone), "dev_code": dev_code}


class VerifyPhoneIn(BaseModel):
    phone: str
    code: str = Field(min_length=4, max_length=8)
    device: DeviceIn = DeviceIn()


@router.post("/verify-phone")
async def verify_phone(body: VerifyPhoneIn, request: Request, response: Response, session: DB):
    phone = _phone(body.phone)
    await verify_limiter.hit(f"{client_ip(request)}:{phone}")
    await check_otp(session, phone, OtpPurpose.verify_phone, body.code)
    user = await session.scalar(select(User).where(User.phone == phone))
    if not user:
        raise HTTPException(400, "That code is not correct")
    user.phone_verified_at = user.phone_verified_at or utcnow()
    record(session, actor_id=user.id, action="auth.phone_verified", entity="user", entity_id=user.id,
           ip=client_ip(request))
    return await issue_session(session, user, body.device, client_ip(request), web=_is_web(request),
                               response=response)


# ---------- sign-in ----------

class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)  # phone or email
    password: str = Field(min_length=1, max_length=128)
    device: DeviceIn = DeviceIn()


async def _find_user(session, identifier: str) -> User | None:
    ident = identifier.strip().lower()
    if "@" in ident:
        return await session.scalar(select(User).where(User.email == ident))
    try:
        return await session.scalar(select(User).where(User.phone == to_e164(ident)))
    except ValueError:
        return None


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response, session: DB):
    ip = client_ip(request)
    await login_limiter.hit(ip)
    user = await _find_user(session, body.identifier)
    now = utcnow()
    if not user or user.status == UserStatus.deleted or not user.password_hash:
        burn_password_check(body.password)
        raise HTTPException(401, "Incorrect phone/email or password")
    if user.locked_until and user.locked_until > now:
        mins = int((user.locked_until - now).total_seconds() // 60) + 1
        raise HTTPException(423, f"Too many failed attempts. Try again in {mins} minute{'s' if mins > 1 else ''}.")
    if not verify_password(body.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= settings.max_failed_logins:
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            user.failed_logins = 0
            record(session, actor_id=user.id, action="auth.locked", entity="user", entity_id=user.id, ip=ip)
        await session.commit()
        raise HTTPException(401, "Incorrect phone/email or password")
    if user.status == UserStatus.suspended:
        raise HTTPException(403, "This account is suspended. Contact DEEN support.")

    web = _is_web(request)
    staff = is_platform(user.role) or is_org(user.role)
    if web and not staff:
        raise HTTPException(403, "Members sign in with the DEEN mobile app")
    if not web and staff:
        raise HTTPException(403, "Staff and organization accounts sign in on the DEEN web portal")

    if user.role == Role.member and not user.phone_verified_at:
        dev_code = await send_otp(session, user.phone, OtpPurpose.verify_phone)
        return {"verify_required": True, "phone": user.phone, "phone_masked": mask_phone(user.phone),
                "dev_code": dev_code}
    # Two-factor for members: a password alone never opens the account on a phone we
    # haven't seen before. The SMS code proves possession of the registered number.
    if user.role == Role.member and not await _known_device(session, user.id, body.device.device_id):
        dev_code = await send_otp(session, user.phone, OtpPurpose.new_device)
        return {"device_verify_required": True, "phone": user.phone, "phone_masked": mask_phone(user.phone),
                "dev_code": dev_code}
    if user.totp_enabled:
        return {"mfa_required": True, "mfa_token": create_mfa_token(user.id, body.device.model_dump())}
    if staff and settings.staff_mfa_required and settings.is_production:
        return {"mfa_setup_required": True, "mfa_token": create_mfa_token(user.id, body.device.model_dump())}
    record(session, actor_id=user.id, action="auth.login", entity="user", entity_id=user.id, ip=ip,
           device=body.device.device_name)
    return await issue_session(session, user, body.device, ip, web=web, response=response)


async def _known_device(session, user_id: str, device_id: str) -> bool:
    return bool(await session.scalar(select(UserSession.id).where(
        UserSession.user_id == user_id, UserSession.device_id == device_id).limit(1)))


class DeviceVerifyIn(BaseModel):
    phone: str
    code: str = Field(min_length=4, max_length=8)
    device: DeviceIn


@router.post("/verify-device")
async def verify_device(body: DeviceVerifyIn, request: Request, response: Response, session: DB):
    phone = _phone(body.phone)
    await verify_limiter.hit(f"{client_ip(request)}:{phone}")
    await check_otp(session, phone, OtpPurpose.new_device, body.code)
    user = await session.scalar(select(User).where(User.phone == phone))
    if not user or user.status != UserStatus.active:
        raise HTTPException(400, "That code is not correct")
    record(session, actor_id=user.id, action="auth.new_device", entity="user", entity_id=user.id,
           ip=client_ip(request), device=body.device.device_name)
    await notify(session, [user.id], kind="announcements", title="New sign-in to your DEEN account",
                 body=f"Signed in on {body.device.device_name}. If this wasn't you, reset your password now.",
                 data={"screen": "security"}, channels_=("push", "sms"))
    return await issue_session(session, user, body.device, client_ip(request), web=False, response=response)


class MfaIn(BaseModel):
    mfa_token: str
    code: str = Field(min_length=6, max_length=8)


@router.post("/mfa")
async def mfa(body: MfaIn, request: Request, response: Response, session: DB):
    ip = client_ip(request)
    await verify_limiter.hit(ip)
    try:
        payload = decode_token(body.mfa_token, "mfa")
    except jwt.PyJWTError:
        raise HTTPException(401, "Sign-in expired. Start again.")
    user = await session.get(User, payload["sub"])
    if not user or not user.totp_enabled or not user.totp_secret_enc:
        raise HTTPException(401, "Sign-in expired. Start again.")
    if not verify_totp(decrypt_text(user.totp_secret_enc), body.code):
        raise HTTPException(400, "That code is not correct")
    record(session, actor_id=user.id, action="auth.login", entity="user", entity_id=user.id, ip=ip, mfa=True)
    return await issue_session(session, user, DeviceIn(**payload.get("dev", {})), ip, web=_is_web(request),
                               response=response)


class RefreshIn(BaseModel):
    refresh_token: str | None = None


@router.post("/refresh")
async def refresh(body: RefreshIn, request: Request, response: Response, session: DB):
    token = body.refresh_token or request.cookies.get("deen_rt")
    if not token:
        raise HTTPException(401, "Session expired")
    user, sess, access, new_refresh = await rotate_refresh(session, token)
    if _is_web(request):
        set_web_cookies(response, access, new_refresh)
        return {"user": await user_payload(session, user)}
    return {"access_token": access, "refresh_token": new_refresh, "expires_in": settings.access_minutes * 60,
            "user": await user_payload(session, user)}


@router.post("/logout")
async def logout(p: CurrentUser, response: Response, session: DB):
    sess = await session.get(UserSession, p.session_id)
    if sess:
        sess.revoked_at = utcnow()
    await session.commit()
    clear_web_cookies(response)
    return {"ok": True}


@router.post("/logout-all")
async def logout_all(p: CurrentUser, response: Response, session: DB):
    await revoke_all(session, p.id)
    record(session, actor_id=p.id, action="auth.logout_all", entity="user", entity_id=p.id, ip=p.ip)
    await session.commit()
    clear_web_cookies(response)
    return {"ok": True}


# ---------- devices ----------

@router.get("/sessions")
async def sessions(p: CurrentUser, session: DB):
    rows = (await session.execute(select(UserSession).where(
        UserSession.user_id == p.id, UserSession.revoked_at.is_(None), UserSession.expires_at > utcnow()
    ).order_by(UserSession.last_seen_at.desc().nullslast()))).scalars().all()
    return [{"id": s.id, "device_name": s.device_name, "platform": s.platform, "last_seen_at": s.last_seen_at,
             "created_at": s.created_at, "ip": s.ip, "biometric_enabled": s.biometric_enabled,
             "current": s.id == p.session_id} for s in rows]


@router.delete("/sessions/{session_id}")
async def revoke_session(session_id: str, p: CurrentUser, session: DB):
    sess = await session.get(UserSession, session_id)
    if not sess or sess.user_id != p.id:
        raise HTTPException(404, "Session not found")
    sess.revoked_at = utcnow()
    record(session, actor_id=p.id, action="auth.session_revoked", entity="user", entity_id=p.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


class CurrentSessionIn(BaseModel):
    biometric_enabled: bool


@router.patch("/sessions/current")
async def update_current_session(body: CurrentSessionIn, p: CurrentUser, session: DB):
    sess = await session.get(UserSession, p.session_id)
    sess.biometric_enabled = body.biometric_enabled
    record(session, actor_id=p.id, action="auth.biometric_" + ("on" if body.biometric_enabled else "off"),
           entity="user", entity_id=p.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


# ---------- passwords ----------

class ForgotIn(BaseModel):
    identifier: str


@router.post("/forgot")
async def forgot(body: ForgotIn, request: Request, session: DB):
    await otp_limiter.hit(client_ip(request))
    user = await _find_user(session, body.identifier)
    dev_code = None
    if user and user.status != UserStatus.deleted:
        target = user.email if "@" in body.identifier else user.phone
        if target:
            dev_code = await send_otp(session, target, OtpPurpose.reset_password)
    # Same answer either way: no account enumeration.
    return {"ok": True, "dev_code": dev_code}


class ResetIn(BaseModel):
    identifier: str
    code: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/reset")
async def reset(body: ResetIn, request: Request, session: DB):
    await verify_limiter.hit(client_ip(request))
    if problem := password_problems(body.new_password):
        raise HTTPException(422, problem)
    user = await _find_user(session, body.identifier)
    if not user:
        raise HTTPException(400, "That code is not correct")
    target = user.email if "@" in body.identifier else user.phone
    await check_otp(session, target, OtpPurpose.reset_password, body.code)
    user.password_hash = hash_password(body.new_password)
    user.failed_logins, user.locked_until = 0, None
    if user.role == Role.member and "@" not in body.identifier:
        user.phone_verified_at = user.phone_verified_at or utcnow()
    await revoke_all(session, user.id)
    record(session, actor_id=user.id, action="auth.password_reset", entity="user", entity_id=user.id,
           ip=client_ip(request))
    await session.commit()
    return {"ok": True}


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, p: CurrentUser, session: DB):
    user = await session.get(User, p.id)
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is not correct")
    if problem := password_problems(body.new_password):
        raise HTTPException(422, problem)
    user.password_hash = hash_password(body.new_password)
    await revoke_all(session, p.id, except_session=p.session_id)
    record(session, actor_id=p.id, action="auth.password_changed", entity="user", entity_id=p.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


# ---------- authenticator app (TOTP) ----------

@router.post("/totp/setup")
async def totp_setup(p: CurrentUser, session: DB):
    user = await session.get(User, p.id)
    if user.totp_enabled:
        raise HTTPException(409, "Two-step verification is already on")
    secret = new_totp_secret()
    user.totp_secret_enc = encrypt_text(secret)
    await session.commit()
    uri = totp_uri(secret, user.email or user.phone or user.full_name)
    return {"secret": secret, "uri": uri, "qr_svg": segno.make(uri).svg_inline(scale=5, dark="#0B2A23")}


class TotpIn(BaseModel):
    code: str
    password: str | None = None


@router.post("/totp/enable")
async def totp_enable(body: TotpIn, p: CurrentUser, session: DB):
    user = await session.get(User, p.id)
    if not user.totp_secret_enc or not verify_totp(decrypt_text(user.totp_secret_enc), body.code):
        raise HTTPException(400, "That code is not correct")
    user.totp_enabled = True
    record(session, actor_id=p.id, action="auth.totp_enabled", entity="user", entity_id=p.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


@router.post("/totp/disable")
async def totp_disable(body: TotpIn, p: CurrentUser, session: DB):
    user = await session.get(User, p.id)
    if not body.password or not verify_password(body.password, user.password_hash):
        raise HTTPException(400, "Your password is not correct")
    if not user.totp_secret_enc or not verify_totp(decrypt_text(user.totp_secret_enc), body.code):
        raise HTTPException(400, "That code is not correct")
    user.totp_enabled, user.totp_secret_enc = False, None
    record(session, actor_id=p.id, action="auth.totp_disabled", entity="user", entity_id=p.id, ip=p.ip)
    await session.commit()
    return {"ok": True}


# ---------- invitations (DEEN staff + organization representatives) ----------

async def _live_invite(session, token: str) -> Invite:
    inv = await session.scalar(select(Invite).where(Invite.token_hash == keyed_hash(token)))
    if not inv or inv.accepted_at or inv.revoked_at or inv.expires_at < utcnow():
        raise HTTPException(404, "This invitation link is invalid or has expired")
    return inv


@router.get("/invites/{token}")
async def invite_preview(token: str, session: DB):
    inv = await _live_invite(session, token)
    org = await session.get(Organization, inv.organization_id) if inv.organization_id else None
    return {"email": inv.email, "full_name": inv.full_name, "role": inv.role.value,
            "organization": {"name": org.name, "verification": org.verification.value} if org else None,
            "expires_at": inv.expires_at}


class AcceptIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None


@router.post("/invites/{token}/accept")
async def invite_accept(token: str, body: AcceptIn, request: Request, response: Response, session: DB):
    await verify_limiter.hit(client_ip(request))
    inv = await _live_invite(session, token)
    if problem := password_problems(body.password):
        raise HTTPException(422, problem)
    phone = _phone(body.phone) if body.phone else None
    conflict = await session.scalar(select(User).where(or_(User.email == inv.email,
                                                           User.phone == phone if phone else False)))
    if conflict:
        raise HTTPException(409, "An account with this email or phone already exists")
    user = User(full_name=body.full_name.strip(), email=inv.email, phone=phone, role=inv.role,
                organization_id=inv.organization_id, password_hash=hash_password(body.password),
                email_verified_at=utcnow(), consent_at=utcnow())
    session.add(user)
    inv.accepted_at = utcnow()
    await session.flush()
    record(session, actor_id=user.id, action="invite.accepted", entity="user", entity_id=user.id,
           ip=client_ip(request), role=inv.role.value, organization_id=inv.organization_id)
    return await issue_session(session, user, DeviceIn(), client_ip(request), web=True, response=response)
