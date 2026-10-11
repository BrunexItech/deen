import { BarChart3, BadgeCheck, Inbox, Mail, MessageSquareText, Send, ShieldCheck, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, PublicPage, Section } from "@/components/public/Site";

export const metadata: Metadata = {
  title: "For organizations",
  description: "Post scholarships, jobs, attachments, grants and programmes to a trusted Muslim community in Kenya.",
};

const WHO = ["Universities and colleges", "Employers", "Foundations and NGOs", "Islamic banks and businesses", "Government programmes", "Mosques and community groups"];

const BENEFITS = [
  { icon: Target, title: "Reach the right people", body: "DEEN shows your opportunity to members whose profile fits it." },
  { icon: BadgeCheck, title: "Earn trust", body: "Your listings carry the Verified by DEEN badge." },
  { icon: Inbox, title: "Receive applications", body: "Collect applications and documents in one place, or send people to your own link." },
  { icon: MessageSquareText, title: "Answer questions", body: "Reply to applicants' questions from your portal." },
  { icon: BarChart3, title: "See your results", body: "Views, saves, applications and outcomes for every listing." },
  { icon: ShieldCheck, title: "Safe and private", body: "Applicants' documents are encrypted. Only you and DEEN can see them." },
];

const STEPS = [
  ["Contact DEEN", "Email us about your organization and what you offer."],
  ["We check you", "DEEN confirms your organization is real and registered."],
  ["Get your portal", "We create your account and invite your team."],
  ["Post opportunities", "Submit a listing. DEEN checks it, then publishes it."],
];

export default function Organizations() {
  return (
    <PublicPage>
      <PageHero eyebrow="For organizations" title="Share your opportunities with a community that trusts them." intro="Scholarships, jobs, attachments, grants and programmes, seen by the people who need them.">
        <a href="mailto:partners@deen.africa?subject=Partnering%20with%20DEEN" className="inline-flex items-center gap-2 rounded-2xl bg-gold-500 px-6 py-4 font-bold text-brand-950 hover:bg-gold-400"><Mail size={18} /> Contact DEEN</a>
        <Link href="/login" className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 font-semibold ring-1 ring-white/25 hover:bg-white/10">Partner sign in</Link>
      </PageHero>

      <Section eyebrow="Who can join" title="Organizations we work with" intro="DEEN adds organizations after checking them. Organizations cannot sign themselves up. This keeps the community safe.">
        <div className="flex flex-wrap gap-3">
          {WHO.map((w) => <span key={w} className="rounded-full border border-sand-300 px-5 py-2.5 font-medium">{w}</span>)}
        </div>
      </Section>

      <Section tone="sand" eyebrow="What you get" title="Everything you need in one portal">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={22} /></div>
              <div className="mt-4 text-lg font-bold">{title}</div>
              <p className="mt-1 text-ink-500">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="How to start" title="Four steps to your first listing">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-2xl border border-sand-200 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-800 font-bold text-gold-400">{i + 1}</div>
              <div className="mt-4 text-lg font-bold">{title}</div>
              <p className="mt-1 text-ink-500">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 rounded-3xl bg-brand-900 p-8 text-white sm:flex sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-bold">Our promise to applicants</div>
            <p className="mt-1 text-brand-100/70">Listings must be free to apply for. Any listing that asks applicants to pay is removed.</p>
          </div>
          <a href="mailto:partners@deen.africa?subject=Partnering%20with%20DEEN" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-brand-900 hover:bg-sand-100 sm:mt-0"><Send size={18} /> partners@deen.africa</a>
        </div>
      </Section>
    </PublicPage>
  );
}
