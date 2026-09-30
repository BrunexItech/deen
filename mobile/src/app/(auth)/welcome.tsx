import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { BadgeCheck, Fingerprint, Sparkles } from "lucide-react-native";
import { useRef, useState } from "react";
import { Alert, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Arabic, Button, Input, T } from "@/components/ui";
import { apiConfig } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  { icon: Sparkles, title: "Opportunities, matched to you", body: "Scholarships, jobs, business funding and support: DEEN shows you what fits your profile, and why." },
  { icon: BadgeCheck, title: "Every organization verified", body: "No more scams in WhatsApp groups. DEEN reviews each organization and every opportunity before you see it." },
  { icon: Fingerprint, title: "Secure by design", body: "Your account is locked with your fingerprint or face, and your data is encrypted and protected by Kenyan law." },
];

function ServerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(apiConfig.baseUrl);
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <T v="h2">Server address</T>
        <T v="small" style={{ marginBottom: 12 }}>For testing: the DEEN API this app talks to.</T>
        <Input value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Button title="Reset" variant="secondary" size="md" style={{ flex: 1 }} onPress={async () => { await apiConfig.setServer(null); setUrl(apiConfig.defaultUrl); }} />
          <Button title="Save" size="md" style={{ flex: 1 }} onPress={async () => { await apiConfig.setServer(url.trim()); Alert.alert("Saved", `Using ${url.trim()}`); onClose(); }} />
        </View>
      </View>
    </Modal>
  );
}

export default function Welcome() {
  const [index, setIndex] = useState(0);
  const [server, setServer] = useState(false);
  const list = useRef<FlatList>(null);

  return (
    <LinearGradient colors={[colors.brand800, colors.brand950]} style={{ flex: 1 }}>
      <View style={styles.glow} />
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(700)} style={styles.brand}>
          <Pressable onLongPress={() => setServer(true)} delayLongPress={900}>
            <Image source={require("../../../assets/deen-emblem.png")} style={styles.logo} contentFit="contain" />
          </Pressable>
          <Text style={styles.wordmark}>DEEN</Text>
          <Text style={styles.tagline}>The Muslim Opportunity Platform</Text>
          <Text style={styles.motto}>Discover · Verify · Apply · Grow</Text>
          <Arabic size={20} color={colors.gold400} style={{ textAlign: "center", marginTop: 6 }}>وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ</Arabic>
          <T v="caption" color="rgba(255,255,255,0.5)" center>&ldquo;Cooperate in righteousness and piety&rdquo; · Qur&apos;an 5:2</T>
        </Animated.View>

        <FlatList
          ref={list}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s) => s.title}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => {
            const Icon = item.icon;
            return (
              <View style={{ width, paddingHorizontal: 32, justifyContent: "center" }}>
                <View style={styles.slideIcon}><Icon size={26} color={colors.gold400} /></View>
                <T v="title" color={colors.white} style={{ marginTop: 18 }}>{item.title}</T>
                <T v="body" color="rgba(236,242,252,0.75)" style={{ marginTop: 8 }}>{item.body}</T>
              </View>
            );
          }}
        />

        <View style={styles.dots}>
          {SLIDES.map((s, i) => <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />)}
        </View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.actions}>
          <Button title="Create free account" variant="gold" onPress={() => router.push("/sign-up")} />
          <Button title="I already have an account" variant="ghost" onPress={() => router.push("/sign-in")} style={{ marginTop: 6 }} />
          <Text style={styles.legal}>By continuing you agree to DEEN&apos;s Terms and Privacy Policy.</Text>
        </Animated.View>
      </SafeAreaView>
      <ServerSheet open={server} onClose={() => setServer(false)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", width: 420, height: 420, borderRadius: 210, backgroundColor: "rgba(227,157,41,0.13)", top: -120, alignSelf: "center" },
  brand: { alignItems: "center", paddingTop: 36 },
  logo: { width: 116, height: 116 },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: 10, color: colors.white, marginTop: 14, marginLeft: 10 },
  tagline: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  motto: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2.5, color: colors.gold400, marginTop: 10, textTransform: "uppercase" },
  slideIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(242,190,92,0.3)", alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  dotActive: { width: 22, backgroundColor: colors.gold400 },
  actions: { paddingHorizontal: 24, paddingBottom: 12 },
  legal: { fontFamily: fonts.regular, fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,23,51,0.5)" },
  sheet: { backgroundColor: colors.sand100, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 },
});
