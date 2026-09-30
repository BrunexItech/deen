import { router } from "expo-router";
import { Lock, Phone } from "lucide-react-native";
import { useState } from "react";
import { Pressable } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { Button, Input, T } from "@/components/ui";
import { ApiError, deviceInfo, post, type TokenResponse } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

type LoginResult = Partial<TokenResponse> & { verify_required?: boolean; phone?: string; phone_masked?: string; dev_code?: string };

export default function SignIn() {
  const signIn = useSession((s) => s.signIn);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await post<LoginResult>("/auth/login", { identifier: phone, password, device: await deviceInfo() });
      if (r.verify_required) {
        router.push({ pathname: "/verify", params: { phone: r.phone!, masked: r.phone_masked, dev: r.dev_code ?? "" } });
      } else if (r.access_token) {
        await signIn(r as TokenResponse, "/biometric-setup");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Sign in with your phone number."
      footer={<Button title="Sign in" loading={busy} disabled={phone.length < 9 || password.length < 1} onPress={submit} />}
    >
      <Input label="Phone number" icon={Phone} placeholder="07xx xxx xxx" keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} />
      <Input label="Password" icon={Lock} placeholder="Your password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      {error && <T v="small" color={colors.rose600}>{error}</T>}
      <Pressable onPress={() => router.push("/forgot")} hitSlop={10}><T v="label" color={colors.brand700}>Forgot password?</T></Pressable>
    </AuthScaffold>
  );
}
