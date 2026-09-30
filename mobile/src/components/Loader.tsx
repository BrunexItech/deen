/** The DEEN loader, the app's signature motion: the khatam's two squares
 * counter-rotate while a trace of gold light runs around the star and the light at
 * the centre (the open door) breathes. Everything runs on the UI thread (Reanimated),
 * so it stays smooth even while the JS thread is busy fetching and parsing data. */
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient as SvgGradient, RadialGradient, Rect, Circle, Stop } from "react-native-svg";
import { colors, fonts } from "@/lib/theme";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const EASE = Easing.bezier(0.6, 0.1, 0.4, 0.9);

export function DeenLoader({ size = 64, tone = "light" }: { size?: number; tone?: "light" | "dark" }) {
  const spin = useSharedValue(0);
  const trace = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 2400, easing: EASE }), -1, false);
    trace.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 800 })), -1, false);
  }, [spin, trace, breathe]);

  const squareA = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 90}deg` }] }));
  const squareB = useAnimatedStyle(() => ({ transform: [{ rotate: `${45 - spin.value * 90}deg` }] }));
  const light = useAnimatedStyle(() => ({ opacity: 0.55 + breathe.value * 0.45, transform: [{ scale: 0.82 + breathe.value * 0.26 }] }));
  const traceProps = useAnimatedProps(() => ({ strokeDashoffset: -trace.value * 208 }));

  const frame = tone === "dark" ? colors.emerald400 : colors.emerald700;
  const s = size;
  const layer: ViewStyle = { position: "absolute", width: s, height: s };

  return (
    <View style={{ width: s, height: s }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[layer, squareA]}>
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Rect x={24} y={24} width={52} height={52} rx={5} fill="none" stroke={frame} strokeWidth={5} strokeOpacity={0.9} />
        </Svg>
      </Animated.View>
      <Animated.View style={[layer, squareB]}>
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Defs>
            <SvgGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F1D78A" />
              <Stop offset="1" stopColor="#B7862C" />
            </SvgGradient>
          </Defs>
          <Rect x={24} y={24} width={52} height={52} rx={5} fill="none" stroke="url(#g)" strokeWidth={5} />
          <AnimatedRect animatedProps={traceProps} x={24} y={24} width={52} height={52} rx={5} fill="none"
            stroke="#FFF6D6" strokeWidth={5} strokeLinecap="round" strokeDasharray="44 164" />
        </Svg>
      </Animated.View>
      <Animated.View style={[layer, light]}>
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="l" cx="50" cy="50" r="16" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFF3C9" stopOpacity={1} />
              <Stop offset="1" stopColor="#E2B654" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={16} fill="url(#l)" />
          <Circle cx={50} cy={50} r={4.5} fill="#E2B654" />
        </Svg>
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
    <View style={[styles.center, { backgroundColor: dark ? colors.emerald900 : colors.sand100 }]}>
      <DeenLoader size={72} tone={dark ? "dark" : "light"} />
      <Text style={[styles.label, { color: dark ? colors.emerald100 : colors.ink400 }]}>{label ?? MESSAGES[i]}</Text>
    </View>
  );
}

/** Inline loader for sections and lists. */
export function InlineLoader({ label }: { label?: string }) {
  return (
    <View style={styles.inline}>
      <DeenLoader size={44} />
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
