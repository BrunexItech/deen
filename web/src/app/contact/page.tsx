import { Building2, Flag, Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHero, PublicPage } from "@/components/public/Site";

export const metadata: Metadata = { title: "Contact us", description: "Get in touch with DEEN." };

const CONTACTS = [
  { icon: Mail, title: "General questions", body: "Help with the app, your account or membership.", email: "hello@deen.africa" },
  { icon: Building2, title: "Organizations", body: "Post opportunities or partner with DEEN.", email: "partners@deen.africa" },
  { icon: Flag, title: "Report a scam", body: "Tell us about a fake opportunity or organization.", email: "safety@deen.africa" },
  { icon: ShieldCheck, title: "Privacy and data", body: "Questions about your data and your rights.", email: "privacy@deen.africa" },
];

export default function Contact() {
  return (
    <PublicPage>
      <PageHero eyebrow="Contact" title="We're here to help" intro="Write to the right team and we'll reply as soon as we can." />
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-14 sm:grid-cols-2">
          {CONTACTS.map(({ icon: Icon, title, body, email }) => (
            <a key={email} href={`mailto:${email}`} className="group rounded-2xl border border-sand-200 p-6 transition hover:border-brand-400 hover:shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={22} /></div>
              <div className="mt-4 text-lg font-bold">{title}</div>
              <p className="mt-1 text-ink-500">{body}</p>
              <div className="mt-4 font-semibold text-brand-700 group-hover:text-brand-900">{email}</div>
            </a>
          ))}
        </div>
        <p className="mx-auto max-w-6xl px-5 pb-14 text-ink-500">In the app, you can also report any opportunity directly with the Report button.</p>
      </section>
    </PublicPage>
  );
}
