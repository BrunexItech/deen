"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Banknote, Building2, ClipboardCheck, Flag, HeartHandshake, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bars, TrendChart } from "@/components/charts";
import { PageLoader } from "@/components/Loader";
import { Badge, Card, CardHeader, PageHeader, Stat, Tabs } from "@/components/ui";
import { get } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { compact, kes, num, VERIFICATION } from "@/lib/format";
import { useCategoryLabel, useTaxonomy } from "@/lib/hooks";
import type { Verification } from "@/lib/types";

interface Overview {
  kpis: Record<string, number>;
  attention: Record<string, number>;
  series: { date: string; signups: number; applications: number; views: number; revenue: number }[];
  categories: { category: string; opportunities: number; views: number; applications: number }[];
  counties: { county: string; members: number; demand: number; supply: number }[];
  top_organizations: { id: string; name: string; verification: Verification; opportunities: number; applications: number }[];
  top_opportunities: { id: string; title: string; category: string; views: number; applications: number }[];
  plan_mix: { plan: string; count: number }[];
  most_saved: { id: string; title: string; saves: number }[];
  most_applied: { id: string; title: string; applications: number }[];
  interests: { category: string; members: number }[];
  user_types: { type: string; members: number }[];
}

function Ranked({ title, rows }: { title: string; rows: { id?: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader title={title} />
      <div className="space-y-2.5">
        {rows.length === 0 && <p className="text-sm text-ink-400">No data yet.</p>}
        {rows.map((r) => {
          const body = (
            <>
              <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-semibold">{r.label}</span><span className="tabular-nums text-ink-500">{num(r.value)}</span></div>
              <div className="h-1.5 rounded-full bg-sand-200"><div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-gold-500" style={{ width: `${(100 * r.value) / max}%` }} /></div>
            </>
          );
          return r.id ? <Link key={r.label} href={`/admin/opportunities/${r.id}`} className="block hover:opacity-80">{body}</Link> : <div key={r.label}>{body}</div>;
        })}
      </div>
    </Card>
  );
}

const CAT_COLORS = ["#004485", "#e39d29", "#43b02a", "#2a72c2", "#7c3aed", "#be123c"];

function greeting() {
  const h = Number(new Date().toLocaleString("en-KE", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const { data: me } = useMe();
  const cat = useCategoryLabel();
  const { data: tax } = useTaxonomy();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "overview", Number(days)], queryFn: () => get<Overview>(`/admin/overview?days=${days}`) });

  if (isLoading || !data) return <PageLoader label="Gathering the numbers" />;
  const k = data.kpis;
  const a = data.attention;
  const attention = [
    { label: "opportunities awaiting review", n: a.review_queue, href: "/admin/review", icon: <ClipboardCheck size={16} /> },
    { label: "organizations pending verification", n: a.pending_orgs, href: "/admin/organizations?verification=pending", icon: <Building2 size={16} /> },
    { label: "open reports", n: a.open_reports, href: "/admin/reports", icon: <Flag size={16} /> },
    { label: "identity checks", n: a.identity_pending, href: "/admin/identity", icon: <BadgeCheck size={16} /> },
    { label: "directory listings", n: a.directory_pending, href: "/admin/directory", icon: <Sparkles size={16} /> },
  ].filter((x) => x.n > 0);

  return (
    <>
      <PageHeader
        eyebrow="Control Center"
        title={`${greeting()}, ${me?.full_name.split(" ")[0] ?? ""}`}
        subtitle="Everything flowing between Muslims, opportunities and organizations, in one place."
        actions={<Tabs value={days} onChange={setDays} tabs={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />}
      />

      {attention.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 animate-fade-up">
          {attention.map((x) => (
            <Link key={x.href} href={x.href} className="group inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-50 px-3.5 py-2 text-[13px] font-semibold text-gold-700 transition hover:bg-gold-100">
              {x.icon}
              <span className="text-ink-900">{x.n}</span> {x.label}
              <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Registered members" value={compact(k.members)} hint={`+${num(k.new_members)} in ${days} days · ${num(k.active_7d)} active this week`} icon={<Users size={20} />} />
        <Stat label="Live opportunities" value={num(k.live_opportunities)} hint={`${num(k.expired_opportunities)} expired · ${num(k.verified_orgs)}/${num(k.organizations)} providers verified`} icon={<Sparkles size={20} />} tone="gold" />
        <Stat label="Successful connections" value={num(k.successful_connections)} hint={`${num(k.accepted)} accepted · ${num(k.outcomes)} success stories`} icon={<HeartHandshake size={20} />} />
        <Stat label="Revenue" value={kes(k.revenue_period)} hint={`${num(k.paying_members)} paying members · ${kes(k.revenue_all)} all-time`} icon={<Banknote size={20} />} tone="gold" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Growth & engagement" subtitle="New members, applications and opportunity views per day" />
          <TrendChart
            data={data.series}
            series={[
              { key: "views", label: "Views", color: "#e39d29" },
              { key: "applications", label: "Applications", color: "#43b02a" },
              { key: "signups", label: "New members", color: "#004485" },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Impact" subtitle="What DEEN measures itself by" />
          <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-5 text-white">
            <div className="text-xs font-semibold uppercase tracking-widest text-gold-400">People who benefited</div>
            <div className="mt-2 text-5xl font-extrabold">{num(k.successful_connections)}</div>
            <p className="mt-2 text-sm text-brand-50/70">Members accepted by organizations or who told us an opportunity changed their life.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-sand-100 p-3"><div className="text-ink-500">Applications</div><div className="text-xl font-bold">{num(k.applications)}</div></div>
            <div className="rounded-xl bg-sand-100 p-3"><div className="text-ink-500">Conversion</div><div className="text-xl font-bold">{k.applications ? Math.round((100 * k.accepted) / k.applications) : 0}%</div></div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Most popular categories" subtitle="Applications by category" />
          <Bars data={data.categories.map((c) => ({ ...c, label: cat(c.category) }))} dataKey="applications" labelKey="label" colors={CAT_COLORS} />
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Geographic intelligence" subtitle="Where members are, where they're looking, and where opportunities exist" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="pb-2">County</th><th className="pb-2 text-right">Members</th><th className="pb-2 text-right">Demand</th><th className="pb-2 text-right">Local supply</th><th className="pb-2 pl-6">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data.counties.slice(0, 10).map((c) => {
                  const gap = c.demand > 0 && c.supply < 2;
                  const max = Math.max(...data.counties.map((x) => x.members), 1);
                  return (
                    <tr key={c.county}>
                      <td className="py-2.5 font-semibold">{c.county}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-sand-200"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(100 * c.members) / max}%` }} /></div>
                          {num(c.members)}
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{num(c.demand)}</td>
                      <td className="py-2.5 text-right tabular-nums">{num(c.supply)}</td>
                      <td className="py-2.5 pl-6">{gap ? <Badge tone="warn">Needs opportunities</Badge> : <Badge tone="good">Served</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!data.counties.length && <p className="py-8 text-center text-sm text-ink-400">County data appears as members complete their profiles.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Ranked title="Most saved" rows={data.most_saved.map((o) => ({ id: o.id, label: o.title, value: o.saves }))} />
        <Ranked title="Most applied for" rows={data.most_applied.map((o) => ({ id: o.id, label: o.title, value: o.applications }))} />
        <Ranked title="Member interests" rows={data.interests.map((i) => ({ label: cat(i.category), value: i.members }))} />
        <Ranked title="Who our members are" rows={data.user_types.map((u) => ({ label: tax?.user_types.find((t) => t.key === u.type)?.name ?? u.type, value: u.members }))} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top organizations" subtitle="By applications received" action={<Link href="/admin/organizations" className="text-sm font-semibold text-brand-700">All</Link>} />
          <div className="divide-y divide-sand-200">
            {data.top_organizations.map((o, i) => (
              <Link key={o.id} href={`/admin/organizations/${o.id}`} className="flex items-center gap-3 py-2.5 hover:bg-sand-50">
                <span className="w-5 text-sm font-bold text-ink-300">{i + 1}</span>
                <span className="flex-1 truncate font-semibold">{o.name}</span>
                <Badge tone={VERIFICATION[o.verification].tone}>{VERIFICATION[o.verification].label}</Badge>
                <span className="w-24 text-right text-sm tabular-nums text-ink-500">{num(o.applications)} apps</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Opportunity performance" subtitle="Most viewed live opportunities" />
          <div className="divide-y divide-sand-200">
            {data.top_opportunities.map((o) => (
              <Link key={o.id} href={`/admin/opportunities/${o.id}`} className="flex items-center gap-3 py-2.5 hover:bg-sand-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{o.title}</div>
                  <div className="text-xs text-ink-400">{cat(o.category)}</div>
                </div>
                <span className="text-right text-sm tabular-nums text-ink-500">{num(o.views)} views</span>
                <span className="w-20 text-right text-sm font-semibold tabular-nums">{num(o.applications)} apps</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
