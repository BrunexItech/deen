import { Check, Gift, HandCoins, Phone, ShieldCheck, Smartphone, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { periodLabel, type Fee } from "@/components/public/content";
import { GetStarted, load, More, PageHero, PublicPage, Section } from "@/components/public/Site";

export const metadata: Metadata = { title: "Membership", description: "One small community fee for everyone. Paid on the DEEN website with M-Pesa." };

const PAY_STEPS = [
  { icon: Phone, title: "Enter your phone number", body: "The number you use in the DEEN app." },
  { icon: ShieldCheck, title: "Enter the code we send", body: "This proves the number is yours." },
  { icon: Smartphone, title: "Confirm on your phone", body: "Enter your M-Pesa PIN on the prompt. Done." },
];

export default async function Membership() {
  const fee = await load<Fee>("/fee", 60);
  return (
    <PublicPage>
      <PageHero eyebrow="Membership" title="One small fee keeps DEEN running" intro="No packages. Everyone pays the same, and everyone gets the same." />

      <Section eyebrow="The community fee" title={fee?.active ? "What it costs" : "There is no fee right now"}>
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl bg-brand-900 p-8 text-white">
            {fee?.active ? (
              <>
                <div className="text-sm text-brand-100/70">Community membership fee</div>
                <div className="mt-2 text-5xl font-extrabold">KES {fee.amount_kes.toLocaleString()}</div>
                <div className="mt-1 text-brand-100/70">{periodLabel(fee.period_months)}</div>
                <Link href="/pay" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gold-500 px-6 py-3.5 font-bold text-brand-950 hover:bg-gold-400">
                  <Phone size={18} /> Pay with M-Pesa
                </Link>
              </>
            ) : (
              <>
                <div className="text-5xl font-extrabold">Free</div>
                <p className="mt-3 text-brand-100/70">Everyone can use DEEN fully at no cost for now.</p>
              </>
            )}
          </div>
          <div className="rounded-3xl border border-sand-200 p-8">
            <div className="font-bold">Your fee pays for</div>
            <ul className="mt-4 space-y-3">
              {(fee?.covers ?? []).map((c) => <li key={c} className="flex gap-3 text-lg"><Check size={22} className="shrink-0 text-leaf-600" />{c}</li>)}
            </ul>
            {fee?.note && <p className="mt-6 rounded-xl bg-sand-100 px-4 py-3 text-ink-700">{fee.note}</p>}
          </div>
        </div>
      </Section>

      <Section tone="sand" eyebrow="Free and paid" title="What you get">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-card">
            <div className="text-xl font-bold">Everyone, free</div>
            <ul className="mt-4 space-y-3 text-ink-700">
              {["Join and build your profile", "Browse every checked opportunity", "Save opportunities and get reminders", "Apply on organizations' own websites",
                fee?.active && fee.free_monthly_applications != null ? `Apply through DEEN ${fee.free_monthly_applications} times a month` : "Apply through DEEN"]
                .map((t) => <li key={t} className="flex gap-3"><Check size={20} className="shrink-0 text-leaf-600" />{t}</li>)}
            </ul>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-card ring-2 ring-gold-400">
            <div className="text-xl font-bold">Paid-up members</div>
            <ul className="mt-4 space-y-3 text-ink-700">
              {["Everything that is free", "Apply through DEEN without a limit", "Opportunities for members only", "Support DEEN's work for the community"]
                .map((t) => <li key={t} className="flex gap-3"><Check size={20} className="shrink-0 text-leaf-600" />{t}</li>)}
            </ul>
          </div>
        </div>
      </Section>

      <Section eyebrow="Paying" title="Pay in about a minute" intro="The fee is paid here on the website, never inside the app.">
        <ol className="grid gap-4 md:grid-cols-3">
          {PAY_STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-2xl border border-sand-200 p-6">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-800 font-bold text-gold-400">{i + 1}</span><Icon size={20} className="text-brand-700" /></div>
              <div className="mt-4 text-lg font-bold">{title}</div>
              <p className="mt-1 text-ink-500">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="flex gap-4 rounded-2xl bg-sand-100 p-6"><Gift size={24} className="shrink-0 text-gold-600" /><div><div className="font-bold">Pay for someone else</div><p className="mt-1 text-ink-500">Cover a student, a relative or a neighbour. Choose &ldquo;For someone else&rdquo; when paying.</p></div></div>
          <div className="flex gap-4 rounded-2xl bg-sand-100 p-6"><HandCoins size={24} className="shrink-0 text-gold-600" /><div><div className="font-bold">Can&apos;t afford it?</div><p className="mt-1 text-ink-500">Contact DEEN. We can cover the fee for people in need.</p></div></div>
        </div>
        {fee?.active && <More href="/pay">Pay the fee now</More>}
      </Section>

      <section className="bg-brand-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-10">
          <Users size={28} className="shrink-0 text-gold-400" />
          <p className="text-lg text-brand-50/90">Paying on the website means every shilling goes to DEEN and the community.</p>
        </div>
      </section>
      <GetStarted />
    </PublicPage>
  );
}
