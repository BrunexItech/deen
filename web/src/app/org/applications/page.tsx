"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Inbox } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { TableSkeleton } from "@/components/Loader";
import { Avatar, Badge, Button, Card, Empty, PageHeader, Select, Tabs } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { ago, APP_STATUS } from "@/lib/format";
import { useTaxonomy } from "@/lib/hooks";
import type { Opportunity } from "@/lib/types";

interface Row {
  id: string; status: string; applicant: string; county: string | null; education_level: string | null; match_score: number | null;
  external: boolean; opportunity: { id: string; title: string }; created_at: string;
}

function Score({ n }: { n: number | null }) {
  if (n == null) return null;
  const color = n >= 70 ? "text-emerald-700 bg-emerald-50" : n >= 45 ? "text-gold-700 bg-gold-50" : "text-ink-500 bg-sand-100";
  return <span className={`rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${color}`}>{n}% match</span>;
}

function Applications() {
  const params = useSearchParams();
  const { data: tax } = useTaxonomy();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [opp, setOpp] = useState(params.get("opportunity") ?? "");
  const opps = useQuery({ queryKey: ["org", "opps"], queryFn: () => get<Opportunity[]>("/org/opportunities") });
  const { data, isLoading } = useQuery({
    queryKey: ["org", "apps", status, opp],
    queryFn: () => get<{ items: Row[]; counts: Record<string, number> }>(`/org/applications${qs({ status, opportunity_id: opp, limit: 100 })}`),
  });
  const c = data?.counts ?? {};
  const total = Object.values(c).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Applications" subtitle="Everyone who applied through DEEN, with the profile they submitted and how well they match."
        actions={opp && <a href={`/api/v1/org/applications/export?opportunity_id=${opp}`}><Button variant="secondary" icon={<Download size={15} />}>Export CSV</Button></a>} />
      <Card pad={false}>
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs value={status} onChange={setStatus} tabs={[
            { value: "", label: "All", count: total },
            ...["submitted", "in_review", "shortlisted", "interview", "accepted", "rejected"].map((s) => ({ value: s, label: APP_STATUS[s].label, count: c[s] ?? 0 })),
          ]} />
          <Select value={opp} onChange={(e) => setOpp(e.target.value)} className="xl:w-72">
            <option value="">All opportunities</option>
            {opps.data?.filter((o) => o.applications_count > 0 || o.status === "published").map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </Select>
        </div>
        {isLoading ? <TableSkeleton /> : !data?.items.length ? <Empty icon={<Inbox size={26} />} title="No applications yet" body="Applications appear here the moment members apply." /> : (
          <div className="divide-y divide-sand-200">
            {data.items.map((a) => (
              <Link key={a.id} href={`/org/applications/${a.id}`} className="flex flex-col gap-2 px-5 py-3.5 hover:bg-emerald-50/40 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={a.applicant ?? "?"} size={38} />
                  <div className="min-w-0">
                    <div className="font-semibold">{a.applicant}</div>
                    <div className="truncate text-xs text-ink-400">{a.opportunity.title} · {[a.county, tax?.education_levels.find((e) => e.key === a.education_level)?.name].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.external && <Badge><ExternalLink size={11} /> Applied on your site</Badge>}
                  <Score n={a.match_score} />
                  <Badge tone={APP_STATUS[a.status].tone}>{APP_STATUS[a.status].label}</Badge>
                  <span className="w-16 text-right text-xs text-ink-400">{ago(a.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

export default function OrgApplicationsPage() {
  return <Suspense><Applications /></Suspense>;
}
