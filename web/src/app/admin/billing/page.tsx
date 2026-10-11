"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Stat, Tabs, TagInput, Toggle } from "@/components/ui";
import { get, put, qs } from "@/lib/api";
import { useCan } from "@/lib/auth";
import { fmtDate, kes, num } from "@/lib/format";

interface Fee {
  amount_kes: number; period_months: number; covers: string[]; free_monthly_applications: number | null;
  note: string | null; enabled: boolean; active: boolean; paying_members: number;
}
interface Payment { id: string; member: string; plan: string; amount_kes: number; phone: string; status: string; receipt: string | null; gift: boolean; result: string | null; created_at: string }
interface Sub { id: string; member: string; phone: string; plan: string; ends_at: string; expiring_soon: boolean; sponsored: boolean }

const PERIODS = [[1, "Every month"], [3, "Every 3 months"], [6, "Every 6 months"], [12, "Every year"]] as const;

function FeeSettings() {
  const can = useCan();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "fee"], queryFn: () => get<Fee>("/admin/fee") });
  const [f, setF] = useState<(Fee & { limit: string }) | null>(null);
  const v = f ?? (data ? { ...data, limit: data.free_monthly_applications == null ? "" : String(data.free_monthly_applications) } : null);
  const save = useMutation({
    mutationFn: () => put("/admin/fee", {
      amount_kes: Number(v!.amount_kes), period_months: Number(v!.period_months), covers: v!.covers, note: v!.note || null,
      free_monthly_applications: v!.limit === "" ? null : Number(v!.limit), enabled: v!.enabled,
    }),
    onSuccess: () => { toast.success("Fee saved. The website shows the new amount now."); setF(null); qc.invalidateQueries({ queryKey: ["admin", "fee"] }); },
  });
  if (!v) return <TableSkeleton rows={4} />;
  const edit = can("plans.manage");
  const set = (patch: Partial<typeof v>) => setF({ ...v, ...patch });
  const period = PERIODS.find(([m]) => m === Number(v.period_months))?.[1] ?? `Every ${v.period_months} months`;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Card>
        <div className="mb-5">
          <div className="font-bold">Community maintenance fee</div>
          <p className="text-sm text-ink-500">One fee for every member. It is paid on the DEEN website by M-Pesa, never inside the app.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (KES)" hint="Minimum KES 50" error={v.amount_kes < 50 ? "The fee can't be less than KES 50" : undefined}>
            <Input type="number" min={50} step={10} value={v.amount_kes} disabled={!edit} onChange={(e) => set({ amount_kes: Number(e.target.value) })} />
          </Field>
          <Field label="How often"><Select value={v.period_months} disabled={!edit} onChange={(e) => set({ period_months: Number(e.target.value) })}>{PERIODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</Select></Field>
          <Field label="What the fee pays for" hint="Shown on the website. Up to 8 short lines." className="sm:col-span-2">
            <TagInput value={v.covers} onChange={(c) => edit && set({ covers: c.slice(0, 8) })} placeholder="Type a line, press Enter" />
          </Field>
          <Field label="Note (optional)" hint="For example: students in need can ask DEEN to waive the fee" className="sm:col-span-2">
            <Input value={v.note ?? ""} disabled={!edit} maxLength={200} onChange={(e) => set({ note: e.target.value })} />
          </Field>
          <Field label="Applications through DEEN before paying" hint="Per month. Empty means no limit."><Input type="number" min={0} value={v.limit} disabled={!edit} onChange={(e) => set({ limit: e.target.value })} /></Field>
          <div className="flex items-end pb-2"><Toggle checked={v.enabled} onChange={(on) => edit && set({ enabled: on })} label="Collect the fee" description="Off: nobody pays and nobody is limited" /></div>
        </div>
        {edit && <div className="mt-6 flex justify-end"><Button disabled={!f || v.amount_kes < 50} loading={save.isPending} onClick={() => save.mutate()}>Save fee</Button></div>}
      </Card>
      <div className="space-y-4">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Members see</div>
          <div className="mt-2 text-3xl font-extrabold">{v.enabled && v.amount_kes > 0 ? kes(v.amount_kes) : "No fee"}</div>
          {v.enabled && v.amount_kes > 0 && <div className="text-sm text-ink-500">{period}</div>}
          <ul className="mt-4 space-y-2 text-sm text-ink-700">{v.covers.map((c) => <li key={c} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-leaf-600" />{c}</li>)}</ul>
        </Card>
        <Stat label="Paid-up members" value={num(data?.paying_members ?? 0)} tone="gold" />
      </div>
    </div>
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
                <tr><th className="px-5 py-3">Member</th><th className="px-3 py-3">For</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">M-Pesa</th><th className="px-3 py-3">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data?.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3"><div className="font-semibold">{p.member}</div><div className="text-xs text-ink-400">{p.phone}</div></td>
                    <td className="px-3 py-3">{p.gift ? <Badge tone="gold">Paid for someone</Badge> : "Self"}</td>
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
            <tr><th className="px-5 py-3">Member</th><th className="px-3 py-3">Paid by</th><th className="px-3 py-3">Paid until</th></tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {data?.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3"><div className="font-semibold">{s.member}</div><div className="text-xs text-ink-400">{s.phone}</div></td>
                <td className="px-3 py-3">{s.sponsored ? <Badge tone="gold">Someone else</Badge> : "Self"}</td>
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
  const [tab, setTab] = useState("fee");
  return (
    <>
      <PageHeader eyebrow="Platform" title="Community fee & payments" subtitle="Set the fee here. Members pay on the website by M-Pesa."
        actions={<Tabs value={tab} onChange={setTab} tabs={[{ value: "fee", label: "Fee" }, { value: "payments", label: "Payments" }, { value: "subs", label: "Paid-up members" }]} />} />
      {tab === "fee" && <FeeSettings />}
      {tab === "payments" && <Payments />}
      {tab === "subs" && <Subscriptions />}
    </>
  );
}
