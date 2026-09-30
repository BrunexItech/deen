"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, Copy, Inbox, Pencil, Send, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageLoader } from "@/components/Loader";
import { OpportunityForm, draftFrom, payloadFrom, type OppDraft } from "@/components/OpportunityForm";
import { Flags, OpportunityView, StatusBadge } from "@/components/OpportunityView";
import { Button, Card, CardHeader, PageHeader, Textarea } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { ago, fmtDate, num, STATUS } from "@/lib/format";
import type { Opportunity, OppStatus } from "@/lib/types";

interface OrgOpp extends Opportunity {
  history: { from: string | null; to: string; note: string | null; at: string }[];
  editable: boolean;
  missing: string[];
}

const NEXT_STEP: Partial<Record<OppStatus, string>> = {
  draft: "Complete the details and submit it to DEEN for review.",
  submitted: "DEEN has received it. Reviews usually take less than 48 hours.",
  under_review: "A DEEN reviewer is checking it now.",
  verification: "DEEN is verifying details with you or the source.",
  info_requested: "DEEN needs a few changes. See the conversation below, edit, then resubmit.",
  approved: "Approved! It will be published shortly.",
  published: "Live and being matched to members right now.",
  rejected: "Declined. Read DEEN's note, make changes and resubmit if appropriate.",
};

export default function OrgOpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: o, isLoading } = useQuery({ queryKey: ["org", "opp", id], queryFn: () => get<OrgOpp>(`/org/opportunities/${id}`) });
  const messages = useQuery({ queryKey: ["org", "opp", id, "messages"], queryFn: () => get<{ id: string; body: string; author: string; from_platform: boolean; at: string }[]>(`/org/opportunities/${id}/messages`) });
  const [editing, setEditing] = useState<OppDraft | null>(null);
  const [msg, setMsg] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["org", "opp", id] }); qc.invalidateQueries({ queryKey: ["org", "opps"] }); };

  const save = useMutation({ mutationFn: (d: OppDraft) => put(`/org/opportunities/${id}`, payloadFrom(d)), onSuccess: () => { toast.success("Saved"); setEditing(null); refresh(); } });
  const action = useMutation({
    mutationFn: (a: "submit" | "withdraw" | "close" | "duplicate") => post<{ id?: string }>(`/org/opportunities/${id}/${a}`),
    onSuccess: (r, a) => {
      if (a === "duplicate" && r.id) { toast.success("Copied to a new draft"); router.push(`/org/opportunities/${r.id}`); return; }
      toast.success(a === "submit" ? "Submitted to DEEN" : a === "withdraw" ? "Withdrawn to draft" : "Closed");
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: () => del(`/org/opportunities/${id}`), onSuccess: () => { toast.success("Draft deleted"); router.push("/org/opportunities"); } });
  const send = useMutation({ mutationFn: () => post(`/org/opportunities/${id}/messages`, { body: msg }), onSuccess: () => { setMsg(""); messages.refetch(); } });
  const [deadline, setDeadline] = useState("");
  const moveDeadline = useMutation({
    mutationFn: () => post(`/org/opportunities/${id}/deadline`, { deadline: new Date(deadline).toISOString() }),
    onSuccess: () => { toast.success("Deadline updated. Members who saved it will be reminded."); setDeadline(""); refresh(); },
  });

  if (isLoading || !o) return <PageLoader label="Loading opportunity" />;
  const inReview = ["submitted", "under_review", "verification", "approved", "info_requested"].includes(o.status);

  return (
    <>
      <Link href="/org/opportunities" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft size={15} /> Opportunities</Link>
      <PageHeader
        title={o.title}
        subtitle={<span className="flex items-center gap-2"><StatusBadge status={o.status} /> updated {ago(o.updated_at)}</span>}
        actions={!editing && (
          <>
            {o.editable && <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => setEditing(draftFrom(o))}>Edit</Button>}
            {o.editable && <Button icon={<Send size={15} />} loading={action.isPending && action.variables === "submit"} onClick={() => action.mutate("submit")}>{o.status === "draft" ? "Submit for review" : "Resubmit"}</Button>}
            {inReview && o.status !== "info_requested" && <Button variant="secondary" icon={<Undo2 size={15} />} onClick={() => action.mutate("withdraw")}>Withdraw to edit</Button>}
            {o.status === "published" && <Link href={`/org/applications?opportunity=${o.id}`}><Button icon={<Inbox size={15} />}>Applications ({num(o.applications_count)})</Button></Link>}
            {o.status === "published" && <Button variant="secondary" icon={<X size={15} />} onClick={() => confirm("Close this opportunity? Members will no longer see it.") && action.mutate("close")}>Close</Button>}
            <Button variant="ghost" icon={<Copy size={15} />} onClick={() => action.mutate("duplicate")}>Duplicate</Button>
            {o.status === "draft" && <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => confirm("Delete this draft?") && remove.mutate()}>Delete</Button>}
          </>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {editing ? (
            <>
              <OpportunityForm value={editing} onChange={setEditing} />
              <div className="sticky bottom-4 flex justify-end gap-2 rounded-2xl border border-sand-200 bg-white/90 p-3 shadow-float backdrop-blur">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button loading={save.isPending} onClick={() => save.mutate(editing)}>Save</Button>
              </div>
            </>
          ) : <OpportunityView o={o} />}
        </div>

        <div className="space-y-5">
          <Card className="bg-gradient-to-br from-brand-800 to-brand-950 !border-0 text-white">
            <div className="text-xs font-bold uppercase tracking-widest text-gold-400">What happens next</div>
            <p className="mt-2 text-[15px]">{NEXT_STEP[o.status] ?? "This opportunity is closed."}</p>
            {o.missing.length > 0 && o.editable && <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm">Before submitting, add: {o.missing.join(", ")}.</p>}
          </Card>

          {["published", "submitted", "under_review", "approved"].includes(o.status) && (
            <Card>
              <CardHeader title="Update deadline" subtitle={`Current: ${fmtDate(o.deadline, true)}`} />
              <div className="flex gap-2">
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-10 flex-1 rounded-xl border border-sand-300 px-3 text-sm" />
                <Button size="sm" disabled={!deadline} loading={moveDeadline.isPending} onClick={() => moveDeadline.mutate()}>Save</Button>
              </div>
              <p className="mt-2 text-xs text-ink-400">Takes effect immediately; DEEN sees every change in the history.</p>
            </Card>
          )}

          {o.flags.length > 0 && (
            <Card><CardHeader title="Things to improve" subtitle="Our automated checks noticed these. Fixing them speeds up approval." /><Flags flags={o.flags} /></Card>
          )}

          <Card>
            <CardHeader title="Conversation with DEEN" />
            <div className="max-h-[360px] space-y-3 overflow-y-auto">
              {!messages.data?.length && <p className="text-sm text-ink-400">Questions about your submission? Message the DEEN review team.</p>}
              {messages.data?.map((m) => (
                <div key={m.id} className={clsx("max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm", m.from_platform ? "bg-brand-50" : "ml-auto bg-sand-100")}>
                  <div className="mb-0.5 text-[11px] font-semibold text-ink-400">{m.author} · {ago(m.at)}</div>
                  <div className="whitespace-pre-line">{m.body}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a message…" className="min-h-[70px]" />
              <Button size="sm" className="w-full" disabled={!msg.trim()} loading={send.isPending} onClick={() => send.mutate()}>Send</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <ol className="relative space-y-4 border-l-2 border-sand-200 pl-4">
              <li className="relative"><span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-sand-300" /><div className="text-sm font-semibold">Created</div><div className="text-xs text-ink-400">{fmtDate(o.created_at, true)}</div></li>
              {o.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
                  <div className="text-sm font-semibold">{STATUS[h.to as OppStatus]?.label ?? h.to}</div>
                  <div className="text-xs text-ink-400">{fmtDate(h.at, true)}</div>
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
