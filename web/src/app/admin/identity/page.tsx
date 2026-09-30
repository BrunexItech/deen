"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Eye, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Button, Card, Empty, Input, PageHeader, Tabs } from "@/components/ui";
import { get, post } from "@/lib/api";
import { ago, titleCase } from "@/lib/format";

interface Check {
  id: string; user: { id: string; full_name: string; phone: string }; id_type: string; id_number_masked: string;
  status: string; created_at: string; id_front_url: string; selfie_url: string; review_note: string | null;
}

function CheckCard({ c, onDone }: { c: Check; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [number, setNumber] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (approve: boolean) => post(`/admin/identity/${c.id}`, { approve, note: note || null }),
    onSuccess: (_, approve) => { toast.success(approve ? "Verified" : "Returned to member"); onDone(); },
  });
  const reveal = useMutation({ mutationFn: () => post<{ id_number: string }>(`/admin/identity/${c.id}/reveal`), onSuccess: (r) => setNumber(r.id_number) });
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="font-bold">{c.user.full_name}</div><div className="text-xs text-ink-400">{c.user.phone} · submitted {ago(c.created_at)}</div></div>
        <div className="text-sm">{titleCase(c.id_type)} <b className="font-mono">{number ?? c.id_number_masked}</b>
          {!number && c.status === "pending" && <button onClick={() => reveal.mutate()} className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><Eye size={13} /> Reveal (audited)</button>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[["ID document", c.id_front_url], ["Selfie", c.selfie_url]].map(([label, url]) => (
          <a key={label} href={url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-sand-200 bg-sand-100">
            <img src={url} alt={label} className="h-56 w-full object-contain transition group-hover:scale-[1.02]" />
            <div className="border-t border-sand-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500">{label}</div>
          </a>
        ))}
      </div>
      {c.status === "pending" ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason if returning (e.g. photo blurry)" />
          <Button variant="secondary" icon={<X size={15} />} disabled={!note} loading={decide.isPending && decide.variables === false} onClick={() => decide.mutate(false)}>Return</Button>
          <Button icon={<BadgeCheck size={15} />} loading={decide.isPending && decide.variables === true} onClick={() => decide.mutate(true)}>Verify</Button>
        </div>
      ) : c.review_note && <p className="mt-3 text-sm text-ink-500">Note: {c.review_note}</p>}
    </Card>
  );
}

export default function IdentityPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const { data, isLoading } = useQuery({ queryKey: ["admin", "identity", status], queryFn: () => get<Check[]>(`/admin/identity?status=${status}`) });
  return (
    <>
      <PageHeader eyebrow="Trust & review" title="Identity checks" subtitle="Compare the ID photo with the live selfie. ID numbers are encrypted; revealing one is recorded in the audit log."
        actions={<Tabs value={status} onChange={setStatus} tabs={[{ value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "rejected", label: "Returned" }]} />} />
      {isLoading ? <Card><TableSkeleton rows={3} /></Card> : !data?.length ? (
        <Card><Empty icon={<BadgeCheck size={26} />} title="Nothing waiting" body="Members submit ID checks from the app to unlock verified-only support." /></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.map((c) => <CheckCard key={c.id} c={c} onDone={() => { qc.invalidateQueries({ queryKey: ["admin", "identity"] }); qc.invalidateQueries({ queryKey: ["admin", "overview"] }); }} />)}
        </div>
      )}
    </>
  );
}
