"""M-Pesa Daraja STK Push (Lipa na M-Pesa Online).

`sandbox` provider simulates the customer approving on their phone: the payment
settles itself a few seconds later through the same code path as a real callback."""
import base64
from datetime import datetime
from uuid import uuid4

import httpx

from app.core.clock import TZ
from app.core.config import settings


class MpesaError(Exception):
    pass


def _base() -> str:
    return "https://api.safaricom.co.ke" if settings.mpesa_env == "production" else "https://sandbox.safaricom.co.ke"


async def _token(client: httpx.AsyncClient) -> str:
    r = await client.get(f"{_base()}/oauth/v1/generate?grant_type=client_credentials",
                         auth=(settings.mpesa_consumer_key, settings.mpesa_consumer_secret))
    if r.status_code != 200:
        raise MpesaError("M-Pesa is unavailable right now. Please try again shortly.")
    return r.json()["access_token"]


async def stk_push(phone_e164: str, amount: int, reference: str, description: str) -> str:
    """Sends the PIN prompt to the customer's phone. Returns CheckoutRequestID."""
    if settings.payments_provider != "daraja":
        return f"ws_SANDBOX_{uuid4().hex[:20]}"
    ts = datetime.now(TZ).strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{settings.mpesa_shortcode}{settings.mpesa_passkey}{ts}".encode()).decode()
    phone = phone_e164.lstrip("+")
    body = {
        "BusinessShortCode": settings.mpesa_shortcode, "Password": password, "Timestamp": ts,
        "TransactionType": "CustomerPayBillOnline", "Amount": amount, "PartyA": phone,
        "PartyB": settings.mpesa_shortcode, "PhoneNumber": phone,
        "CallBackURL": f"{settings.api_public_url}/api/v1/payments/mpesa/callback/{settings.mpesa_callback_token}",
        "AccountReference": reference[:12], "TransactionDesc": description[:13],
    }
    async with httpx.AsyncClient(timeout=30) as client:
        token = await _token(client)
        r = await client.post(f"{_base()}/mpesa/stkpush/v1/processrequest", json=body,
                              headers={"Authorization": f"Bearer {token}"})
    data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if r.status_code != 200 or data.get("ResponseCode") != "0":
        raise MpesaError(data.get("errorMessage") or data.get("CustomerMessage") or "Could not start M-Pesa payment")
    return data["CheckoutRequestID"]


def parse_callback(body: dict) -> dict:
    cb = (body.get("Body") or {}).get("stkCallback") or {}
    items = {i.get("Name"): i.get("Value") for i in (cb.get("CallbackMetadata") or {}).get("Item", [])}
    return {
        "checkout_request_id": cb.get("CheckoutRequestID"),
        "result_code": int(cb.get("ResultCode", -1)),
        "result_desc": cb.get("ResultDesc"),
        "receipt": items.get("MpesaReceiptNumber"),
        "amount": items.get("Amount"),
    }
