import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InlineLoader } from "@/components/Loader";
import { Card, Header, T } from "@/components/ui";
import { get, put } from "@/lib/api";
import { colors } from "@/lib/theme";

type Prefs = Record<"push" | "email" | "sms", Record<string, boolean>> & { quiet_hours: { enabled: boolean; start: number; end: number } };

const KINDS: Record<string, [string, string]> = {
  matches: ["New matches", "Opportunities that fit your profile"],
  deadlines: ["Deadline reminders", "3 days before saved opportunities close"],
  applications: ["Application updates", "When an organization moves your application"],
  subscription: ["Membership", "Payments and renewals"],
  announcements: ["Community announcements", "News from DEEN"],
  organizations: ["Organizations you follow", "New posts from them"],
};

export default function NotificationSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["prefs"], queryFn: () => get<{ prefs: Prefs }>("/notifications/preferences") });
  const save = useMutation({
    mutationFn: (prefs: Prefs) => put<{ prefs: Prefs }>("/notifications/preferences", { prefs }),
    onMutate: (prefs) => qc.setQueryData(["prefs"], { prefs }),
  });
  if (!data) return <SafeAreaView style={{ flex: 1 }}><Header title="Notifications" /><InlineLoader /></SafeAreaView>;
  const p = data.prefs;
  const set = (ch: "push" | "email" | "sms", kind: string, v: boolean) => save.mutate({ ...p, [ch]: { ...p[ch], [kind]: v } });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Quiet hours (10pm – 6am)</T>
            <T v="caption">Notifications arrive silently overnight</T>
          </View>
          <Switch value={p.quiet_hours.enabled} onValueChange={(v) => save.mutate({ ...p, quiet_hours: { ...p.quiet_hours, enabled: v } })} trackColor={{ true: colors.emerald600, false: colors.sand300 }} thumbColor={colors.white} />
        </Card>
        {Object.entries(KINDS).map(([kind, [title, sub]]) => (
          <Card key={kind} style={{ gap: 10 }}>
            <View><T v="bodyStrong">{title}</T><T v="caption">{sub}</T></View>
            <View style={styles.channels}>
              {(["push", "email", "sms"] as const).map((ch) => (
                <View key={ch} style={styles.channel}>
                  <T v="label">{ch === "sms" ? "SMS" : ch[0].toUpperCase() + ch.slice(1)}</T>
                  <Switch value={!!p[ch]?.[kind]} onValueChange={(v) => set(ch, kind, v)} trackColor={{ true: colors.emerald600, false: colors.sand300 }} thumbColor={colors.white} />
                </View>
              ))}
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  channels: { flexDirection: "row", justifyContent: "space-between" },
  channel: { alignItems: "center", gap: 2 },
});
