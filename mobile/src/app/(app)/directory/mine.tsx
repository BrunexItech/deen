import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Store } from "lucide-react-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { Badge, Button, Card, Chip, Header, Input, Segmented, T } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import { useTaxonomy } from "@/lib/queries";
import { colors } from "@/lib/theme";
import { toast, toastError } from "@/lib/toast";
import type { Listing } from "@/lib/types";

const blank = { kind: "business", name: "", headline: "", category: "", description: "", county: "", town: "", phone: "", whatsapp: "", email: "", website: "", services: "", halal_certified: false };

export default function MyListing() {
  const qc = useQueryClient();
  const { data: tax } = useTaxonomy();
  const cats = useQuery({ queryKey: ["dir-cats"], queryFn: () => get<{ key: string; label: string }[]>("/directory/categories"), staleTime: Infinity });
  const mine = useQuery({ queryKey: ["directory", "mine"], queryFn: () => get<Listing[]>("/directory/mine") });
  const existing = mine.data?.[0];
  const [f, setF] = useState(blank);

  useEffect(() => {
    if (existing) setF({ ...blank, ...Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v ?? ""])), services: existing.services.join(", "), halal_certified: existing.halal_certified } as typeof blank);
  }, [existing]);

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, services: f.services.split(",").map((s) => s.trim()).filter(Boolean),
        ...Object.fromEntries(["description", "county", "town", "phone", "whatsapp", "email", "website"].map((k) => [k, (f as Record<string, unknown>)[k] || null])) };
      return existing ? put(`/directory/${existing.id}`, body) : post("/directory", body);
    },
    onSuccess: () => { toast("Submitted. DEEN will review it shortly."); qc.invalidateQueries({ queryKey: ["directory"] }); },
    onError: toastError,
  });

  if (mine.isLoading) return <LoadingScreen />;
  const set = (k: keyof typeof blank, v: string | boolean) => setF({ ...f, [k]: v });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title={existing ? "My listing" : "List your business"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {existing && (
            <Card style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Store size={20} color={colors.brand700} />
              <T v="bodyStrong" style={{ flex: 1 }}>Status</T>
              <Badge label={existing.status === "approved" ? "Live" : existing.status === "rejected" ? "Needs changes" : "In review"} tone={existing.status === "approved" ? "good" : existing.status === "rejected" ? "bad" : "warn"} />
            </Card>
          )}
          {existing?.review_note && <T v="small" color={colors.rose600}>DEEN: {existing.review_note}</T>}
          <Segmented value={f.kind} onChange={(v) => set("kind", v)} options={[{ value: "business", label: "Business" }, { value: "professional", label: "Professional" }]} />
          <Input label="Name" value={f.name} onChangeText={(v) => set("name", v)} />
          <Input label="One-line headline" value={f.headline} onChangeText={(v) => set("headline", v)} placeholder="e.g. Family dentist in South B" />
          <T v="label">Category</T>
          <View style={styles.wrap}>{cats.data?.map((c) => <Chip key={c.key} label={c.label} active={f.category === c.key} onPress={() => set("category", c.key)} />)}</View>
          <Input label="About" value={f.description} onChangeText={(v) => set("description", v)} multiline style={{ minHeight: 90, textAlignVertical: "top" }} />
          <Input label="Services (comma separated)" value={f.services} onChangeText={(v) => set("services", v)} />
          <T v="label">County</T>
          <View style={styles.wrap}>{tax?.counties.slice(0, 47).map((c) => <Chip key={c} label={c} active={f.county === c} onPress={() => set("county", c)} />)}</View>
          <Input label="Town / area" value={f.town} onChangeText={(v) => set("town", v)} />
          <Input label="Phone" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => set("phone", v)} />
          <Input label="WhatsApp" keyboardType="phone-pad" value={f.whatsapp} onChangeText={(v) => set("whatsapp", v)} />
          <Input label="Email" keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={(v) => set("email", v)} />
          <Input label="Website" autoCapitalize="none" value={f.website} onChangeText={(v) => set("website", v)} />
          <Pressable onPress={() => set("halal_certified", !f.halal_certified)} style={styles.check}>
            <View style={[styles.box, f.halal_certified && styles.boxOn]}>{f.halal_certified && <Check size={14} color={colors.white} strokeWidth={3} />}</View>
            <T v="body">Halal certified (KEBS / Halal body)</T>
          </Pressable>
          <Button title={existing ? "Save & resubmit" : "Submit for review"} loading={save.isPending} disabled={!f.name || f.headline.length < 5 || !f.category} onPress={() => save.mutate()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  check: { flexDirection: "row", alignItems: "center", gap: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.sand300, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
});
