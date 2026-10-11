"""Passwords, tokens and one-time codes."""
import hashlib
import hmac
import re
import secrets
from datetime import timedelta

import bcrypt
import jwt
import pyotp

from app.core.clock import utcnow
from app.core.config import settings

_COMMON = {
    "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123",
    "iloveyou", "admin123", "welcome1", "changeme", "letmein123", "bismillah", "bismillah1",
    "alhamdulillah", "insha allah", "inshallah1", "muhammad1", "allahuakbar", "kenya2026",
}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    return bcrypt.checkpw(password.encode(), hashed.encode())


_DECOY = bcrypt.hashpw(b"decoy-password", bcrypt.gensalt(rounds=12)).decode()


def burn_password_check(password: str) -> None:
    """Unknown accounts cost the same time as wrong passwords (no user enumeration)."""
    bcrypt.checkpw(password.encode(), _DECOY.encode())


def password_problems(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return "Password must include letters and numbers"
    if password.lower() in _COMMON:
        return "That password is too common"
    return None


def keyed_hash(value: str) -> str:
    """HMAC for secrets we must look up but never store (refresh tokens, OTPs, invites)."""
    return hmac.new(settings.hash_pepper.encode(), value.encode(), hashlib.sha256).hexdigest()


def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def numeric_code(digits: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(digits))


def create_access_token(user_id: str, session_id: str, role: str, minutes: int | None = None) -> str:
    exp = utcnow() + timedelta(minutes=minutes or settings.access_minutes)
    return jwt.encode(
        {"sub": user_id, "sid": session_id, "role": role, "typ": "access", "exp": exp},
        settings.jwt_secret, algorithm=settings.jwt_algorithm,
    )


def create_mfa_token(user_id: str, device: dict) -> str:
    exp = utcnow() + timedelta(minutes=5)
    return jwt.encode({"sub": user_id, "typ": "mfa", "dev": device, "exp": exp}, settings.jwt_secret,
                      algorithm=settings.jwt_algorithm)


def create_pay_token(user_id: str) -> str:
    """Short-lived proof that someone holds a member's phone, for paying on the website."""
    exp = utcnow() + timedelta(minutes=20)
    return jwt.encode({"sub": user_id, "typ": "pay", "exp": exp}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, typ: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("typ") != typ:
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def new_totp_secret() -> str:
    return pyotp.random_base32()


def verify_totp(secret: str, code: str) -> bool:
    code = code.replace(" ", "")
    return code.isdigit() and pyotp.TOTP(secret).verify(code, valid_window=1)


def totp_uri(secret: str, label: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=label, issuer_name=settings.app_name)
