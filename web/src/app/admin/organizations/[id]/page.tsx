"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CheckCircle2, Copy, Globe, Mail, MapPin, Phone, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageLoader } from "@/components/Loader";
import { StatusBadge } from "@/components/OpportunityView";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Modal, PageHeader, Select, Stat } from "@/components/ui";
import { get, post } from "@/lib/api";
import { useCan } from "@/lib/auth";
import { ago, fmtDate, num, ROLE_LABEL, titleCase, VERIFICATION } from "@/lib/format";
import type { AdminOrg, OppStatus, Verification } from "@/lib/types";

type Detail = Omit<AdminOrg, "team" | "opportunities"> & {
  description: string | null; phone: string | null; address: string | null; registration_number: string | null;
  applications: number;
  invites: { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }[];
  team: { id: string; full_name: string; email: string; role: string; status: string; last_active_at: string | null; totp_enabled: boolean }[];
  opportunities: { id: string; title: string; status: OppStatus; category: string; deadline: string | null; views: number; applications: number; risk_score: number }[];
};

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const qc = useQueryClient();
  const { data: o, isLoading } = useQuery({ queryKey: ["admin", "org", id], queryFn: () => get<Detail>(`/admin/organizations/${id}`) });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inv, setInv] = useState({ email: "", full_name: "", role: "org_admin" });
  const [link, setLink] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "org", id] }); qc.invalidateQueries({ queryKey: ["admin", "orgs"] }); };

  const verify = useMutation({
    mutationFn: (verification: Verification) => post(`/admin/organizations/${id}/verification`, { verification }),
    onSuccess: () => { toast.success("Verification updated"); refresh(); },
  });
  const status = useMutation({
    mutationFn: (s: string) => post(`/admin/organizations/${id}/status`, { status: s }),
    onSuccess: () => { toast.success("Status updated"); refresh(); },
  });
  const invite = useMutation({
    mutationFn: () => post<{ link: string; email_sent: boolean }>(`/admin/organizations/${id}/invites`, { ...inv, full_name: inv.full_name || null }),
    onSuccess: (r) => { setLink(r.link); refresh(); },
  });

  if (isLoading || !o) return <PageLoader label="Loading organization" />;
  const v = VERIFICATION[o.verification];

  return (
    <>
      <Link href="/admin/organizations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft size={15} /> Organizations</Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={o.name} src={o.logo_url} size={64} />
        <div className="flex-1">
          <PageHeader title={o.name} subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={v.tone}>{v.label}</Badge> {titleCase(o.type)} {o.status === "suspended" && <Badge tone="bad">Suspended</Badge>}</span>} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Opportunities" value={num(o.opportunities.length)} />
            <Stat label="Applications received" value={num(o.applications)} />
            <Stat label="Team" value={num(o.team.length)} />
          </div>
          <Card pad={false}>
            <div className="p-5 pb-3"><CardHeader title="Opportunities" /></div>
            <div className="divide-y divide-sand-200">
              {o.opportunities.length === 0 && <p className="px-5 pb-5 text-sm text-ink-400">No opportunities submitted yet.</p>}
              {o.opportunities.map((x) => (
                <Link key={x.id} href={`/admin/opportunities/${x.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40">
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{x.title}</div><div className="text-xs text-ink-400">Deadline {fmtDate(x.deadline)} · {num(x.views)} views · {num(x.applications)} apps</div></div>
                  <StatusBadge status={x.status} />
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Team" action={can("orgs.manage") && <Button size="sm" variant="secondary" icon={<UserPlus size={14} />} onClick={() => { setLink(null); setInviteOpen(true); }}>Invite</Button>} />
            <div className="divide-y divide-sand-200">
              {o.team.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={u.full_name} size={34} />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{u.full_name}</div><div className="truncate text-xs text-ink-400">{u.email} · active {ago(u.last_active_at)}</div></div>
                  {u.totp_enabled && <Badge tone="good">2FA</Badge>}
                  <Badge>{ROLE_LABEL[u.role]}</Badge>
                </div>
              ))}
              {o.invites.filter((i) => !i.accepted_at && !i.revoked_at).map((i) => (
                <div key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-sand-100 text-ink-400"><Mail size={15} /></div>
                  <div className="flex-1"><div className="font-semibold">{i.email}</div><div className="text-xs text-ink-400">Invited · expires {fmtDate(i.expires_at)}</div></div>
                  <Badge tone="warn">Pending</Badge>
                </div>
              ))}
              {o.team.length === 0 && o.invites.length === 0 && <p className="text-sm text-ink-400">No representatives yet. Invite one to give them portal access.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {can("orgs.verify") && (
            <Card>
              <CardHeader title="Verification" subtitle="Shown to every member on this organization's opportunities." />
              <div className="grid gap-2">
                {(["pending", "verified", "trusted"] as Verification[]).map((lvl) => (
                  <button key={lvl} disabled={verify.isPending} onClick={() => verify.mutate(lvl)}
                    className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition ${o.verification === lvl ? "border-brand-600 bg-brand-50" : "border-sand-200 hover:border-sand-300"}`}>
                    <span>{VERIFICATION[lvl].label}<span className="block text-xs font-normal text-ink-500">{lvl === "pending" ? "Can draft; can't be published" : lvl === "verified" ? "Documents checked by DEEN" : "Long-standing partner with a strong record"}</span></span>
                    {o.verification === lvl && <CheckCircle2 size={18} className="text-brand-700" />}
                  </button>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-2.5 text-sm">
              {o.county && <div className="flex items-center gap-2"><MapPin size={15} className="text-ink-400" />{o.county}{o.address && `, ${o.address}`}</div>}
              {o.website && <a href={o.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-brand-700"><Globe size={15} />{o.website}</a>}
              {o.email && <div className="flex items-center gap-2"><Mail size={15} className="text-ink-400" />{o.email}</div>}
              {o.phone && <div className="flex items-center gap-2"><Phone size={15} className="text-ink-400" />{o.phone}</div>}
              {o.registration_number && <div className="text-ink-500">Reg. no. <b className="text-ink-900">{o.registration_number}</b></div>}
            </dl>
            {o.description && <p className="mt-4 whitespace-pre-line text-sm text-ink-700">{o.description}</p>}
          </Card>
          {can("orgs.manage") && (
            <Card>
              <CardHeader title="Account status" />
              {o.status === "active" ? (
                <Button variant="danger" className="w-full" icon={<Ban size={15} />} loading={status.isPending} onClick={() => confirm(`Suspend ${o.name}? Their team is signed out immediately.`) && status.mutate("suspended")}>Suspend organization</Button>
              ) : (
                <Button className="w-full" loading={status.isPending} onClick={() => status.mutate("active")}>Reactivate</Button>
              )}
            </Card>
          )}
        </div>
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={`Invite to ${o.name}`}
        footer={link ? <Button onClick={() => setInviteOpen(false)}>Done</Button> : <Button loading={invite.isPending} disabled={!inv.email} onClick={() => invite.mutate()}>Send invitation</Button>}>
        {link ? (
          <div className="flex items-center gap-2 rounded-xl bg-sand-100 p-3">
            <code className="flex-1 truncate text-xs">{link}</code>
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}>Copy</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Full name"><Input value={inv.full_name} onChange={(e) => setInv({ ...inv, full_name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></Field>
            <Field label="Role"><Select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })}><option value="org_admin">Organization Admin</option><option value="org_staff">Organization Staff</option></Select></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
