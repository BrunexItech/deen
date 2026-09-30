"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { del, get, post } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { ago, fmtDate, ROLE_LABEL } from "@/lib/format";

interface Team {
  members: { id: string; full_name: string; email: string; role: string; status: string; last_active_at: string | null; totp_enabled: boolean }[];
  invites: { id: string; email: string; role: string; expires_at: string }[];
}

export default function OrgTeam() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const isAdmin = me?.role === "org_admin";
  const { data, isLoading } = useQuery({ queryKey: ["org", "team"], queryFn: () => get<Team>("/org/team") });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", full_name: "", role: "org_staff" });
  const [link, setLink] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["org", "team"] });
  const invite = useMutation({ mutationFn: () => post<{ link: string }>("/org/team/invite", f), onSuccess: (r) => { setLink(r.link); refresh(); } });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/org/team/invites/${id}`), onSuccess: refresh });
  const deactivate = useMutation({ mutationFn: (id: string) => post(`/org/team/${id}/deactivate`), onSuccess: () => { toast.success("Access removed"); refresh(); } });

  return (
    <>
      <PageHeader title="Team" subtitle="People from your organization who can manage opportunities and applications."
        actions={isAdmin && <Button icon={<UserPlus size={16} />} onClick={() => { setLink(null); setOpen(true); }}>Invite colleague</Button>} />
      <Card pad={false}>
        {isLoading ? <TableSkeleton rows={3} /> : (
          <div className="divide-y divide-sand-200">
            {data?.members.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={u.full_name} size={38} />
                <div className="flex-1"><div className="font-semibold">{u.full_name}{u.id === me?.id && <span className="text-ink-400"> (you)</span>}</div><div className="text-xs text-ink-400">{u.email} · active {ago(u.last_active_at)}</div></div>
                {u.status === "suspended" ? <Badge tone="bad">Removed</Badge> : <Badge>{ROLE_LABEL[u.role]}</Badge>}
                {isAdmin && u.id !== me?.id && u.status === "active" && <Button size="sm" variant="ghost" onClick={() => confirm(`Remove ${u.full_name}'s access?`) && deactivate.mutate(u.id)}>Remove</Button>}
              </div>
            ))}
            {data?.invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-sand-100 text-ink-400"><Mail size={16} /></div>
                <div className="flex-1"><div className="font-semibold">{i.email}</div><div className="text-xs text-ink-400">Invited as {ROLE_LABEL[i.role]} · expires {fmtDate(i.expires_at)}</div></div>
                {isAdmin && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>Cancel invite</Button>}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite a colleague"
        footer={link ? <Button onClick={() => setOpen(false)}>Done</Button> : <Button loading={invite.isPending} disabled={!f.email} onClick={() => invite.mutate()}>Send invitation</Button>}>
        {link ? (
          <div className="flex items-center gap-2 rounded-xl bg-sand-100 p-3">
            <code className="flex-1 truncate text-xs">{link}</code>
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}>Copy</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Full name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
            <Field label="Work email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="org_staff">Staff: manage opportunities & applications</option><option value="org_admin">Admin: also manage team & profile</option></Select></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
