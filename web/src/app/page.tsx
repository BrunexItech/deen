import { ArrowRight, BadgeCheck, Check, Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CATEGORIES, periodLabel, STEPS, type Fee, type PublicOpp, type Stats } from "@/components/public/content";
import { OppCard } from "@/components/public/OppCard";
import { GetStarted, load, More, PublicPage, Section } from "@/components/public/Site";

export default async function Home() {
  const [stats, fee, opps] = await Promise.all([
    load<Stats>("/public/stats"), load<Fee>("/fee"), load<{ items: PublicOpp[] }>("/public/opportunities?limit=6"),
  ]);
  return (
    <PublicPage>
      <section className="pattern-khatam relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 text-white">
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.2fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-gold-400 ring-1 ring-gold-400/30">
              <BadgeCheck size={14} /> Introducing D.E.E.N · Development and Education Empowerment Network
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Real opportunities for our community.</h1>
            <p className="mt-6 max-w-xl text-lg text-brand-50/80">
              DEEN is a digital opportunity platform that connects you with verified opportunities in education, employment,
              entrepreneurship, skills development, community development and professional growth.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="/downloads/deen.apk" className="inline-flex items-center gap-2.5 rounded-2xl bg-gold-500 px-6 py-4 font-bold text-brand-950 shadow-lg shadow-black/20 hover:bg-gold-400">
                <Download size={20} /> Get the Android app
              </a>
              <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 font-semibold ring-1 ring-white/25 hover:bg-white/10">
                How it works <ArrowRight size={18} />
              </Link>
            </div>
            <p className="mt-4 text-sm text-brand-100/60">Free to join · Kenya</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {([[stats?.live_opportunities, "Open opportunities", "/opportunities"], [stats?.verified_organizations, "Checked organizations", "/organizations"], [stats?.members, "Community members", "/about"]] as const).map(([n, label, href]) => (
              <Link key={label} href={href} className="rounded-2xl bg-white/[0.07] p-5 ring-1 ring-white/10 hover:bg-white/[0.12]">
                <div className="text-3xl font-extrabold text-gold-400">{n != null ? Number(n).toLocaleString() : "—"}</div>
                <div className="text-sm text-brand-100/70">{label}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Section eyebrow="Opportunities" title="Everything in one trusted place" intro="No more hunting through WhatsApp groups. Choose what you need.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(({ key, icon: Icon, title, line }) => (
            <Link key={key} href={`/opportunities?category=${key}`} className="group flex items-center gap-4 rounded-2xl border border-sand-200 p-5 transition hover:border-brand-400 hover:shadow-card">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={22} /></div>
              <div className="flex-1">
                <div className="font-bold group-hover:text-brand-700">{title}</div>
                <div className="text-sm text-ink-500">{line}</div>
              </div>
              <ArrowRight size={18} className="text-ink-300 group-hover:text-brand-700" />
            </Link>
          ))}
        </div>
        {!!opps?.items?.length && (
          <>
            <h3 className="mt-14 text-xl font-bold">Open now</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{opps.items.map((o) => <OppCard key={o.id} o={o} />)}</div>
          </>
        )}
        <More href="/opportunities">See all opportunities</More>
      </Section>

      <Section tone="sand" eyebrow="How it works" title="Four simple steps">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-2xl bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={22} /></div>
                <span className="text-sm font-bold text-ink-300">0{i + 1}</span>
              </div>
              <div className="mt-4 text-lg font-bold">{title}</div>
              <p className="mt-1 text-ink-500">{body}</p>
            </li>
          ))}
        </ol>
        <More href="/how-it-works">How DEEN works and checks opportunities</More>
      </Section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-16 sm:py-20 lg:grid-cols-2">
          <Link href="/safety" className="group rounded-3xl bg-brand-900 p-8 text-white">
            <ShieldCheck size={28} className="text-gold-400" />
            <div className="mt-4 text-2xl font-extrabold">Safe from scams</div>
            <p className="mt-2 text-brand-100/70">DEEN checks every organization and every opportunity before you see it. Nobody should ever ask you to pay to apply.</p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-gold-400">How we keep you safe <ArrowRight size={18} /></span>
          </Link>
          <Link href="/membership" className="group rounded-3xl border border-sand-200 p-8 hover:border-brand-400 hover:shadow-card">
            <div className="text-sm font-semibold text-gold-600">Membership</div>
            <div className="mt-2 text-2xl font-extrabold">{fee?.active ? <>KES {fee.amount_kes.toLocaleString()} <span className="text-base font-medium text-ink-500">{periodLabel(fee.period_months)}</span></> : "Free to join"}</div>
            <p className="mt-2 text-ink-500">One small community fee for everyone. No packages.</p>
            <ul className="mt-4 space-y-2">{(fee?.covers ?? []).slice(0, 3).map((c) => <li key={c} className="flex gap-2 text-ink-700"><Check size={18} className="shrink-0 text-leaf-600" />{c}</li>)}</ul>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-700">About membership <ArrowRight size={18} /></span>
          </Link>
        </div>
      </section>

      <GetStarted />
    </PublicPage>
  );
}
