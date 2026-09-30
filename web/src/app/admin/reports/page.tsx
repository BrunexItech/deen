"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Badge, Button, Card, Empty, Input, PageHeader, Tabs } from "@/components/ui";
import { get, post } from "@/lib/api";
import { ago, titleCase } from "@/lib/format";

interface Report {
  id: string; target_type: string; target_id: string; target_name: string; reason: string; reason_label: string;
  details: string | null; status: string; reporter: string | null; reports_on_target: number; resolution_note: string | null; created_at: string;
}

const HREF: Record<string, (id: string) => string> = {
  opportunity: (id) => `/admin/opportunities/${id}`,
  organization: (id) => `/admin/organizations/${id}`,
  directory: () => `/admin/directory`,
};

function Row({ r, onDone }: { r: Report; onDone: () => void }) {
  const [note, setNote] = useState("");
  const update = useMutation({
    mutationFn: (status: string) => post(`/admin/reports/${r.id}`, { status, resolution_note: note || null }),
    onSuccess: () => { toast.success("Report updated"); onDone(); },
  });
  const serious = r.reason === "scam" || r.reason === "fee";
  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={serious ? "bad" : "warn"}>{r.reason_label}</Badge>
            {r.reports_on_target > 1 && <Badge tone="bad">{r.reports_on_target} members reported this</Badge>}
            <span className="text-xs text-ink-400">{titleCase(r.target_type)} · {ago(r.created_at)} · by {r.reporter ?? "a member"}</span>
          </div>
          <Link href={HREF[r.target_type](r.target_id)} className="mt-1.5 block font-bold hover:text-brand-700">{r.target_name}</Link>
          {r.details && <p className="mt-1 max-w-2xl text-sm text-ink-700">&ldquo;{r.details}&rdquo;</p>}
        </div>
      </div>
      {(r.status === "open" || r.status === "investigating") ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note" />
          {r.status === "open" && <Button variant="secondary" onClick={() => update.mutate("investigating")}>Investigate</Button>}
          <Button variant="secondary" onClick={() => update.mutate("dismissed")}>Dismiss</Button>
          <Button onClick={() => update.mutate("resolved")}>Resolve</Button>
        </div>
      ) : r.resolution_note && <p className="mt-2 text-sm text-ink-500">Resolution: {r.resolution_note}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const { data, isLoading } = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => get<Report[]>(`/admin/reports?status=${status}`) });
  return (
    <>
      <PageHeader eyebrow="Trust & review" title="Reports" subtitle="Member reports on opportunities, organizations and listings. Three fraud reports automatically pull a live opportunity back into review."
        actions={<Tabs value={status} onChange={setStatus} tabs={[{ value: "open", label: "Open" }, { value: "investigating", label: "Investigating" }, { value: "resolved", label: "Resolved" }, { value: "dismissed", label: "Dismissed" }]} />} />
      <Card pad={false}>
        {isLoading ? <TableSkeleton /> : !data?.length ? (
          <Empty icon={status === "open" ? <ShieldCheck size={26} /> : <Flag size={26} />} title={status === "open" ? "No open reports" : "Nothing here"} />
        ) : (
          <div className="divide-y divide-sand-200">
            {data.map((r) => <Row key={r.id} r={r} onDone={() => { qc.invalidateQueries({ queryKey: ["admin", "reports"] }); qc.invalidateQueries({ queryKey: ["admin", "overview"] }); }} />)}
          </div>
        )}
      </Card>
    </>
  );
}
