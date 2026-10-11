"use client";

import { ArrowLeft, BadgeCheck, CircleCheck, CircleX, Phone, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DeenLoader } from "@/components/Loader";
import { SiteFooter, SiteHeader } from "@/components/public/Site";
import { Button, Field, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type Fee = { amount_kes: number; period_months: number; active: boolean };
type Status = { first_name: string; paid: boolean; ends_at: string | null; fee: Fee };
type Payment = { status: "pending" | "success" | "failed" | "cancelled"; receipt: string | null; result: string | null; membership: Status };

type Step = "phone" | "code" | "pay" | "waiting" | "done" | "failed";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
const period = (m: number) => (m === 1 ? "1 month" : m === 12 ? "1 year" : `${m} months`);

export default function PayPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [forOther, setForOther] = useState(false);
  const [otherPhone, setOtherPhone] = useState("");
  const [mpesa, setMpesa] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [result, setResult] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const start = () => run(async () => {
    const r = await api<{ dev_code: string | null }>("/pay/start", { method: "POST", body: { phone } });
    setDevCode(r.dev_code);
    setStep("code");
  });

  const verify = () => run(async () => {
    const r = await api<Status & { pay_token: string }>("/pay/verify", { method: "POST", body: { phone, code } });
    setToken(r.pay_token);
    setStatus(r);
    setStep("pay");
  });

  const pay = () => run(async () => {
    const r = await api<{ payment_id: string }>("/pay/checkout", {
      method: "POST",
      body: { pay_token: token, mpesa_phone: mpesa || null, gift_to_phone: forOther ? otherPhone : null },
    });
    setPaymentId(r.payment_id);
    setStep("waiting");
  });

  // Wait for M-Pesa to confirm (the member enters their PIN on their phone).
  useEffect(() => {
    if (step !== "waiting") return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api<Payment>(`/pay/status/${paymentId}?token=${encodeURIComponent(token)}`);
        if (stop) return;
        if (r.status === "pending") return void setTimeout(tick, 3000);
        setResult(r);
        setStatus(r.membership);
        setStep(r.status === "success" ? "done" : "failed");
      } catch {
        if (!stop) setTimeout(tick, 5000);
      }
    };
    const t = setTimeout(tick, 3000);
    return () => { stop = true; clearTimeout(t); };
  }, [step, paymentId, token]);

  const fee = status?.fee;

  return (
    <div className="flex min-h-screen flex-col bg-sand-100">
      <SiteHeader />
      <main className="flex-1 px-5 py-12 sm:py-16">
        <div className="mx-auto max-w-md">
          <Link href="/membership" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700"><ArrowLeft size={16} /> Membership</Link>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Pay the community fee</h1>
          <p className="mt-2 text-ink-500">Pay with M-Pesa. It takes about a minute.</p>

          <div className="mt-8 rounded-3xl bg-white p-6 shadow-card sm:p-8">
            {step === "phone" && (
              <form onSubmit={(e) => { e.preventDefault(); start(); }} className="space-y-5">
                <Field label="Your DEEN phone number" hint="The number you use to sign in to the app.">
                  <Input autoFocus inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Button type="submit" className="w-full" size="lg" loading={busy} disabled={phone.replace(/\D/g, "").length < 9} icon={<Phone size={18} />}>Send me a code</Button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-5">
                <p className="text-ink-700">If <b>{phone}</b> has a DEEN account, we&apos;ve sent it a 6-digit code by SMS.</p>
                {devCode && <p className="rounded-xl bg-gold-50 px-4 py-3 text-sm text-gold-700">Test mode code: <b className="tracking-widest">{devCode}</b></p>}
                <Field label="Code">
                  <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="text-center text-2xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                </Field>
                <Button type="submit" className="w-full" size="lg" loading={busy} disabled={code.length < 6}>Continue</Button>
                <button type="button" onClick={() => { setStep("phone"); setCode(""); }} className="w-full text-sm font-medium text-ink-500 hover:text-brand-700">Use a different number</button>
              </form>
            )}

            {step === "pay" && status && fee && (
              <div className="space-y-5">
                <div>
                  <div className="text-lg font-bold">Assalamu alaikum, {status.first_name}</div>
                  <p className="text-ink-500">{status.paid && status.ends_at ? `Your membership is paid until ${date(status.ends_at)}. Paying now adds ${period(fee.period_months)}.` : "Your membership is not paid yet."}</p>
                </div>
                {!fee.active ? (
                  <p className="rounded-xl bg-sand-100 px-4 py-3 text-ink-700">There is no fee to pay right now.</p>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between rounded-2xl bg-brand-900 px-5 py-4 text-white">
                      <span className="text-brand-100/70">Community fee · {period(fee.period_months)}</span>
                      <span className="text-2xl font-extrabold">KES {fee.amount_kes.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-sand-100 p-1">
                      {[[false, "For me"], [true, "For someone else"]].map(([v, label]) => (
                        <button key={String(v)} type="button" onClick={() => setForOther(v as boolean)}
                          className={`rounded-xl py-2.5 text-sm font-semibold ${forOther === v ? "bg-white text-brand-800 shadow-sm" : "text-ink-500"}`}>{label as string}</button>
                      ))}
                    </div>
                    {forOther && (
                      <Field label="Their DEEN phone number" hint="They must already have a DEEN account.">
                        <Input inputMode="tel" placeholder="07XX XXX XXX" value={otherPhone} onChange={(e) => setOtherPhone(e.target.value)} />
                      </Field>
                    )}
                    <Field label="M-Pesa number to pay from" hint="Leave empty to use your DEEN number.">
                      <Input inputMode="tel" placeholder={phone} value={mpesa} onChange={(e) => setMpesa(e.target.value)} />
                    </Field>
                    <Button className="w-full" size="lg" loading={busy} disabled={forOther && otherPhone.replace(/\D/g, "").length < 9} onClick={pay} icon={<Smartphone size={18} />}>
                      Pay KES {fee.amount_kes.toLocaleString()}
                    </Button>
                  </>
                )}
              </div>
            )}

            {step === "waiting" && (
              <div className="flex flex-col items-center py-6 text-center">
                <DeenLoader size={64} />
                <div className="mt-6 text-lg font-bold">Check your phone</div>
                <p className="mt-1 text-ink-500">Enter your M-Pesa PIN to confirm. This page updates by itself.</p>
              </div>
            )}

            {step === "done" && (
              <div className="flex flex-col items-center py-4 text-center">
                <CircleCheck size={56} className="text-leaf-600" />
                <div className="mt-4 text-xl font-bold">Payment received</div>
                <p className="mt-1 text-ink-500">JazakAllahu khayran. {forOther ? "Their" : "Your"} membership is active{!forOther && status?.ends_at ? ` until ${date(status.ends_at)}` : ""}.</p>
                {result?.receipt && <p className="mt-3 rounded-xl bg-sand-100 px-4 py-2 text-sm">M-Pesa receipt <b>{result.receipt}</b></p>}
                <p className="mt-6 text-sm text-ink-400">Open the DEEN app. It updates within a minute.</p>
              </div>
            )}

            {step === "failed" && (
              <div className="flex flex-col items-center py-4 text-center">
                <CircleX size={56} className="text-rose-600" />
                <div className="mt-4 text-xl font-bold">Payment not completed</div>
                <p className="mt-1 text-ink-500">{result?.result ?? "M-Pesa did not confirm the payment."} No money was taken.</p>
                <Button className="mt-6" onClick={() => setStep("pay")}>Try again</Button>
              </div>
            )}

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          </div>

          <div className="mt-6 space-y-2 text-sm text-ink-500">
            <p className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-leaf-600" />You pay DEEN directly by M-Pesa. We never ask for your PIN.</p>
            <p className="flex gap-2"><BadgeCheck size={18} className="shrink-0 text-leaf-600" />No account yet? Get the free app first, then come back.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
