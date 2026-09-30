"use client";

import clsx from "clsx";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTaxonomy } from "@/lib/hooks";
import type { Opportunity, Question } from "@/lib/types";
import { Button, Card, ChipSelect, Field, Input, Select, TagInput, Textarea, Toggle } from "./ui";

export type OppDraft = {
  title: string; summary: string; description: string; category: string; type: string; tags: string[];
  eligibility: string; benefits: string; requirements: string; responsibilities: string; application_process: string;
  country: string; counties: string[]; location_label: string; work_mode: "physical" | "remote" | "hybrid";
  is_international: boolean; eligible_countries: string[];
  industry: string; department: string; duration_label: string; duration_weeks: string; time_commitment: string;
  compensation: string; allowances: string; certificate_provided: boolean; weekend: boolean; student_friendly: boolean;
  causes: string[]; contact_email: string; contact_phone: string;
  education_levels: string[]; fields_of_study: string[]; min_age: string; max_age: string; gender: string;
  min_experience_years: string; skills: string[]; target_user_types: string[];
  requires_verified_identity: boolean; deadline: string; starts_at: string; ends_at: string; venue: string;
  is_event: boolean; amount_label: string; slots: string; apply_mode: "external" | "internal"; external_url: string;
  form_questions: Question[]; required_documents: string[]; access_tier: "free" | "member" | "premium";
  feature_requested: boolean; islamic_tags: string[]; shariah_basis: string;
};

// Types that are roles (placements, jobs, volunteering) get the role-details section.
const ROLE_TYPES = new Set(["job", "attachment", "internship", "graduate_trainee", "volunteer", "fellowship", "mentorship",
  "certification", "training", "exchange_programme", "incubator", "accelerator"]);

const toLocal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const str = (n?: number | null) => (n === null || n === undefined ? "" : String(n));

export function draftFrom(o?: Partial<Opportunity>): OppDraft {
  return {
    title: o?.title ?? "", summary: o?.summary ?? "", description: o?.description ?? "", category: o?.category ?? "education",
    type: o?.type ?? "scholarship", tags: o?.tags ?? [], eligibility: o?.eligibility ?? "", benefits: o?.benefits ?? "",
    requirements: o?.requirements ?? "", responsibilities: o?.responsibilities ?? "",
    application_process: o?.application_process ?? "",
    country: o?.country ?? "Kenya", counties: o?.counties ?? [], location_label: o?.location_label ?? "",
    work_mode: o?.work_mode ?? "physical", is_international: o?.is_international ?? false,
    eligible_countries: o?.eligible_countries ?? [], industry: o?.industry ?? "", department: o?.department ?? "",
    duration_label: o?.duration_label ?? "", duration_weeks: str(o?.duration_weeks), time_commitment: o?.time_commitment ?? "",
    compensation: o?.compensation ?? "undisclosed", allowances: o?.allowances ?? "",
    certificate_provided: o?.certificate_provided ?? false, weekend: o?.weekend ?? false,
    student_friendly: o?.student_friendly ?? false, causes: o?.causes ?? [], contact_email: o?.contact_email ?? "",
    contact_phone: o?.contact_phone ?? "", education_levels: o?.education_levels ?? [],
    fields_of_study: o?.fields_of_study ?? [], min_age: str(o?.min_age), max_age: str(o?.max_age),
    gender: o?.gender ?? "", min_experience_years: str(o?.min_experience_years), skills: o?.skills ?? [],
    target_user_types: o?.target_user_types ?? [], requires_verified_identity: o?.requires_verified_identity ?? false,
    deadline: toLocal(o?.deadline), starts_at: toLocal(o?.starts_at), ends_at: toLocal(o?.ends_at), venue: o?.venue ?? "",
    is_event: o?.is_event ?? false, amount_label: o?.amount_label ?? "", slots: str(o?.slots),
    apply_mode: o?.apply_mode ?? "external", external_url: o?.external_url ?? "", form_questions: o?.form_questions ?? [],
    required_documents: o?.required_documents ?? [], access_tier: o?.access_tier ?? "free",
    feature_requested: o?.feature_requested ?? false, islamic_tags: o?.islamic_tags ?? [], shariah_basis: o?.shariah_basis ?? "",
  };
}

/** Converts form state to the API payload (empty strings become nulls, dates become ISO). */
export function payloadFrom(d: OppDraft) {
  const iso = (v: string) => (v ? new Date(v).toISOString() : null);
  const int = (v: string) => (v === "" ? null : Number(v));
  const txt = (v: string) => v.trim() || null;
  return {
    ...d,
    min_age: int(d.min_age), max_age: int(d.max_age), slots: int(d.slots), duration_weeks: int(d.duration_weeks),
    min_experience_years: int(d.min_experience_years), gender: d.gender || null, industry: d.industry || null,
    deadline: iso(d.deadline), starts_at: iso(d.starts_at), ends_at: iso(d.ends_at),
    venue: txt(d.venue), location_label: txt(d.location_label), amount_label: txt(d.amount_label),
    department: txt(d.department), duration_label: txt(d.duration_label), time_commitment: txt(d.time_commitment),
    allowances: txt(d.allowances), contact_email: txt(d.contact_email), contact_phone: txt(d.contact_phone),
    shariah_basis: txt(d.shariah_basis),
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
            <input type="checkbox" checked={q.required} onChange={(e) => set(i, { required: e.target.checked })} className="accent-brand-700" /> Required
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
  const isRole = ROLE_TYPES.has(value.type);
  const isVolunteer = value.type === "volunteer";
  const pairs = (xs?: { key: string; name: string }[]) => xs?.map((x) => ({ value: x.key, label: x.name })) ?? [];

  return (
    <div className="space-y-5">
      <Section title="The basics" subtitle="What is this opportunity, in plain words?">
        <Field label="Title"><Input value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Health records attachment, 3 months" maxLength={200} /></Field>
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
        <Field label="Industry">
          <Select value={value.industry} onChange={(e) => set("industry", e.target.value)}>
            <option value="">Not specific to one industry</option>
            {tax?.industries.map((i) => <option key={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="Summary" hint={`${value.summary.length}/400 · shown on cards in the app`}>
          <Textarea value={value.summary} onChange={(e) => set("summary", e.target.value)} maxLength={400} className="min-h-[70px]" />
        </Field>
        <Field label="Full description"><Textarea value={value.description} onChange={(e) => set("description", e.target.value)} className="min-h-[160px]" /></Field>
        <Field label="Keywords" hint="Help members find this in search."><TagInput value={value.tags} onChange={(v) => set("tags", v)} placeholder="e.g. engineering, tuition" /></Field>
      </Section>

      {isRole && (
        <Section title={isVolunteer ? "Volunteer role" : "Role details"} subtitle="What the placement involves, how long it lasts and what it pays.">
          {!isVolunteer && <Field label="Department / area"><Input value={value.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Health Records & Information" /></Field>}
          <Field label="Responsibilities"><Textarea value={value.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Duration"><Input value={value.duration_label} onChange={(e) => set("duration_label", e.target.value)} placeholder="e.g. 3 months" /></Field>
            <Field label="Duration in weeks" hint="Used for filters"><Input type="number" min={0} value={value.duration_weeks} onChange={(e) => set("duration_weeks", e.target.value)} /></Field>
            <Field label="Time commitment"><Input value={value.time_commitment} onChange={(e) => set("time_commitment", e.target.value)} placeholder="e.g. Weekends, 4 hrs" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pay">
              <Select value={value.compensation} onChange={(e) => set("compensation", e.target.value)}>
                {tax?.compensation.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Allowances"><Input value={value.allowances} onChange={(e) => set("allowances", e.target.value)} placeholder="e.g. Transport & lunch provided" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Toggle checked={value.certificate_provided} onChange={(v) => set("certificate_provided", v)} label="Certificate provided" />
            <Toggle checked={value.student_friendly} onChange={(v) => set("student_friendly", v)} label="Student-friendly" />
            <Toggle checked={value.weekend} onChange={(v) => set("weekend", v)} label="Weekends" />
          </div>
          {isVolunteer && (
            <Field label="Causes"><ChipSelect options={pairs(tax?.causes)} value={value.causes} onChange={(v) => set("causes", v)} /></Field>
          )}
        </Section>
      )}

      <Section title="Who can apply" subtitle="Structured eligibility powers DEEN's matching: members see how well they fit.">
        <Field label="Eligibility (in words)"><Textarea value={value.eligibility} onChange={(e) => set("eligibility", e.target.value)} /></Field>
        <Field label="Aimed at" hint="Members in these groups see it as a stronger match.">
          <ChipSelect options={pairs(tax?.user_types)} value={value.target_user_types} onChange={(v) => set("target_user_types", v)} />
        </Field>
        <Field label="Education levels" hint="Leave empty if any level can apply.">
          <ChipSelect options={pairs(tax?.education_levels)} value={value.education_levels} onChange={(v) => set("education_levels", v)} />
        </Field>
        <Field label="Course / field of study"><TagInput value={value.fields_of_study} onChange={(v) => set("fields_of_study", v)} placeholder="e.g. Health Records, Computer Science" /></Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Minimum age"><Input type="number" min={10} max={100} value={value.min_age} onChange={(e) => set("min_age", e.target.value)} /></Field>
          <Field label="Maximum age"><Input type="number" min={10} max={100} value={value.max_age} onChange={(e) => set("max_age", e.target.value)} /></Field>
          <Field label="Years of experience"><Input type="number" min={0} max={50} value={value.min_experience_years} onChange={(e) => set("min_experience_years", e.target.value)} /></Field>
          <Field label="Open to">
            <Select value={value.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Everyone</option><option value="female">Women only</option><option value="male">Men only</option>
            </Select>
          </Field>
        </div>
        <Field label="Relevant skills"><TagInput value={value.skills} onChange={(v) => set("skills", v)} suggestions={tax?.skills} placeholder="Type a skill" /></Field>
        <Field label="Nationalities that can apply" hint="Leave empty if not restricted.">
          <TagInput value={value.eligible_countries} onChange={(v) => set("eligible_countries", v.filter((c) => tax?.countries.includes(c)))} suggestions={tax?.countries} placeholder="Start typing a country" />
        </Field>
        <Toggle checked={value.requires_verified_identity} onChange={(v) => set("requires_verified_identity", v)} label="Verified identity required" description="Only members whose ID DEEN has verified can apply (recommended for financial support)." />
      </Section>

      <Section title="Where & when">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country">
            <Select value={value.country} onChange={(e) => onChange({ ...value, country: e.target.value, is_international: e.target.value !== "Kenya", counties: e.target.value === "Kenya" ? value.counties : [] })}>
              {tax?.countries.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Work mode">
            <Select value={value.work_mode} onChange={(e) => set("work_mode", e.target.value as OppDraft["work_mode"])}>
              {tax?.work_modes.map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
            </Select>
          </Field>
        </div>
        {value.country === "Kenya" && value.work_mode !== "remote" && (
          <Field label="Counties" hint="Leave empty if it's open across Kenya.">
            <TagInput value={value.counties} onChange={(v) => set("counties", v.filter((c) => tax?.counties.includes(c)))} suggestions={tax?.counties} placeholder="Start typing a county" />
          </Field>
        )}
        <Field label="Location label (optional)"><Input value={value.location_label} onChange={(e) => set("location_label", e.target.value)} placeholder="e.g. Mombasa & Kilifi" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Application deadline"><Input type="datetime-local" value={value.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
          <Field label="Start date"><Input type="datetime-local" value={value.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
        </div>
        <Toggle checked={value.is_event} onChange={(v) => set("is_event", v)} label="This is an event" description="Workshops, seminars, conferences, volunteering days." />
        {value.is_event && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ends"><Input type="datetime-local" value={value.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
            <Field label="Venue"><Input value={value.venue} onChange={(e) => set("venue", e.target.value)} /></Field>
          </div>
        )}
      </Section>

      <Section title="What it offers">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Funding / value" hint="Shown prominently, e.g. “Full tuition”, “KES 60,000 / month”"><Input value={value.amount_label} onChange={(e) => set("amount_label", e.target.value)} /></Field>
          <Field label="Places available"><Input type="number" min={1} value={value.slots} onChange={(e) => set("slots", e.target.value)} /></Field>
        </div>
        <Field label="Benefits"><Textarea value={value.benefits} onChange={(e) => set("benefits", e.target.value)} /></Field>
        <Field label="Requirements"><Textarea value={value.requirements} onChange={(e) => set("requirements", e.target.value)} /></Field>
      </Section>

      <Section title="How members apply" subtitle="Applying on your official page is preferred; DEEN verifies the link.">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["external", "internal"] as const).map((m) => (
            <button key={m} type="button" onClick={() => set("apply_mode", m)} className={clsx("rounded-2xl border-2 p-4 text-left transition", value.apply_mode === m ? "border-brand-600 bg-brand-50" : "border-sand-200 bg-white hover:border-sand-300")}>
              <div className="font-bold">{m === "internal" ? "Apply on DEEN" : "Apply on our official page"}</div>
              <div className="mt-1 text-[13px] text-ink-500">{m === "internal" ? "Applications arrive in your DEEN dashboard with each member's profile and documents." : "Members go to your verified application link; DEEN tracks the clicks."}</div>
            </button>
          ))}
        </div>
        {value.apply_mode === "external" ? (
          <Field label="Official application link"><Input type="url" value={value.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://" /></Field>
        ) : (
          <Field label="Application questions"><QuestionsBuilder value={value.form_questions} onChange={(v) => set("form_questions", v)} /></Field>
        )}
        <Field label="Documents applicants should prepare"><TagInput value={value.required_documents} onChange={(v) => set("required_documents", v)} placeholder="e.g. CV, attachment letter, business plan" /></Field>
        <Field label="Application process (in words)"><Textarea value={value.application_process} onChange={(e) => set("application_process", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Official contact email"><Input type="email" value={value.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></Field>
          <Field label="Official contact phone"><Input value={value.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Islamic-friendly" subtitle="Helps members find opportunities aligned with their values. Only tag what you can stand behind.">
        <ChipSelect options={pairs(tax?.islamic_tags)} value={value.islamic_tags} onChange={(v) => set("islamic_tags", v)} />
        {value.islamic_tags.includes("shariah_conscious") && (
          <Field label="Basis for the Shariah-conscious label" hint="Required. e.g. the certifying Shariah board and reference.">
            <Textarea value={value.shariah_basis} onChange={(e) => set("shariah_basis", e.target.value)} />
          </Field>
        )}
      </Section>

      <Section title="Visibility">
        {staff ? (
          <Field label="Who can apply" hint="Member and Premium opportunities are shown to everyone but only paying members can apply.">
            <Select value={value.access_tier} onChange={(e) => set("access_tier", e.target.value as OppDraft["access_tier"])}>
              <option value="free">Everyone (free)</option><option value="member">Members</option><option value="premium">Premium members</option>
            </Select>
          </Field>
        ) : (
          <Toggle checked={value.feature_requested} onChange={(v) => set("feature_requested", v)} label="Request a featured / sponsored placement" description="Sponsored listings appear at the top of members' feeds and are clearly labelled. DEEN will contact you." />
        )}
      </Section>
    </div>
  );
}
