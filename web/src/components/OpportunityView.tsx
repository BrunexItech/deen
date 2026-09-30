"use client";

import { AlertTriangle, BadgeCheck, CalendarDays, ExternalLink, FileText, MapPin, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { fmtDate, STATUS, titleCase } from "@/lib/format";
import { useCategoryLabel, useTaxonomy, useTypeLabel } from "@/lib/hooks";
import type { Flag, Opportunity } from "@/lib/types";
import { Badge, Card } from "./ui";

export function StatusBadge({ status }: { status: Opportunity["status"] }) {
  const s = STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function Flags({ flags }: { flags: Flag[] }) {
  if (!flags.length)
    return (
      <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
        <ShieldCheck size={16} /> No automated concerns found.
      </div>
    );
  const order = { high: 0, medium: 1, low: 2 };
  return (
    <div className="space-y-2">
      {[...flags].sort((a, b) => order[a.severity] - order[b.severity]).map((f) => (
        <div key={f.code} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] ${f.severity === "high" ? "bg-rose-50 text-rose-800" : f.severity === "medium" ? "bg-amber-50 text-amber-900" : "bg-sand-100 text-ink-700"}`}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span><b className="uppercase tracking-wide">{f.severity}</b> · {f.message}</span>
        </div>
      ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink-400">{title}</h4>
      <div className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-700">{children}</div>
    </div>
  );
}

/** Read-only view of an opportunity: what members will see. */
export function OpportunityView({ o }: { o: Opportunity }) {
  const cat = useCategoryLabel();
  const type = useTypeLabel();
  const { data: tax } = useTaxonomy();
  const edu = (k: string) => tax?.education_levels.find((e) => e.key === k)?.name ?? k;
  const name = (list: { key: string; name: string }[] | undefined, k: string) => list?.find((x) => x.key === k)?.name ?? k;
  const role: [string, string | null | undefined][] = [
    ["Industry", o.industry], ["Department", o.department], ["Duration", o.duration_label],
    ["Time commitment", o.time_commitment], ["Pay", name(tax?.compensation, o.compensation)], ["Allowances", o.allowances],
    ["Experience", o.min_experience_years ? `${o.min_experience_years}+ years` : null],
    ["Nationalities", o.eligible_countries?.join(", ")],
  ];
  const flags = [o.certificate_provided && "Certificate provided", o.student_friendly && "Student-friendly", o.weekend && "Weekends"].filter(Boolean) as string[];
  const facts: { icon: ReactNode; label: string; value: string }[] = [
    { icon: <MapPin size={15} />, label: "Where", value: `${o.location}${o.work_mode !== "physical" ? ` · ${titleCase(o.work_mode)}` : ""}` },
    { icon: <CalendarDays size={15} />, label: o.is_event ? "Date" : "Deadline", value: o.is_event && o.starts_at ? fmtDate(o.starts_at, true) : fmtDate(o.deadline, true) },
    { icon: <Users size={15} />, label: "Open to", value: [o.gender === "female" ? "Sisters" : o.gender === "male" ? "Brothers" : "Everyone", o.min_age || o.max_age ? `age ${o.min_age ?? "any"}–${o.max_age ?? "any"}` : ""].filter(Boolean).join(", ") },
  ];
  return (
    <Card className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">{cat(o.category)}</Badge>
          <Badge>{type(o.type)}</Badge>
          {o.access_tier !== "free" && <Badge tone="info">{titleCase(o.access_tier)} only</Badge>}
          {o.featured && <Badge tone="gold">★ Featured</Badge>}
          {o.sponsored && <Badge tone="warn">Sponsored</Badge>}
          {o.verified_by_deen && <Badge tone="good"><BadgeCheck size={12} /> Verified by DEEN</Badge>}
          {o.status_label && <Badge>{o.status_label}</Badge>}
        </div>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight">{o.title}</h2>
        {o.amount_label && <div className="mt-1 text-lg font-bold text-brand-700">{o.amount_label}</div>}
        <p className="mt-2 text-[15px] text-ink-500">{o.summary}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl bg-sand-100 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-400">{f.icon}{f.label}</div>
            <div className="mt-1 text-sm font-semibold">{f.value}</div>
          </div>
        ))}
      </div>
      {role.some(([, v]) => v) && (
        <div className="grid gap-3 rounded-xl border border-sand-200 p-4 sm:grid-cols-2">
          {role.filter(([, v]) => v).map(([l, v]) => (
            <div key={l}><div className="text-xs font-semibold text-ink-400">{l}</div><div className="text-sm font-semibold">{v}</div></div>
          ))}
          {flags.length > 0 && <div className="flex flex-wrap gap-1.5 sm:col-span-2">{flags.map((f) => <Badge key={f} tone="good">{f}</Badge>)}</div>}
        </div>
      )}
      <Block title="About">{o.description}</Block>
      <Block title="Responsibilities">{o.responsibilities}</Block>
      <Block title="Eligibility">{o.eligibility}</Block>
      {(o.education_levels.length > 0 || o.skills.length > 0 || o.fields_of_study?.length > 0 || o.target_user_types?.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {o.target_user_types?.map((t) => <Badge key={t} tone="info">{name(tax?.user_types, t)}</Badge>)}
          {o.education_levels.map((e) => <Badge key={e} tone="good">{edu(e)}</Badge>)}
          {o.fields_of_study?.map((f) => <Badge key={f} tone="gold">{f}</Badge>)}
          {o.skills.map((s) => <Badge key={s}>{s}</Badge>)}
          {o.causes?.map((c) => <Badge key={c} tone="good">{name(tax?.causes, c)}</Badge>)}
        </div>
      )}
      {o.islamic_tags?.length > 0 && (
        <div className="rounded-xl bg-brand-50 p-4">
          <div className="flex flex-wrap gap-1.5">{o.islamic_tags.map((t) => <Badge key={t} tone="good">{name(tax?.islamic_tags, t)}</Badge>)}</div>
          {o.shariah_basis && <p className="mt-2 text-[13px] text-brand-900"><b>Shariah basis:</b> {o.shariah_basis}</p>}
        </div>
      )}
      <Block title="Benefits">{o.benefits}</Block>
      <Block title="Requirements">{o.requirements}</Block>
      <Block title="How to apply">{o.application_process}</Block>
      {(o.contact_email || o.contact_phone) && (
        <p className="text-sm text-ink-500">Official contact: {[o.contact_email, o.contact_phone].filter(Boolean).join(" · ")}</p>
      )}
      {o.apply_mode === "external" && o.external_url && (
        <a href={o.external_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
          <ExternalLink size={15} /> {o.external_url}
        </a>
      )}
      {o.apply_mode === "internal" && o.form_questions.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Application form</h4>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-700">
            {o.form_questions.map((q, i) => <li key={q.id ?? i}>{q.label}{q.required && <span className="text-rose-600"> *</span>} <span className="text-ink-400">· {titleCase(q.kind)}</span></li>)}
          </ol>
        </div>
      )}
      {o.required_documents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {o.required_documents.map((d) => <span key={d} className="inline-flex items-center gap-1.5 rounded-lg bg-sand-100 px-2.5 py-1 text-[13px]"><FileText size={13} />{d}</span>)}
        </div>
      )}
    </Card>
  );
}
