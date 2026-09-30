/** The DEEN loader: the official emblem breathes at the centre while two arcs in the
 * logo's colours orbit it: gold and green on the inside, royal blue on the outside.
 * Everything runs on the UI thread (Reanimated), so it stays smooth while the JS
 * thread is busy fetching and parsing data. */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { colors, fonts } from "@/lib/theme";

const EMBLEM = require("../../assets/deen-emblem.png");

export function DeenLoader({ size = 64, tone = "light" }: { size?: number; tone?: "light" | "dark" }) {
  const fast = useSharedValue(0);
  const slow = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    fast.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.bezier(0.5, 0.15, 0.5, 0.85) }), -1, false);
    slow.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, false);
  }, [fast, slow, breathe]);

  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${fast.value * 360}deg` }] }));
  const outer = useAnimatedStyle(() => ({ transform: [{ rotate: `${-slow.value * 360}deg` }] }));
  const emblem = useAnimatedStyle(() => ({ opacity: 0.9 + breathe.value * 0.1, transform: [{ scale: 0.92 + breathe.value * 0.08 }] }));

  const s = size;
  const layer: ViewStyle = { position: "absolute", width: s, height: s };
  const track = tone === "dark" ? "rgba(255,255,255,0.14)" : "rgba(0,68,133,0.12)";
  const blue = tone === "dark" ? colors.brand400 : colors.brand700;
  // Circumferences for r=46 (outer) and r=38 (inner) in a 100-unit viewBox.
  return (
    <View style={{ width: s, height: s }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[layer, outer]}>
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={46} fill="none" stroke={track} strokeWidth={4} />
          <Circle cx={50} cy={50} r={46} fill="none" stroke={blue} strokeWidth={4} strokeLinecap="round" strokeDasharray="70 219" />
        </Svg>
      </Animated.View>
      <Animated.View style={[layer, inner]}>
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={38} fill="none" stroke={colors.gold500} strokeWidth={4.5} strokeLinecap="round" strokeDasharray="52 187" />
          <Circle cx={50} cy={50} r={38} fill="none" stroke={colors.leaf500} strokeWidth={4.5} strokeLinecap="round" strokeDasharray="26 213" strokeDashoffset={-119} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: s * 0.22, top: s * 0.22, width: s * 0.56, height: s * 0.56 }, emblem]}>
        <Image source={EMBLEM} style={{ width: "100%", height: "100%" }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const MESSAGES = ["Bismillah…", "Finding opportunities for you", "Checking what's new", "Almost there"];

/** Centred loader for whole screens, with gently rotating status lines. */
export function LoadingScreen({ label, dark = false }: { label?: string; dark?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (label) return;
    const t = setInterval(() => setI((x) => (x + 1) % MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, [label]);
  return (
    <View style={[styles.center, { backgroundColor: dark ? colors.brand900 : colors.sand100 }]}>
      <DeenLoader size={84} tone={dark ? "dark" : "light"} />
      <Text style={[styles.label, { color: dark ? colors.brand100 : colors.ink400 }]}>{label ?? MESSAGES[i]}</Text>
    </View>
  );
}

/** Inline loader for sections and lists. */
export function InlineLoader({ label }: { label?: string }) {
  return (
    <View style={styles.inline}>
      <DeenLoader size={48} />
      {label ? <Text style={styles.inlineLabel}>{label}</Text> : null}
    </View>
  );
}

/** Shimmering placeholder block. */
export function Skeleton({ width = "100%", height = 14, radius = 10, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
  }, [x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -200 + x.value * 500 }] }));
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: colors.sand200, overflow: "hidden" }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { width: 200 }, sweep]}>
        <LinearGradient colors={["transparent", "rgba(255,255,255,0.6)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Skeleton width={42} height={42} radius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="45%" height={11} />
          <Skeleton width="80%" height={15} />
        </View>
      </View>
      <Skeleton height={11} style={{ marginTop: 16 }} />
      <Skeleton width="65%" height={11} style={{ marginTop: 8 }} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Skeleton width={90} height={24} radius={12} />
        <Skeleton width={70} height={24} radius={12} />
      </View>
    </View>
  );
}

export function FeedSkeleton() {
  return (
    <View style={{ gap: 14, padding: 20 }}>
      <View style={{ alignItems: "center", paddingVertical: 8 }}><DeenLoader size={56} /></View>
      <Skeleton height={150} radius={24} />
      <CardSkeleton />
      <CardSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 },
  label: { fontFamily: fonts.medium, fontSize: 14, letterSpacing: 0.3 },
  inline: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 12 },
  inlineLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink400 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.sand200 },
});
