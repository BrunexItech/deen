"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, MapPin, Phone, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Avatar, Badge, Button, Card, Empty, Input, PageHeader, Tabs } from "@/components/ui";
import { get, post } from "@/lib/api";
import { ago } from "@/lib/format";

interface Listing {
  id: string; kind: string; name: string; headline: string; category_label: string; description: string | null;
  county: string | null; town: string | null; phone: string | null; whatsapp: string | null; website: string | null;
  services: string[]; halal_certified: boolean; logo_url: string | null; verified: boolean; status: string; owner: string; created_at: string;
}

function ListingCard({ l, onDone }: { l: Listing; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const decide = useMutation({
    mutationFn: (approve: boolean) => post(`/admin/directory/${l.id}`, { approve, verified, note: note || null }),
    onSuccess: () => { toast.success("Done"); onDone(); },
  });
  return (
    <Card>
      <div className="flex gap-4">
        <Avatar name={l.name} src={l.logo_url} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{l.name}</span><Badge>{l.category_label}</Badge>{l.halal_certified && <Badge tone="good">Halal certified</Badge>}<Badge tone="info">{l.kind}</Badge></div>
          <div className="text-sm text-ink-700">{l.headline}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
            {l.county && <span className="flex items-center gap-1"><MapPin size={12} />{[l.town, l.county].filter(Boolean).join(", ")}</span>}
            {(l.phone || l.whatsapp) && <span className="flex items-center gap-1"><Phone size={12} />{l.phone ?? l.whatsapp}</span>}
            {l.website && <span className="flex items-center gap-1"><Globe size={12} />{l.website}</span>}
          </div>
          {l.description && <p className="mt-2 text-sm text-ink-700">{l.description}</p>}
          <div className="mt-2 text-xs text-ink-400">Submitted by {l.owner} · {ago(l.created_at)}</div>
        </div>
      </div>
      {l.status === "pending" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-sand-200 pt-4 sm:flex-row sm:items-center">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to owner (if changes needed)" />
          <label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="accent-brand-700" /> Verified badge</label>
          <Button variant="secondary" disabled={!note} onClick={() => decide.mutate(false)}>Needs changes</Button>
          <Button onClick={() => decide.mutate(true)}>Approve</Button>
        </div>
      )}
    </Card>
  );
}

export default function DirectoryAdmin() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const { data, isLoading } = useQuery({ queryKey: ["admin", "directory", status], queryFn: () => get<Listing[]>(`/admin/directory?status=${status}`) });
  return (
    <>
      <PageHeader eyebrow="Community" title="Business & professional directory" subtitle="Muslim-owned businesses and professionals, submitted by members and approved by DEEN."
        actions={<Tabs value={status} onChange={setStatus} tabs={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Live" }, { value: "rejected", label: "Returned" }]} />} />
      {isLoading ? <Card><TableSkeleton /></Card> : !data?.length ? <Card><Empty icon={<Store size={26} />} title="Nothing here" /></Card> : (
        <div className="grid gap-4 xl:grid-cols-2">{data.map((l) => <ListingCard key={l.id} l={l} onDone={() => qc.invalidateQueries({ queryKey: ["admin", "directory"] })} />)}</div>
      )}
    </>
  );
}
