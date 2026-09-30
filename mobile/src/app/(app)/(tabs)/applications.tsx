import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bookmark, ExternalLink, FileStack, Plus, Briefcase } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardSkeleton } from "@/components/Loader";
import { OpportunityCard, OrgLogo } from "@/components/OpportunityCard";
import { Sheet } from "@/components/Sheet";
import { Button, Chip, Empty, IconButton, Input, Segmented, T, Tap } from "@/components/ui";
import { get, post } from "@/lib/api";
import { keys } from "@/lib/queries";
import { APP_STATUS, PIPELINE, SELF_STATUSES } from "@/lib/status";
import { colors, fonts, shadow } from "@/lib/theme";
import { toast, toastError } from "@/lib/toast";
import type { Application, OppCard } from "@/lib/types";

function Progress({ status }: { status: string }) {
  const s = APP_STATUS[status] ?? APP_STATUS.submitted;
  return (
    <View style={styles.progress}>
      {PIPELINE.map((label, i) => (
        <View key={label} style={{ flex: 1 }}>
          <View style={[styles.seg, i < s.step && { backgroundColor: status === "rejected" && i === 3 ? colors.ink300 : colors.leaf500 }]} />
        </View>
      ))}
    </View>
  );
}

function AppRow({ a }: { a: Application }) {
  const s = APP_STATUS[a.status] ?? APP_STATUS.submitted;
  const title = a.opportunity?.title ?? a.manual?.title ?? "Application";
  const org = a.opportunity?.organization.name ?? a.manual?.organization ?? "";
  return (
    <Tap onPress={() => router.push(`/application/${a.id}`)} style={styles.card} scale={0.985}>
      <View style={styles.row}>
        {a.opportunity ? <OrgLogo org={a.opportunity.organization} size={40} /> : (
          <View style={styles.manualIcon}><Briefcase size={19} color={colors.brand700} /></View>
        )}
        <View style={{ flex: 1 }}>
          <T v="caption" numberOfLines={1}>{org}</T>
          <T v="h3" numberOfLines={2}>{title}</T>
        </View>
        <View style={[styles.status, { backgroundColor: s.bg }]}><Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text></View>
      </View>
      <Progress status={a.status} />
      <View style={styles.meta}>
        <T v="caption">Added {new Date(a.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</T>
        {a.source !== "deen" && (
          <View style={styles.ext}><ExternalLink size={11} color={colors.ink400} /><T v="caption">{a.source === "manual" ? "Outside DEEN" : "On their website"}</T></View>
        )}
      </View>
    </Tap>
  );
}

function AddManual({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", organization: "", url: "", status: "submitted" });
  const add = useMutation({
    mutationFn: () => post("/applications/manual", { ...f, url: f.url || null }),
    onSuccess: () => { toast("Added to your tracker"); setF({ title: "", organization: "", url: "", status: "submitted" }); qc.invalidateQueries({ queryKey: keys.applications }); onClose(); },
    onError: toastError,
  });
  return (
    <Sheet open={open} onClose={onClose} title="Add an application"
      footer={<Button title="Add to tracker" loading={add.isPending} disabled={f.title.length < 3 || f.organization.length < 2} onPress={() => add.mutate()} />}>
      <T v="small">Applied for something outside DEEN? Record it here to keep all your applications in one place.</T>
      <Input label="What did you apply for?" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} placeholder="e.g. County bursary 2026" />
      <Input label="Organization" value={f.organization} onChangeText={(v) => setF({ ...f, organization: v })} />
      <Input label="Link (optional)" value={f.url} onChangeText={(v) => setF({ ...f, url: v })} autoCapitalize="none" keyboardType="url" />
      <T v="label">Status</T>
      <View style={styles.wrap}>
        {SELF_STATUSES.slice(0, 4).map((k) => <Chip key={k} label={APP_STATUS[k].label} active={f.status === k} onPress={() => setF({ ...f, status: k })} />)}
      </View>
    </Sheet>
  );
}

export default function Tracker() {
  const [tab, setTab] = useState<"applications" | "saved">("applications");
  const [adding, setAdding] = useState(false);
  const apps = useQuery({ queryKey: keys.applications, queryFn: () => get<Application[]>("/applications") });
  const saved = useQuery({ queryKey: keys.saved, queryFn: () => get<OppCard[]>("/opportunities/saved"), enabled: tab === "saved" });
  const active = (apps.data ?? []).filter((a) => !["accepted", "rejected", "withdrawn", "closed"].includes(a.status)).length;
  const q = tab === "applications" ? apps : saved;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T v="title">My dashboard</T>
          <IconButton icon={Plus} label="Add an application" onPress={() => setAdding(true)} />
        </View>
        {tab === "applications" && apps.data && apps.data.length > 0 && (
          <View style={styles.stats}>
            {[["Active", active], ["Total", apps.data.length], ["Successful", apps.data.filter((a) => a.status === "accepted").length]].map(([l, n]) => (
              <View key={l as string} style={styles.stat}><Text style={styles.statN}>{n}</Text><T v="caption">{l as string}</T></View>
            ))}
          </View>
        )}
        <Segmented value={tab} onChange={setTab} options={[{ value: "applications", label: "My applications" }, { value: "saved", label: "My saved" }]} />
      </View>
      {tab === "applications" ? (
        <FlatList
          data={apps.data ?? []}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <AppRow a={item} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 130, gap: 12 }}
          ListEmptyComponent={apps.isLoading ? <View style={{ gap: 12 }}><CardSkeleton /><CardSkeleton /></View>
            : <Empty icon={FileStack} title="No applications yet" body="Follow every step here: started, applied, under review, shortlisted and successful. You can also add ones you made outside DEEN." action="Find opportunities" onAction={() => router.push("/explore")} />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} colors={[colors.brand700]} tintColor={colors.brand700} />}
        />
      ) : (
        <FlatList
          data={saved.data ?? []}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OpportunityCard o={item} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 130, gap: 12 }}
          ListEmptyComponent={saved.isLoading ? <CardSkeleton /> : <Empty icon={Bookmark} title="Nothing saved" body="Tap the bookmark on any opportunity. We'll remind you 7 days, 3 days and 1 day before it closes." />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} colors={[colors.brand700]} tintColor={colors.brand700} />}
        />
      )}
      <AddManual open={adding} onClose={() => setAdding(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.sand200, ...shadow.card },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  manualIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, maxWidth: 120 },
  statusText: { fontFamily: fonts.bold, fontSize: 11.5 },
  progress: { flexDirection: "row", gap: 5, marginTop: 14 },
  seg: { height: 5, borderRadius: 3, backgroundColor: colors.sand200 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  ext: { flexDirection: "row", alignItems: "center", gap: 4 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.sand200 },
  statN: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.brand800 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
