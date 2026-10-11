/** Membership status only. Google Play rules: the app shows no prices, payment buttons or
 * payment links. The community fee is paid outside the app. */
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleDashed, Receipt } from "lucide-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { Card, Divider, ErrorState, Header, T } from "@/components/ui";
import { get } from "@/lib/api";
import { useMembership } from "@/lib/queries";
import { colors } from "@/lib/theme";

type PaymentRow = { id: string; status: string; receipt: string | null; created_at: string; settled_at: string | null; gift: boolean };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

export default function Membership() {
  const membership = useMembership();
  const payments = useQuery({ queryKey: ["payments"], queryFn: () => get<{ items: PaymentRow[] }>("/payments") });
  if (membership.isLoading) return <LoadingScreen label="Loading" />;
  if (membership.isError || !membership.data) {
    return <SafeAreaView style={{ flex: 1 }}><Header title="Membership" /><ErrorState onRetry={() => membership.refetch()} /></SafeAreaView>;
  }
  const m = membership.data;
  const limit = m.features.monthly_applications;
  const paidRows = (payments.data?.items ?? []).filter((p) => p.status === "success");

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Membership" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Card style={styles.status}>
          <View style={[styles.statusIcon, { backgroundColor: m.paid ? colors.leaf50 : colors.sand100 }]}>
            {m.paid ? <BadgeCheck size={26} color={colors.leaf600} /> : <CircleDashed size={26} color={colors.ink400} />}
          </View>
          <T v="overline" color={colors.ink400}>Community fee</T>
          <T v="title">{m.paid ? "Paid up" : "Not paid"}</T>
          {m.paid && m.ends_at && <T v="body" color={colors.ink500}>Active until {day(m.ends_at)}</T>}
          {m.sponsored && <T v="small" color={colors.leaf700}>Paid for you by another member. May Allah reward them.</T>}
        </Card>

        {!m.paid && limit != null && (
          <Card style={{ gap: 6 }}>
            <T v="bodyStrong">Applications through DEEN this month</T>
            <T v="title">{Math.min(m.applications_this_month ?? 0, limit)} of {limit}</T>
            <T v="small">Applying on an organization&apos;s own website never counts towards this.</T>
          </Card>
        )}

        {paidRows.length > 0 && (
          <Card padded={false}>
            <View style={{ padding: 16, paddingBottom: 8 }}><T v="h3">Payment history</T></View>
            {paidRows.map((p, i) => (
              <View key={p.id}>
                {i > 0 && <Divider style={{ marginHorizontal: 16 }} />}
                <View style={styles.row}>
                  <Receipt size={18} color={colors.ink400} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{p.receipt ?? "Payment"}</T>
                    <T v="caption">{day(p.settled_at ?? p.created_at)}{p.gift ? " · for another member" : ""}</T>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: "center", gap: 4, paddingVertical: 28 },
  statusIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
