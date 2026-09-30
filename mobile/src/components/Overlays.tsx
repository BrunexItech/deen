import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle2, Fingerprint, Info, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authenticate, lockCapability } from "@/lib/biometrics";
import { hijriLabel } from "@/lib/faith";
import { useSession } from "@/lib/session";
import { colors, fonts } from "@/lib/theme";
import { useToast } from "@/lib/toast";
import { DeenLoader } from "./Loader";
import { Arabic, Button, T } from "./ui";

export function ToastHost() {
  const { message, kind, id, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, kind === "error" ? 4200 : 2800);
    return () => clearTimeout(t);
  }, [message, id, kind, hide]);
  if (!message) return null;
  const Icon = kind === "error" ? XCircle : kind === "success" ? CheckCircle2 : Info;
  const tint = kind === "error" ? "#FDA4AF" : colors.gold400;
  return (
    <Animated.View key={id} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp} style={[styles.toast, { top: insets.top + 8 }]} pointerEvents="none">
      <Icon size={18} color={tint} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

/** Returning to the app after this long in the background requires biometrics again. */
const RELOCK_AFTER_MS = 30_000;

/** Full-screen lock: shown on launch with a saved session and after time away. */
export function AppLock() {
  const { locked, biometric, status, unlock, lock, signOut, user } = useSession();
  const [label, setLabel] = useState("Fingerprint");
  const [busy, setBusy] = useState(false);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    lockCapability().then((c) => setLabel(c.label)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") leftAt.current = Date.now();
      if (s === "active" && leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS) lock();
      if (s === "active") leftAt.current = null;
    });
    return () => sub.remove();
  }, [lock]);

  const tryUnlock = useCallback(async () => {
    setBusy(true);
    try {
      if (await authenticate("Unlock DEEN")) unlock();
    } finally {
      setBusy(false);
    }
  }, [unlock]);

  useEffect(() => {
    if (locked) tryUnlock();
  }, [locked, tryUnlock]);

  if (!locked || !biometric || status !== "ready") return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.emerald800, colors.emerald950]} style={styles.lock}>
        <DeenLoader size={86} tone="dark" />
        <Text style={styles.brand}>DEEN</Text>
        <Arabic size={22} color={colors.gold400} style={{ textAlign: "center", marginTop: 18 }}>بِسْمِ ٱللَّٰهِ</Arabic>
        <T v="body" color={colors.emerald100} center style={{ marginTop: 4 }}>
          Assalamu alaikum{user ? `, ${user.full_name.split(" ")[0]}` : ""}
        </T>
        <T v="caption" color="rgba(255,255,255,0.45)" center>{hijriLabel()}</T>
        <View style={{ width: "100%", marginTop: 48, gap: 12 }}>
          <Button title={`Unlock with ${label}`} icon={Fingerprint} variant="gold" loading={busy} onPress={tryUnlock} />
          <Button title="Sign in with password instead" variant="ghost" onPress={() => signOut(false)} style={{ opacity: 0.9 }} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: "absolute", left: 16, right: 16, zIndex: 100, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.emerald950, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 },
  toastText: { flex: 1, color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
  lock: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  brand: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: 9, color: colors.white, marginTop: 22 },
});
