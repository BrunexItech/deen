import jwt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record
from app.core.clock import utcnow
from app.core.config import settings
from app.core.deps import DB, Member
from app.core.pagination import finish, keyset
from app.core.phone import mask_phone, to_e164
from app.core.ratelimit import RateLimiter, client_ip
from app.core.security import create_pay_token, decode_token
from app.modules.jobs.service import enqueue, handler
from app.modules.notifications.service import notify
from app.modules.subscriptions import mpesa
from app.modules.subscriptions.models import Payment, PayStatus, Plan
from app.modules.subscriptions.service import activate, applications_this_month, current_membership, fee_out, fee_plan
from app.modules.users.models import OtpPurpose, User, UserStatus
from app.modules.users.service import check_otp, send_otp

router = APIRouter(prefix="/api/v1", tags=["membership"])
checkout_limiter = RateLimiter("checkout", 6, 600)
pay_otp_limiter = RateLimiter("pay_otp", 4, 600)
pay_verify_limiter = RateLimiter("pay_verify", 10, 600)


@router.get("/fee")
async def fee(session: DB):
    """Public: the community maintenance fee as the super admin set it."""
    return fee_out(await fee_plan(session))


@router.get("/membership")
async def membership(p: Member, session: DB):
    """Status only. Payment happens on the DEEN website, never inside the app."""
    m = await current_membership(session, p.id)
    return {**m, "applications_this_month": await applications_this_month(session, p.id)}


# ---------- paying on the website ----------
# A member proves they hold their registered phone with an SMS code, then pays by
# M-Pesa. The same answer is returned whether or not a number is registered, so the
# page never reveals who belongs to DEEN.

class PayStartIn(BaseModel):
    phone: str


@router.post("/pay/start")
async def pay_start(body: PayStartIn, request: Request, session: DB):
    try:
        phone = to_e164(body.phone)
    except ValueError:
        raise HTTPException(422, "Enter a valid phone number")
    await pay_otp_limiter.hit(f"{client_ip(request)}:{phone}")
    user = await session.scalar(select(User).where(User.phone == phone, User.status == UserStatus.active))
    dev_code = None
    if user and user.role.value == "member":
        dev_code = await send_otp(session, phone, OtpPurpose.payment)
    return {"sent": True, "phone_masked": mask_phone(phone), "dev_code": dev_code}


class PayVerifyIn(BaseModel):
    phone: str
    code: str = Field(min_length=4, max_length=8)


async def _pay_status(session: AsyncSession, user: User) -> dict:
    m = await current_membership(session, user.id)
    return {"first_name": user.full_name.split()[0], "paid": m["paid"], "ends_at": m["ends_at"],
            "fee": fee_out(await fee_plan(session))}


@router.post("/pay/verify")
async def pay_verify(body: PayVerifyIn, request: Request, session: DB):
    try:
        phone = to_e164(body.phone)
    except ValueError:
        raise HTTPException(422, "Enter a valid phone number")
    await pay_verify_limiter.hit(f"{client_ip(request)}:{phone}")
    await check_otp(session, phone, OtpPurpose.payment, body.code)
    user = await session.scalar(select(User).where(User.phone == phone, User.status == UserStatus.active))
    if not user:
        raise HTTPException(400, "That code is not correct")
    await session.commit()
    return {"pay_token": create_pay_token(user.id), **await _pay_status(session, user)}


async def _pay_user(session: AsyncSession, token: str) -> User:
    try:
        user = await session.get(User, decode_token(token, "pay")["sub"])
    except jwt.PyJWTError:
        user = None
    if not user or user.status != UserStatus.active:
        raise HTTPException(401, "This page has expired. Start again.")
    return user


class CheckoutIn(BaseModel):
    pay_token: str
    mpesa_phone: str | None = None  # M-Pesa number to prompt; defaults to the account phone
    gift_to_phone: str | None = None  # pay another member's fee


@router.post("/pay/checkout")
async def checkout(body: CheckoutIn, request: Request, session: DB):
    user = await _pay_user(session, body.pay_token)
    await checkout_limiter.hit(user.id)
    plan = await fee_plan(session)
    if not plan or not fee_out(plan)["active"]:
        raise HTTPException(409, "Payments are not open right now")
    try:
        pay_phone = to_e164(body.mpesa_phone) if body.mpesa_phone else user.phone
    except ValueError:
        raise HTTPException(422, "Enter a valid M-Pesa number")
    beneficiary_id = user.id
    if body.gift_to_phone:
        try:
            gift_phone = to_e164(body.gift_to_phone)
        except ValueError:
            raise HTTPException(422, "Enter a valid phone number for the person you're paying for")
        target = await session.scalar(select(User).where(User.phone == gift_phone, User.status == UserStatus.active))
        if not target or target.role.value != "member":
            raise HTTPException(404, "No DEEN member uses that phone number yet. Invite them to join first.")
        beneficiary_id = target.id
    try:
        checkout_id = await mpesa.stk_push(pay_phone, int(plan.price_kes), "DEEN", "Community fee")
    except mpesa.MpesaError as exc:
        raise HTTPException(502, str(exc))
    pay = Payment(user_id=user.id, plan_id=plan.id, beneficiary_id=beneficiary_id, amount_kes=plan.price_kes,
                  phone=pay_phone, provider=settings.payments_provider, checkout_request_id=checkout_id)
    session.add(pay)
    await session.flush()
    if settings.payments_provider != "daraja":
        await enqueue(session, "payments.sandbox_settle", {"payment_id": pay.id}, delay_seconds=5)
    record(session, actor_id=user.id, action="payment.started", entity="payment", entity_id=pay.id,
           ip=client_ip(request), gift=beneficiary_id != user.id)
    await session.commit()
    return {"payment_id": pay.id, "status": pay.status.value, "phone_masked": mask_phone(pay_phone),
            "message": f"Check your phone ({mask_phone(pay_phone)}) and enter your M-Pesa PIN to pay "
                       f"KES {int(plan.price_kes):,}."}


@router.get("/pay/status/{payment_id}")
async def pay_status(payment_id: str, token: str, session: DB):
    user = await _pay_user(session, token)
    pay = await session.get(Payment, payment_id)
    if not pay or pay.user_id != user.id:
        raise HTTPException(404, "Payment not found")
    return {**payment_out(pay), "membership": await _pay_status(session, user)}


def payment_out(pay: Payment) -> dict:
    return {"id": pay.id, "status": pay.status.value, "amount_kes": float(pay.amount_kes), "receipt": pay.receipt,
            "result": pay.result_desc, "created_at": pay.created_at,
            "settled_at": pay.settled_at, "gift": pay.beneficiary_id not in (None, pay.user_id)}


@router.get("/payments")
async def my_payments(p: Member, session: DB, cursor: str | None = None, limit: int = 20):
    stmt = keyset(select(Payment).where(Payment.user_id == p.id), Payment, cursor, limit)
    rows, nxt = finish((await session.execute(stmt)).scalars().all(), limit)
    return {"items": [payment_out(r) for r in rows], "next_cursor": nxt}


async def settle(session: AsyncSession, pay: Payment, *, success: bool, receipt: str | None, desc: str | None,
                 raw: dict | None = None) -> None:
    """Idempotent: M-Pesa may deliver the same callback more than once."""
    if pay.status != PayStatus.pending:
        return
    pay.status = PayStatus.success if success else (PayStatus.cancelled if desc and "cancel" in desc.lower()
                                                     else PayStatus.failed)
    pay.receipt, pay.result_desc, pay.settled_at, pay.raw_callback = receipt, desc, utcnow(), raw
    if not success:
        await notify(session, [pay.user_id], kind="subscription", title="Payment not completed",
                     body=desc or "Your M-Pesa payment did not go through.",
                     data={"screen": "membership"})
        return
    plan = await session.get(Plan, pay.plan_id)
    beneficiary = pay.beneficiary_id or pay.user_id
    sub = await activate(session, beneficiary, plan, sponsored_by=pay.user_id if beneficiary != pay.user_id else None)
    until = sub.ends_at.strftime("%d %b %Y")
    if beneficiary != pay.user_id:
        payer = await session.get(User, pay.user_id)
        await notify(session, [beneficiary], kind="subscription", title="Your DEEN membership was paid for you",
                     body=f"{payer.full_name.split()[0]} paid your community fee. Active until {until}. "
                          "May Allah reward them.", data={"screen": "membership"}, channels_=("push", "sms"))
        await notify(session, [pay.user_id], kind="subscription", title="Payment complete — JazakAllahu khayran",
                     body=f"The membership you paid for is now active. Receipt {receipt}.",
                     data={"screen": "membership"})
    else:
        await notify(session, [pay.user_id], kind="subscription", title="Membership active — JazakAllahu khayran",
                     body=f"Your DEEN membership is active until {until}. Receipt {receipt}.",
                     data={"screen": "membership"}, channels_=("push", "sms"))
    record(session, actor_id=pay.user_id, action="payment.succeeded", entity="payment", entity_id=pay.id,
           receipt=receipt)


@handler("payments.sandbox_settle")
async def sandbox_settle(session: AsyncSession, payload: dict) -> None:
    pay = await session.get(Payment, payload["payment_id"])
    if pay:
        await settle(session, pay, success=True, receipt=f"SBX{pay.id[:7].upper()}",
                     desc="The service request is processed successfully.")


@router.post("/payments/mpesa/callback/{token}")
async def mpesa_callback(token: str, request: Request, session: DB):
    if token != settings.mpesa_callback_token:
        raise HTTPException(404)
    body = await request.json()
    data = mpesa.parse_callback(body)
    pay = await session.scalar(select(Payment).where(Payment.checkout_request_id == data["checkout_request_id"])
                               .with_for_update())
    if pay:
        # Never trust the amount blindly: a tampered callback must not activate a plan.
        ok = data["result_code"] == 0 and (data["amount"] is None or float(data["amount"]) >= float(pay.amount_kes))
        await settle(session, pay, success=ok, receipt=data["receipt"], desc=data["result_desc"], raw=body)
        await session.commit()
    return {"ResultCode": 0, "ResultDesc": "Accepted"}
