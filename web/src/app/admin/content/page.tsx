"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageLoader } from "@/components/Loader";
import { Badge, Button, Card, CardHeader, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, Toggle } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import { useCan } from "@/lib/auth";
import { fmtDate, kes } from "@/lib/format";
import type { Taxonomy } from "@/lib/types";

interface Reminder { id: string; kind: string; arabic: string | null; text: string; reference: string; theme: string | null; active: boolean; sort: number }
interface Zakat { gold_price_per_gram_kes: number; silver_price_per_gram_kes: number; nisab_basis: string; gold_nisab_grams: number; silver_nisab_grams: number; updated_at?: string }

const KIND_LABEL: Record<string, string> = { ayah: "Qur'an", hadith: "Hadith", dua: "Du'a" };

function Reminders() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "reminders"], queryFn: () => get<Reminder[]>("/admin/reminders") });
  const blank = { kind: "ayah", arabic: "", text: "", reference: "", theme: "", active: true, sort: 0 };
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const body = { ...edit, arabic: edit?.arabic || null, theme: edit?.theme || null };
      return edit?.id ? put(`/admin/reminders/${edit.id}`, body) : post("/admin/reminders", body);
    },
    onSuccess: () => { toast.success("Saved"); setEdit(null); qc.invalidateQueries({ queryKey: ["admin", "reminders"] }); },
  });
  return (
    <Card>
      <CardHeader title="Daily reminders" subtitle="One reminder shows on every member's home screen each day. Always include the exact source reference."
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit(blank)}>Add</Button>} />
      <div className="grid gap-3 lg:grid-cols-2">
        {data?.map((r) => (
          <button key={r.id} onClick={() => setEdit({ ...r, arabic: r.arabic ?? "", theme: r.theme ?? "" })} className={`rounded-2xl border p-4 text-left transition hover:border-emerald-600/40 ${r.active ? "border-sand-200 bg-white" : "border-dashed border-sand-300 bg-sand-50 opacity-60"}`}>
            <div className="mb-2 flex items-center justify-between"><Badge tone="gold">{KIND_LABEL[r.kind]}</Badge><span className="text-xs text-ink-400">{r.reference}</span></div>
            {r.arabic && <p dir="rtl" lang="ar" className="font-arabic text-xl leading-loose text-emerald-800">{r.arabic}</p>}
            <p className="mt-1 text-sm text-ink-700">{r.text}</p>
          </button>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit reminder" : "New reminder"} wide
        footer={<Button loading={save.isPending} disabled={!edit?.text || !edit?.reference} onClick={() => save.mutate()}>Save</Button>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type"><Select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}><option value="ayah">Qur&apos;an</option><option value="hadith">Hadith</option><option value="dua">Du&apos;a</option></Select></Field>
              <Field label="Theme"><Input value={edit.theme} onChange={(e) => setEdit({ ...edit, theme: e.target.value })} placeholder="work, knowledge, patience…" /></Field>
            </div>
            <Field label="Arabic"><Textarea dir="rtl" lang="ar" value={edit.arabic} onChange={(e) => setEdit({ ...edit, arabic: e.target.value })} className="font-arabic text-xl" /></Field>
            <Field label="Meaning (English)"><Textarea value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} /></Field>
            <Field label="Source reference" hint="e.g. Qur'an 94:5–6 · Sahih Muslim 2699"><Input value={edit.reference} onChange={(e) => setEdit({ ...edit, reference: e.target.value })} /></Field>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" description="Inactive reminders are kept but never shown." />
          </div>
        )}
      </Modal>
    </Card>
  );
}

function ZakatSettings() {
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery({ queryKey: ["admin", "zakat"], queryFn: () => get<Zakat>("/admin/settings/zakat") });
  const [f, setF] = useState<Zakat | null>(null);
  const v = f ?? data;
  const save = useMutation({
    mutationFn: () => put("/admin/settings/zakat", { gold_price_per_gram_kes: Number(v?.gold_price_per_gram_kes), silver_price_per_gram_kes: Number(v?.silver_price_per_gram_kes), nisab_basis: v?.nisab_basis }),
    onSuccess: () => { toast.success("Zakat prices updated for all members"); setF(null); qc.invalidateQueries({ queryKey: ["admin", "zakat"] }); },
  });
  if (!v) return null;
  const nisab = v.nisab_basis === "gold" ? v.gold_price_per_gram_kes * v.gold_nisab_grams : v.silver_price_per_gram_kes * v.silver_nisab_grams;
  return (
    <Card>
      <CardHeader title="Zakat calculator prices" subtitle={`Used by the in-app zakat calculator. Last updated ${fmtDate(v.updated_at)}.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Gold (KES / gram)"><Input type="number" value={v.gold_price_per_gram_kes} onChange={(e) => setF({ ...v, gold_price_per_gram_kes: Number(e.target.value) })} disabled={!can("plans.manage")} /></Field>
        <Field label="Silver (KES / gram)"><Input type="number" value={v.silver_price_per_gram_kes} onChange={(e) => setF({ ...v, silver_price_per_gram_kes: Number(e.target.value) })} disabled={!can("plans.manage")} /></Field>
        <Field label="Nisab basis"><Select value={v.nisab_basis} onChange={(e) => setF({ ...v, nisab_basis: e.target.value })} disabled={!can("plans.manage")}><option value="silver">Silver (595 g)</option><option value="gold">Gold (85 g)</option></Select></Field>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-gold-50 px-4 py-3 text-sm">
        <span>Current nisab: <b>{kes(nisab)}</b></span>
        {can("plans.manage") && <Button size="sm" disabled={!f} loading={save.isPending} onClick={() => save.mutate()}>Save prices</Button>}
      </div>
    </Card>
  );
}

function TaxonomyEditor() {
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery({ queryKey: ["admin", "taxonomy"], queryFn: () => get<Taxonomy["categories"]>("/admin/taxonomy") });
  const [newType, setNewType] = useState<Record<string, string>>({});
  const addType = useMutation({
    mutationFn: ({ cat, name }: { cat: string; name: string }) =>
      post(`/admin/taxonomy/${cat}/types`, { key: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40), name, active: true }),
    onSuccess: () => { toast.success("Type added"); setNewType({}); qc.invalidateQueries({ queryKey: ["admin", "taxonomy"] }); qc.invalidateQueries({ queryKey: ["taxonomy"] }); },
  });
  const toggle = useMutation({
    mutationFn: ({ cat, key, name, active }: { cat: string; key: string; name: string; active: boolean }) => post(`/admin/taxonomy/${cat}/types`, { key, name, active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "taxonomy"] }),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data?.map((c) => (
        <Card key={c.key}>
          <div className="mb-3 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
            <div><div className="font-bold">{c.name}</div><div className="text-xs text-ink-400">Tab: {c.tab_label} · {c.description}</div></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.types.map((t) => (
              <button key={t.key} disabled={!can("taxonomy.manage")} onClick={() => toggle.mutate({ cat: c.key, key: t.key, name: t.name, active: !t.active })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.active ? "bg-emerald-50 text-emerald-800" : "bg-sand-200 text-ink-400 line-through"}`} title="Click to enable/disable">
                {t.name}
              </button>
            ))}
          </div>
          {can("taxonomy.manage") && (
            <div className="mt-3 flex gap-2">
              <Input value={newType[c.key] ?? ""} onChange={(e) => setNewType({ ...newType, [c.key]: e.target.value })} placeholder="New type" className="h-9" />
              <Button size="sm" variant="secondary" disabled={!newType[c.key]} onClick={() => addType.mutate({ cat: c.key, name: newType[c.key] })}>Add</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export default function ContentPage() {
  const can = useCan();
  const tabs = [
    ...(can("content.manage") ? [{ value: "reminders", label: "Qur'an & hadith" }] : []),
    { value: "zakat", label: "Zakat" },
    { value: "taxonomy", label: "Categories" },
  ];
  const [tab, setTab] = useState(tabs[0].value);
  if (!tabs.length) return <PageLoader />;
  return (
    <>
      <PageHeader eyebrow="Community" title="Content & taxonomy" subtitle="The faith content members see every day, and the categories every opportunity is organised by."
        actions={<Tabs value={tab} onChange={setTab} tabs={tabs} />} />
      {tab === "reminders" && <Reminders />}
      {tab === "zakat" && <ZakatSettings />}
      {tab === "taxonomy" && <TaxonomyEditor />}
    </>
  );
}
