import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  BadgeCheck, Bell, Briefcase, ChevronRight, CircleDashed, FileLock2, Fingerprint, GraduationCap, HeartHandshake, LogOut, Shield, Store,
  UserRoundPen, type LucideIcon,
} from "lucide-react-native";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, T, Tap } from "@/components/ui";
import { get } from "@/lib/api";
import { useMembership, useProfile } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { colors, fonts } from "@/lib/theme";

function Row({ icon: Icon, label, sub, onPress, right, danger }: { icon: LucideIcon; label: string; sub?: string; onPress: () => void; right?: React.ReactNode; danger?: boolean }) {
  return (
    <Tap onPress={onPress} style={styles.row} scale={0.99}>
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.rose50 }]}><Icon size={19} color={danger ? colors.rose600 : colors.brand700} /></View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" color={danger ? colors.rose600 : undefined}>{label}</T>
        {sub && <T v="caption">{sub}</T>}
      </View>
      {right ?? <ChevronRight size={18} color={colors.ink300} />}
    </Tap>
  );
}

export default function Me() {
  const { user, signOut, biometric } = useSession();
  const profile = useProfile();
  const membership = useMembership();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => get<{ applications: number; saved: number; outcomes: number }>("/me/stats") });
  if (!user) return null;
  const m = membership.data;
  const initials = user.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <T v="h2" numberOfLines={1} style={{ flexShrink: 1 }}>{user.full_name}</T>
              {user.identity_status === "verified" && <BadgeCheck size={18} color={colors.brand600} fill={colors.brand50} />}
            </View>
            <T v="small">{user.phone}</T>
          </View>
        </View>

        <View style={styles.stats}>
          {[["Applications", stats.data?.applications], ["Saved", stats.data?.saved], ["Profile", profile.data ? `${profile.data.completeness}%` : "—"]].map(([l, n]) => (
            <View key={l as string} style={styles.stat}><Text style={styles.statN}>{n ?? "—"}</Text><T v="caption">{l as string}</T></View>
          ))}
        </View>

        <Tap onPress={() => router.push("/membership")} style={[styles.member, { marginTop: 16 }]}>
          <View style={[styles.memberIcon, { backgroundColor: m?.paid ? colors.leaf50 : colors.sand100 }]}>
            {m?.paid ? <BadgeCheck size={20} color={colors.leaf600} /> : <CircleDashed size={20} color={colors.ink400} />}
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Membership</T>
            <T v="caption">{m?.paid ? (m.ends_at ? `Paid up until ${new Date(m.ends_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}` : "Paid up") : "Not paid"}</T>
          </View>
          <ChevronRight size={18} color={colors.ink300} />
        </Tap>

        <T v="overline" style={styles.group}>Profile</T>
        <View style={styles.card}>
          <Row icon={UserRoundPen} label="Edit profile" sub="Education, skills, interests" onPress={() => router.push("/onboarding")} />
          <Row icon={BadgeCheck} label="Verify your identity" sub={{ none: "Unlock verified-only support", pending: "Under review", verified: "Verified ✓", rejected: "Needs attention" }[user.identity_status]}
            onPress={() => router.push("/identity")} right={user.identity_status === "verified" ? <Badge label="Verified" tone="good" /> : undefined} />
          <Row icon={Briefcase} label="My DEEN Experience" sub="Build your experience profile and CV" onPress={() => router.push("/experience")} />
          <Row icon={GraduationCap} label="Student & Graduate Hub" sub="Study · Experience · Career · Growth" onPress={() => router.push("/hub")} />
          <Row icon={Store} label="My business or practice" sub="List it in the halal directory" onPress={() => router.push("/directory/mine")} />
          <Row icon={HeartHandshake} label="Share a success story" sub="Tell us when an opportunity changed your life" onPress={() => router.push("/applications")} />
        </View>

        <T v="overline" style={styles.group}>Account</T>
        <View style={styles.card}>
          <Row icon={Fingerprint} label="Security" sub={biometric ? "Biometric lock on" : "Biometric lock off"} onPress={() => router.push("/settings/security")} />
          <Row icon={Bell} label="Notifications" sub="What we send and when" onPress={() => router.push("/settings/notifications")} />
          <Row icon={FileLock2} label="Privacy & data" sub="Download or delete your data" onPress={() => router.push("/settings/privacy")} />
          <Row icon={Shield} label="Safety tips" sub="Legitimate opportunities never ask you to pay" onPress={() => Alert.alert("Stay safe",
            "• DEEN verifies organizations, but never send money to apply for any opportunity.\n• DEEN staff will never ask for your password or M-Pesa PIN.\n• Report anything suspicious with the flag on the opportunity page.")} />
        </View>

        <View style={[styles.card, { marginTop: 16 }]}>
          <Row icon={LogOut} label="Log out" danger onPress={() => Alert.alert("Log out?", "You'll need your password to sign in again.", [
            { text: "Cancel", style: "cancel" }, { text: "Log out", style: "destructive", onPress: () => signOut() },
          ])} right={<View />} />
        </View>
        <T v="caption" center style={{ marginTop: 20 }}>DEEN · Development and Education Empowerment Network · v1.0</T>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 6 },
  avatar: { width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand800 },
  initials: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.gold400 },
  stats: { flexDirection: "row", gap: 10, marginTop: 18 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.sand200 },
  statN: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.brand800 },
  member: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, padding: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.sand200 },
  memberIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  group: { marginTop: 24, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.sand200, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
});
