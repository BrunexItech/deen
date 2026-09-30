"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { get, patch, post } from "@/lib/api";
import { useCan, useMe } from "@/lib/auth";
import { ago, fmtDate, ROLE_LABEL } from "@/lib/format";

interface StaffRow { id: string; full_name: string; email: string; role: string; status: string; last_active_at: string | null; totp_enabled: boolean }

const STAFF_ROLES: Record<string, string> = {
  super_admin: "Everything, including managing the DEEN team",
  platform_admin: "Everything except managing the DEEN team",
  verification_officer: "Reviews opportunities, organizations, identity checks and reports",
  content_manager: "Publishes, features, taxonomy, reminders and announcements",
  finance_admin: "Plans, prices, payments and revenue analytics",
  support_agent: "Views members, organizations and handles reports",
};

export default function StaffPage() {
  const can = useCan();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "staff"], queryFn: () => get<{ members: StaffRow[]; invites: { id: string; email: string; role: string; expires_at: string }[] }>("/admin/staff") });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", full_name: "", role: "verification_officer" });
  const [link, setLink] = useState<string | null>(null);
  const invite = useMutation({ mutationFn: () => post<{ link: string }>("/admin/staff/invite", f), onSuccess: (r) => { setLink(r.link); qc.invalidateQueries({ queryKey: ["admin", "staff"] }); } });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => patch(`/admin/staff/${id}`, body),
    onSuccess: () => { toast.success("Access updated. They'll sign in again."); qc.invalidateQueries({ queryKey: ["admin", "staff"] }); },
  });

  return (
    <>
      <PageHeader eyebrow="Platform" title="DEEN team" subtitle="Granular roles: everyone gets exactly the access their work needs, and every action is audited."
        actions={can("staff.manage") && <Button icon={<UserPlus size={16} />} onClick={() => { setLink(null); setOpen(true); }}>Invite team member</Button>} />
      <Card pad={false}>
        {isLoading ? <TableSkeleton /> : (
          <div className="divide-y divide-sand-200">
            {data?.members.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={u.full_name} size={38} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">{u.full_name}{u.status === "suspended" && <Badge tone="bad">Suspended</Badge>}{u.totp_enabled ? <Badge tone="good">2FA</Badge> : <Badge tone="warn">No 2FA</Badge>}</div>
                    <div className="text-xs text-ink-400">{u.email} · active {ago(u.last_active_at)}</div>
                  </div>
                </div>
                {can("staff.manage") && u.id !== me?.id ? (
                  <div className="flex gap-2">
                    <Select value={u.role} onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value } })} className="h-9 w-56 text-sm">
                      {Object.keys(STAFF_ROLES).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: u.id, body: { suspended: u.status !== "suspended" } })}>{u.status === "suspended" ? "Restore" : "Suspend"}</Button>
                  </div>
                ) : <Badge tone="gold">{ROLE_LABEL[u.role]}</Badge>}
              </div>
            ))}
            {data?.invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-sand-100 text-ink-400"><Mail size={16} /></div>
                <div className="flex-1"><div className="font-semibold">{i.email}</div><div className="text-xs text-ink-400">{ROLE_LABEL[i.role]} · invitation expires {fmtDate(i.expires_at)}</div></div>
                <Badge tone="warn">Invited</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite to the DEEN team"
        footer={link ? <Button onClick={() => setOpen(false)}>Done</Button> : <Button loading={invite.isPending} disabled={!f.email} onClick={() => invite.mutate()}>Send invitation</Button>}>
        {link ? (
          <div className="flex items-center gap-2 rounded-xl bg-sand-100 p-3">
            <code className="flex-1 truncate text-xs">{link}</code>
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}>Copy</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Full name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink-700">Role</div>
              <div className="space-y-2">
                {Object.entries(STAFF_ROLES).map(([r, desc]) => (
                  <button key={r} type="button" onClick={() => setF({ ...f, role: r })} className={`block w-full rounded-xl border-2 px-4 py-2.5 text-left transition ${f.role === r ? "border-brand-600 bg-brand-50" : "border-sand-200"}`}>
                    <div className="text-sm font-semibold">{ROLE_LABEL[r]}</div>
                    <div className="text-xs text-ink-500">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
