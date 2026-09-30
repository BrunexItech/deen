import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { DeenLoader } from "@/components/Loader";
import { Button, Header, T } from "@/components/ui";
import { distanceToMakkahKm, qiblaBearing } from "@/lib/faith";
import { colors, fonts } from "@/lib/theme";

const SIZE = 300;

function Dial() {
  const c = SIZE / 2;
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <Svg width={SIZE} height={SIZE}>
      <Circle cx={c} cy={c} r={c - 4} fill="rgba(255,255,255,0.04)" stroke="rgba(242,190,92,0.35)" strokeWidth={1.5} />
      {ticks.map((d) => {
        const major = d % 90 === 0;
        const r1 = c - 8, r2 = c - (major ? 26 : d % 30 === 0 ? 20 : 14);
        const a = (d * Math.PI) / 180;
        return <Line key={d} x1={c + r1 * Math.sin(a)} y1={c - r1 * Math.cos(a)} x2={c + r2 * Math.sin(a)} y2={c - r2 * Math.cos(a)}
          stroke={major ? colors.gold400 : "rgba(255,255,255,0.3)"} strokeWidth={major ? 2.5 : 1} />;
      })}
      {[["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([l, d]) => {
        const a = ((d as number) * Math.PI) / 180, r = c - 44;
        return <SvgText key={l as string} x={c + r * Math.sin(a)} y={c - r * Math.cos(a) + 6} fill={l === "N" ? colors.gold400 : "rgba(255,255,255,0.7)"} fontSize={17} fontWeight="700" textAnchor="middle">{l}</SvgText>;
      })}
    </Svg>
  );
}

function Kaaba({ bearing }: { bearing: number }) {
  const c = SIZE / 2;
  return (
    <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
      <G rotation={bearing} origin={`${c}, ${c}`}>
        <Line x1={c} y1={c} x2={c} y2={64} stroke={colors.gold400} strokeWidth={3} strokeLinecap="round" />
        <Path d={`M${c - 15} 60 h30 v26 h-30 z`} fill="#15110A" stroke={colors.gold400} strokeWidth={2} />
        <Line x1={c - 15} y1={67} x2={c + 15} y2={67} stroke={colors.gold400} strokeWidth={2} />
      </G>
      <Circle cx={c} cy={c} r={7} fill={colors.gold400} />
    </Svg>
  );
}

export default function Qibla() {
  const [perm, setPerm] = useState<"unknown" | "granted" | "denied">("unknown");
  const [heading, setHeading] = useState(0);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const aligned = useRef(false);

  async function start() {
    const r = await Location.requestForegroundPermissionsAsync();
    setPerm(r.granted ? "granted" : "denied");
  }

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((r) => setPerm(r.granted ? "granted" : "unknown"));
  }, []);

  useEffect(() => {
    if (perm !== "granted") return;
    let sub: Location.LocationSubscription | null = null;
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude })).catch(() => undefined);
    Location.watchHeadingAsync((h) => setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading)).then((s) => (sub = s));
    return () => sub?.remove();
  }, [perm]);

  const bearing = pos ? qiblaBearing(pos.lat, pos.lng) : 0;
  const diff = ((bearing - heading + 540) % 360) - 180;
  const isAligned = !!pos && Math.abs(diff) < 4;

  useEffect(() => {
    if (isAligned && !aligned.current) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    aligned.current = isAligned;
  }, [isAligned]);

  const rotate = useAnimatedStyle(() => ({ transform: [{ rotate: withSpring(`${-heading}deg`, { damping: 20, stiffness: 90 }) }] }));

  return (
    <LinearGradient colors={[colors.brand800, colors.brand950]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="Qibla" dark />
        {perm !== "granted" ? (
          <View style={styles.center}>
            <T v="h2" color={colors.white} center>Find the direction of the Ka&apos;bah</T>
            <T v="body" color={colors.brand100} center style={{ marginTop: 8, marginBottom: 24 }}>DEEN needs your location once to calculate the Qibla accurately. It isn&apos;t stored.</T>
            <Button title="Allow location" variant="gold" onPress={start} />
            {perm === "denied" && <T v="caption" color={colors.brand100} center style={{ marginTop: 12 }}>Location is off. Enable it in your phone settings.</T>}
          </View>
        ) : !pos ? (
          <View style={styles.center}><DeenLoader size={64} tone="dark" /><T v="small" color={colors.brand100} style={{ marginTop: 14 }}>Finding your location…</T></View>
        ) : (
          <View style={styles.center}>
            <View style={styles.compass}>
              <View style={[styles.glow, isAligned && styles.glowOn]} />
              <View style={styles.pointer} />
              <Animated.View style={[{ width: SIZE, height: SIZE }, rotate]}>
                <Dial />
                <Kaaba bearing={bearing} />
              </Animated.View>
            </View>
            <Text style={[styles.status, isAligned && { color: colors.gold400 }]}>{isAligned ? "You are facing the Qibla" : `Turn ${diff > 0 ? "right" : "left"} ${Math.round(Math.abs(diff))}°`}</Text>
            <T v="small" color={colors.brand100} center>Qibla is {Math.round(bearing)}° from true north · {distanceToMakkahKm(pos.lat, pos.lng).toLocaleString()} km to Makkah</T>
            <T v="caption" color="rgba(255,255,255,0.45)" center style={{ marginTop: 10 }}>Hold your phone flat, away from metal and magnets.</T>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  compass: { width: SIZE + 40, height: SIZE + 40, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: SIZE + 40, height: SIZE + 40, borderRadius: (SIZE + 40) / 2, backgroundColor: "rgba(227,157,41,0.05)" },
  glowOn: { backgroundColor: "rgba(227,157,41,0.22)" },
  // Fixed marker at 12 o'clock: the direction the phone is pointing.
  pointer: { position: "absolute", top: 0, zIndex: 2, width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 16, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.white },
  status: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.white, marginTop: 30, marginBottom: 6 },
});
