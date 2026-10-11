import { Lock, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, type PublicOpp } from "@/components/public/content";
import { OppCard } from "@/components/public/OppCard";
import { GetStarted, load, PageHero, PublicPage } from "@/components/public/Site";

export const metadata: Metadata = { title: "Opportunities", description: "Scholarships, jobs, attachments, internships, grants and support, checked by DEEN." };

const PER_PAGE = 12;

export default async function Opportunities({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const sp = await searchParams;
  const category = CATEGORIES.find((c) => c.key === sp.category);
  const page = Math.max(Number(sp.page) || 1, 1);
  const data = await load<{ items: PublicOpp[]; has_more: boolean }>(
    `/public/opportunities?limit=${PER_PAGE}&page=${page}${category ? `&category=${category.key}` : ""}`, 120);
  const href = (p: { category?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (p.category) q.set("category", p.category);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    return `/opportunities${q.size ? `?${q}` : ""}`;
  };

  return (
    <PublicPage>
      <PageHero eyebrow="Opportunities" title={category ? category.title : "Open opportunities"}
        intro={category ? `${category.line} ${category.items.join(", ")}.` : "Every listing here has been checked by DEEN. Apply in the app."} />

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
            <Tab href={href({})} active={!category}>All</Tab>
            {CATEGORIES.map((c) => <Tab key={c.key} href={href({ category: c.key })} active={category?.key === c.key}>{c.title}</Tab>)}
          </div>

          {!data ? (
            <Notice icon={<SearchX size={28} />} title="We couldn't load opportunities" body="Please try again in a moment." />
          ) : data.items.length === 0 ? (
            <Notice icon={<SearchX size={28} />} title="Nothing open here right now" body="New opportunities are checked and added every week. Get the app to be alerted first." />
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((o) => <OppCard key={o.id} o={o} />)}</div>
          )}

          {data && (page > 1 || data.has_more) && (
            <div className="mt-8 flex items-center justify-between">
              {page > 1 ? <Link href={href({ category: category?.key, page: page - 1 })} className="rounded-xl px-4 py-2.5 font-semibold ring-1 ring-sand-300 hover:bg-sand-100">Previous</Link> : <span />}
              <span className="text-sm text-ink-500">Page {page}</span>
              {data.has_more ? <Link href={href({ category: category?.key, page: page + 1 })} className="rounded-xl px-4 py-2.5 font-semibold ring-1 ring-sand-300 hover:bg-sand-100">Next</Link> : <span />}
            </div>
          )}

          <div className="mt-10 flex items-start gap-3 rounded-2xl bg-sand-100 p-5 text-ink-700">
            <Lock size={20} className="mt-0.5 shrink-0 text-brand-700" />
            <p>Some opportunities are only for paid-up members and appear in the app. Get the app to see everything that matches you, save opportunities and get deadline reminders.</p>
          </div>
        </div>
      </section>
      <GetStarted />
    </PublicPage>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-brand-800 text-white" : "bg-sand-100 text-ink-700 hover:bg-sand-200"}`}>
      {children}
    </Link>
  );
}

function Notice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-sand-300 px-6 py-16 text-center">
      <div className="text-ink-300">{icon}</div>
      <div className="mt-3 text-lg font-bold">{title}</div>
      <p className="mt-1 max-w-md text-ink-500">{body}</p>
    </div>
  );
}
