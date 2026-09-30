"use client";

import { useQuery } from "@tanstack/react-query";
import { FileStack, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TableSkeleton } from "@/components/Loader";
import { StatusBadge } from "@/components/OpportunityView";
import { Button, Card, Empty, PageHeader, Tabs } from "@/components/ui";
import { get } from "@/lib/api";
import { fmtDate, num } from "@/lib/format";
import { useCategoryLabel } from "@/lib/hooks";
import type { Opportunity } from "@/lib/types";

const GROUPS: Record<string, string[]> = {
  all: [],
  draft: ["draft", "info_requested", "rejected"],
  review: ["submitted", "under_review", "verification", "approved"],
  live: ["published"],
  closed: ["expired", "archived"],
};

export default function OrgOpportunities() {
  const cat = useCategoryLabel();
  const [group, setGroup] = useState("all");
  const { data, isLoading } = useQuery({ queryKey: ["org", "opps"], queryFn: () => get<Opportunity[]>("/org/opportunities") });
  const items = (data ?? []).filter((o) => !GROUPS[group].length || GROUPS[group].includes(o.status));
  const count = (g: string) => (data ?? []).filter((o) => GROUPS[g].includes(o.status)).length;

  return (
    <>
      <PageHeader title="Opportunities" subtitle="Draft, submit and track everything you share with the community. DEEN reviews each submission before it goes live."
        actions={<Link href="/org/opportunities/new"><Button icon={<Plus size={16} />}>New opportunity</Button></Link>} />
      <Card pad={false}>
        <div className="border-b border-sand-200 p-4">
          <Tabs value={group} onChange={setGroup} tabs={[
            { value: "all", label: "All", count: data?.length ?? 0 }, { value: "draft", label: "Needs your attention", count: count("draft") },
            { value: "review", label: "With DEEN", count: count("review") }, { value: "live", label: "Live", count: count("live") }, { value: "closed", label: "Closed", count: count("closed") },
          ]} />
        </div>
        {isLoading ? <TableSkeleton /> : !items.length ? (
          <Empty icon={<FileStack size={26} />} title="No opportunities here" body="Share a scholarship, job, programme or event with thousands of Muslims across Kenya." action={<Link href="/org/opportunities/new"><Button icon={<Plus size={16} />}>Create one</Button></Link>} />
        ) : (
          <div className="divide-y divide-sand-200">
            {items.map((o) => (
              <Link key={o.id} href={`/org/opportunities/${o.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-brand-50/40 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{o.title}</div>
                  <div className="text-xs text-ink-400">{cat(o.category)} · deadline {fmtDate(o.deadline)} · updated {fmtDate(o.updated_at)}</div>
                </div>
                {o.status === "published" && <span className="text-sm text-ink-500">{num(o.views_count)} views · <b className="text-ink-900">{num(o.applications_count)}</b> applications</span>}
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
