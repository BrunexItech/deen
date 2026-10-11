"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, Ban, CalendarX, Check, Eye, Lock, MessageSquare, MousePointerClick, Pencil, Send, Star, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageLoader } from "@/components/Loader";
import { OpportunityForm, draftFrom, payloadFrom, type OppDraft } from "@/components/OpportunityForm";
import { Flags, OpportunityView, StatusBadge } from "@/components/OpportunityView";
import { Badge, Button, Card, CardHeader, PageHeader, Select, Textarea, Toggle } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import { useTaxonomy } from "@/lib/hooks";
import { useCan } from "@/lib/auth";
import { ago, fmtDate, num, STATUS, VERIFICATION } from "@/lib/format";
import type { Opportunity, OppStatus, Verification } from "@/lib/types";

interface AdminOpp extends Opportunity {
  org_detail: { id: string; name: string; verification: Verification; website: string | null; status: string };
  history: { from: string | null; to: string; note: string | null; by: string; at: string }[];
  messages: { id: string; body: string; internal: boolean; from_platform: boolean; author: string | null; at: string }[];
  actions: string[];
  featured_until: string | null;
}

const ACTIONS: Record<string, { label: string; variant: "primary" | "secondary" | "danger" | "gold"; icon: React.ReactNode; needsNote?: boolean }> = {
  publish: { label: "Approve & publish", variant: "primary", icon: <Check size={16} /> },
  approve: { label: "Approve (publish later)", variant: "secondary", icon: <Check size={16} /> },
  start_review: { label: "Start review", variant: "secondary", icon: <Eye size={16} /> },
  send_to_verification: { label: "Send to verification", variant: "secondary", icon: <Lock size={16} /> },
  request_info: { label: "Request information", variant: "secondary", icon: <MessageSquare size={16} />, needsNote: true },
  reject: { label: "Decline", variant: "danger", icon: <X size={16} />, needsNote: true },
  archive: { label: "Remove / close listing", variant: "secondary", icon: <X size={16} /> },
  republish: { label: "Re-publish", variant: "primary", icon: <Send size={16} /> },
  suspend: { label: "Suspend (pull from app)", variant: "danger", icon: <Ban size={16} />, needsNote: true },
  reinstate: { label: "Reinstate", variant: "primary", icon: <Check size={16} /> },
  mark_expired: { label: "Mark as expired", variant: "secondary", icon: <CalendarX size={16} /> },
};

function Checklist({ o, onSaved }: { o: AdminOpp; onSaved: () => void }) {
  const { data: tax } = useTaxonomy();
  const can = useCan();
  const [items, setItems] = useState<Record<string, string>>(o.verification_checklist ?? {});
  const save = useMutation({
    mutationFn: (next: Record<string, string>) => put(`/admin/opportunities/${o.id}/checklist`, { items: next }),
    onSuccess: onSaved,
  });
  const setItem = (k: string, v: string) => {
    const next = { ...items, [k]: items[k] === v ? "no" : v };
    setItems(next);
    save.mutate(next);
  };
  const list = tax?.verification_checklist ?? [];
  const done = list.filter((c) => items[c.key] === "yes" || items[c.key] === "na").length;
  return (
    <Card>
      <CardHeader title="Verification checklist" subtitle={`${done}/${list.length} confirmed · required before publishing`} />
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-sand-200"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${list.length ? (100 * done) / list.length : 0}%` }} /></div>
      <div className="space-y-1.5">
        {list.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-[13px]">
            <button disabled={!can("opps.review")} onClick={() => setItem(c.key, "yes")} className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition", items[c.key] === "yes" ? "border-brand-600 bg-brand-600 text-white" : "border-sand-300 bg-white")} aria-label={`Confirm ${c.name}`}>
              {items[c.key] === "yes" && <Check size={14} strokeWidth={3} />}
            </button>
            <span className={clsx("flex-1", items[c.key] === "na" && "text-ink-400 line-through")}>{c.name}</span>
            <button disabled={!can("opps.review")} onClick={() => setItem(c.key, "na")} className={clsx("rounded-md px-1.5 py-0.5 text-[11px] font-bold", items[c.key] === "na" ? "bg-sand-300 text-ink-700" : "text-ink-300 hover:bg-sand-100")}>N/A</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AdminOpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const can = useCan();
  const { data: o, isLoading } = useQuery({ queryKey: ["admin", "opp", id], queryFn: () => get<AdminOpp>(`/admin/opportunities/${id}`) });
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [editing, setEditing] = useState<OppDraft | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "opp", id] });
    qc.invalidateQueries({ queryKey: ["admin", "opps"] });
    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
  };

  const act = useMutation({
    mutationFn: (action: string) => post<{ status: OppStatus }>(`/admin/opportunities/${id}/actions`, { action, note: note || null }),
    onSuccess: (r) => { toast.success(`Now: ${STATUS[r.status].label}`); setNote(""); refresh(); },
  });
  const send = useMutation({
    mutationFn: () => post(`/admin/opportunities/${id}/messages`, { body: message, internal }),
    onSuccess: () => { setMessage(""); refresh(); },
  });
  const save = useMutation({
    mutationFn: (d: OppDraft) => put(`/admin/opportunities/${id}`, { ...payloadFrom(d), featured: o?.featured ?? false, featured_until: o?.featured_until, sponsored: o?.sponsored ?? false }),
    onSuccess: () => { toast.success("Saved. Automated checks re-ran."); setEditing(null); refresh(); },
  });
  const placement = useMutation({
    mutationFn: (body: { featured: boolean; sponsored?: boolean; access_tier?: string }) => post(`/admin/opportunities/${id}/placement`, body),
    onSuccess: () => { toast.success("Placement updated"); refresh(); },
  });

  if (isLoading || !o) return <PageLoader label="Opening submission" />;

  return (
    <>
      <Link href="/admin/review" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft size={15} /> Back</Link>
      <PageHeader
        title={o.title}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={o.status} /> by <Link className="font-semibold text-brand-700" href={`/admin/organizations/${o.org_detail.id}`}>{o.org_detail.name}</Link> · submitted {ago(o.submitted_at)}</span>}
        actions={can("opps.edit") && !editing && <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => setEditing(draftFrom(o))}>Edit details</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {editing ? (
            <>
              <OpportunityForm value={editing} onChange={setEditing} staff />
              <div className="sticky bottom-4 flex justify-end gap-2 rounded-2xl border border-sand-200 bg-white/90 p-3 shadow-float backdrop-blur">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button loading={save.isPending} onClick={() => save.mutate(editing)}>Save changes</Button>
              </div>
            </>
          ) : (
            <OpportunityView o={o} />
          )}

          <Card>
            <CardHeader title="Conversation with the organization" subtitle="Internal notes are only visible to the DEEN team." />
            <div className="space-y-3">
              {o.messages.length === 0 && <p className="text-sm text-ink-400">No messages yet.</p>}
              {o.messages.map((m) => (
                <div key={m.id} className={clsx("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.internal ? "border border-dashed border-gold-400 bg-gold-50" : m.from_platform ? "ml-auto bg-brand-700 text-white" : "bg-sand-100")}>
                  <div className={clsx("mb-0.5 text-[11px] font-semibold", m.from_platform && !m.internal ? "text-brand-100" : "text-ink-400")}>
                    {m.internal ? "Internal note · " : ""}{m.author ?? "DEEN"} · {ago(m.at)}
                  </div>
                  <div className="whitespace-pre-line">{m.body}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={internal ? "Note for the DEEN team…" : "Message the organization…"} className="min-h-[70px]" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[13px] text-ink-700"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-gold-600" /> Internal note</label>
                <Button size="sm" disabled={!message.trim()} loading={send.isPending} onClick={() => send.mutate()} icon={<Send size={14} />}>Send</Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {o.actions.length > 0 && can("opps.review") && (
            <Card className="border-brand-600/30 ring-4 ring-brand-600/5">
              <CardHeader title="Decision" subtitle="Notes are sent to the organization when you request information or decline." />
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required to request info or decline)" className="min-h-[80px]" />
              <div className="mt-3 grid gap-2">
                {o.actions.map((a) => {
                  const cfg = ACTIONS[a];
                  if (!cfg) return null;
                  return (
                    <Button key={a} variant={cfg.variant} icon={cfg.icon} loading={act.isPending && act.variables === a} disabled={cfg.needsNote && !note.trim()} onClick={() => act.mutate(a)}>
                      {cfg.label}
                    </Button>
                  );
                })}
              </div>
              {o.org_detail.verification === "pending" && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900">This organization isn&apos;t verified yet. Verify it before publishing.</p>
              )}
              {!o.checklist_complete && o.actions.includes("publish") && (
                <p className="mt-3 rounded-xl bg-sky-50 p-3 text-[13px] text-sky-900">Complete the verification checklist below to publish.</p>
              )}
            </Card>
          )}

          <Checklist o={o} onSaved={refresh} />

          <Card>
            <CardHeader title="Automated trust checks" subtitle={`Risk score ${o.risk_score ?? 0}/100`} />
            <Flags flags={o.flags} />
          </Card>

          <Card>
            <CardHeader title="Organization" />
            <div className="flex items-center justify-between">
              <Link href={`/admin/organizations/${o.org_detail.id}`} className="font-semibold hover:text-brand-700">{o.org_detail.name}</Link>
              <Badge tone={VERIFICATION[o.org_detail.verification].tone}>{VERIFICATION[o.org_detail.verification].label}</Badge>
            </div>
            {o.org_detail.website && <a href={o.org_detail.website} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-brand-700">{o.org_detail.website}</a>}
          </Card>

          {can("opps.publish") && (
            <Card>
              <CardHeader title="Placement" subtitle={o.feature_requested ? "The organization requested a featured placement." : undefined} />
              <div className="space-y-4">
                <Toggle checked={o.featured} onChange={(v) => placement.mutate({ featured: v })} label={<span className="flex items-center gap-1.5"><Star size={14} className="text-gold-500" /> Featured</span>} description="Pinned to the top of matching members' feeds." />
                <Toggle checked={o.sponsored} onChange={(v) => placement.mutate({ featured: o.featured, sponsored: v })} label="Sponsored (paid placement)" description="Always shown to members with a clear “Sponsored” label." />
                <div>
                  <div className="mb-1.5 text-[13px] font-semibold text-ink-700">Who can apply</div>
                  <Select value={o.access_tier} onChange={(e) => placement.mutate({ featured: o.featured, access_tier: e.target.value })}>
                    <option value="free">Everyone</option><option value="member">Paid-up members</option>
                  </Select>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Performance" />
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Views", o.views_count, <Eye key="v" size={14} />], ["Clicks", o.clicks_count, <MousePointerClick key="c" size={14} />], ["Applications", o.applications_count, <Send key="a" size={14} />]].map(([l, n, icon]) => (
                <div key={l as string} className="rounded-xl bg-sand-100 p-3">
                  <div className="flex justify-center text-ink-400">{icon}</div>
                  <div className="mt-1 text-lg font-bold">{num(n as number)}</div>
                  <div className="text-[11px] text-ink-500">{l}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="History" />
            <ol className="relative space-y-4 border-l-2 border-sand-200 pl-4">
              {o.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
                  <div className="text-sm font-semibold">{STATUS[h.to as OppStatus]?.label ?? h.to}</div>
                  <div className="text-xs text-ink-400">{h.by} · {fmtDate(h.at, true)}</div>
                  {h.note && <div className="mt-1 text-[13px] text-ink-700">{h.note}</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
