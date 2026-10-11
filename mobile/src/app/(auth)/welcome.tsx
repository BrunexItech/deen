import { Image } from "expo-image";
import { router } from "expo-router";
import { BadgeCheck, Fingerprint, Target, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Input, T } from "@/components/ui";
import { apiConfig } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";

const POINTS: [LucideIcon, string, string][] = [
  [BadgeCheck, "Checked by DEEN", "Every organization and opportunity is verified first."],
  [Target, "Matched to you", "See what fits your studies, skills and location."],
  [Fingerprint, "Safe and private", "Locked with your fingerprint. Your data stays protected."],
];

function ServerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(apiConfig.baseUrl);
  const [testing, setTesting] = useState(false);
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <T v="h2">Server address</T>
        <T v="small" style={{ marginBottom: 12 }}>For testing: the DEEN API this app talks to.</T>
        <Input value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Button title="Reset" variant="secondary" size="md" style={{ flex: 1 }} onPress={async () => { await apiConfig.setServer(null); setUrl(apiConfig.defaultUrl); }} />
          <Button title="Save" size="md" style={{ flex: 1 }} loading={testing} onPress={async () => {
            setTesting(true);
            const ok = await apiConfig.ping(url);
            setTesting(false);
            await apiConfig.setServer(url);
            setUrl(apiConfig.baseUrl);
            Alert.alert(ok ? "Connected" : "Saved, but not reachable",
              ok ? `Using ${apiConfig.baseUrl}` : `${apiConfig.baseUrl} did not answer. Check the address and that the phone and server are on the same network.`);
            if (ok) onClose();
          }} />
        </View>
      </View>
    </Modal>
  );
}

export default function Welcome() {
  const [server, setServer] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand900 }}>
      <View style={styles.glow} />
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.brand}>
          <Pressable onLongPress={() => setServer(true)} delayLongPress={900} accessibilityLabel="DEEN">
            <Image source={require("../../../assets/deen-emblem.png")} style={styles.logo} contentFit="contain" />
          </Pressable>
          <View>
            <Text style={styles.wordmark}>DEEN</Text>
            <Text style={styles.expansion}>Development and Education{"\n"}Empowerment Network</Text>
          </View>
        </Animated.View>

        <View style={styles.middle}>
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Text style={styles.headline}>Real opportunities for our community.</Text>
            <Text style={styles.sub}>Scholarships, jobs, attachments, business funding and support. All in one safe app.</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(220).duration(500)} style={{ marginTop: 28, gap: 18 }}>
            {POINTS.map(([Icon, title, body]) => (
              <View key={title} style={styles.point}>
                <View style={styles.pointIcon}><Icon size={20} color={colors.gold400} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pointTitle}>{title}</Text>
                  <Text style={styles.pointBody}>{body}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(320).duration(500)} style={styles.actions}>
          <Button title="Log in" variant="gold" onPress={() => router.push("/sign-in")} />
          <Button title="Create free account" variant="outlineLight" onPress={() => router.push("/sign-up")} style={{ marginTop: 12 }} />
          <Text style={styles.legal}>By continuing you agree to DEEN&apos;s Terms and Privacy Policy.</Text>
        </Animated.View>
      </SafeAreaView>
      {/* Remounted on open, so it always starts from the address in use. */}
      {server && <ServerSheet open onClose={() => setServer(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", width: 460, height: 460, borderRadius: 230, backgroundColor: "rgba(8,125,126,0.35)", top: -180, right: -160 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingTop: 20 },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.white },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 6, color: colors.white },
  expansion: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  middle: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  headline: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: colors.white },
  sub: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: "rgba(255,255,255,0.75)", marginTop: 12 },
  point: { flexDirection: "row", alignItems: "center", gap: 14 },
  pointIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  pointTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  pointBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.65)", marginTop: 1 },
  actions: { paddingHorizontal: 24, paddingBottom: 16 },
  legal: { fontFamily: fonts.regular, fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center", marginTop: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(4,41,43,0.5)" },
  sheet: { backgroundColor: colors.white, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 },
});
