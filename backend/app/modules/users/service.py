"""Accounts, sessions and one-time codes."""
from datetime import timedelta

from fastapi import HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.config import settings
from app.core.roles import is_org, is_platform, perms_for
from app.core.security import create_access_token, keyed_hash, numeric_code, random_token
from app.modules.notifications import channels
from app.modules.users.models import OtpCode, OtpPurpose, User, UserSession


class DeviceIn(BaseModel):
    device_id: str = Field(default="web", max_length=80)
    device_name: str = Field(default="Web browser", max_length=120)
    platform: str = Field(default="web", max_length=20)


# ---------- sessions ----------

async def issue_session(session: AsyncSession, user: User, device: DeviceIn, ip: str, *, web: bool,
                        response: Response | None = None) -> dict:
    """Creates a device session and returns tokens (mobile) or sets httpOnly cookies (web).
    Signing in again on the same device replaces its previous session."""
    now = utcnow()
    await session.execute(update(UserSession).where(
        UserSession.user_id == user.id, UserSession.device_id == device.device_id, UserSession.revoked_at.is_(None)
    ).values(revoked_at=now))
    refresh = random_token()
    lifetime = timedelta(hours=settings.web_session_hours) if web else timedelta(days=settings.refresh_days)
    sess = UserSession(user_id=user.id, device_id=device.device_id, device_name=device.device_name,
                       platform=device.platform, refresh_hash=keyed_hash(refresh), expires_at=now + lifetime,
                       last_seen_at=now, ip=ip)
    session.add(sess)
    user.last_login_at = now
    user.failed_logins = 0
    user.locked_until = None
    await session.flush()
    access = create_access_token(user.id, sess.id, user.role.value)
    token = f"{sess.id}.{refresh}"
    await session.commit()
    if web and response is not None:
        set_web_cookies(response, access, token)
        return {"user": await user_payload(session, user)}
    return {"access_token": access, "refresh_token": token, "expires_in": settings.access_minutes * 60,
            "user": await user_payload(session, user)}


def set_web_cookies(response: Response, access: str, refresh: str) -> None:
    secure = settings.is_production
    response.set_cookie("deen_at", access, httponly=True, secure=secure, samesite="lax", path="/",
                        max_age=settings.access_minutes * 60)
    response.set_cookie("deen_rt", refresh, httponly=True, secure=secure, samesite="strict", path="/api/v1/auth",
                        max_age=settings.web_session_hours * 3600)


def clear_web_cookies(response: Response) -> None:
    response.delete_cookie("deen_at", path="/")
    response.delete_cookie("deen_rt", path="/api/v1/auth")


async def rotate_refresh(session: AsyncSession, token: str) -> tuple[User, UserSession, str, str]:
    """Returns (user, session, new_access, new_refresh). A replayed (already rotated)
    token revokes the session: someone else is holding a copy of it."""
    try:
        sid, secret = token.split(".", 1)
    except ValueError:
        raise HTTPException(401, "Session expired")
    sess = await session.get(UserSession, sid)
    now = utcnow()
    if not sess or sess.revoked_at or sess.expires_at < now:
        raise HTTPException(401, "Session expired")
    digest = keyed_hash(secret)
    if sess.refresh_hash != digest:
        if sess.previous_refresh_hash == digest:
            sess.revoked_at = now
            await session.commit()
        raise HTTPException(401, "Session expired")
    user = await session.get(User, sess.user_id)
    if not user or user.status.value != "active":
        raise HTTPException(401, "Session expired")
    new_secret = random_token()
    sess.previous_refresh_hash, sess.refresh_hash = sess.refresh_hash, keyed_hash(new_secret)
    sess.last_seen_at = now
    await session.commit()
    return user, sess, create_access_token(user.id, sess.id, user.role.value), f"{sess.id}.{new_secret}"


async def revoke_all(session: AsyncSession, user_id: str, except_session: str | None = None) -> None:
    stmt = update(UserSession).where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
    if except_session:
        stmt = stmt.where(UserSession.id != except_session)
    await session.execute(stmt.values(revoked_at=utcnow()))


# ---------- one-time codes ----------

async def send_otp(session: AsyncSession, target: str, purpose: OtpPurpose) -> str | None:
    """Creates a 6-digit code and sends it by SMS or email. Returns the code only in
    development with sandbox delivery, so the app can be exercised without an SMS account."""
    await session.execute(update(OtpCode).where(
        OtpCode.target == target, OtpCode.purpose == purpose, OtpCode.used_at.is_(None)).values(used_at=utcnow()))
    code = numeric_code()
    session.add(OtpCode(target=target, purpose=purpose, code_hash=keyed_hash(f"{target}:{code}"),
                        expires_at=utcnow() + timedelta(minutes=settings.otp_minutes)))
    await session.commit()
    text = f"Your DEEN code is {code}. It expires in {settings.otp_minutes} minutes. Never share it."
    if "@" in target:
        await channels.send_email(target, "Your DEEN verification code", text,
                                  channels.branded_email("Your verification code",
                                                         f"<p style='font-size:30px;letter-spacing:8px;font-weight:700'>{code}</p>"
                                                         f"<p>It expires in {settings.otp_minutes} minutes. "
                                                         "Never share this code with anyone.</p>"))
    else:
        await channels.send_sms(target, text)
    dev = settings.sms_provider == "sandbox" and (not settings.is_production or settings.otp_on_screen)
    return code if dev else None


async def check_otp(session: AsyncSession, target: str, purpose: OtpPurpose, code: str) -> None:
    row = await session.scalar(select(OtpCode).where(
        OtpCode.target == target, OtpCode.purpose == purpose, OtpCode.used_at.is_(None)
    ).order_by(OtpCode.created_at.desc()).limit(1))
    if not row or row.expires_at < utcnow():
        raise HTTPException(400, "This code has expired. Request a new one.")
    if row.attempts >= settings.otp_max_attempts:
        raise HTTPException(429, "Too many wrong codes. Request a new one.")
    if row.code_hash != keyed_hash(f"{target}:{code.strip()}"):
        row.attempts += 1
        await session.commit()
        raise HTTPException(400, "That code is not correct")
    row.used_at = utcnow()


# ---------- payloads ----------

async def user_payload(session: AsyncSession, user: User) -> dict:
    from app.modules.orgs.models import Organization
    from app.modules.subscriptions.service import current_membership

    org = await session.get(Organization, user.organization_id) if user.organization_id else None
    membership = await current_membership(session, user.id) if user.role.value == "member" else None
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role.value,
        "portal": "admin" if is_platform(user.role) else "org" if is_org(user.role) else "member",
        "permissions": sorted(p.value for p in perms_for(user.role)),
        "phone_verified": user.phone_verified_at is not None,
        "identity_status": user.identity_status.value,
        "totp_enabled": user.totp_enabled,
        "avatar_url": f"/api/v1/files/{user.avatar_file_id}" if user.avatar_file_id else None,
        "organization": {"id": org.id, "name": org.name, "verification": org.verification.value,
                         "logo_url": f"/api/v1/files/{org.logo_file_id}" if org.logo_file_id else None} if org else None,
        "membership": membership,
        "created_at": user.created_at,
    }
