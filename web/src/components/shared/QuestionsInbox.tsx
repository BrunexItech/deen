"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, MessageCircleQuestion, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Badge, Button, Card, Empty, PageHeader, Tabs, Textarea } from "@/components/ui";
import { get, post } from "@/lib/api";
import { ago } from "@/lib/format";

interface Question {
  id: string; opportunity_id: string; opportunity: string | null; question: string; answer: string | null;
  status: string; answered_by: string | null; asker?: string | null; created_at: string;
}

/** Members' questions about opportunities (spec section 24), answered by DEEN or the provider. */
export function QuestionsInbox({ scope }: { scope: "admin" | "org" }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const base = scope === "admin" ? "/admin/questions" : "/org/questions";
  const { data, isLoading } = useQuery({
    queryKey: [scope, "questions", status],
    queryFn: async () => {
      const r = await get<Question[] | { items: Question[] }>(`${base}?status=${status}`);
      return Array.isArray(r) ? r : r.items;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: [scope, "questions"] });
  const oppHref = (id: string) => (scope === "admin" ? `/admin/opportunities/${id}` : `/org/opportunities/${id}`);

  return (
    <>
      <PageHeader eyebrow={scope === "admin" ? "Trust & review" : undefined} title="Questions from members"
        subtitle="Answers are published on the opportunity for everyone to see. Unanswered questions stay private."
        actions={<Tabs value={status} onChange={setStatus} tabs={[{ value: "pending", label: "Waiting" }, { value: "answered", label: "Answered" }, ...(scope === "admin" ? [{ value: "hidden", label: "Hidden" }] : [])]} />} />
      {isLoading ? <Card><TableSkeleton rows={3} /></Card> : !data?.length ? (
        <Card><Empty icon={<MessageCircleQuestion size={26} />} title={status === "pending" ? "No questions waiting" : "Nothing here"} /></Card>
      ) : (
        <div className="space-y-4">{data.map((q) => <QuestionCard key={q.id} q={q} scope={scope} href={oppHref(q.opportunity_id)} onDone={refresh} />)}</div>
      )}
    </>
  );
}

function QuestionCard({ q, scope, href, onDone }: { q: Question; scope: "admin" | "org"; href: string; onDone: () => void }) {
  const [answer, setAnswer] = useState("");
  const base = scope === "admin" ? "/admin/questions" : "/org/questions";
  const send = useMutation({ mutationFn: () => post(`${base}/${q.id}/answer`, { answer }), onSuccess: () => { toast.success("Answer published"); onDone(); } });
  const hide = useMutation({ mutationFn: () => post(`/admin/questions/${q.id}/hide`), onSuccess: onDone });
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
        <Link href={href} className="font-semibold text-brand-700 hover:underline">{q.opportunity}</Link>
        <span>{q.asker ? `${q.asker} · ` : ""}{ago(q.created_at)}</span>
      </div>
      <p className="mt-2 text-[15px] font-semibold text-ink-900">&ldquo;{q.question}&rdquo;</p>
      {q.answer ? (
        <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900"><Badge tone="good">{q.answered_by}</Badge> <span className="ml-1">{q.answer}</span></div>
      ) : q.status === "pending" && (
        <div className="mt-3 space-y-2">
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write a clear, public answer…" className="min-h-[70px]" />
          <div className="flex justify-end gap-2">
            {scope === "admin" && <Button size="sm" variant="ghost" icon={<EyeOff size={14} />} onClick={() => hide.mutate()}>Hide</Button>}
            <Button size="sm" icon={<Send size={14} />} disabled={answer.trim().length < 2} loading={send.isPending} onClick={() => send.mutate()}>Publish answer</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
