"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Field, Input } from "@/components/ui";
import { ApiError, post } from "@/lib/api";

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await post<{ dev_code?: string }>("/auth/forgot", { identifier: email });
      setSent(true);
      if (r.dev_code) toast.info(`Development code: ${r.dev_code}`);
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/auth/reset", { identifier: email, code, new_password: password });
      toast.success("Password updated. Sign in with your new password.");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle={sent ? `If ${email} has an account, we've emailed a 6-digit code.` : "We'll email you a one-time code."}>
      {!sent ? (
        <form onSubmit={request} className="space-y-4">
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send code</Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <Field label="Code"><Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" className="tracking-[0.4em]" required autoFocus /></Field>
          <Field label="New password" hint="At least 8 characters, with letters and numbers."><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></Field>
          {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
        </form>
      )}
      <Link href="/login" className="mt-6 block text-center text-sm text-ink-500 hover:text-ink-900">Back to sign in</Link>
    </AuthLayout>
  );
}
