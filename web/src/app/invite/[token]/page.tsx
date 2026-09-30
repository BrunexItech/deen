"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { PageLoader } from "@/components/Loader";
import { Badge, Button, Field, Input } from "@/components/ui";
import { ApiError, get, post } from "@/lib/api";
import { ROLE_LABEL, VERIFICATION } from "@/lib/format";
import type { Me, Verification } from "@/lib/types";

interface Preview {
  email: string;
  full_name: string | null;
  role: string;
  organization: { name: string; verification: Verification } | null;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invite = useQuery({ queryKey: ["invite", token], queryFn: () => get<Preview>(`/auth/invites/${token}`), retry: false });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (invite.isLoading) return <PageLoader label="Checking your invitation" />;
  if (invite.isError || !invite.data)
    return (
      <AuthLayout title="Invitation not valid" subtitle="This link has already been used or has expired. Ask whoever invited you for a new one.">
        <Button variant="secondary" onClick={() => router.push("/login")}>Go to sign in</Button>
      </AuthLayout>
    );

  const inv = invite.data;
  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ user: Me }>(`/auth/invites/${token}/accept`, { full_name: name || inv.full_name, password, phone: phone || null });
      qc.setQueryData(["me"], r.user);
      router.replace(r.user.portal === "admin" ? "/admin" : "/org");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={inv.organization ? `Join ${inv.organization.name}` : "Join the DEEN team"}
      subtitle={<>You&apos;re invited as <b>{ROLE_LABEL[inv.role]}</b>. Create your account to continue.</>}
    >
      {inv.organization && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-sand-200 bg-white p-4">
          <div>
            <div className="text-sm font-bold">{inv.organization.name}</div>
            <div className="text-xs text-ink-500">{inv.email}</div>
          </div>
          <Badge tone={VERIFICATION[inv.organization.verification].tone}>{VERIFICATION[inv.organization.verification].label}</Badge>
        </div>
      )}
      <form onSubmit={accept} className="space-y-4">
        <Field label="Full name">
          <Input value={name || inv.full_name || ""} onChange={(e) => setName(e.target.value)} required minLength={3} autoComplete="name" />
        </Field>
        <Field label="Phone (optional)" hint="Used for security alerts only.">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Password" hint="At least 8 characters, with letters and numbers.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="Confirm password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
        </Field>
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
    </AuthLayout>
  );
}
