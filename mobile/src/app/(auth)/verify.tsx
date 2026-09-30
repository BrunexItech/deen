import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { Button, T } from "@/components/ui";
import { ApiError, deviceInfo, post, type TokenResponse } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, fonts } from "@/lib/theme";

export default function Verify() {
  const { phone, masked, dev, fresh } = useLocalSearchParams<{ phone: string; masked?: string; dev?: string; fresh?: string }>();
  const signIn = useSession((s) => s.signIn);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState(dev || "");
  const [wait, setWait] = useState(45);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function verify(value = code) {
    if (value.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<TokenResponse>("/auth/verify-phone", { phone, code: value, device: await deviceInfo() });
      await signIn(r, fresh ? "/onboarding" : "/biometric-setup");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't verify");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    const r = await post<{ dev_code?: string }>("/auth/otp/resend", { phone, purpose: "verify_phone" }).catch(() => null);
    if (r?.dev_code) setDevCode(r.dev_code);
    setWait(45);
  }

  return (
    <AuthScaffold title="Verify your number" subtitle={`Enter the 6-digit code we sent to ${masked ?? phone}.`}
      footer={<Button title="Verify" loading={busy} disabled={code.length < 6} onPress={() => verify()} />}>
      <Pressable onPress={() => input.current?.focus()} style={styles.boxes}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.box, i === code.length && styles.boxActive, !!code[i] && styles.boxFilled]}>
            <Text style={styles.digit}>{code[i] ?? ""}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(v) => {
          const c = v.replace(/\D/g, "").slice(0, 6);
          setCode(c);
          if (c.length === 6) verify(c);
        }}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        autoFocus
        style={styles.hidden}
      />
      {error && <T v="small" color={colors.rose600} center>{error}</T>}
      {!!devCode && <T v="caption" center>Development code: {devCode}</T>}
      <Pressable disabled={wait > 0} onPress={resend} style={{ alignSelf: "center" }}>
        <T v="label" color={wait > 0 ? colors.ink400 : colors.brand700}>{wait > 0 ? `Resend code in ${wait}s` : "Resend code"}</T>
      </Pressable>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: "row", gap: 9, justifyContent: "center" },
  box: { width: 48, height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: colors.sand300, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  boxActive: { borderColor: colors.brand600, borderWidth: 2 },
  boxFilled: { borderColor: colors.brand700, backgroundColor: colors.brand50 },
  digit: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.ink900 },
  hidden: { position: "absolute", opacity: 0, height: 1, width: 1 },
});
