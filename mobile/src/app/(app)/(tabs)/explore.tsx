import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Compass, Search, SlidersHorizontal, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardSkeleton, InlineLoader } from "@/components/Loader";
import { CATEGORY_ICON, OpportunityCard } from "@/components/OpportunityCard";
import { Sheet } from "@/components/Sheet";
import { Button, Chip, Empty, IconButton, Input, Segmented, T, Tap } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { useTaxonomy } from "@/lib/queries";
import { colors, fonts } from "@/lib/theme";
import type { OppCard } from "@/lib/types";

type Sort = "relevance" | "deadline" | "newest";

// Every filter in the spec (sections 8, 10, 11, 25). Empty string / false = not applied.
const EMPTY = {
  sort: "relevance" as Sort, types: "", country: "", county: "", closing: "", work_mode: "", compensation: "",
  duration: "", scope: "", industry: "", education_level: "", field_of_study: "", max_experience: "", cause: "",
  eligible: false, weekend: false, student_friendly: false, certificate: false, islamic: false, events: false,
};
type Filters = typeof EMPTY;

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T v="label">{label}</T>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

export default function Explore() {
  const params = useLocalSearchParams<{ category?: string; closing?: string; types?: string; sort?: Sort }>();
  const { data: tax } = useTaxonomy();
  const [category, setCategory] = useState(params.category ?? "");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, closing: params.closing ?? "", types: params.types ?? "", sort: params.sort ?? "relevance" });
  const [draft, setDraft] = useState(filters);
  const [open, setOpen] = useState(false);

  // Deep links from Home / Hub re-apply their preset.
  useEffect(() => {
    if (params.category !== undefined || params.types !== undefined || params.closing || params.sort) {
      setCategory(params.category ?? "");
      setFilters({ ...EMPTY, types: params.types ?? "", closing: params.closing ?? "", sort: params.sort ?? "relevance" });
    }
  }, [params.category, params.types, params.closing, params.sort]);

  const query = useInfiniteQuery({
    queryKey: ["explore", category, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => get<{ items: OppCard[]; has_more: boolean; total: number; page: number }>(`/opportunities${qs({
      category, types: filters.types, country: filters.country, county: filters.county, closing_within: filters.closing,
      work_mode: filters.work_mode, compensation: filters.compensation, duration: filters.duration, scope: filters.scope,
      industry: filters.industry, education_level: filters.education_level, field_of_study: filters.field_of_study,
      max_experience: filters.max_experience, cause: filters.cause, eligible_only: filters.eligible || undefined,
      weekend: filters.weekend || undefined, student_friendly: filters.student_friendly || undefined,
      certificate: filters.certificate || undefined, islamic: filters.islamic || undefined, events: filters.events || undefined,
      sort: filters.sort, page: pageParam, limit: 20,
    })}`),
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "sort" && v && v !== EMPTY[k as keyof Filters]).length + (filters.sort !== "relevance" ? 1 : 0);
  const types = tax?.categories.find((c) => c.key === category)?.types ?? [];
  const d = draft;
  const pick = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft({ ...d, [k]: d[k] === v ? EMPTY[k] : v });
  const typeSel = (t: string) => filters.types.split(",").includes(t);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={styles.head}>
        <T v="title">Explore</T>
        <View style={styles.searchRow}>
          <Tap onPress={() => router.push("/search")} style={styles.search}>
            <Search size={18} color={colors.ink400} />
            <Text style={styles.searchText}>What are you looking for?</Text>
          </Tap>
          <View>
            <IconButton icon={SlidersHorizontal} label="Filters" onPress={() => { setDraft(filters); setOpen(true); }} bg={activeCount ? colors.brand700 : colors.white} color={activeCount ? colors.white : colors.ink900} size={50} />
            {activeCount > 0 && <View style={styles.count}><Text style={styles.countText}>{activeCount}</Text></View>}
          </View>
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <Chip label="All" active={!category} onPress={() => { setCategory(""); setFilters((f) => ({ ...f, types: "" })); }} icon={Compass} />
          {tax?.categories.map((c) => (
            <Chip key={c.key} label={c.tab_label} active={category === c.key} icon={CATEGORY_ICON[c.key]} onPress={() => { setCategory(c.key); setFilters((f) => ({ ...f, types: "" })); }} />
          ))}
        </ScrollView>
        {types.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { paddingTop: 0 }]}>
            {types.map((t) => (
              <Tap key={t.key} onPress={() => setFilters((f) => ({ ...f, types: f.types === t.key ? "" : t.key }))} style={[styles.sub, typeSel(t.key) && styles.subOn]}>
                <Text style={[styles.subText, typeSel(t.key) && { color: colors.brand800 }]}>{t.name}</Text>
              </Tap>
            ))}
          </ScrollView>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <OpportunityCard o={item} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 12 }}
        ListHeaderComponent={!query.isLoading ? (
          <View style={styles.resultRow}>
            <T v="small">{total} {total === 1 ? "opportunity" : "opportunities"}</T>
            {activeCount > 0 && <Tap onPress={() => setFilters(EMPTY)} style={styles.clear}><X size={13} color={colors.ink500} /><T v="caption">Clear filters</T></Tap>}
          </View>
        ) : null}
        ListEmptyComponent={query.isLoading ? <View style={{ gap: 12 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
          : <Empty icon={Compass} title="Nothing matches yet" body="Try another category or fewer filters. New opportunities are verified every day." />}
        ListFooterComponent={query.isFetchingNextPage ? <InlineLoader /> : null}
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={colors.brand700} colors={[colors.brand700]} />}
        showsVerticalScrollIndicator={false}
      />

      <Sheet open={open} onClose={() => setOpen(false)} title="Filters"
        footer={<View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Reset" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(EMPTY)} />
          <Button title="Show results" style={{ flex: 2 }} onPress={() => { setFilters(draft); setOpen(false); }} />
        </View>}>
        <T v="label">Sort by</T>
        <Segmented value={d.sort} onChange={(sort) => setDraft({ ...d, sort })} options={[{ value: "relevance", label: "Best match" }, { value: "deadline", label: "Deadline" }, { value: "newest", label: "Newest" }]} />
        <Group label="Show only">
          <Chip label="I'm eligible for" active={d.eligible} onPress={() => setDraft({ ...d, eligible: !d.eligible })} />
          <Chip label="Islamic-friendly" active={d.islamic} onPress={() => setDraft({ ...d, islamic: !d.islamic })} />
          <Chip label="Student-friendly" active={d.student_friendly} onPress={() => setDraft({ ...d, student_friendly: !d.student_friendly })} />
          <Chip label="Certificate provided" active={d.certificate} onPress={() => setDraft({ ...d, certificate: !d.certificate })} />
          <Chip label="Weekends" active={d.weekend} onPress={() => setDraft({ ...d, weekend: !d.weekend })} />
          <Chip label="Events" active={d.events} onPress={() => setDraft({ ...d, events: !d.events })} />
        </Group>
        <Group label="Deadline">
          {[["3", "3 days"], ["7", "A week"], ["30", "A month"]].map(([v, l]) => <Chip key={v} label={l} active={d.closing === v} onPress={() => pick("closing", v)} />)}
        </Group>
        <Group label="Work mode">
          {tax?.work_modes.map((w) => <Chip key={w.key} label={w.name} active={d.work_mode === w.key} onPress={() => pick("work_mode", w.key)} />)}
        </Group>
        <Group label="Pay">
          {[["paid", "Paid / stipend"], ["unpaid", "Unpaid"]].map(([v, l]) => <Chip key={v} label={l} active={d.compensation === v} onPress={() => pick("compensation", v)} />)}
        </Group>
        <Group label="Duration">
          {[["short", "Up to 1 month"], ["medium", "1–3 months"], ["long", "Over 3 months"]].map(([v, l]) => <Chip key={v} label={l} active={d.duration === v} onPress={() => pick("duration", v)} />)}
        </Group>
        <Group label="Local or international">
          {[["local", "Local"], ["international", "International"]].map(([v, l]) => <Chip key={v} label={l} active={d.scope === v} onPress={() => pick("scope", v)} />)}
        </Group>
        <Group label="Education level">
          {tax?.education_levels.map((e) => <Chip key={e.key} label={e.name} active={d.education_level === e.key} onPress={() => pick("education_level", e.key)} />)}
        </Group>
        <Input label="Course / field of study" value={d.field_of_study} onChangeText={(v) => setDraft({ ...d, field_of_study: v })} placeholder="e.g. Business, Nursing, IT" />
        <Group label="My experience (years)">
          {[["0", "None yet"], ["1", "1 year"], ["3", "3 years"], ["5", "5+ years"]].map(([v, l]) => <Chip key={v} label={l} active={d.max_experience === v} onPress={() => pick("max_experience", v)} />)}
        </Group>
        <Group label="Industry">
          {tax?.industries.map((i) => <Chip key={i} label={i} active={d.industry === i} onPress={() => pick("industry", i)} />)}
        </Group>
        <Group label="Volunteer cause">
          {tax?.causes.map((c) => <Chip key={c.key} label={c.name} active={d.cause === c.key} onPress={() => pick("cause", c.key)} />)}
        </Group>
        <Group label="Country">
          {tax?.countries.slice(0, 12).map((c) => <Chip key={c} label={c} active={d.country === c} onPress={() => pick("country", c)} />)}
        </Group>
        <Group label="County">
          {tax?.counties.map((c) => <Chip key={c} label={c} active={d.county === c} onPress={() => pick("county", c)} />)}
        </Group>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 10, gap: 14 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: 50, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.sand200 },
  searchText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink300 },
  count: { position: "absolute", top: -4, right: -4, backgroundColor: colors.gold500, borderRadius: 9, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.sand100 },
  countText: { fontFamily: fonts.bold, fontSize: 10, color: colors.brand950 },
  tabs: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  sub: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.sand200 },
  subOn: { backgroundColor: colors.brand100 },
  subText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink500 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  clear: { flexDirection: "row", alignItems: "center", gap: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
