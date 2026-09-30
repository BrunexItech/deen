import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import { BookOpen, Calculator, Compass, LocateFixed, Store } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InlineLoader } from "@/components/Loader";
import { ReminderCard } from "@/components/Reminder";
import { Arabic, Card, Section, T, Tap } from "@/components/ui";
import { PRAYERS, toHijri } from "@/lib/faith";
import { useToday } from "@/lib/queries";
import { colors, fonts } from "@/lib/theme";
import { toast } from "@/lib/toast";
import { fmtTime, usePrayer } from "@/lib/usePrayer";

const TOOLS = [
  { title: "Qibla", body: "Find the direction of the Ka'bah", icon: Compass, href: "/qibla" },
  { title: "Zakat", body: "Calculate what you owe", icon: Calculator, href: "/zakat" },
  { title: "Du'as & reminders", body: "Qur'an, hadith and du'a", icon: BookOpen, href: "/reminders" },
  { title: "Halal directory", body: "Muslim businesses & pros", icon: Store, href: "/directory" },
] as const;

export default function Deen() {
  const prayer = usePrayer();
  const today = useToday();
  const now = new Date();
  const h = toHijri(now);
  const friday = now.getDay() === 5;
  const ramadan = h.month === 9;

  async function useGps() {
    const r = await Location.requestForegroundPermissionsAsync();
    toast(r.granted ? "Using your location for prayer times" : "Using your county for prayer times", r.granted ? "success" : "info");
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          <LinearGradient colors={[colors.emerald700, colors.emerald950]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.glow} />
            <T v="overline" color={colors.gold400}>{now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}</T>
            <Text style={styles.hijri}>{h.day} {h.monthName}</Text>
            <T v="body" color={colors.emerald100}>{h.year} AH{ramadan ? " · Ramadan Mubarak" : ""}</T>

            {prayer ? (
              <View style={styles.next}>
                <View>
                  <T v="caption" color={colors.emerald100}>Next prayer</T>
                  <Text style={styles.nextName}>{prayer.next.name}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.nextTime}>{fmtTime(prayer.next.at)}</Text>
                  <T v="caption" color={colors.gold400}>in {prayer.countdown}</T>
                </View>
              </View>
            ) : <InlineLoader />}
          </LinearGradient>
        </View>

        {friday && (
          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
            <Card style={{ backgroundColor: colors.gold50, borderColor: colors.gold100 }}>
              <T v="bodyStrong">Jumu&apos;ah Mubarak</T>
              <T v="small">Read Surah Al-Kahf and send salawat upon the Prophet ﷺ today.</T>
            </Card>
          </View>
        )}

        {prayer && (
          <Section title="Prayer times" action={prayer.coords.source === "county" ? "Use GPS" : undefined} onAction={useGps}>
            <View style={{ paddingHorizontal: 20 }}>
              <Card padded={false}>
                {PRAYERS.map((p, i) => {
                  const at = prayer.today[p.key];
                  const isNext = p.key === prayer.next.key && prayer.next.at.getDate() === now.getDate();
                  const past = at < now && !isNext;
                  return (
                    <View key={p.key} style={[styles.row, i > 0 && styles.rowBorder, isNext && styles.rowNext]}>
                      <View style={[styles.bullet, isNext && { backgroundColor: colors.gold500 }, past && { backgroundColor: colors.sand300 }]} />
                      <Text style={[styles.pName, past && { color: colors.ink400 }, isNext && { color: colors.emerald800 }]}>{p.name}</Text>
                      <Arabic size={16} color={past ? colors.ink300 : colors.emerald700} style={{ flex: 1, lineHeight: 26 }}>{p.arabic}</Arabic>
                      <Text style={[styles.pTime, past && { color: colors.ink400 }, isNext && { color: colors.emerald800 }]}>{fmtTime(at)}</Text>
                    </View>
                  );
                })}
              </Card>
              <View style={styles.src}>
                <LocateFixed size={12} color={colors.ink400} />
                <T v="caption">For {prayer.place} · Muslim World League · Shafi&apos;i Asr</T>
              </View>
            </View>
          </Section>
        )}

        <Section title="Tools">
          <View style={styles.grid}>
            {TOOLS.map(({ title, body, icon: Icon, href }) => (
              <Tap key={title} onPress={() => router.push(href)} style={styles.tool}>
                <View style={styles.toolIcon}><Icon size={22} color={colors.emerald700} /></View>
                <T v="bodyStrong" style={{ marginTop: 12 }}>{title}</T>
                <T v="caption">{body}</T>
              </Tap>
            ))}
          </View>
        </Section>

        {today.data?.reminder && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <ReminderCard r={today.data.reminder} dark />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 22, overflow: "hidden" },
  glow: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(201,163,78,0.15)", top: -130, right: -90 },
  hijri: { fontFamily: fonts.extrabold, fontSize: 34, color: colors.white, marginTop: 6, letterSpacing: -0.5 },
  next: { marginTop: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(223,192,122,0.25)" },
  nextName: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.white },
  nextTime: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.gold400 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.sand200 },
  rowNext: { backgroundColor: colors.emerald50 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald500 },
  pName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink900, width: 74 },
  pTime: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink900, fontVariant: ["tabular-nums"] },
  src: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20 },
  tool: { width: "47.8%", backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.sand200 },
  toolIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.emerald50, alignItems: "center", justifyContent: "center" },
});
