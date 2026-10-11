import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, KeyRound, LogOut, Smartphone } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormScroll } from "@/components/Keyboard";
import { Badge, Button, Card, Header, Input, T, Tap } from "@/components/ui";
import { del, get, post } from "@/lib/api";
import { authenticate, lockCapability } from "@/lib/biometrics";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { toast, toastError } from "@/lib/toast";

interface Session { id: string; device_name: string; platform: string; last_seen_at: string | null; current: boolean; biometric_enabled: boolean }

export default function Security() {
  const qc = useQueryClient();
  const { biometric, setBiometric, signOut } = useSession();
  const [label, setLabel] = useState("Biometric");
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => get<Session[]>("/auth/sessions") });

  useEffect(() => { lockCapability().then((c) => setLabel(c.label)).catch(() => undefined); }, []);

  async function toggle(on: boolean) {
    // Changing the lock always requires proving it's you.
    if (await authenticate(on ? "Turn on the DEEN lock" : "Turn off the DEEN lock")) {
      await setBiometric(on);
      toast(on ? `${label} lock is on` : "Lock turned off");
    }
  }

  const change = useMutation({
    mutationFn: () => post("/auth/change-password", pw),
    onSuccess: () => { toast("Password changed. Other devices were signed out."); setPw({ current_password: "", new_password: "" }); qc.invalidateQueries({ queryKey: ["sessions"] }); },
    onError: toastError,
  });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/auth/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }) });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Security" />
      <FormScroll contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Card style={styles.row}>
          <View style={styles.icon}><Fingerprint size={22} color={colors.brand700} /></View>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">{label} lock</T>
            <T v="caption">Required to open DEEN and after 30 seconds away</T>
          </View>
          <Switch value={biometric} onValueChange={toggle} trackColor={{ true: colors.brand600, false: colors.sand300 }} thumbColor={colors.white} />
        </Card>

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><KeyRound size={18} color={colors.brand700} /><T v="h3">Change password</T></View>
          <Input placeholder="Current password" secureTextEntry value={pw.current_password} onChangeText={(v) => setPw({ ...pw, current_password: v })} />
          <Input placeholder="New password (8+ characters)" secureTextEntry value={pw.new_password} onChangeText={(v) => setPw({ ...pw, new_password: v })} />
          <Button title="Update password" size="md" loading={change.isPending} disabled={!pw.current_password || pw.new_password.length < 8} onPress={() => change.mutate()} />
        </Card>

        <T v="overline" style={{ marginTop: 8 }}>Signed-in devices</T>
        <Card padded={false}>
          {sessions.data?.map((s, i) => (
            <View key={s.id} style={[styles.row, { padding: 14 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.sand200 }]}>
              <Smartphone size={20} color={colors.ink500} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">{s.device_name}</T>
                <T v="caption">{s.current ? "This phone" : `Last active ${s.last_seen_at ? new Date(s.last_seen_at).toLocaleDateString("en-KE") : "—"}`}</T>
              </View>
              {s.current ? <Badge label="Current" tone="good" /> : (
                <Tap onPress={() => revoke.mutate(s.id)}><T v="label" color={colors.rose600}>Sign out</T></Tap>
              )}
            </View>
          ))}
        </Card>
        <Button title="Sign out of all devices" variant="secondary" icon={LogOut} onPress={() => Alert.alert("Sign out everywhere?", "Including this phone. Use this if you lost a phone.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out all", style: "destructive", onPress: async () => { await post("/auth/logout-all").catch(() => undefined); signOut(false); } },
        ])} />
      </FormScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
});
