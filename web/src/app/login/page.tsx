"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Field, Input } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import type { Me } from "@/lib/types";

type LoginResult = { user?: Me; mfa_required?: boolean; mfa_setup_required?: boolean; mfa_token?: string };

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const device = { device_id: "web", device_name: typeof navigator !== "undefined" ? browserName() : "Web", platform: "web" };

  function done(user: Me) {
    qc.setQueryData(["me"], user);
    router.replace(user.portal === "admin" ? "/admin" : "/org");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mfaToken) {
        const r = await post<LoginResult>("/auth/mfa", { mfa_token: mfaToken, code });
        if (r.user) done(r.user);
      } else {
        const r = await post<LoginResult>("/auth/login", { identifier, password, device });
        if (r.mfa_required && r.mfa_token) setMfaToken(r.mfa_token);
        else if (r.mfa_setup_required) setError("Your account must use two-step verification. Ask a DEEN administrator to help you set it up.");
        else if (r.user) done(r.user);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={mfaToken ? "Two-step verification" : "Welcome back"}
      subtitle={mfaToken ? "Enter the 6-digit code from your authenticator app." : "Sign in to the DEEN Control Center or your Organization Portal."}
    >
      <form onSubmit={submit} className="space-y-4">
        {mfaToken ? (
          <Field label="Authentication code">
            <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-xl tracking-[0.5em]" placeholder="••••••" />
          </Field>
        ) : (
          <>
            <Field label="Email">
              <Input autoFocus type="email" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@organization.org" required />
            </Field>
            <Field label={<span className="flex justify-between">Password <Link href="/forgot" className="font-medium text-emerald-700 hover:underline">Forgot?</Link></span>}>
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          </>
        )}
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">{error}</div>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {mfaToken ? "Verify" : "Sign in"}
        </Button>
        {mfaToken && (
          <button type="button" onClick={() => { setMfaToken(null); setCode(""); }} className="w-full text-sm text-ink-500 hover:text-ink-900">
            Use a different account
          </button>
        )}
      </form>
      <div className="mt-10 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-[13px] text-emerald-900">
        <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={18} />
        <p>Members sign in with the DEEN mobile app. Organizations are onboarded by DEEN. Use the invitation link we sent you to set up your account.</p>
      </div>
    </AuthLayout>
  );
}

function browserName(): string {
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${b}${os ? ` on ${os}` : ""}`;
}
