import { router } from "expo-router";
import { Check, Lock, Mail, Phone, User } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { Button, Input, T } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { colors } from "@/lib/theme";

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/\d/.test(p) && /[A-Za-z]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export default function SignUp() {
  const [f, setF] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = strength(f.password);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ phone: string; phone_masked: string; dev_code?: string }>("/auth/register", {
        ...f, email: f.email.trim() || null, full_name: f.full_name.trim(), consent,
      });
      router.push({ pathname: "/verify", params: { phone: r.phone, masked: r.phone_masked, dev: r.dev_code ?? "", fresh: "1" } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create your account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScaffold
      title="Join DEEN"
      subtitle="Free to join. Opportunities matched to you, from organizations DEEN has verified."
      footer={<Button title="Continue" loading={busy} disabled={!consent || f.full_name.length < 3 || f.phone.length < 9 || s < 2} onPress={submit} />}
    >
      <Input label="Full name" icon={User} placeholder="As on your ID" autoComplete="name" value={f.full_name} onChangeText={(v) => setF({ ...f, full_name: v })} />
      <Input label="Phone number" icon={Phone} placeholder="07xx xxx xxx" keyboardType="phone-pad" autoComplete="tel" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} hint="We'll send a code to verify it's you." />
      <Input label="Email (optional)" icon={Mail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} />
      <View>
        <Input label="Password" icon={Lock} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} />
        <View style={styles.meter}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i < s ? (s < 2 ? colors.rose600 : s < 3 ? colors.gold500 : colors.brand500) : colors.sand300 }]} />
          ))}
        </View>
        <T v="caption">{f.password ? ["Too weak", "Weak", "Good", "Strong", "Excellent"][s] : "Use letters and numbers"}</T>
      </View>
      <Pressable onPress={() => setConsent(!consent)} style={styles.consent}>
        <View style={[styles.box, consent && styles.boxOn]}>{consent && <Check size={14} color={colors.white} strokeWidth={3} />}</View>
        <T v="small" style={{ flex: 1 }}>
          I agree to the Terms and Privacy Policy, and consent to DEEN processing my profile, including that I am Muslim, to match me with opportunities (Data Protection Act, 2019).
        </T>
      </Pressable>
      {error && <T v="small" color={colors.rose600}>{error}</T>}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: "row", gap: 5, marginTop: 10, marginBottom: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  consent: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 4 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.sand300, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
});
