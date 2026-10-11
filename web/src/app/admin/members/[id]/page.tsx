"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Ban, Fingerprint, Gift, Smartphone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageLoader } from "@/components/Loader";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Modal, PageHeader } from "@/components/ui";
import { get, post } from "@/lib/api";
import { useCan } from "@/lib/auth";
import { ago, APP_STATUS, fmtDate, kes } from "@/lib/format";
import { useTaxonomy } from "@/lib/hooks";

interface MemberDetail {
  id: string; full_name: string; phone: string; email: string | null; status: string; identity_status: string;
  created_at: string; last_active_at: string | null;
  profile: { county: string | null; town: string | null; age: number | null; gender: string | null; education_level: string | null; field_of_study: string | null; institution: string | null; profession: string | null; skills: string[]; interests: string[]; languages: string[]; bio: string | null; completeness: number };
  membership: { paid: boolean; ends_at: string | null; sponsored: boolean };
  applications: { id: string; opportunity: string; status: string; created_at: string }[];
  payments: { id: string; plan: string; amount_kes: number; status: string; receipt: string | null; created_at: string }[];
  devices: { device_name: string; platform: string; last_seen_at: string | null; biometric_enabled: boolean }[];
}

export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const qc = useQueryClient();
  const { data: tax } = useTaxonomy();
  const { data: m, isLoading } = useQuery({ queryKey: ["admin", "member", id], queryFn: () => get<MemberDetail>(`/admin/members/${id}`) });
  const [grantOpen, setGrantOpen] = useState(false);
  const [grant, setGrant] = useState({ reason: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "member", id] });

  const suspend = useMutation({
    mutationFn: (suspended: boolean) => post(`/admin/members/${id}/status`, { suspended }),
    onSuccess: () => { toast.success("Updated"); refresh(); },
  });
  const doGrant = useMutation({
    mutationFn: () => post(`/admin/members/${id}/grant`, grant),
    onSuccess: () => { toast.success("Membership granted"); setGrantOpen(false); refresh(); },
  });

  if (isLoading || !m) return <PageLoader label="Loading member" />;
  const p = m.profile;
  const edu = tax?.education_levels.find((e) => e.key === p.education_level)?.name;

  return (
    <>
      <Link href="/admin/members" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft size={15} /> Members</Link>
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={m.full_name} size={60} />
        <PageHeader
          title={<span className="flex items-center gap-2">{m.full_name}{m.identity_status === "verified" && <BadgeCheck className="text-leaf-600" />}</span>}
          subtitle={<span className="flex flex-wrap items-center gap-2">{m.phone} {m.email && `· ${m.email}`} · joined {fmtDate(m.created_at)} {m.status === "suspended" && <Badge tone="bad">Suspended</Badge>}</span>}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Profile" subtitle={`${p.completeness}% complete`} />
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              {[["County", [p.county, p.town].filter(Boolean).join(", ")], ["Age", p.age], ["Gender", p.gender === "female" ? "Sister" : p.gender === "male" ? "Brother" : null], ["Education", edu], ["Field", p.field_of_study], ["Institution", p.institution], ["Profession", p.profession]].map(([l, v]) => (
                <div key={l as string}><div className="text-xs text-ink-400">{l}</div><div className="font-semibold">{(v as string) || "—"}</div></div>
              ))}
            </div>
            {p.bio && <p className="mt-4 text-sm text-ink-700">{p.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">{p.skills.map((s) => <Badge key={s}>{s}</Badge>)}{p.languages.map((s) => <Badge key={s} tone="info">{s}</Badge>)}</div>
          </Card>
          <Card>
            <CardHeader title="Applications" />
            {m.applications.length === 0 ? <p className="text-sm text-ink-400">No applications yet.</p> : (
              <div className="divide-y divide-sand-200">
                {m.applications.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-semibold">{a.opportunity}</span>
                    <span className="flex items-center gap-3 text-ink-400">{fmtDate(a.created_at)}<Badge tone={APP_STATUS[a.status]?.tone}>{APP_STATUS[a.status]?.label}</Badge></span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Payments" />
            {m.payments.length === 0 ? <p className="text-sm text-ink-400">No payments.</p> : (
              <div className="divide-y divide-sand-200 text-sm">
                {m.payments.map((x) => (
                  <div key={x.id} className="flex items-center justify-between py-2.5">
                    <span>{x.plan} <span className="text-ink-400">· {fmtDate(x.created_at)}</span></span>
                    <span className="flex items-center gap-3"><b>{kes(x.amount_kes)}</b><Badge tone={x.status === "success" ? "good" : x.status === "pending" ? "warn" : "bad"}>{x.receipt ?? x.status}</Badge></span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Membership" />
            <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-4 text-white">
              <div className="text-xs uppercase tracking-widest text-gold-400">Community fee</div>
              <div className="text-xl font-bold">{m.membership.paid ? "Paid up" : "Not paid"}</div>
              {m.membership.ends_at && <div className="text-sm text-brand-100/70">Until {fmtDate(m.membership.ends_at)}{m.membership.sponsored && " · paid by someone else"}</div>}
            </div>
            {can("plans.manage") && <Button variant="secondary" className="mt-3 w-full" icon={<Gift size={15} />} onClick={() => setGrantOpen(true)}>Waive one fee period</Button>}
          </Card>
          <Card>
            <CardHeader title="Signed-in devices" />
            {m.devices.length === 0 ? <p className="text-sm text-ink-400">No active sessions.</p> : m.devices.map((d, i) => (
              <div key={i} className="flex items-center gap-3 py-2 text-sm">
                <Smartphone size={16} className="text-ink-400" />
                <div className="flex-1"><div className="font-semibold">{d.device_name}</div><div className="text-xs text-ink-400">Active {ago(d.last_seen_at)}</div></div>
                {d.biometric_enabled && <Badge tone="good"><Fingerprint size={12} /> Biometric</Badge>}
              </div>
            ))}
          </Card>
          {can("users.manage") && (
            <Card>
              <CardHeader title="Account" />
              {m.status === "active" ? (
                <Button variant="danger" className="w-full" icon={<Ban size={15} />} onClick={() => confirm("Suspend this member? They're signed out on every device.") && suspend.mutate(true)}>Suspend account</Button>
              ) : (
                <Button className="w-full" onClick={() => suspend.mutate(false)}>Reactivate account</Button>
              )}
            </Card>
          )}
        </div>
      </div>
      <Modal open={grantOpen} onClose={() => setGrantOpen(false)} title="Waive one fee period"
        footer={<Button loading={doGrant.isPending} disabled={grant.reason.length < 3} onClick={() => doGrant.mutate()}>Waive fee</Button>}>
        <div className="space-y-4">
          <Field label="Reason" hint="Recorded in the audit log."><Input value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} placeholder="e.g. Student in need" /></Field>
        </div>
      </Modal>
    </>
  );
}
