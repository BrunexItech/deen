import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Search as SearchIcon, Store, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InlineLoader } from "@/components/Loader";
import { OpportunityCard, OrgLogo, Verified } from "@/components/OpportunityCard";
import { Chip, Empty, T, Tap } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";
import type { OppCard, OrgMini } from "@/lib/types";

interface Results {
  opportunities: OppCard[]; events: OppCard[]; organizations: (OrgMini & { tagline: string | null })[];
  directory: { id: string; name: string; headline: string; category_label: string; county: string | null; verified: boolean }[];
}

const SUGGESTIONS = ["Scholarship", "Internship", "Nursing", "Startup grant", "Zakat", "Arabic", "Remote", "Mentorship"];

export default function Search() {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const q = useQuery({ queryKey: ["search", term], queryFn: () => get<Results>(`/search${qs({ q: term })}`), enabled: term.length >= 2 });
  const r = q.data;
  const nothing = r && !r.opportunities.length && !r.events.length && !r.organizations.length && !r.directory.length;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.bar}>
        <Tap onPress={() => router.back()} hitSlop={10}><ArrowLeft size={22} color={colors.ink900} /></Tap>
        <View style={styles.input}>
          <SearchIcon size={18} color={colors.ink400} />
          <TextInput autoFocus value={text} onChangeText={setText} placeholder="Search DEEN" placeholderTextColor={colors.ink300} style={styles.text} returnKeyType="search" />
          {!!text && <Tap onPress={() => setText("")} hitSlop={10}><X size={18} color={colors.ink400} /></Tap>}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {term.length < 2 ? (
          <>
            <T v="label">Popular searches</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{SUGGESTIONS.map((s) => <Chip key={s} label={s} onPress={() => setText(s)} />)}</View>
          </>
        ) : q.isLoading ? <InlineLoader label="Searching" /> : nothing ? (
          <Empty icon={SearchIcon} title={`Nothing for “${term}”`} body="Try a broader word, or browse by category in Explore." />
        ) : r && (
          <>
            {r.organizations.length > 0 && <T v="overline">Organizations</T>}
            {r.organizations.map((o) => (
              <Tap key={o.id} onPress={() => router.push(`/organization/${o.id}`)} style={styles.row}>
                <OrgLogo org={o} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}><T v="bodyStrong">{o.name}</T><Verified org={o} /></View>
                  {o.tagline && <T v="caption" numberOfLines={1}>{o.tagline}</T>}
                </View>
              </Tap>
            ))}
            {r.opportunities.length > 0 && <T v="overline" style={{ marginTop: 8 }}>Opportunities</T>}
            {r.opportunities.map((o) => <OpportunityCard key={o.id} o={o} />)}
            {r.events.length > 0 && <T v="overline" style={{ marginTop: 8 }}>Events</T>}
            {r.events.map((o) => <OpportunityCard key={o.id} o={o} />)}
            {r.directory.length > 0 && <T v="overline" style={{ marginTop: 8 }}>Businesses & professionals</T>}
            {r.directory.map((d) => (
              <Tap key={d.id} onPress={() => router.push(`/directory/${d.id}`)} style={styles.row}>
                <View style={styles.store}><Store size={18} color={colors.emerald700} /></View>
                <View style={{ flex: 1 }}><T v="bodyStrong">{d.name}</T><T v="caption" numberOfLines={1}>{d.headline}</T></View>
              </Tap>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  input: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: 50, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1.5, borderColor: colors.emerald600 },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink900 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.sand200 },
  store: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.emerald50, alignItems: "center", justifyContent: "center" },
});
