import { router } from "expo-router";
import { Hash, Lock, Phone } from "lucide-react-native";
import { useState } from "react";
import { AuthScaffold } from "@/components/AuthScaffold";
import { Button, Input, T } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { colors } from "@/lib/theme";
import { toast } from "@/lib/toast";

export default function Forgot() {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [dev, setDev] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const r = await post<{ dev_code?: string }>("/auth/forgot", { identifier: phone });
      setDev(r.dev_code ?? "");
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await post("/auth/reset", { identifier: phone, code, new_password: password });
      toast("Password updated. Log in with your new password.");
      router.replace("/sign-in");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reset password");
    } finally {
      setBusy(false);
    }
  }

  return sent ? (
    <AuthScaffold title="Choose a new password" subtitle="Enter the code we sent by SMS."
      footer={<Button title="Update password" loading={busy} disabled={code.length < 6 || password.length < 8} onPress={reset} />}>
      <Input label="Code" icon={Hash} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} autoComplete="sms-otp" />
      <Input label="New password" icon={Lock} secureTextEntry value={password} onChangeText={setPassword} hint="At least 8 characters, letters and numbers" />
      {!!dev && <T v="caption">Development code: {dev}</T>}
      {error && <T v="small" color={colors.rose600}>{error}</T>}
    </AuthScaffold>
  ) : (
    <AuthScaffold title="Forgot password?" subtitle="We'll text you a code to reset it."
      footer={<Button title="Send code" loading={busy} disabled={phone.length < 9} onPress={send} />}>
      <Input label="Phone number" icon={Phone} keyboardType="phone-pad" placeholder="07xx xxx xxx" value={phone} onChangeText={setPhone} />
    </AuthScaffold>
  );
}
