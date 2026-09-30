"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Badge, Button, Card, CardHeader, ChipSelect, Empty, Field, Input, PageHeader, Select, TagInput, Textarea } from "@/components/ui";
import { get, post } from "@/lib/api";
import { ago, num } from "@/lib/format";
import { useTaxonomy } from "@/lib/hooks";

interface Announcement {
  id: string; title: string; body: string; audience: string; counties: string[]; channels: string[]; recipients: number; sent_at: string;
}

const AUDIENCES: Record<string, string> = {
  all: "All members", free: "Free members", members: "Paying members", premium: "Premium members",
  county: "Members in specific counties", organizations: "Organization teams",
};

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const { data: tax } = useTaxonomy();
  const [f, setF] = useState({ title: "", body: "", audience: "all", counties: [] as string[], channels: ["push"] });
  const { data, isLoading } = useQuery({ queryKey: ["admin", "announcements"], queryFn: () => get<Announcement[]>("/admin/announcements") });
  const send = useMutation({
    mutationFn: () => post("/admin/announcements", f),
    onSuccess: () => {
      toast.success("Announcement is on its way");
      setF({ ...f, title: "", body: "" });
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });

  return (
    <>
      <PageHeader eyebrow="Community" title="Announcements" subtitle="Speak to the community: platform news, Ramadan and Eid messages, urgent appeals. Delivered in batches, so any audience size is fine." />
      <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
        <Card className="h-fit">
          <CardHeader title="New announcement" />
          <div className="space-y-4">
            <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} placeholder="Ramadan Mubarak from DEEN" /></Field>
            <Field label="Message" hint={`${f.body.length}/2000`}><Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={2000} className="min-h-[120px]" /></Field>
            <Field label="Audience">
              <Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
                {Object.entries(AUDIENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            {f.audience === "county" && (
              <Field label="Counties"><TagInput value={f.counties} onChange={(v) => setF({ ...f, counties: v.filter((c) => tax?.counties.includes(c)) })} suggestions={tax?.counties} placeholder="Type a county" /></Field>
            )}
            <Field label="Channels" hint="Members' own notification preferences are always respected.">
              <ChipSelect options={[{ value: "push", label: "Push" }, { value: "email", label: "Email" }, { value: "sms", label: "SMS" }]} value={f.channels} onChange={(v) => setF({ ...f, channels: v.length ? v : ["push"] })} />
            </Field>
            {/* A live preview of the phone notification. */}
            <div className="rounded-2xl bg-brand-950 p-3">
              <div className="flex gap-3 rounded-xl bg-white/10 p-3 text-white backdrop-blur">
                <img src="/deen-icon.png" alt="" className="h-9 w-9 object-contain" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{f.title || "Title"}</div>
                  <div className="line-clamp-2 text-xs text-white/70">{f.body || "Your message appears here."}</div>
                </div>
              </div>
            </div>
            <Button className="w-full" icon={<Send size={15} />} disabled={f.title.length < 3 || f.body.length < 3} loading={send.isPending}
              onClick={() => confirm(`Send to ${AUDIENCES[f.audience].toLowerCase()}?`) && send.mutate()}>
              Send announcement
            </Button>
          </div>
        </Card>
        <Card pad={false}>
          <div className="p-5 pb-2"><CardHeader title="Sent" /></div>
          {isLoading ? <TableSkeleton /> : !data?.length ? <Empty icon={<Megaphone size={26} />} title="No announcements yet" /> : (
            <div className="divide-y divide-sand-200">
              {data.map((a) => (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{a.title}</span>
                    <span className="text-xs text-ink-400">{ago(a.sent_at)} · {num(a.recipients)} recipients</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-700">{a.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="info">{AUDIENCES[a.audience]}</Badge>
                    {a.counties.map((c) => <Badge key={c}>{c}</Badge>)}
                    {a.channels.map((c) => <Badge key={c} tone="good">{c}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
