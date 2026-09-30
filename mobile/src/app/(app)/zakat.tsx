import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Info } from "lucide-react-native";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { Arabic, Button, Card, Header, Input, T } from "@/components/ui";
import { computeZakat, type ZakatInput } from "@/lib/faith";
import { useToday } from "@/lib/queries";
import { colors, fonts } from "@/lib/theme";

const FIELDS: { key: keyof ZakatInput; label: string; hint?: string; unit?: string }[] = [
  { key: "cash", label: "Cash, bank & M-Pesa balances", unit: "KES" },
  { key: "gold_grams", label: "Gold you own", hint: "Jewellery and gold held as savings", unit: "grams" },
  { key: "silver_grams", label: "Silver you own", unit: "grams" },
  { key: "business_goods", label: "Business stock for sale", hint: "At current selling value", unit: "KES" },
  { key: "receivables", label: "Money owed to you", hint: "That you expect to be repaid", unit: "KES" },
  { key: "investments", label: "Shares & investments", unit: "KES" },
  { key: "debts_due", label: "Debts & bills due now", hint: "Deducted from your total", unit: "KES" },
];

const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;

export default function Zakat() {
  const { data, isLoading } = useToday();
  const [v, setV] = useState<Record<string, string>>({});
  const input = useMemo(() => Object.fromEntries(FIELDS.map((f) => [f.key, Number((v[f.key] ?? "").replace(/,/g, "")) || 0])) as unknown as ZakatInput, [v]);
  if (isLoading || !data) return <LoadingScreen />;
  const z = data.zakat;
  const r = computeZakat(input, { gold: z.gold_price_per_gram_kes, silver: z.silver_price_per_gram_kes, basis: z.nisab_basis, goldNisab: z.gold_nisab_grams, silverNisab: z.silver_nisab_grams, rate: z.rate });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Zakat calculator" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[colors.emerald700, colors.emerald950]} style={styles.result}>
            <T v="overline" color={colors.gold400}>Zakat due</T>
            <Text style={styles.due}>{kes(r.due)}</Text>
            <T v="small" color={colors.emerald100}>
              {r.eligible ? `2.5% of your zakatable wealth (${kes(r.net)})` : `Your wealth (${kes(r.net)}) is below the nisab of ${kes(r.nisab)}. No zakat is due.`}
            </T>
            <View style={styles.nisab}>
              <T v="caption" color={colors.emerald100}>Nisab ({z.nisab_basis === "silver" ? "595 g silver" : "85 g gold"})</T>
              <T v="label" color={colors.white}>{kes(r.nisab)}</T>
            </View>
          </LinearGradient>

          {FIELDS.map((f) => (
            <Input key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ""}`} hint={f.hint} keyboardType="numeric" placeholder="0"
              value={v[f.key] ?? ""} onChangeText={(t) => setV({ ...v, [f.key]: t.replace(/[^\d.,]/g, "") })} />
          ))}

          <Card style={{ flexDirection: "row", gap: 10, backgroundColor: colors.sand50 }}>
            <Info size={18} color={colors.ink500} />
            <T v="caption" style={{ flex: 1 }}>
              Zakat is due on wealth held for a full lunar year (hawl). Gold {kes(z.gold_price_per_gram_kes)}/g, silver {kes(z.silver_price_per_gram_kes)}/g. {z.note} For personal rulings, consult a qualified scholar.
            </T>
          </Card>
          <Card style={{ backgroundColor: colors.gold50, borderColor: colors.gold100 }}>
            <Arabic size={20} color={colors.gold700}>وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ</Arabic>
            <T v="small" style={{ fontStyle: "italic" }}>&ldquo;And establish prayer and give zakat.&rdquo; (Qur&apos;an 2:43)</T>
          </Card>
          {r.due > 0 && <Button title="Find verified zakat programmes" onPress={() => router.push({ pathname: "/explore", params: { category: "support" } })} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  result: { borderRadius: 24, padding: 20 },
  due: { fontFamily: fonts.extrabold, fontSize: 38, color: colors.white, marginVertical: 4 },
  nisab: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)" },
});
