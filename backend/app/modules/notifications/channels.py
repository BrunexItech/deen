"""Outbound delivery channels. Each provider degrades to logging in development so
the whole platform runs end-to-end without third-party accounts."""
import asyncio
import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import settings

log = logging.getLogger("deen.channels")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_sms(phone: str, text: str) -> None:
    if settings.sms_provider == "africastalking" and settings.at_api_key:
        base = ("https://api.sandbox.africastalking.com" if settings.at_username == "sandbox"
                else "https://api.africastalking.com")
        data = {"username": settings.at_username, "to": phone, "message": text}
        if settings.at_sender_id:
            data["from"] = settings.at_sender_id
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f"{base}/version1/messaging", data=data,
                                  headers={"apiKey": settings.at_api_key, "Accept": "application/json"})
            r.raise_for_status()
        return
    log.info("[sms sandbox] to=%s text=%s", phone, text)


def _smtp_send(msg: EmailMessage) -> None:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as s:
        s.starttls()
        if settings.smtp_user:
            s.login(settings.smtp_user, settings.smtp_password)
        s.send_message(msg)


async def send_email(to: str, subject: str, text: str, html: str | None = None) -> None:
    if not settings.smtp_host:
        log.info("[email sandbox] to=%s subject=%s\n%s", to, subject, text)
        return
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.smtp_from, to, subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    await asyncio.to_thread(_smtp_send, msg)


async def send_push(messages: list[dict]) -> list[dict]:
    """Expo push API, 100 messages per request. Returns per-message tickets."""
    if not settings.expo_push_enabled or settings.testing or not messages:
        log.info("[push sandbox] %d messages", len(messages))
        return []
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if settings.expo_access_token:
        headers["Authorization"] = f"Bearer {settings.expo_access_token}"
    tickets: list[dict] = []
    async with httpx.AsyncClient(timeout=20) as client:
        for i in range(0, len(messages), 100):
            r = await client.post(EXPO_PUSH_URL, json=messages[i:i + 100], headers=headers)
            if r.status_code == 200:
                tickets.extend(r.json().get("data", []))
    return tickets


def branded_email(title: str, body: str, cta: tuple[str, str] | None = None) -> str:
    button = (f'<p style="margin:28px 0"><a href="{cta[1]}" style="background:#0B5D4B;color:#fff;padding:12px 22px;'
              f'border-radius:10px;text-decoration:none;font-weight:600">{cta[0]}</a></p>') if cta else ""
    return f"""<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#F6F4EE;padding:32px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #E7E2D6">
<div style="font-weight:800;letter-spacing:4px;color:#0B5D4B;font-size:20px">DEEN</div>
<h1 style="font-size:22px;color:#0F1A17;margin:24px 0 8px">{title}</h1>
<div style="color:#43504B;line-height:1.6;font-size:15px">{body}</div>{button}
<hr style="border:none;border-top:1px solid #EEE9DD;margin:28px 0 16px"/>
<p style="color:#8A938F;font-size:12px">DEEN — opportunities for the Muslim community in Kenya.</p>
</div></div>"""
