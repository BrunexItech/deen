"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { TableSkeleton } from "@/components/Loader";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { fmtDate, ROLE_LABEL } from "@/lib/format";

interface Entry { id: string; action: string; entity: string; entity_id: string | null; actor: string; actor_role: string | null; ip: string | null; meta: Record<string, unknown> | null; at: string }

const ENTITIES = ["opportunity", "organization", "user", "application", "payment", "plan", "identity", "report", "announcement", "directory", "settings", "file"];

export default function AuditPage() {
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "audit", q, entity, page], queryFn: () => get<Entry[]>(`/admin/audit${qs({ q, entity, page })}`), placeholderData: (p) => p });
  return (
    <>
      <PageHeader eyebrow="Platform" title="Audit log" subtitle="Every important action on DEEN: who did it, when, from where. Append-only." />
      <Card pad={false}>
        <div className="grid gap-3 border-b border-sand-200 p-4 sm:grid-cols-[1fr_220px]">
          <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-ink-300" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Action, e.g. publish, login, verification" className="pl-9" /></div>
          <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}><option value="">Everything</option>{ENTITIES.map((x) => <option key={x}>{x}</option>)}</Select>
        </div>
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <tr><th className="px-5 py-3">When</th><th className="px-3 py-3">Who</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Details</th><th className="px-3 py-3">IP</th></tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data?.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-ink-500">{fmtDate(e.at, true)}</td>
                    <td className="px-3 py-3"><div className="font-semibold">{e.actor}</div>{e.actor_role && <div className="text-xs text-ink-400">{ROLE_LABEL[e.actor_role]}</div>}</td>
                    <td className="px-3 py-3"><Badge tone={e.action.includes("suspend") || e.action.includes("reject") || e.action.includes("locked") ? "bad" : e.action.includes("reveal") || e.action.includes("viewed") ? "warn" : "neutral"}>{e.action}</Badge></td>
                    <td className="max-w-md px-3 py-3 text-xs text-ink-500">
                      {e.meta && Object.entries(e.meta).filter(([, v]) => v !== null && v !== "").map(([k, v]) => <span key={k} className="mr-3 inline-block"><b className="text-ink-700">{k}</b> {String(v)}</span>)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-400">{e.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-sand-200 px-5 py-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} icon={<ChevronLeft size={14} />}>Newer</Button>
          <Button size="sm" variant="secondary" disabled={(data?.length ?? 0) < 50} onClick={() => setPage(page + 1)}>Older <ChevronRight size={14} /></Button>
        </div>
      </Card>
    </>
  );
}
