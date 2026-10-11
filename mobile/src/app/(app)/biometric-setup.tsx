import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Fingerprint, ScanFace, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, T } from "@/components/ui";
import { authenticate, lockCapability, type LockCapability } from "@/lib/biometrics";
import { registerForPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { toast } from "@/lib/toast";

function Pulse({ children }: { children: React.ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1);
  }, [v]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + v.value * 0.18 }], opacity: 0.5 - v.value * 0.4 }));
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.ring, ring]} />
      <View style={styles.core}>{children}</View>
    </View>
  );
}

export default function BiometricSetup() {
  const setBiometric = useSession((s) => s.setBiometric);
  const [cap, setCap] = useState<LockCapability | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    lockCapability().then(setCap).catch(() => setCap({ hardware: false, enrolled: false, label: "Screen lock", strong: false }));
  }, []);

  const finish = () => {
    registerForPush();
    router.dismissTo("/");
  };

  async function enable() {
    setBusy(true);
    try {
      if (await authenticate("Confirm it's you to turn on the DEEN lock")) {
        await setBiometric(true);
        toast(`${cap?.label ?? "Biometric"} lock is on`);
        finish();
      }
    } finally {
      setBusy(false);
    }
  }

  const Icon = cap?.label.startsWith("Face") ? ScanFace : Fingerprint;
  const usable = cap && (cap.enrolled || cap.hardware);

  return (
    <LinearGradient colors={[colors.brand800, colors.brand950]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.body}>
        <Pulse><Icon size={54} color={colors.gold400} strokeWidth={1.6} /></Pulse>
        <T v="title" color={colors.white} center style={{ marginTop: 36 }}>Protect your account</T>
        <T v="body" color={colors.brand100} center style={{ marginTop: 10 }}>
          Lock DEEN with your {cap?.label.toLowerCase() ?? "fingerprint"}. Only you can open the app, even if someone else has your phone.
        </T>
        <View style={styles.points}>
          {["Required every time you open DEEN", "Your fingerprint never leaves your phone", "Falls back to your phone PIN if needed"].map((p) => (
            <View key={p} style={styles.point}><ShieldCheck size={16} color={colors.gold400} /><T v="small" color={colors.brand100}>{p}</T></View>
          ))}
        </View>
        <View style={{ width: "100%", gap: 10, marginTop: "auto" }}>
          <Button title={usable ? `Turn on ${cap!.label}` : "Set up a screen lock first"} variant="gold" icon={Icon} loading={busy} disabled={!usable} onPress={enable} />
          {!cap?.enrolled && cap && <T v="caption" color={colors.brand100} center>No fingerprint or face saved on this phone. Add one in Settings → Security, or use your PIN.</T>}
          <Button title="Not now" variant="ghost" onPress={finish} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 60, paddingBottom: 20 },
  pulseWrap: { width: 170, height: 170, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 170, height: 170, borderRadius: 85, borderWidth: 2, borderColor: colors.gold400 },
  core: { width: 128, height: 128, borderRadius: 42, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(111,211,206,0.35)", alignItems: "center", justifyContent: "center" },
  points: { marginTop: 28, gap: 12, alignSelf: "stretch" },
  point: { flexDirection: "row", alignItems: "center", gap: 10 },
});
