import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInRight, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { CATEGORY_ICON } from "@/components/OpportunityCard";
import { Button, Chip, Header, Input, T, Tap } from "@/components/ui";
import { put } from "@/lib/api";
import { keys, useProfile, useTaxonomy } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { CATEGORY_META, colors, fonts } from "@/lib/theme";
import { toastError } from "@/lib/toast";
import type { Profile } from "@/lib/types";

const STEPS = ["About you", "Education & work", "Skills", "What you're looking for"];

type Draft = Omit<Profile, "completeness" | "missing" | "onboarding_completed"> & { dob_d: string; dob_m: string; dob_y: string };

function Progress({ step }: { step: number }) {
  const bar = useAnimatedStyle(() => ({ width: withTiming(`${((step + 1) / STEPS.length) * 100}%`, { duration: 350 }) }));
  return <View style={styles.track}><Animated.View style={[styles.fill, bar]} /></View>;
}

export default function Onboarding() {
  const qc = useQueryClient();
  const biometric = useSession((s) => s.biometric);
  const { data: tax } = useTaxonomy();
  const { data: profile, isLoading } = useProfile();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft | null>(null);
  const [countyQ, setCountyQ] = useState("");
  const [skill, setSkill] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && !d) {
      const [y, m, day] = (profile.date_of_birth ?? "").split("-");
      setD({ ...profile, dob_y: y ?? "", dob_m: m ?? "", dob_d: day ?? "" });
    }
  }, [profile, d]);

  const counties = useMemo(() => (tax?.counties ?? []).filter((c) => c.toLowerCase().includes(countyQ.toLowerCase())), [tax, countyQ]);
  if (isLoading || !d || !tax) return <LoadingScreen label="Preparing your profile" />;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD({ ...d, [k]: v });
  const toggle = (k: "skills" | "interests" | "opportunity_types" | "languages", v: string) =>
    set(k, d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v]);

  const dob = d.dob_y.length === 4 && d.dob_m && d.dob_d ? `${d.dob_y}-${d.dob_m.padStart(2, "0")}-${d.dob_d.padStart(2, "0")}` : null;
  const canNext = [!!d.county && !!d.gender, !!d.education_level, d.skills.length > 0, d.interests.length > 0][step];

  async function next() {
    setSaving(true);
    try {
      const { dob_d: _d, dob_m: _m, dob_y: _y, ...rest } = d!;
      const last = step === STEPS.length - 1;
      await put("/me/profile", { ...rest, date_of_birth: dob, onboarding_completed: last || undefined });
      if (!last) return setStep(step + 1);
      await qc.invalidateQueries({ queryKey: keys.profile });
      qc.invalidateQueries({ queryKey: keys.feed });
      if (!biometric) router.replace("/biometric-setup");
      else if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title={STEPS[step]} subtitle={`Step ${step + 1} of ${STEPS.length}`} back={step > 0 || router.canGoBack()} />
      <View style={{ paddingHorizontal: 20 }}><Progress step={step} /></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          <Animated.View key={step} entering={FadeInRight.duration(300)} style={{ gap: 18 }}>
            {step === 0 && (
              <>
                <T v="body" style={{ color: colors.ink500 }}>This helps DEEN show you opportunities near you and ones you&apos;re eligible for.</T>
                <T v="label">I am a</T>
                <View style={styles.row}>
                  {[["male", "Brother"], ["female", "Sister"]].map(([v, l]) => (
                    <Tap key={v} onPress={() => set("gender", v)} style={[styles.big, d.gender === v && styles.bigOn]}>
                      <Text style={[styles.bigText, d.gender === v && { color: colors.emerald800 }]}>{l}</Text>
                      {d.gender === v && <Check size={18} color={colors.emerald700} />}
                    </Tap>
                  ))}
                </View>
                <T v="label">Date of birth</T>
                <View style={styles.row}>
                  {([["dob_d", "DD", 2], ["dob_m", "MM", 2], ["dob_y", "YYYY", 4]] as const).map(([k, ph, len]) => (
                    <TextInput key={k} value={d[k]} onChangeText={(v) => set(k, v.replace(/\D/g, "").slice(0, len))} placeholder={ph} keyboardType="number-pad"
                      placeholderTextColor={colors.ink300} style={[styles.dob, { flex: len === 4 ? 1.6 : 1 }]} />
                  ))}
                </View>
                <T v="label">County {d.county ? `· ${d.county}` : ""}</T>
                <Input placeholder="Search counties" value={countyQ} onChangeText={setCountyQ} />
                <View style={styles.wrap}>
                  {counties.slice(0, countyQ ? 47 : 14).map((c) => <Chip key={c} label={c} active={d.county === c} onPress={() => set("county", c)} />)}
                </View>
                <Input label="Town (optional)" value={d.town ?? ""} onChangeText={(v) => set("town", v)} placeholder="e.g. Eastleigh, Old Town" />
              </>
            )}
            {step === 1 && (
              <>
                <T v="label">Highest education level</T>
                <View style={styles.wrap}>{tax.education_levels.map((e) => <Chip key={e.key} label={e.name} active={d.education_level === e.key} onPress={() => set("education_level", e.key)} />)}</View>
                <Input label="Field of study" value={d.field_of_study ?? ""} onChangeText={(v) => set("field_of_study", v)} placeholder="e.g. Computer Science, Nursing, Islamic Studies" />
                <Input label="School / university (optional)" value={d.institution ?? ""} onChangeText={(v) => set("institution", v)} />
                <T v="label">Right now I&apos;m</T>
                <View style={styles.wrap}>{tax.employment_statuses.map((e) => <Chip key={e.key} label={e.name} active={d.employment_status === e.key} onPress={() => set("employment_status", e.key)} />)}</View>
                <Input label="Profession (optional)" value={d.profession ?? ""} onChangeText={(v) => set("profession", v)} placeholder="e.g. Teacher, Accountant" />
              </>
            )}
            {step === 2 && (
              <>
                <T v="body" style={{ color: colors.ink500 }}>Pick your skills. DEEN uses them to match jobs, programmes and grants.</T>
                <View style={styles.addRow}>
                  <View style={{ flex: 1 }}><Input placeholder="Add your own skill" value={skill} onChangeText={setSkill} onSubmitEditing={() => { if (skill.trim()) { toggle("skills", skill.trim()); setSkill(""); } }} /></View>
                  <Tap onPress={() => { if (skill.trim()) { toggle("skills", skill.trim()); setSkill(""); } }} style={styles.addBtn}><Plus size={22} color={colors.white} /></Tap>
                </View>
                <View style={styles.wrap}>
                  {[...new Set([...d.skills, ...tax.skills])].map((s) => <Chip key={s} label={s} active={d.skills.includes(s)} onPress={() => toggle("skills", s)} />)}
                </View>
                <T v="label">Languages</T>
                <View style={styles.wrap}>{tax.languages.map((l) => <Chip key={l} label={l} active={d.languages.includes(l)} onPress={() => toggle("languages", l)} />)}</View>
                <Input label="A line about you (optional)" value={d.bio ?? ""} onChangeText={(v) => set("bio", v)} multiline maxLength={600} style={{ minHeight: 80, textAlignVertical: "top" }} />
              </>
            )}
            {step === 3 && (
              <>
                <T v="body" style={{ color: colors.ink500 }}>What kind of opportunities do you want? Choose as many as you like.</T>
                <View style={styles.grid}>
                  {tax.categories.map((c) => {
                    const Icon = CATEGORY_ICON[c.key];
                    const on = d.interests.includes(c.key);
                    const meta = CATEGORY_META[c.key];
                    return (
                      <Tap key={c.key} onPress={() => toggle("interests", c.key)} style={[styles.cat, on && { borderColor: meta.color, backgroundColor: meta.tint }]}>
                        <Icon size={22} color={meta.color} />
                        <T v="bodyStrong" style={{ marginTop: 8 }}>{c.tab_label}</T>
                        {on && <View style={[styles.catCheck, { backgroundColor: meta.color }]}><Check size={12} color={colors.white} strokeWidth={3} /></View>}
                      </Tap>
                    );
                  })}
                </View>
                {tax.categories.filter((c) => d.interests.includes(c.key)).map((c) => (
                  <View key={c.key} style={{ gap: 8 }}>
                    <T v="label">{c.name}: specifically</T>
                    <View style={styles.wrap}>{c.types.map((t) => <Chip key={t.key} label={t.name} active={d.opportunity_types.includes(t.key)} onPress={() => toggle("opportunity_types", t.key)} />)}</View>
                  </View>
                ))}
              </>
            )}
          </Animated.View>
        </ScrollView>
        <View style={{ padding: 20, paddingTop: 8 }}>
          <Button title={step === STEPS.length - 1 ? "Show my matches" : "Continue"} loading={saving} disabled={!canNext} onPress={next} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sand200, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.gold500 },
  row: { flexDirection: "row", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  big: { flex: 1, height: 58, borderRadius: 16, borderWidth: 1.5, borderColor: colors.sand300, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bigOn: { borderColor: colors.emerald600, backgroundColor: colors.emerald50 },
  bigText: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink700 },
  dob: { height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.sand300, backgroundColor: colors.white, textAlign: "center", fontFamily: fonts.bold, fontSize: 18, color: colors.ink900 },
  addRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  addBtn: { width: 54, height: 54, borderRadius: 14, backgroundColor: colors.emerald700, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cat: { width: "48%", borderRadius: 18, borderWidth: 1.5, borderColor: colors.sand300, backgroundColor: colors.white, padding: 16 },
  catCheck: { position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
