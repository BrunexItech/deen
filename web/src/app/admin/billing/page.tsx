"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Tabs, TagInput, Toggle } from "@/components/ui";
import { get, post, put, qs } from "@/lib/api";
import { useCan } from "@/lib/auth";
import { fmtDate, kes, num } from "@/lib/format";

interface Plan {
  id: string; code: string; name: string; tagline: string | null; tier: string; price_kes: number; interval_months: number;
  benefits: string[]; features: Record<string, unknown>; highlight: boolean; active: boolean; sort: number; subscribers: number;
}
interface Payment { id: string; member: string; plan: string; amount_kes: number; phone: string; status: string; receipt: string | null; gift: boolean; result: string | null; created_at: string }
interface Sub { id: string; member: string; phone: string; plan: string; ends_at: string; expiring_soon: boolean; sponsored: boolean }

type PlanForm = Omit<Plan, "id" | "subscribers"> & { id?: string; monthly_applications: string };

function PlanEditor({ plan, onClose }: { plan: PlanForm; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(plan);
  const feature = (k: string) => Boolean(f.features[k]);
  const setFeature = (k: string, v: unknown) => setF({ ...f, features: { ...f.features, [k]: v } });
  const save = useMutation({
    mutationFn: () => {
      const { id, monthly_applications, ...rest } = f;
      const body = { ...rest, price_kes: Number(rest.price_kes), interval_months: Number(rest.interval_months), features: { ...rest.features, monthly_applications: monthly_applications ? Number(monthly_applications) : null } };
      return id ? put(`/admin/plans/${id}`, body) : post("/admin/plans", body);
    },
    onSuccess: () => { toast.success("Plan saved. Members see it immediately."); qc.invalidateQueries({ queryKey: ["admin", "plans"] }); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title={f.id ? `Edit ${f.name}` : "New plan"} wide footer={<Button loading={save.isPending} onClick={() => save.mutate()}>Save plan</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Code" hint="Lowercase, never changes once members subscribe"><Input value={f.code} disabled={!!f.id} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Tagline" className="sm:col-span-2"><Input value={f.tagline ?? ""} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
        <Field label="Tier"><Select value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })}><option value="free">Free</option><option value="member">Member</option><option value="premium">Premium</option></Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (KES)"><Input type="number" value={f.price_kes} onChange={(e) => setF({ ...f, price_kes: Number(e.target.value) })} /></Field>
          <Field label="Months"><Input type="number" value={f.interval_months} onChange={(e) => setF({ ...f, interval_months: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Benefits (shown to members)" className="sm:col-span-2"><TagInput value={f.benefits} onChange={(v) => setF({ ...f, benefits: v })} placeholder="Type a benefit, press Enter" /></Field>
        <Field label="Applications per month" hint="Empty = unlimited"><Input type="number" value={f.monthly_applications} onChange={(e) => setF({ ...f, monthly_applications: e.target.value })} /></Field>
        <Field label="Display order"><Input type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} /></Field>
        <div className="space-y-3 sm:col-span-2">
          <Toggle checked={feature("advanced_matching")} onChange={(v) => setFeature("advanced_matching", v)} label="Personalised matching alerts" />
          <Toggle checked={feature("premium_opportunities")} onChange={(v) => setFeature("premium_opportunities", v)} label="Premium opportunities" />
          <Toggle checked={feature("mentorship")} onChange={(v) => setFeature("mentorship", v)} label="Mentorship" />
          <Toggle checked={feature("priority_support")} onChange={(v) => setFeature("priority_support", v)} label="Priority support" />
          <Toggle checked={f.highlight} onChange={(v) => setF({ ...f, highlight: v })} label="Highlight as recommended" />
          <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Available for purchase" />
        </div>
      </div>
    </Modal>
  );
}

function Plans() {
  const can = useCan();
  const { data } = useQuery({ queryKey: ["admin", "plans"], queryFn: () => get<Plan[]>("/admin/plans") });
  const [edit, setEdit] = useState<PlanForm | null>(null);
  const open = (p?: Plan) =>
    setEdit(p ? { ...p, monthly_applications: p.features.monthly_applications != null ? String(p.features.monthly_applications) : "" }
      : { code: "", name: "", tagline: "", tier: "member", price_kes: 0, interval_months: 1, benefits: [], features: {}, highlight: false, active: true, sort: 10, monthly_applications: "" });
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((p) => (
          <Card key={p.id} className={p.highlight ? "ring-2 ring-gold-400" : ""}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold">{p.tier === "premium" && <Crown size={15} className="text-gold-500" />}{p.name}</div>
                <div className="text-xs text-ink-400">{p.tagline}</div>
              </div>
              {!p.active && <Badge>Hidden</Badge>}
            </div>
            <div className="mt-3 text-2xl font-extrabold">{p.price_kes ? kes(p.price_kes) : "Free"}<span className="text-sm font-medium text-ink-400">{p.price_kes ? ` / ${p.interval_months === 1 ? "month" : `${p.interval_months} months`}` : ""}</span></div>
            <ul className="mt-3 space-y-1 text-sm text-ink-700">{p.benefits.map((b) => <li key={b}>✓ {b}</li>)}</ul>
            <div className="mt-4 flex items-center justify-between border-t border-sand-200 pt-3 text-sm">
              <span className="text-ink-500">{num(p.subscribers)} active</span>
              {can("plans.manage") && <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => open(p)}>Edit</Button>}
            </div>
          </Card>
        ))}
        {can("plans.manage") && (
          <button onClick={() => open()} className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand-300 text-sm font-semibold text-ink-500 hover:border-emerald-600 hover:text-emerald-700">
            <Plus size={20} /> New plan
          </button>
        )}
      </div>
      {edit && <PlanEditor plan={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function Payments() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin", "payments", status, q], queryFn: () => get<{ items: Payment[]; totals: Record<string, number> }>(`/admin/payments${qs({ status, q })}`) });
  return (
    <>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Stat label="Last 24 hours" value={kes(data?.totals.today ?? 0)} />
        <Stat label="Last 7 days" value={kes(data?.totals.week ?? 0)} />
        <Stat label="Last 30 days" value={kes(data?.totals.month ?? 0)} tone="gold" />
      </div>
      <Card pad={false}>
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 lg:flex-row lg:justify-between">
          <Tabs value={status} onChange={setStatus} tabs={[{ value: "", label: "All" }, { value: "success", label: "Paid" }, { value: "pending", label: "Pending" }, { value: "failed", label: "Failed" }, { value: "cancelled", label: "Cancelled" }]} />
          <div className="relative lg:w-72"><Search size={16} className="absolute left-3 top-3.5 text-ink-300" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or M-Pesa receipt" className="pl-9" /></div>
        </div>
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <tr><th className="px-5 py-3">Member</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">M-Pesa</th><th className="px-3 py-3">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data?.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3"><div className="font-semibold">{p.member}</div><div className="text-xs text-ink-400">{p.phone}</div></td>
                    <td className="px-3 py-3">{p.plan}{p.gift && <Badge tone="gold" className="ml-2">Gift</Badge>}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{kes(p.amount_kes)}</td>
                    <td className="px-3 py-3"><Badge tone={p.status === "success" ? "good" : p.status === "pending" ? "warn" : "bad"}>{p.receipt ?? p.status}</Badge></td>
                    <td className="px-3 py-3 text-ink-500">{fmtDate(p.created_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Subscriptions() {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "subs"], queryFn: () => get<Sub[]>("/admin/subscriptions") });
  return (
    <Card pad={false}>
      {isLoading ? <TableSkeleton /> : (
        <table className="w-full text-sm">
          <thead className="bg-sand-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
            <tr><th className="px-5 py-3">Member</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Renews / ends</th></tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {data?.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3"><div className="font-semibold">{s.member}</div><div className="text-xs text-ink-400">{s.phone}</div></td>
                <td className="px-3 py-3">{s.plan}{s.sponsored && <Badge tone="gold" className="ml-2">Sponsored</Badge>}</td>
                <td className="px-3 py-3">{fmtDate(s.ends_at)} {s.expiring_soon && <Badge tone="warn" className="ml-2">Ending soon</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export default function BillingPage() {
  const [tab, setTab] = useState("plans");
  return (
    <>
      <PageHeader eyebrow="Platform" title="Memberships & payments" subtitle="Plans, prices and benefits are managed here, with no code changes. Payments arrive via M-Pesa."
        actions={<Tabs value={tab} onChange={setTab} tabs={[{ value: "plans", label: "Plans" }, { value: "payments", label: "Payments" }, { value: "subs", label: "Active members" }]} />} />
      {tab === "plans" && <Plans />}
      {tab === "payments" && <Payments />}
      {tab === "subs" && <Subscriptions />}
    </>
  );
}
