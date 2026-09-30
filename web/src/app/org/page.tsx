"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, HeartHandshake, Inbox, MousePointerClick, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { TrendChart } from "@/components/charts";
import { PageLoader } from "@/components/Loader";
import { Button, Card, CardHeader, Empty, PageHeader, Stat } from "@/components/ui";
import { get } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { APP_STATUS, num, STATUS } from "@/lib/format";
import type { OppStatus } from "@/lib/types";

interface Dash {
  status_counts: Record<string, number>;
  totals: { views: number; clicks: number; saves: number; applications: number; accepted: number; outcomes: number };
  series: { date: string; view: number; click: number; apply: number }[];
  counties: { county: string; count: number }[];
  funnel: Record<string, number>;
  top: { id: string; title: string; status: OppStatus; views: number; clicks: number; applications: number; conversion: number }[];
}

export default function OrgDashboard() {
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({ queryKey: ["org", "dashboard"], queryFn: () => get<Dash>("/org/dashboard") });
  if (isLoading || !data) return <PageLoader label="Loading your dashboard" />;
  const t = data.totals;
  const pending = me?.organization?.verification === "pending";
  const maxCounty = Math.max(1, ...data.counties.map((c) => c.count));

  return (
    <>
      <PageHeader
        eyebrow="Organization Portal"
        title={`Assalamu alaikum, ${me?.full_name.split(" ")[0]}`}
        subtitle="How your opportunities are reaching the Muslim community."
        actions={<Link href="/org/opportunities/new"><Button icon={<Plus size={16} />}>New opportunity</Button></Link>}
      />
      {pending && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Verification in progress.</b> You can prepare and submit opportunities now; DEEN publishes them once your organization is verified.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Views" value={num(t.views)} icon={<Eye size={20} />} />
        <Stat label="Clicks to apply" value={num(t.clicks)} icon={<MousePointerClick size={20} />} tone="gold" />
        <Stat label="Applications" value={num(t.applications)} icon={<Inbox size={20} />} />
        <Stat label="People helped" value={num(t.accepted + t.outcomes)} hint={`${num(t.accepted)} accepted · ${num(t.outcomes)} stories`} icon={<HeartHandshake size={20} />} tone="gold" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Engagement, last 30 days" />
          {data.series.length ? (
            <TrendChart data={data.series} series={[{ key: "view", label: "Views", color: "#c9a34e" }, { key: "click", label: "Clicks", color: "#1d4ed8" }, { key: "apply", label: "Applications", color: "#0f7a61" }]} />
          ) : <Empty icon={<Sparkles size={24} />} title="No activity yet" body="Once an opportunity is published, members' views and applications appear here." />}
        </Card>
        <Card>
          <CardHeader title="Where interest comes from" />
          <div className="space-y-2.5">
            {data.counties.map((c) => (
              <div key={c.county} className="text-sm">
                <div className="mb-1 flex justify-between"><span className="font-semibold">{c.county}</span><span className="text-ink-400">{num(c.count)}</span></div>
                <div className="h-1.5 rounded-full bg-sand-200"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-gold-500" style={{ width: `${(100 * c.count) / maxCounty}%` }} /></div>
              </div>
            ))}
            {!data.counties.length && <p className="text-sm text-ink-400">Appears as members engage.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" pad={false}>
          <div className="p-5 pb-2"><CardHeader title="Opportunity performance" /></div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <tr><th className="px-5 py-2">Opportunity</th><th className="px-3 py-2 text-right">Views</th><th className="px-3 py-2 text-right">Applications</th><th className="px-5 py-2 text-right">Conversion</th></tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {data.top.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-3"><Link href={`/org/opportunities/${o.id}`} className="font-semibold hover:text-emerald-700">{o.title}</Link><div className="text-xs text-ink-400">{STATUS[o.status].label}</div></td>
                  <td className="px-3 py-3 text-right tabular-nums">{num(o.views)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{num(o.applications)}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">{o.conversion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.top.length && <p className="px-5 pb-5 text-sm text-ink-400">No published opportunities yet.</p>}
        </Card>
        <Card>
          <CardHeader title="Application pipeline" />
          <div className="space-y-2">
            {["submitted", "in_review", "shortlisted", "interview", "accepted", "rejected"].map((s) => (
              <Link key={s} href={`/org/applications?status=${s}`} className="flex items-center justify-between rounded-xl bg-sand-100 px-4 py-2.5 text-sm hover:bg-emerald-50">
                <span className="font-semibold">{APP_STATUS[s].label}</span><span className="tabular-nums">{num(data.funnel[s] ?? 0)}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
