import { BadgeCheck, Bell, Bookmark, ClipboardList, ExternalLink, FileText, MapPin, Search, Target } from "lucide-react";
import type { Metadata } from "next";
import { CHECKS, STEPS } from "@/components/public/content";
import { GetStarted, More, PageHero, PublicPage, Section } from "@/components/public/Site";

export const metadata: Metadata = { title: "How it works", description: "How DEEN finds, checks and matches opportunities for you." };

const FEATURES = [
  { icon: Target, title: "Matched to you", body: "Each opportunity shows how well it fits you, and why." },
  { icon: Search, title: "Search and filters", body: "Filter by county, field, pay, work mode, deadline and more." },
  { icon: Bookmark, title: "Save for later", body: "Keep the ones you like in one list." },
  { icon: Bell, title: "Deadline reminders", body: "We remind you 7, 3 and 1 day before a saved opportunity closes." },
  { icon: ClipboardList, title: "Application tracker", body: "See every application: started, sent, shortlisted, successful." },
  { icon: FileText, title: "Experience and CV", body: "Record what you have done and turn it into a CV." },
];

export default function HowItWorks() {
  return (
    <PublicPage>
      <PageHero eyebrow="How it works" title="From finding an opportunity to getting it" intro="DEEN does the searching and checking, so you can focus on applying." />

      <Section eyebrow="For members" title="Four simple steps">
        <ol className="space-y-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex items-start gap-5 rounded-2xl border border-sand-200 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-800 text-lg font-bold text-gold-400">{i + 1}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-lg font-bold"><Icon size={20} className="text-brand-700" />{title}</div>
                <p className="mt-1 text-ink-500">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="sand" eyebrow="Checking" title="How DEEN checks every opportunity" intro="Organizations cannot post on their own. A DEEN officer checks each one first. Only then does it get the Verified by DEEN badge.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-card">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700"><Icon size={20} /></div>
              <span className="font-medium">{text}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-leaf-50 px-4 py-2 font-semibold text-leaf-700"><BadgeCheck size={18} /> Verified by DEEN</div>
      </Section>

      <Section eyebrow="Applying" title="Two ways to apply">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-sand-200 p-8">
            <ExternalLink size={26} className="text-brand-700" />
            <div className="mt-4 text-xl font-bold">On the organization&apos;s website</div>
            <p className="mt-2 text-ink-500">Tap Apply and DEEN opens the organization&apos;s own checked link. Then add it to your tracker.</p>
          </div>
          <div className="rounded-3xl border border-sand-200 p-8">
            <FileText size={26} className="text-brand-700" />
            <div className="mt-4 text-xl font-bold">Through DEEN</div>
            <p className="mt-2 text-ink-500">Some organizations accept applications in the app. Send your answers and documents safely, then follow the progress.</p>
          </div>
        </div>
      </Section>

      <Section tone="sand" eyebrow="In the app" title="Tools that help you succeed">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={22} /></div>
              <div className="mt-4 text-lg font-bold">{title}</div>
              <p className="mt-1 text-ink-500">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 flex items-center gap-2 text-ink-500"><MapPin size={18} /> Also in the app: prayer times, Qibla direction and a zakat calculator.</p>
        <More href="/opportunities">Browse opportunities</More>
      </Section>
      <GetStarted />
    </PublicPage>
  );
}
