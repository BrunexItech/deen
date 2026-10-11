import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InlineLoader } from "@/components/Loader";
import { Card, Header, T } from "@/components/ui";
import { get, put } from "@/lib/api";
import { keys, useProfile } from "@/lib/queries";
import { colors } from "@/lib/theme";

type Channel = "push" | "email" | "sms" | "whatsapp";
type Prefs = Record<Channel, Record<string, boolean>> & { quiet_hours: { enabled: boolean; start: number; end: number } };

const KINDS: Record<string, [string, string]> = {
  matches: ["New matches", "Opportunities that fit your profile"],
  deadlines: ["Deadline reminders", "7, 3 and 1 day before saved opportunities close"],
  applications: ["Application updates", "When an organization moves your application"],
  digest: ["Weekly opportunities digest", "Every Monday: what's new this week"],
  questions: ["Answers to my questions", "When DEEN or an organization replies"],
  subscription: ["Membership", "When your membership changes"],
  announcements: ["Community announcements", "News from DEEN"],
  organizations: ["Organizations you follow", "New posts from them"],
};

export default function NotificationSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["prefs"], queryFn: () => get<{ prefs: Prefs }>("/notifications/preferences") });
  const profile = useProfile();
  const save = useMutation({
    mutationFn: (prefs: Prefs) => put<{ prefs: Prefs }>("/notifications/preferences", { prefs }),
    onMutate: (prefs) => qc.setQueryData(["prefs"], { prefs }),
  });
  if (!data) return <SafeAreaView style={{ flex: 1 }}><Header title="Notifications" /><InlineLoader /></SafeAreaView>;
  const p = data.prefs;
  const set = (ch: Channel, kind: string, v: boolean) => save.mutate({ ...p, [ch]: { ...p[ch], [kind]: v } });
  const whatsapp = !!profile.data?.whatsapp_opt_in;
  const consent = async (v: boolean) => {
    await put("/me/profile", { whatsapp_opt_in: v });
    qc.invalidateQueries({ queryKey: keys.profile });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Quiet hours (10pm – 6am)</T>
            <T v="caption">Notifications arrive silently overnight</T>
          </View>
          <Switch value={p.quiet_hours.enabled} onValueChange={(v) => save.mutate({ ...p, quiet_hours: { ...p.quiet_hours, enabled: v } })} trackColor={{ true: colors.brand600, false: colors.sand300 }} thumbColor={colors.white} />
        </Card>
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">WhatsApp messages</T>
            <T v="caption">I agree to receive DEEN updates on WhatsApp. You can withdraw anytime.</T>
          </View>
          <Switch value={whatsapp} onValueChange={consent} trackColor={{ true: colors.leaf600, false: colors.sand300 }} thumbColor={colors.white} />
        </Card>
        {Object.entries(KINDS).map(([kind, [title, sub]]) => (
          <Card key={kind} style={{ gap: 10 }}>
            <View><T v="bodyStrong">{title}</T><T v="caption">{sub}</T></View>
            <View style={styles.channels}>
              {(whatsapp ? (["push", "email", "sms", "whatsapp"] as const) : (["push", "email", "sms"] as const)).map((ch) => (
                <View key={ch} style={styles.channel}>
                  <T v="label">{ch === "sms" ? "SMS" : ch === "whatsapp" ? "WhatsApp" : ch[0].toUpperCase() + ch.slice(1)}</T>
                  <Switch value={!!p[ch]?.[kind]} onValueChange={(v) => set(ch, kind, v)} trackColor={{ true: colors.brand600, false: colors.sand300 }} thumbColor={colors.white} />
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
