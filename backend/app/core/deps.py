"""Request dependencies: who is calling, and are they allowed."""
from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.db import get_session
from app.core.ratelimit import client_ip
from app.core.roles import Perm, Role, is_org, is_platform, perms_for
from app.core.security import decode_token
from app.modules.users.models import User, UserSession, UserStatus

DB = Annotated[AsyncSession, Depends(get_session)]


@dataclass
class Principal:
    user: User
    session_id: str
    ip: str

    @property
    def id(self) -> str:
        return self.user.id

    @property
    def role(self) -> Role:
        return self.user.role

    def can(self, perm: Perm) -> bool:
        return perm in perms_for(self.user.role)


def _token_from(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get("deen_at")


async def current_principal(request: Request, session: DB) -> Principal:
    token = _token_from(request)
    if not token:
        raise HTTPException(401, "Not signed in")
    try:
        payload = decode_token(token, "access")
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired")
    # One indexed lookup per request so revoking a session (lost phone, sign out
    # everywhere) takes effect immediately rather than when the token expires.
    row = (await session.execute(
        select(User, UserSession)
        .join(UserSession, UserSession.user_id == User.id)
        .where(User.id == payload["sub"], UserSession.id == payload["sid"])
    )).first()
    if not row:
        raise HTTPException(401, "Session expired")
    user, sess = row
    now = utcnow()
    if sess.revoked_at or sess.expires_at < now:
        raise HTTPException(401, "Session expired")
    if user.status != UserStatus.active:
        raise HTTPException(403, "This account is suspended. Contact DEEN support.")
    # Touch at most once every 5 minutes: keeps "last active" useful without a write per request.
    if not sess.last_seen_at or now - sess.last_seen_at > timedelta(minutes=5):
        await session.execute(update(UserSession).where(UserSession.id == sess.id).values(last_seen_at=now))
        await session.execute(update(User).where(User.id == user.id).values(last_active_at=now))
        await session.commit()
    return Principal(user=user, session_id=sess.id, ip=client_ip(request))


CurrentUser = Annotated[Principal, Depends(current_principal)]


async def optional_principal(request: Request, session: DB) -> Principal | None:
    if not _token_from(request):
        return None
    try:
        return await current_principal(request, session)
    except HTTPException:
        return None


MaybeUser = Annotated[Principal | None, Depends(optional_principal)]


def require(perm: Perm):
    async def dep(p: CurrentUser) -> Principal:
        if not p.can(perm):
            raise HTTPException(403, "You don't have permission to do that")
        return p

    return Depends(dep)


async def platform_staff(p: CurrentUser) -> Principal:
    if not is_platform(p.role):
        raise HTTPException(403, "DEEN staff only")
    return p


async def org_user(p: CurrentUser) -> Principal:
    if not is_org(p.role) or not p.user.organization_id:
        raise HTTPException(403, "Organization accounts only")
    return p


async def org_admin(p: CurrentUser) -> Principal:
    if p.role != Role.org_admin or not p.user.organization_id:
        raise HTTPException(403, "Organization administrators only")
    return p


async def member(p: CurrentUser) -> Principal:
    if p.role != Role.member:
        raise HTTPException(403, "Member accounts only")
    return p


Staff = Annotated[Principal, Depends(platform_staff)]
OrgUser = Annotated[Principal, Depends(org_user)]
OrgAdmin = Annotated[Principal, Depends(org_admin)]
Member = Annotated[Principal, Depends(member)]
