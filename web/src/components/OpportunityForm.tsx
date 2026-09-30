"use client";

import clsx from "clsx";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTaxonomy } from "@/lib/hooks";
import type { Opportunity, Question } from "@/lib/types";
import { Button, Card, ChipSelect, Field, Input, Select, TagInput, Textarea, Toggle } from "./ui";

export type OppDraft = {
  title: string; summary: string; description: string; category: string; type: string; tags: string[];
  eligibility: string; benefits: string; requirements: string; application_process: string;
  counties: string[]; location_label: string; is_remote: boolean; is_international: boolean;
  education_levels: string[]; min_age: string; max_age: string; gender: string; skills: string[];
  requires_verified_identity: boolean; deadline: string; starts_at: string; ends_at: string; venue: string;
  is_event: boolean; amount_label: string; slots: string; apply_mode: "external" | "internal"; external_url: string;
  form_questions: Question[]; required_documents: string[]; access_tier: "free" | "member" | "premium";
  feature_requested: boolean;
};

const toLocal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

export function draftFrom(o?: Partial<Opportunity>): OppDraft {
  return {
    title: o?.title ?? "", summary: o?.summary ?? "", description: o?.description ?? "", category: o?.category ?? "education",
    type: o?.type ?? "scholarship", tags: o?.tags ?? [], eligibility: o?.eligibility ?? "", benefits: o?.benefits ?? "",
    requirements: o?.requirements ?? "", application_process: o?.application_process ?? "", counties: o?.counties ?? [],
    location_label: o?.location_label ?? "", is_remote: o?.is_remote ?? false, is_international: o?.is_international ?? false,
    education_levels: o?.education_levels ?? [], min_age: o?.min_age?.toString() ?? "", max_age: o?.max_age?.toString() ?? "",
    gender: o?.gender ?? "", skills: o?.skills ?? [], requires_verified_identity: o?.requires_verified_identity ?? false,
    deadline: toLocal(o?.deadline), starts_at: toLocal(o?.starts_at), ends_at: toLocal(o?.ends_at), venue: o?.venue ?? "",
    is_event: o?.is_event ?? false, amount_label: o?.amount_label ?? "", slots: o?.slots?.toString() ?? "",
    apply_mode: o?.apply_mode ?? "external", external_url: o?.external_url ?? "", form_questions: o?.form_questions ?? [],
    required_documents: o?.required_documents ?? [], access_tier: o?.access_tier ?? "free", feature_requested: o?.feature_requested ?? false,
  };
}

/** Converts form state to the API payload (empty strings become nulls, dates become ISO). */
export function payloadFrom(d: OppDraft) {
  const iso = (v: string) => (v ? new Date(v).toISOString() : null);
  const int = (v: string) => (v ? Number(v) : null);
  return {
    ...d,
    min_age: int(d.min_age), max_age: int(d.max_age), slots: int(d.slots), gender: d.gender || null,
    deadline: iso(d.deadline), starts_at: iso(d.starts_at), ends_at: iso(d.ends_at),
    venue: d.venue || null, location_label: d.location_label || null, amount_label: d.amount_label || null,
    external_url: d.apply_mode === "external" ? d.external_url || null : null,
    form_questions: d.apply_mode === "internal" ? d.form_questions : [],
  };
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-5">
        <h3 className="text-[15px] font-bold">{title}</h3>
        {subtitle && <p className="text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

const KINDS = [
  { value: "short_text", label: "Short answer" }, { value: "long_text", label: "Paragraph" },
  { value: "single_choice", label: "One choice" }, { value: "multi_choice", label: "Several choices" },
  { value: "yes_no", label: "Yes / No" }, { value: "number", label: "Number" }, { value: "date", label: "Date" },
];

function QuestionsBuilder({ value, onChange }: { value: Question[]; onChange: (q: Question[]) => void }) {
  const set = (i: number, q: Partial<Question>) => onChange(value.map((x, j) => (i === j ? { ...x, ...q } : x)));
  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <div key={q.id ?? i} className="rounded-xl border border-sand-200 bg-sand-50 p-3.5">
          <div className="flex items-start gap-2">
            <GripVertical size={16} className="mt-3 text-ink-300" />
            <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_170px]">
              <Input value={q.label} onChange={(e) => set(i, { label: e.target.value })} placeholder={`Question ${i + 1}`} />
              <Select value={q.kind} onChange={(e) => set(i, { kind: e.target.value })}>
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </Select>
              {(q.kind === "single_choice" || q.kind === "multi_choice") && (
                <div className="sm:col-span-2">
                  <TagInput value={q.options} onChange={(options) => set(i, { options })} placeholder="Type an option, press Enter" />
                </div>
              )}
            </div>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="mt-2 rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove question">
              <Trash2 size={16} />
            </button>
          </div>
          <label className="ml-6 mt-2 flex items-center gap-2 text-[13px] text-ink-700">
            <input type="checkbox" checked={q.required} onChange={(e) => set(i, { required: e.target.checked })} className="accent-emerald-700" /> Required
          </label>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" icon={<Plus size={15} />} onClick={() => onChange([...value, { label: "", kind: "short_text", required: true, options: [] }])}>
        Add question
      </Button>
    </div>
  );
}

export function OpportunityForm({ value, onChange, staff = false }: { value: OppDraft; onChange: (d: OppDraft) => void; staff?: boolean }) {
  const { data: tax } = useTaxonomy();
  const set = <K extends keyof OppDraft>(k: K, v: OppDraft[K]) => onChange({ ...value, [k]: v });
  const category = tax?.categories.find((c) => c.key === value.category);

  return (
    <div className="space-y-5">
      <Section title="The basics" subtitle="What is this opportunity, in plain words?">
        <Field label="Title"><Input value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Full scholarship for engineering students" maxLength={200} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={value.category} onChange={(e) => {
              const c = tax?.categories.find((x) => x.key === e.target.value);
              onChange({ ...value, category: e.target.value, type: c?.types[0]?.key ?? "" });
            }}>
              {tax?.categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={value.type} onChange={(e) => set("type", e.target.value)}>
              {category?.types.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Summary" hint={`${value.summary.length}/400 · shown on cards in the app`}>
          <Textarea value={value.summary} onChange={(e) => set("summary", e.target.value)} maxLength={400} className="min-h-[70px]" />
        </Field>
        <Field label="Full description"><Textarea value={value.description} onChange={(e) => set("description", e.target.value)} className="min-h-[160px]" /></Field>
        <Field label="Keywords" hint="Help members find this in search."><TagInput value={value.tags} onChange={(v) => set("tags", v)} placeholder="e.g. engineering, tuition" /></Field>
      </Section>

      <Section title="Who can apply" subtitle="Structured eligibility powers DEEN's matching: members see how well they fit.">
        <Field label="Eligibility (in words)"><Textarea value={value.eligibility} onChange={(e) => set("eligibility", e.target.value)} /></Field>
        <Field label="Education levels" hint="Leave empty if any level can apply.">
          <ChipSelect options={tax?.education_levels.map((e) => ({ value: e.key, label: e.name })) ?? []} value={value.education_levels} onChange={(v) => set("education_levels", v)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum age"><Input type="number" min={10} max={100} value={value.min_age} onChange={(e) => set("min_age", e.target.value)} /></Field>
          <Field label="Maximum age"><Input type="number" min={10} max={100} value={value.max_age} onChange={(e) => set("max_age", e.target.value)} /></Field>
          <Field label="Open to">
            <Select value={value.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Everyone</option><option value="female">Sisters only</option><option value="male">Brothers only</option>
            </Select>
          </Field>
        </div>
        <Field label="Relevant skills"><TagInput value={value.skills} onChange={(v) => set("skills", v)} suggestions={tax?.skills} placeholder="Type a skill" /></Field>
        <Toggle checked={value.requires_verified_identity} onChange={(v) => set("requires_verified_identity", v)} label="Verified identity required" description="Only members whose ID DEEN has verified can apply (recommended for financial support)." />
      </Section>

      <Section title="Where & when">
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle checked={value.is_remote} onChange={(v) => set("is_remote", v)} label="Remote" description="Can be done from anywhere." />
          <Toggle checked={value.is_international} onChange={(v) => set("is_international", v)} label="International" description="Based outside Kenya." />
        </div>
        {!value.is_remote && !value.is_international && (
          <Field label="Counties" hint="Leave empty if it's open across Kenya.">
            <TagInput value={value.counties} onChange={(v) => set("counties", v.filter((c) => tax?.counties.includes(c)))} suggestions={tax?.counties} placeholder="Start typing a county" />
          </Field>
        )}
        <Field label="Location label (optional)"><Input value={value.location_label} onChange={(e) => set("location_label", e.target.value)} placeholder="e.g. Mombasa & Kilifi" /></Field>
        <Field label="Application deadline"><Input type="datetime-local" value={value.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
        <Toggle checked={value.is_event} onChange={(v) => set("is_event", v)} label="This is an event" description="Conferences, lectures, workshops, volunteering days." />
        {value.is_event && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Starts"><Input type="datetime-local" value={value.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
            <Field label="Ends"><Input type="datetime-local" value={value.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
            <Field label="Venue"><Input value={value.venue} onChange={(e) => set("venue", e.target.value)} /></Field>
          </div>
        )}
      </Section>

      <Section title="What it offers">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Value" hint="Shown prominently, e.g. “Full tuition”, “KES 60,000 / month”"><Input value={value.amount_label} onChange={(e) => set("amount_label", e.target.value)} /></Field>
          <Field label="Places available"><Input type="number" min={1} value={value.slots} onChange={(e) => set("slots", e.target.value)} /></Field>
        </div>
        <Field label="Benefits"><Textarea value={value.benefits} onChange={(e) => set("benefits", e.target.value)} /></Field>
        <Field label="Requirements"><Textarea value={value.requirements} onChange={(e) => set("requirements", e.target.value)} /></Field>
      </Section>

      <Section title="How members apply">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["internal", "external"] as const).map((m) => (
            <button key={m} type="button" onClick={() => set("apply_mode", m)} className={clsx("rounded-2xl border-2 p-4 text-left transition", value.apply_mode === m ? "border-emerald-600 bg-emerald-50" : "border-sand-200 bg-white hover:border-sand-300")}>
              <div className="font-bold">{m === "internal" ? "Apply on DEEN" : "Apply on our website"}</div>
              <div className="mt-1 text-[13px] text-ink-500">{m === "internal" ? "Applications arrive in your DEEN dashboard with each member's profile." : "Members are sent to your link; DEEN tracks the clicks."}</div>
            </button>
          ))}
        </div>
        {value.apply_mode === "external" ? (
          <Field label="Application link"><Input type="url" value={value.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://" /></Field>
        ) : (
          <Field label="Application questions"><QuestionsBuilder value={value.form_questions} onChange={(v) => set("form_questions", v)} /></Field>
        )}
        <Field label="Documents applicants should prepare"><TagInput value={value.required_documents} onChange={(v) => set("required_documents", v)} placeholder="e.g. KCSE certificate" /></Field>
        <Field label="Application process (in words)"><Textarea value={value.application_process} onChange={(e) => set("application_process", e.target.value)} /></Field>
      </Section>

      <Section title="Visibility">
        {staff ? (
          <Field label="Who can apply" hint="Member and Premium opportunities are shown to everyone but only paying members can apply.">
            <Select value={value.access_tier} onChange={(e) => set("access_tier", e.target.value as OppDraft["access_tier"])}>
              <option value="free">Everyone (free)</option><option value="member">Members</option><option value="premium">Premium members</option>
            </Select>
          </Field>
        ) : (
          <Toggle checked={value.feature_requested} onChange={(v) => set("feature_requested", v)} label="Request a featured placement" description="Featured opportunities appear at the top of members' feeds. DEEN will contact you." />
        )}
      </Section>
    </div>
  );
}
