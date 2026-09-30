import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bookmark, ExternalLink, FileStack } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardSkeleton } from "@/components/Loader";
import { OpportunityCard, OrgLogo } from "@/components/OpportunityCard";
import { Empty, Segmented, T, Tap } from "@/components/ui";
import { get } from "@/lib/api";
import { keys } from "@/lib/queries";
import { APP_STATUS, PIPELINE } from "@/lib/status";
import { colors, fonts, shadow } from "@/lib/theme";
import type { Application, OppCard } from "@/lib/types";

function Progress({ status }: { status: string }) {
  const s = APP_STATUS[status] ?? APP_STATUS.submitted;
  return (
    <View style={styles.progress}>
      {PIPELINE.map((label, i) => (
        <View key={label} style={{ flex: 1 }}>
          <View style={[styles.seg, i < s.step && { backgroundColor: status === "rejected" && i === 3 ? colors.ink300 : colors.brand500 }]} />
        </View>
      ))}
    </View>
  );
}

function AppRow({ a }: { a: Application }) {
  const s = APP_STATUS[a.status] ?? APP_STATUS.submitted;
  return (
    <Tap onPress={() => router.push(`/application/${a.id}`)} style={styles.card} scale={0.985}>
      <View style={styles.row}>
        <OrgLogo org={a.opportunity.organization} size={40} />
        <View style={{ flex: 1 }}>
          <T v="caption" numberOfLines={1}>{a.opportunity.organization.name}</T>
          <T v="h3" numberOfLines={2}>{a.opportunity.title}</T>
        </View>
        <View style={[styles.status, { backgroundColor: s.bg }]}><Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text></View>
      </View>
      <Progress status={a.status} />
      <View style={styles.meta}>
        <T v="caption">Applied {new Date(a.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</T>
        {a.external && <View style={styles.ext}><ExternalLink size={11} color={colors.ink400} /><T v="caption">On their website</T></View>}
      </View>
    </Tap>
  );
}

export default function Tracker() {
  const [tab, setTab] = useState<"applications" | "saved">("applications");
  const apps = useQuery({ queryKey: keys.applications, queryFn: () => get<Application[]>("/applications") });
  const saved = useQuery({ queryKey: keys.saved, queryFn: () => get<OppCard[]>("/opportunities/saved"), enabled: tab === "saved" });
  const active = (apps.data ?? []).filter((a) => !["accepted", "rejected", "withdrawn"].includes(a.status)).length;
  const q = tab === "applications" ? apps : saved;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 14 }}>
        <T v="title">Tracker</T>
        {tab === "applications" && apps.data && apps.data.length > 0 && (
          <View style={styles.stats}>
            {[["Active", active], ["Total", apps.data.length], ["Accepted", apps.data.filter((a) => a.status === "accepted").length]].map(([l, n]) => (
              <View key={l as string} style={styles.stat}><Text style={styles.statN}>{n}</Text><T v="caption">{l as string}</T></View>
            ))}
          </View>
        )}
        <Segmented value={tab} onChange={setTab} options={[{ value: "applications", label: "Applications" }, { value: "saved", label: "Saved" }]} />
      </View>
      {tab === "applications" ? (
        <FlatList
          data={apps.data ?? []}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <AppRow a={item} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 130, gap: 12 }}
          ListEmptyComponent={apps.isLoading ? <View style={{ gap: 12 }}><CardSkeleton /><CardSkeleton /></View>
            : <Empty icon={FileStack} title="No applications yet" body="When you apply, you can follow every step here, from sent to accepted." action="Find opportunities" onAction={() => router.push("/explore")} />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} colors={[colors.brand700]} tintColor={colors.brand700} />}
        />
      ) : (
        <FlatList
          data={saved.data ?? []}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OpportunityCard o={item} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 130, gap: 12 }}
          ListEmptyComponent={saved.isLoading ? <CardSkeleton /> : <Empty icon={Bookmark} title="Nothing saved" body="Tap the bookmark on any opportunity. We'll remind you 3 days before it closes." />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} colors={[colors.brand700]} tintColor={colors.brand700} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.sand200, ...shadow.card },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontFamily: fonts.bold, fontSize: 11.5 },
  progress: { flexDirection: "row", gap: 5, marginTop: 14 },
  seg: { height: 5, borderRadius: 3, backgroundColor: colors.sand200 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  ext: { flexDirection: "row", alignItems: "center", gap: 4 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.sand200 },
  statN: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.brand800 },
});
