import { AlertTriangle, BadgeCheck, Ban, Fingerprint, Flag, KeyRound, Lock, ShieldCheck, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { SAFETY_RULES } from "@/components/public/content";
import { GetStarted, More, PageHero, PublicPage, Section } from "@/components/public/Site";

export const metadata: Metadata = { title: "Stay safe", description: "How DEEN protects you from scams, and how to spot a fake opportunity." };

const SIGNS = [
  "They ask you to pay a fee to apply, or to \"secure your place\".",
  "They promise you are already selected before you applied.",
  "They want your M-Pesa PIN, password or a code we sent you.",
  "The email or link does not match the organization's real website.",
  "They rush you: \"apply in the next hour\".",
  "The offer sounds too good to be true.",
];

const PROTECT = [
  { icon: BadgeCheck, title: "Checked organizations", body: "DEEN adds every organization itself after checking it." },
  { icon: ShieldCheck, title: "Checked opportunities", body: "Every listing is reviewed before it goes live." },
  { icon: Flag, title: "Quick action on reports", body: "Reported listings are reviewed, and taken down when needed." },
  { icon: Fingerprint, title: "Fingerprint lock", body: "Your app locks with your fingerprint or face." },
  { icon: KeyRound, title: "New phone check", body: "Logging in on a new phone needs a code sent to your number." },
  { icon: Lock, title: "Encrypted data", body: "Your documents and personal details are encrypted." },
];

export default function Safety() {
  return (
    <PublicPage>
      <PageHero eyebrow="Stay safe" title="Your safety comes first" intro="DEEN checks everything before you see it. These simple rules keep you safe everywhere." />

      <Section eyebrow="The rules" title="Four rules that protect you">
        <div className="grid gap-4 sm:grid-cols-2">
          {SAFETY_RULES.map((s, i) => (
            <div key={s} className="flex items-start gap-4 rounded-2xl border border-sand-200 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-800 font-bold text-gold-400">{i + 1}</div>
              <p className="text-lg font-medium">{s}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="sand" eyebrow="Warning signs" title="How to spot a scam">
        <ul className="grid gap-3 sm:grid-cols-2">
          {SIGNS.map((s) => (
            <li key={s} className="flex items-start gap-3 rounded-2xl bg-white p-5 shadow-card">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-gold-600" /><span className="text-ink-700">{s}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-rose-50 p-5 text-rose-800">
          <Ban size={20} className="mt-0.5 shrink-0" />
          <p><b>Real opportunities never ask you to pay to apply.</b> If anyone does, stop and report it.</p>
        </div>
      </Section>

      <Section eyebrow="How DEEN protects you" title="Safety built into DEEN">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROTECT.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-sand-200 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700"><Icon size={22} /></div>
              <div className="mt-4 text-lg font-bold">{title}</div>
              <p className="mt-1 text-ink-500">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="sand" eyebrow="Report and privacy" title="If something is wrong">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-card">
            <Flag size={26} className="text-brand-700" />
            <div className="mt-4 text-xl font-bold">Report it</div>
            <p className="mt-2 text-ink-500">In the app, open the opportunity and tap Report. Or contact us. We act quickly.</p>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-card">
            <Trash2 size={26} className="text-brand-700" />
            <div className="mt-4 text-xl font-bold">Your data, your choice</div>
            <p className="mt-2 text-ink-500">Download or delete your data at any time. We follow Kenya&apos;s Data Protection Act and never sell your data.</p>
          </div>
        </div>
        <More href="/privacy">Read our privacy policy</More>
      </Section>
      <GetStarted />
    </PublicPage>
  );
}
