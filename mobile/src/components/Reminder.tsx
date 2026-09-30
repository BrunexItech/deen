import { LinearGradient } from "expo-linear-gradient";
import { Share2 } from "lucide-react-native";
import { Share, StyleSheet, View } from "react-native";
import { colors } from "@/lib/theme";
import type { Reminder } from "@/lib/types";
import { Arabic, T, Tap } from "./ui";

const KIND = { ayah: "Qur'an", hadith: "Hadith", dua: "Du'a" } as const;

export function ReminderCard({ r, dark = false }: { r: Reminder; dark?: boolean }) {
  const share = () => Share.share({ message: `${r.arabic ? r.arabic + "\n\n" : ""}"${r.text}"\n— ${r.reference}\n\nShared from DEEN` });
  const body = (
    <>
      <View style={styles.head}>
        <T v="overline" color={dark ? colors.gold400 : colors.gold600}>Today&apos;s reminder · {KIND[r.kind]}</T>
        <Tap onPress={share} hitSlop={10}><Share2 size={17} color={dark ? colors.emerald100 : colors.ink400} /></Tap>
      </View>
      {r.arabic && <Arabic size={23} color={dark ? colors.gold400 : colors.emerald800} style={{ marginTop: 10 }}>{r.arabic}</Arabic>}
      <T v="body" color={dark ? colors.white : colors.ink700} style={{ marginTop: 6, fontStyle: "italic" }}>&ldquo;{r.text}&rdquo;</T>
      <T v="caption" color={dark ? colors.emerald100 : colors.ink400} style={{ marginTop: 8 }}>{r.reference}</T>
    </>
  );
  return dark ? (
    <LinearGradient colors={[colors.emerald800, colors.emerald950]} style={styles.card}>{body}</LinearGradient>
  ) : (
    <View style={[styles.card, styles.light]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 18, overflow: "hidden" },
  light: { backgroundColor: colors.gold50, borderWidth: 1, borderColor: colors.gold100 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
