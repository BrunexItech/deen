/** Student & Graduate Hub (spec section 26): Study, Experience, Career, Growth. */
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { BookOpen, Briefcase, GraduationCap, TrendingUp, type LucideIcon } from "lucide-react-native";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Header, T, Tap } from "@/components/ui";
import { get } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";
import type { OppCard } from "@/lib/types";

interface Hub {
  sections: { key: string; label: string; types: { key: string; name: string; count: number }[]; items: OppCard[] }[];
}

const ICONS: Record<string, LucideIcon> = { study: GraduationCap, experience: BookOpen, career: Briefcase, growth: TrendingUp };

export default function StudentHub() {
  const { data, isLoading } = useQuery({ queryKey: ["hub"], queryFn: () => get<Hub>("/opportunities/hub") });
  if (isLoading || !data) return <LoadingScreen label="Opening the hub" />;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Student & Graduate Hub" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <LinearGradient colors={[colors.brand700, colors.brand950]} style={styles.hero}>
            <T v="overline" color={colors.gold400}>Your pathway</T>
            <T v="h2" color={colors.white}>Scholarship → Attachment → Internship → Volunteer → Training → Job</T>
          </LinearGradient>
        </View>
        {data.sections.map((s) => {
          const Icon = ICONS[s.key] ?? GraduationCap;
          return (
            <View key={s.key} style={{ marginTop: 24 }}>
              <View style={styles.head}>
                <View style={styles.icon}><Icon size={18} color={colors.brand700} /></View>
                <T v="h2">{s.label}</T>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.types}>
                {s.types.map((t) => (
                  <Tap key={t.key} onPress={() => router.push({ pathname: "/explore", params: { types: t.key } })} style={styles.type}>
                    <Text style={styles.typeName}>{t.name}</Text>
                    <Text style={styles.typeCount}>{t.count}</Text>
                  </Tap>
                ))}
              </ScrollView>
              {s.items.length > 0 ? (
                <FlatList horizontal data={s.items} keyExtractor={(o) => o.id} renderItem={({ item }) => <OpportunityCard o={item} compact />}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} showsHorizontalScrollIndicator={false} />
              ) : <T v="small" style={{ paddingHorizontal: 20 }}>Nothing open right now. New ones are verified every day.</T>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 22, padding: 20, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, marginBottom: 10 },
  icon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
  types: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  type: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.sand200 },
  typeName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink700 },
  typeCount: { fontFamily: fonts.bold, fontSize: 12, color: colors.gold600 },
});
