from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record
from app.core.clock import utcnow
from app.core.config import settings
from app.core.deps import DB, Member
from app.core.pagination import finish, keyset
from app.core.phone import mask_phone, to_e164
from app.core.ratelimit import RateLimiter
from app.modules.jobs.service import enqueue, handler
from app.modules.notifications.service import notify
from app.modules.subscriptions import mpesa
from app.modules.subscriptions.models import Payment, PayStatus, Plan
from app.modules.subscriptions.service import applications_this_month, current_membership, activate
from app.modules.users.models import User, UserStatus

router = APIRouter(prefix="/api/v1", tags=["membership"])
checkout_limiter = RateLimiter("checkout", 6, 600)


def plan_out(p: Plan) -> dict:
    return {"id": p.id, "code": p.code, "name": p.name, "tagline": p.tagline, "tier": p.tier,
            "price_kes": float(p.price_kes), "interval_months": p.interval_months, "benefits": p.benefits,
            "features": p.features or {}, "highlight": p.highlight}


@router.get("/plans")
async def plans(session: DB):
    rows = (await session.execute(select(Plan).where(Plan.active.is_(True)).order_by(Plan.sort, Plan.price_kes)))
    return [plan_out(p) for p in rows.scalars()]


@router.get("/membership")
async def membership(p: Member, session: DB):
    m = await current_membership(session, p.id)
    return {**m, "applications_this_month": await applications_this_month(session, p.id)}


class CheckoutIn(BaseModel):
    plan_code: str
    phone: str | None = None  # M-Pesa number to prompt; defaults to the account phone
    gift_to_phone: str | None = None  # sponsor another member's membership


@router.post("/payments/checkout")
async def checkout(body: CheckoutIn, p: Member, session: DB):
    await checkout_limiter.hit(p.id)
    plan = await session.scalar(select(Plan).where(Plan.code == body.plan_code, Plan.active.is_(True)))
    if not plan or float(plan.price_kes) <= 0:
        raise HTTPException(404, "Choose a paid plan")
    try:
        pay_phone = to_e164(body.phone) if body.phone else p.user.phone
    except ValueError:
        raise HTTPException(422, "Enter a valid M-Pesa number")
    beneficiary_id = p.id
    if body.gift_to_phone:
        try:
            gift_phone = to_e164(body.gift_to_phone)
        except ValueError:
            raise HTTPException(422, "Enter a valid phone number for the person you're sponsoring")
        target = await session.scalar(select(User).where(User.phone == gift_phone, User.status == UserStatus.active))
        if not target or target.role.value != "member":
            raise HTTPException(404, "No DEEN member uses that phone number yet. Invite them to join first.")
        beneficiary_id = target.id
    try:
        checkout_id = await mpesa.stk_push(pay_phone, int(plan.price_kes), "DEEN", plan.name)
    except mpesa.MpesaError as exc:
        raise HTTPException(502, str(exc))
    pay = Payment(user_id=p.id, plan_id=plan.id, beneficiary_id=beneficiary_id, amount_kes=plan.price_kes,
                  phone=pay_phone, provider=settings.payments_provider, checkout_request_id=checkout_id)
    session.add(pay)
    await session.flush()
    if settings.payments_provider != "daraja":
        await enqueue(session, "payments.sandbox_settle", {"payment_id": pay.id}, delay_seconds=5)
    record(session, actor_id=p.id, action="payment.started", entity="payment", entity_id=pay.id, ip=p.ip,
           plan=plan.code, gift=beneficiary_id != p.id)
    await session.commit()
    return {"payment_id": pay.id, "status": pay.status.value, "phone_masked": mask_phone(pay_phone),
            "message": f"Check your phone ({mask_phone(pay_phone)}) and enter your M-Pesa PIN to pay "
                       f"KES {int(plan.price_kes):,}."}


def payment_out(pay: Payment, plan: Plan | None = None) -> dict:
    return {"id": pay.id, "status": pay.status.value, "amount_kes": float(pay.amount_kes), "receipt": pay.receipt,
            "plan": plan.name if plan else None, "result": pay.result_desc, "created_at": pay.created_at,
            "settled_at": pay.settled_at, "gift": pay.beneficiary_id not in (None, pay.user_id)}


@router.get("/payments/{payment_id}")
async def payment_status(payment_id: str, p: Member, session: DB):
    pay = await session.get(Payment, payment_id)
    if not pay or pay.user_id != p.id:
        raise HTTPException(404, "Payment not found")
    return payment_out(pay, await session.get(Plan, pay.plan_id))


@router.get("/payments")
async def my_payments(p: Member, session: DB, cursor: str | None = None, limit: int = 20):
    stmt = keyset(select(Payment).where(Payment.user_id == p.id), Payment, cursor, limit)
    rows, nxt = finish((await session.execute(stmt)).scalars().all(), limit)
    plans_ = {pl.id: pl for pl in (await session.execute(select(Plan))).scalars()}
    return {"items": [payment_out(r, plans_.get(r.plan_id)) for r in rows], "next_cursor": nxt}


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
                     body=desc or "Your M-Pesa payment did not go through. You can try again anytime.",
                     data={"screen": "membership"})
        return
    plan = await session.get(Plan, pay.plan_id)
    beneficiary = pay.beneficiary_id or pay.user_id
    sub = await activate(session, beneficiary, plan, sponsored_by=pay.user_id if beneficiary != pay.user_id else None)
    until = sub.ends_at.strftime("%d %b %Y")
    if beneficiary != pay.user_id:
        payer = await session.get(User, pay.user_id)
        await notify(session, [beneficiary], kind="subscription", title="You've been gifted DEEN " + plan.name,
                     body=f"{payer.full_name.split()[0]} sponsored your membership until {until}. "
                          "May Allah reward them.", data={"screen": "membership"}, channels_=("push", "sms"))
        await notify(session, [pay.user_id], kind="subscription", title="Sponsorship complete — JazakAllahu khayran",
                     body=f"Your gift of {plan.name} is now active. Receipt {receipt}.", data={"screen": "membership"})
    else:
        await notify(session, [pay.user_id], kind="subscription", title=f"Welcome to DEEN {plan.name}",
                     body=f"Your membership is active until {until}. Receipt {receipt}.",
                     data={"screen": "membership"}, channels_=("push", "sms"))
    record(session, actor_id=pay.user_id, action="payment.succeeded", entity="payment", entity_id=pay.id,
           receipt=receipt, plan=plan.code)


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
