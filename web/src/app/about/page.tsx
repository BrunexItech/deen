import { Eye, HeartHandshake, Scale, ShieldCheck, Target } from "lucide-react";
import type { Metadata } from "next";
import { LETTERS, PEOPLE, type Stats } from "@/components/public/content";
import { GetStarted, load, More, PageHero, PublicPage, Section } from "@/components/public/Site";

export const metadata: Metadata = { title: "About DEEN", description: "DEEN, the Development and Education Empowerment Network, connects the Muslim community in Kenya with verified opportunities." };

const VALUES = [
  { icon: ShieldCheck, title: "Trust", body: "We check before we share. Nothing reaches you unchecked." },
  { icon: Scale, title: "Fairness", body: "One fee for everyone. Everyone gets the same access." },
  { icon: Eye, title: "Honesty", body: "We tell you why something fits you, and when it doesn't." },
  { icon: HeartHandshake, title: "Service", body: "We measure success by how many people actually benefit." },
];

export default async function About() {
  const stats = await load<Stats>("/public/stats");
  return (
    <PublicPage>
      <PageHero eyebrow="About DEEN" title="Development and Education Empowerment Network" intro="One trusted place where our community finds real opportunities, checked and ready to apply for." />

      <Section eyebrow="Our name" title="What D.E.E.N stands for">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LETTERS.map(([letter, word, line]) => (
            <div key={word} className="rounded-2xl border border-sand-200 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-800 text-2xl font-extrabold text-gold-400">{letter}</div>
              <div className="mt-4 text-lg font-bold">{word}</div>
              <p className="mt-1 text-ink-500">{line}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="sand" eyebrow="Why we exist" title="Good opportunities are hard to find. Fake ones are everywhere.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-card">
            <div className="font-bold text-rose-700">The problem</div>
            <ul className="mt-4 space-y-3 text-lg text-ink-700">
              <li>Opportunities are scattered across WhatsApp groups and social media.</li>
              <li>Many are fake, or ask people to pay to apply.</li>
              <li>Good ones are missed because nobody heard about them in time.</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-brand-900 p-8 text-white">
            <div className="font-bold text-gold-400">What DEEN does</div>
            <ul className="mt-4 space-y-3 text-lg text-brand-50/90">
              <li>Brings opportunities together in one app.</li>
              <li>Checks every organization and every opportunity first.</li>
              <li>Shows each person what fits them, and reminds them before deadlines.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section eyebrow="Our mission" title="Trusted opportunities. Real access. Greater impact.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-sand-200 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={22} /></div>
              <div className="mt-4 text-lg font-bold">{title}</div>
              <p className="mt-1 text-ink-500">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="sand" eyebrow="Who it's for" title="Made for everyone in our community">
        <div className="flex flex-wrap gap-3">
          {PEOPLE.map((p) => <span key={p} className="rounded-full bg-white px-5 py-2.5 font-medium shadow-card">{p}</span>)}
        </div>
        {stats && (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[[stats.live_opportunities, "Open opportunities"], [stats.verified_organizations, "Checked organizations"], [stats.members, "Community members"]].map(([n, l]) => (
              <div key={l as string} className="rounded-2xl bg-white p-6 shadow-card">
                <div className="text-3xl font-extrabold text-brand-800">{Number(n).toLocaleString()}</div>
                <div className="text-ink-500">{l}</div>
              </div>
            ))}
          </div>
        )}
        <More href="/how-it-works">See how DEEN works</More>
      </Section>

      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <Target size={28} className="mx-auto text-gold-600" />
          <p className="mt-4 font-arabic text-3xl leading-relaxed text-brand-800" dir="rtl" lang="ar">وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ</p>
          <p className="mt-2 text-lg text-ink-700">&ldquo;And cooperate in righteousness and piety.&rdquo;</p>
          <p className="text-sm text-ink-400">Qur&apos;an 5:2</p>
        </div>
      </section>
      <GetStarted />
    </PublicPage>
  );
}
