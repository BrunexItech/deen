import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { Check, CheckCircle2, Crown, Gift, Phone, Smartphone, XCircle } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { DeenLoader, LoadingScreen } from "@/components/Loader";
import { Sheet } from "@/components/Sheet";
import { Arabic, Button, Header, Input, Segmented, T, Tap } from "@/components/ui";
import { get, post } from "@/lib/api";
import { keys, useMembership } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { colors, fonts } from "@/lib/theme";
import { toastError } from "@/lib/toast";
import type { Plan } from "@/lib/types";

type PayStatus = "pending" | "success" | "failed" | "cancelled";
type PayState = { id: string; status: PayStatus; message: string; receipt?: string | null } | null;

export default function Membership() {
  const params = useLocalSearchParams<{ gift?: string }>();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const refreshUser = useSession((s) => s.refreshUser);
  const membership = useMembership();
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => get<Plan[]>("/plans") });
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [gift, setGift] = useState(params.gift === "1");
  const [phone, setPhone] = useState(user?.phone?.replace("+254", "0") ?? "");
  const [giftPhone, setGiftPhone] = useState("");
  const [pay, setPay] = useState<PayState>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  if (plans.isLoading || membership.isLoading) return <LoadingScreen label="Loading plans" />;
  const paid = (plans.data ?? []).filter((p) => p.price_kes > 0 && (billing === "yearly" ? p.interval_months >= 12 : p.interval_months < 12));
  const m = membership.data;

  async function checkout() {
    if (!chosen) return;
    setBusy(true);
    try {
      const r = await post<{ payment_id: string; message: string }>("/payments/checkout", {
        plan_code: chosen.code, phone, gift_to_phone: gift ? giftPhone : null,
      });
      setPay({ id: r.payment_id, status: "pending", message: r.message });
      let tries = 0;
      poll.current = setInterval(async () => {
        tries += 1;
        const s = await get<{ status: PayStatus; receipt: string | null; result: string | null }>(`/payments/${r.payment_id}`).catch(() => null);
        if (s && s.status !== "pending") {
          clearInterval(poll.current!);
          setPay({ id: r.payment_id, status: s.status, receipt: s.receipt, message: s.result ?? "" });
          if (s.status === "success") {
            qc.invalidateQueries({ queryKey: keys.membership });
            qc.invalidateQueries({ queryKey: keys.feed });
            refreshUser().catch(() => undefined);
          }
        } else if (tries > 40) {
          clearInterval(poll.current!);
          setPay({ id: r.payment_id, status: "failed", message: "We didn't get a confirmation from M-Pesa. If you were charged, it will reflect shortly." });
        }
      }, 2500);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  const close = () => { setChosen(null); setPay(null); if (poll.current) clearInterval(poll.current); };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title={gift ? "Sponsor a membership" : "Membership"} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
        {gift ? (
          <LinearGradient colors={["#3A2E12", "#15110A"]} style={styles.current}>
            <Gift size={26} color={colors.gold400} />
            <T v="h2" color={colors.white} style={{ marginTop: 10 }}>Give the gift of opportunity</T>
            <T v="small" color="rgba(255,255,255,0.7)">Pay for a brother or sister&apos;s membership. They get unlimited access to scholarships, jobs and support, and you share in the reward, in sha Allah.</T>
            <Arabic size={18} color={colors.gold400} style={{ marginTop: 10 }}>مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ</Arabic>
            <T v="caption" color="rgba(255,255,255,0.55)">&ldquo;Charity never decreases wealth.&rdquo; (Sahih Muslim 2588)</T>
          </LinearGradient>
        ) : (
          <LinearGradient colors={m?.tier === "free" ? [colors.emerald700, colors.emerald950] : ["#3A2E12", "#15110A"]} style={styles.current}>
            <Crown size={24} color={colors.gold400} />
            <T v="overline" color={colors.gold400} style={{ marginTop: 10 }}>Your plan</T>
            <T v="title" color={colors.white}>{m?.plan_name ?? "Free"}</T>
            <T v="small" color="rgba(255,255,255,0.7)">
              {m?.tier === "free"
                ? `${m?.applications_this_month ?? 0} of ${m?.features.monthly_applications ?? 3} applications used this month`
                : m?.ends_at ? `Active until ${new Date(m.ends_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}${m.sponsored ? " · Sponsored 💚" : ""}` : "Active"}
            </T>
          </LinearGradient>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Segmented value={billing} onChange={setBilling} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly · save 17%" }]} />
          </View>
          <Tap onPress={() => setGift(!gift)} style={[styles.giftToggle, gift && { backgroundColor: colors.gold500, borderColor: colors.gold500 }]}>
            <Gift size={18} color={gift ? colors.emerald950 : colors.gold600} />
          </Tap>
        </View>

        {paid.map((p) => {
          const current = m?.plan_code === p.code;
          return (
            <Animated.View key={p.id} entering={FadeIn}>
              <Tap onPress={() => (!current || gift) && setChosen(p)} style={[styles.plan, p.highlight && styles.planHi]} scale={0.985}>
                {p.highlight && <View style={styles.ribbon}><Text style={styles.ribbonText}>MOST POPULAR</Text></View>}
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <T v="h2">{p.name}</T>
                    {p.tagline && <T v="small">{p.tagline}</T>}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.price}>KES {p.price_kes.toLocaleString()}</Text>
                    <T v="caption">{p.interval_months >= 12 ? "per year" : "per month"}</T>
                  </View>
                </View>
                <View style={{ marginTop: 14, gap: 8 }}>
                  {p.benefits.map((b) => (
                    <View key={b} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <View style={styles.tick}><Check size={12} color={colors.white} strokeWidth={3} /></View>
                      <T v="small" style={{ flex: 1, color: colors.ink700 }}>{b}</T>
                    </View>
                  ))}
                </View>
                <Button title={current && !gift ? "Your current plan" : gift ? "Sponsor this plan" : m?.tier !== "free" ? "Switch / renew" : `Choose ${p.name}`}
                  variant={p.highlight ? "gold" : "primary"} disabled={current && !gift} onPress={() => setChosen(p)} style={{ marginTop: 16 }} size="md" />
              </Tap>
            </Animated.View>
          );
        })}
        <T v="caption" center>Secure payment with M-Pesa. Renewal is never automatic: you choose when to renew.</T>
      </ScrollView>

      <Sheet open={!!chosen} onClose={close} title={pay ? "M-Pesa payment" : `Pay for ${chosen?.name ?? ""}`}
        footer={!pay ? <Button title={`Pay KES ${chosen?.price_kes.toLocaleString() ?? ""}`} icon={Smartphone} loading={busy} disabled={phone.length < 9 || (gift && giftPhone.length < 9)} onPress={checkout} />
          : pay.status !== "pending" ? <Button title="Done" onPress={close} /> : undefined}>
        {!pay ? (
          <>
            {gift && <Input label="Their DEEN phone number" icon={Gift} keyboardType="phone-pad" value={giftPhone} onChangeText={setGiftPhone} placeholder="07xx xxx xxx" hint="The person must already have a DEEN account." />}
            <Input label="Your M-Pesa number" icon={Phone} keyboardType="phone-pad" value={phone} onChangeText={setPhone} hint="You'll get a prompt on this phone to enter your M-Pesa PIN." />
          </>
        ) : pay.status === "pending" ? (
          <View style={styles.center}>
            <DeenLoader size={70} />
            <T v="h3" center style={{ marginTop: 16 }}>Waiting for M-Pesa…</T>
            <T v="small" center>{pay.message}</T>
          </View>
        ) : pay.status === "success" ? (
          <Animated.View entering={ZoomIn} style={styles.center}>
            <CheckCircle2 size={64} color={colors.emerald600} />
            <T v="title" center style={{ marginTop: 12 }}>{gift ? "JazakAllahu khayran!" : "Welcome aboard!"}</T>
            <T v="small" center>{gift ? "Your gift is active. May Allah reward you." : "Your membership is now active."} Receipt {pay.receipt}</T>
          </Animated.View>
        ) : (
          <View style={styles.center}>
            <XCircle size={60} color={colors.rose600} />
            <T v="h3" center style={{ marginTop: 12 }}>Payment not completed</T>
            <T v="small" center>{pay.message || "You can try again anytime."}</T>
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  current: { borderRadius: 24, padding: 20 },
  giftToggle: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.gold400, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold50 },
  plan: { backgroundColor: colors.white, borderRadius: 22, padding: 18, borderWidth: 1.5, borderColor: colors.sand200, overflow: "hidden" },
  planHi: { borderColor: colors.gold400, borderWidth: 2 },
  ribbon: { position: "absolute", top: 0, right: 0, backgroundColor: colors.gold500, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 12 },
  ribbonText: { fontFamily: fonts.extrabold, fontSize: 9.5, letterSpacing: 1, color: colors.emerald950 },
  price: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.emerald800 },
  tick: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.emerald600, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", paddingVertical: 20, gap: 4 },
});
