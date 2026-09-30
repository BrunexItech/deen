"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Laptop, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { del, get, post } from "@/lib/api";
import { useMe, useSignOut } from "@/lib/auth";
import { ago } from "@/lib/format";

interface Session { id: string; device_name: string; platform: string; last_seen_at: string | null; ip: string | null; current: boolean }

function TwoStep() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; qr_svg: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const start = useMutation({ mutationFn: () => post<{ secret: string; qr_svg: string }>("/auth/totp/setup"), onSuccess: setSetup });
  const enable = useMutation({
    mutationFn: () => post("/auth/totp/enable", { code }),
    onSuccess: () => { toast.success("Two-step verification is on"); setSetup(null); setCode(""); qc.invalidateQueries({ queryKey: ["me"] }); },
  });
  const disable = useMutation({
    mutationFn: () => post("/auth/totp/disable", { code, password }),
    onSuccess: () => { toast.success("Two-step verification turned off"); setCode(""); setPassword(""); qc.invalidateQueries({ queryKey: ["me"] }); },
  });

  return (
    <Card>
      <CardHeader title="Two-step verification" subtitle="A code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) at every sign-in."
        action={me?.totp_enabled ? <Badge tone="good"><ShieldCheck size={12} /> On</Badge> : <Badge tone="warn">Off</Badge>} />
      {me?.totp_enabled ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Current code"><Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} /></Field>
          <Button variant="secondary" loading={disable.isPending} disabled={!password || code.length < 6} onClick={() => disable.mutate()}>Turn off</Button>
        </div>
      ) : setup ? (
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div className="rounded-2xl border border-sand-200 bg-white p-2" dangerouslySetInnerHTML={{ __html: setup.qr_svg }} />
          <div className="space-y-3">
            <p className="text-sm text-ink-700">Scan the code with your authenticator app, or enter this key manually:</p>
            <code className="block break-all rounded-lg bg-sand-100 px-3 py-2 text-xs">{setup.secret}</code>
            <Field label="Enter the 6-digit code to confirm"><Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" className="tracking-[0.4em]" /></Field>
            <Button loading={enable.isPending} disabled={code.length < 6} onClick={() => enable.mutate()}>Turn on</Button>
          </div>
        </div>
      ) : (
        <Button icon={<ShieldCheck size={16} />} loading={start.isPending} onClick={() => start.mutate()}>Set up two-step verification</Button>
      )}
    </Card>
  );
}

function Password() {
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const change = useMutation({
    mutationFn: () => post("/auth/change-password", f),
    onSuccess: () => { toast.success("Password changed. Other devices were signed out."); setF({ current_password: "", new_password: "" }); },
  });
  return (
    <Card>
      <CardHeader title="Password" />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Current password"><Input type="password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} autoComplete="current-password" /></Field>
        <Field label="New password"><Input type="password" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} autoComplete="new-password" /></Field>
        <Button variant="secondary" icon={<KeyRound size={15} />} loading={change.isPending} disabled={!f.current_password || f.new_password.length < 8} onClick={() => change.mutate()}>Change</Button>
      </div>
    </Card>
  );
}

function Sessions() {
  const qc = useQueryClient();
  const signOut = useSignOut();
  const { data } = useQuery({ queryKey: ["sessions"], queryFn: () => get<Session[]>("/auth/sessions") });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/auth/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }) });
  const all = useMutation({ mutationFn: () => post("/auth/logout-all"), onSuccess: signOut });
  return (
    <Card>
      <CardHeader title="Where you're signed in" action={<Button size="sm" variant="ghost" icon={<LogOut size={14} />} onClick={() => confirm("Sign out everywhere, including here?") && all.mutate()}>Sign out everywhere</Button>} />
      <div className="divide-y divide-sand-200">
        {data?.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-3">
            <div className="rounded-xl bg-sand-100 p-2.5 text-ink-500">{s.platform === "web" ? <Laptop size={16} /> : <Smartphone size={16} />}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{s.device_name} {s.current && <Badge tone="good" className="ml-1">This device</Badge>}</div>
              <div className="text-xs text-ink-400">Active {ago(s.last_seen_at)}{s.ip && ` · ${s.ip}`}</div>
            </div>
            {!s.current && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>Sign out</Button>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SecurityPanel() {
  return (
    <>
      <PageHeader eyebrow="Account" title="Security" subtitle="Protect your account and the community data it can reach." />
      <div className="max-w-3xl space-y-5">
        <TwoStep />
        <Password />
        <Sessions />
      </div>
    </>
  );
}
