"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TableSkeleton } from "@/components/Loader";
import { StatusBadge } from "@/components/OpportunityView";
import { Badge, Card, Empty, Input, Tabs } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { ago, fmtDate, num } from "@/lib/format";
import { useCategoryLabel } from "@/lib/hooks";
import type { Opportunity } from "@/lib/types";

function Risk({ score }: { score?: number }) {
  if (score === undefined) return null;
  const tone = score >= 40 ? "bad" : score >= 15 ? "warn" : "good";
  return <Badge tone={tone}>{score >= 40 ? "High risk" : score >= 15 ? "Check" : "Clean"} · {score}</Badge>;
}

export function OppTable({ queue = false }: { queue?: boolean }) {
  const cat = useCategoryLabel();
  const [status, setStatus] = useState(queue ? "queue" : "published");
  const [q, setQ] = useState("");
  const params = status === "queue" ? { queue: true } : status === "flagged" ? { flagged: true } : { status };
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "opps", status, q],
    queryFn: () => get<{ items: Opportunity[]; total: number; counts: Record<string, number> }>(`/admin/opportunities${qs({ ...params, q, limit: 60 })}`),
  });
  const c = data?.counts ?? {};
  const tabs = queue
    ? [
        { value: "queue", label: "Needs action", count: (c.submitted ?? 0) + (c.under_review ?? 0) + (c.verification ?? 0) + (c.info_requested ?? 0) },
        { value: "submitted", label: "New", count: c.submitted ?? 0 },
        { value: "under_review", label: "In review", count: c.under_review ?? 0 },
        { value: "verification", label: "Verification", count: c.verification ?? 0 },
        { value: "info_requested", label: "Waiting on org", count: c.info_requested ?? 0 },
        { value: "flagged", label: "High risk" },
      ]
    : [
        { value: "published", label: "Live", count: c.published ?? 0 },
        { value: "approved", label: "Approved", count: c.approved ?? 0 },
        { value: "expired", label: "Expired", count: c.expired ?? 0 },
        { value: "suspended", label: "Suspended", count: c.suspended ?? 0 },
        { value: "archived", label: "Closed", count: c.archived ?? 0 },
        { value: "rejected", label: "Declined", count: c.rejected ?? 0 },
        { value: "draft", label: "Drafts", count: c.draft ?? 0 },
      ];

  return (
    <Card pad={false}>
      <div className="flex flex-col gap-3 border-b border-sand-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onChange={setStatus} tabs={tabs} />
        <div className="relative lg:w-72">
          <Search size={16} className="absolute left-3 top-3.5 text-ink-300" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or organization" className="pl-9" />
        </div>
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : !data?.items.length ? (
        <Empty icon={<ShieldAlert size={26} />} title={queue ? "The queue is clear" : "Nothing here yet"} body={queue ? "Alhamdulillah. New submissions will appear here for review." : undefined} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-5 py-3">Opportunity</th><th className="px-3 py-3">Organization</th><th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">{queue ? "Automated checks" : "Performance"}</th><th className="px-3 py-3">{queue ? "Submitted" : "Deadline"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {data.items.map((o) => (
                <tr key={o.id} className="group hover:bg-brand-50/40">
                  <td className="max-w-[340px] px-5 py-3.5">
                    <Link href={`/admin/opportunities/${o.id}`} className="block">
                      <div className="truncate font-semibold text-ink-900 group-hover:text-brand-800">{o.title}</div>
                      <div className="text-xs text-ink-400">{cat(o.category)}{o.featured && " · ★ Featured"}{o.feature_requested && " · Feature requested"}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-ink-700">{o.organization.name}</td>
                  <td className="px-3 py-3.5"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-3.5">
                    {queue ? <Risk score={o.risk_score} /> : <span className="text-ink-500">{num(o.views_count)} views · <b className="text-ink-900">{num(o.applications_count)}</b> apps</span>}
                  </td>
                  <td className="px-3 py-3.5 text-ink-500">{queue ? ago(o.submitted_at) : fmtDate(o.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
