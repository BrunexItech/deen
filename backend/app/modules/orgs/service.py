import re
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.config import settings
from app.core.roles import Role
from app.core.security import keyed_hash, random_token
from app.modules.notifications import channels
from app.modules.orgs.models import Invite, Organization

INVITE_DAYS = 7


async def unique_slug(session: AsyncSession, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "org"
    slug, n = base, 1
    while await session.scalar(select(Organization.id).where(Organization.slug == slug)):
        n += 1
        slug = f"{base}-{n}"
    return slug


async def create_invite(session: AsyncSession, *, email: str, role: Role, invited_by: str,
                        organization: Organization | None = None, full_name: str | None = None) -> dict:
    """Creates a one-time link (valid 7 days) and emails it. Returns the link so the
    inviter can also share it directly (e.g. over WhatsApp) when email is not set up."""
    token = random_token()
    inv = Invite(email=email.lower(), full_name=full_name, role=role,
                 organization_id=organization.id if organization else None, token_hash=keyed_hash(token),
                 expires_at=utcnow() + timedelta(days=INVITE_DAYS), invited_by_id=invited_by)
    session.add(inv)
    await session.flush()
    link = f"{settings.app_url.rstrip('/')}/invite/{token}"
    where = f" for {organization.name}" if organization else " to the DEEN team"
    body = (f"<p>Assalamu alaikum{(' ' + full_name.split()[0]) if full_name else ''},</p>"
            f"<p>You've been invited to DEEN{where}. Use the button below to create your account. "
            f"The link works once and expires in {INVITE_DAYS} days.</p>")
    await channels.send_email(email, f"You're invited to DEEN{where}",
                              f"You've been invited to DEEN{where}. Create your account: {link}",
                              channels.branded_email("You're invited", body, ("Accept invitation", link)))
    return {"id": inv.id, "email": inv.email, "role": role.value, "link": link, "expires_at": inv.expires_at,
            "email_sent": bool(settings.smtp_host)}


def org_out(org: Organization, extra: dict | None = None) -> dict:
    return {
        "id": org.id, "name": org.name, "slug": org.slug, "type": org.org_type.value, "tagline": org.tagline,
        "description": org.description, "website": org.website, "email": org.email, "phone": org.phone,
        "county": org.county, "address": org.address, "registration_number": org.registration_number,
        "logo_url": f"/api/v1/files/{org.logo_file_id}" if org.logo_file_id else None,
        "logo_file_id": org.logo_file_id, "verification": org.verification.value, "status": org.status.value,
        "premium": org.premium, "verified_at": org.verified_at, "followers_count": org.followers_count,
        "created_at": org.created_at, **(extra or {}),
    }
