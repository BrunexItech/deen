"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, FileText, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageLoader } from "@/components/Loader";
import { Avatar, Badge, Button, Card, CardHeader, PageHeader, Textarea } from "@/components/ui";
import { get, patch, post } from "@/lib/api";
import { APP_STATUS, fmtDate } from "@/lib/format";
import { useTaxonomy } from "@/lib/hooks";
import type { Question } from "@/lib/types";

interface AppDetail {
  id: string; status: string; cover_note: string | null; answers: Record<string, string | string[]>; external: boolean;
  documents: { file_id: string; label: string; filename: string; url: string }[]; match_score: number | null; created_at: string;
  opportunity: { id: string; title: string; form_questions: Question[] };
  events: { status: string; message: string | null; at: string }[];
  applicant: Record<string, string | number | boolean | string[] | null>;
  org_notes: string | null;
}

const MOVES = [
  { status: "in_review", label: "Mark in review", variant: "secondary" as const },
  { status: "shortlisted", label: "Shortlist", variant: "gold" as const },
  { status: "interview", label: "Invite to interview", variant: "secondary" as const },
  { status: "accepted", label: "Accept", variant: "primary" as const },
  { status: "rejected", label: "Not selected", variant: "danger" as const },
];

export default function OrgApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: tax } = useTaxonomy();
  const { data: a, isLoading } = useQuery({ queryKey: ["org", "app", id], queryFn: () => get<AppDetail>(`/org/applications/${id}`) });
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (a) setNotes(a.org_notes ?? ""); }, [a]);

  const move = useMutation({
    mutationFn: (status: string) => post(`/org/applications/${id}/status`, { status, message: message || null }),
    onSuccess: () => { toast.success("Applicant notified"); setMessage(""); qc.invalidateQueries({ queryKey: ["org", "app", id] }); qc.invalidateQueries({ queryKey: ["org", "apps"] }); },
  });
  const saveNotes = useMutation({ mutationFn: () => patch(`/org/applications/${id}/notes`, { org_notes: notes }), onSuccess: () => toast.success("Notes saved") });

  if (isLoading || !a) return <PageLoader label="Opening application" />;
  const p = a.applicant;
  const edu = tax?.education_levels.find((e) => e.key === p.education_level)?.name;

  return (
    <>
      <Link href="/org/applications" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft size={15} /> Applications</Link>
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={String(p.full_name ?? "?")} size={58} />
        <PageHeader
          title={<span className="flex items-center gap-2">{String(p.full_name)}{p.identity_verified && <BadgeCheck className="text-leaf-600" />}</span>}
          subtitle={<span className="flex flex-wrap items-center gap-2">Applied for <b>{a.opportunity.title}</b> · {fmtDate(a.created_at)} <Badge tone={APP_STATUS[a.status].tone}>{APP_STATUS[a.status].label}</Badge>{a.match_score != null && <Badge tone="gold">{a.match_score}% match</Badge>}</span>}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Profile" subtitle="As submitted with the application" />
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              {[["Age", p.age], ["Gender", p.gender === "female" ? "Female" : p.gender === "male" ? "Male" : null], ["Education", edu], ["Field of study", p.field_of_study], ["Institution", p.institution], ["Profession", p.profession]].map(([l, v]) => (
                <div key={l as string}><div className="text-xs text-ink-400">{l as string}</div><div className="font-semibold">{(v as string) || "—"}</div></div>
              ))}
            </div>
            {p.bio && <p className="mt-4 text-sm text-ink-700">{String(p.bio)}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">{(p.skills as string[] | null)?.map((s) => <Badge key={s}>{s}</Badge>)}{(p.languages as string[] | null)?.map((s) => <Badge key={s} tone="info">{s}</Badge>)}</div>
          </Card>
          {a.external ? (
            <Card><p className="text-sm text-ink-700">This member told DEEN they applied on your website. Their profile is shared so you can recognise the application.</p></Card>
          ) : (
            <Card>
              <CardHeader title="Application" />
              {a.cover_note && <div className="mb-5"><div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-400">Cover note</div><p className="whitespace-pre-line text-sm text-ink-700">{a.cover_note}</p></div>}
              <div className="space-y-4">
                {a.opportunity.form_questions.map((q) => (
                  <div key={q.id}>
                    <div className="text-sm font-semibold">{q.label}</div>
                    <div className="mt-0.5 whitespace-pre-line text-sm text-ink-700">{Array.isArray(a.answers[q.id!]) ? (a.answers[q.id!] as string[]).join(", ") : String(a.answers[q.id!] ?? "—")}</div>
                  </div>
                ))}
              </div>
              {a.documents.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {a.documents.map((d) => <a key={d.file_id} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-sand-200 px-3 py-2 text-sm font-semibold hover:border-brand-600"><FileText size={15} className="text-brand-700" />{d.label}</a>)}
                </div>
              )}
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Contact" />
            <div className="space-y-2 text-sm">
              {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-2"><Phone size={15} className="text-ink-400" />{String(p.phone)}</a>}
              {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-2"><Mail size={15} className="text-ink-400" />{String(p.email)}</a>}
              {p.county && <div className="flex items-center gap-2"><MapPin size={15} className="text-ink-400" />{[p.town, p.county].filter(Boolean).join(", ")}</div>}
            </div>
          </Card>
          <Card className="border-brand-600/30 ring-4 ring-brand-600/5">
            <CardHeader title="Move this application" subtitle="The applicant is notified instantly." />
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional message to the applicant (e.g. interview time)" className="min-h-[80px]" />
            <div className="mt-3 grid gap-2">
              {MOVES.filter((m) => m.status !== a.status).map((m) => (
                <Button key={m.status} variant={m.variant} loading={move.isPending && move.variables === m.status} disabled={a.status === "withdrawn"} onClick={() => move.mutate(m.status)}>{m.label}</Button>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Private notes" subtitle="Only your team sees these." />
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button size="sm" variant="secondary" className="mt-2" loading={saveNotes.isPending} onClick={() => saveNotes.mutate()}>Save notes</Button>
          </Card>
          <Card>
            <CardHeader title="History" />
            <ol className="space-y-3 text-sm">
              {a.events.map((e, i) => (
                <li key={i}><b>{APP_STATUS[e.status]?.label ?? e.status}</b> <span className="text-xs text-ink-400">· {fmtDate(e.at, true)}</span>{e.message && <div className="text-[13px] text-ink-700">{e.message}</div>}</li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
