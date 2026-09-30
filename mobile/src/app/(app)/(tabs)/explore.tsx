import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Compass, Search, SlidersHorizontal, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardSkeleton, InlineLoader } from "@/components/Loader";
import { CATEGORY_ICON, OpportunityCard } from "@/components/OpportunityCard";
import { Sheet } from "@/components/Sheet";
import { Button, Chip, Empty, IconButton, Segmented, T, Tap } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { useTaxonomy } from "@/lib/queries";
import { colors, fonts } from "@/lib/theme";
import type { OppCard } from "@/lib/types";

type Sort = "relevance" | "deadline" | "newest";
interface Filters { county: string; closing: string; remote: boolean; events: boolean; eligible: boolean; sort: Sort; type: string }
const EMPTY: Filters = { county: "", closing: "", remote: false, events: false, eligible: false, sort: "relevance", type: "" };

export default function Explore() {
  const params = useLocalSearchParams<{ category?: string; closing?: string }>();
  const { data: tax } = useTaxonomy();
  const [category, setCategory] = useState(params.category ?? "");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, closing: params.closing ?? "" });
  const [draft, setDraft] = useState(filters);
  const [open, setOpen] = useState(false);

  useEffect(() => { if (params.category !== undefined) setCategory(params.category); }, [params.category]);
  useEffect(() => { if (params.closing) setFilters((f) => ({ ...f, closing: params.closing! })); }, [params.closing]);

  const query = useInfiniteQuery({
    queryKey: ["explore", category, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      get<{ items: OppCard[]; has_more: boolean; total: number; page: number }>(`/opportunities${qs({
        category, type: filters.type, county: filters.county, closing_within: filters.closing, remote: filters.remote || undefined,
        events: filters.events || undefined, eligible_only: filters.eligible || undefined, sort: filters.sort, page: pageParam, limit: 20,
      })}`),
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const activeCount = [filters.county, filters.closing, filters.remote, filters.events, filters.eligible, filters.type, filters.sort !== "relevance"].filter(Boolean).length;
  const types = tax?.categories.find((c) => c.key === category)?.types ?? [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={styles.head}>
        <T v="title">Explore</T>
        <View style={styles.searchRow}>
          <Tap onPress={() => router.push("/search")} style={styles.search}>
            <Search size={18} color={colors.ink400} />
            <Text style={styles.searchText}>Scholarships, jobs, grants…</Text>
          </Tap>
          <View>
            <IconButton icon={SlidersHorizontal} label="Filters" onPress={() => { setDraft(filters); setOpen(true); }} bg={activeCount ? colors.emerald700 : colors.white} color={activeCount ? colors.white : colors.ink900} size={50} />
            {activeCount > 0 && <View style={styles.count}><Text style={styles.countText}>{activeCount}</Text></View>}
          </View>
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <Chip label="All" active={!category} onPress={() => { setCategory(""); setFilters((f) => ({ ...f, type: "" })); }} icon={Compass} />
          {tax?.categories.map((c) => (
            <Chip key={c.key} label={c.tab_label} active={category === c.key} icon={CATEGORY_ICON[c.key]} onPress={() => { setCategory(c.key); setFilters((f) => ({ ...f, type: "" })); }} />
          ))}
        </ScrollView>
        {types.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { paddingTop: 0 }]}>
            {types.map((t) => (
              <Tap key={t.key} onPress={() => setFilters((f) => ({ ...f, type: f.type === t.key ? "" : t.key }))} style={[styles.sub, filters.type === t.key && styles.subOn]}>
                <Text style={[styles.subText, filters.type === t.key && { color: colors.emerald800 }]}>{t.name}</Text>
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
          : <Empty icon={Compass} title="Nothing matches yet" body="Try another category or fewer filters. New opportunities are published every day." />}
        ListFooterComponent={query.isFetchingNextPage ? <InlineLoader /> : null}
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={colors.emerald700} colors={[colors.emerald700]} />}
        showsVerticalScrollIndicator={false}
      />

      <Sheet open={open} onClose={() => setOpen(false)} title="Filters"
        footer={<View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Reset" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(EMPTY)} />
          <Button title="Show results" style={{ flex: 2 }} onPress={() => { setFilters(draft); setOpen(false); }} />
        </View>}>
        <T v="label">Sort by</T>
        <Segmented value={draft.sort} onChange={(sort) => setDraft({ ...draft, sort })} options={[{ value: "relevance", label: "Best match" }, { value: "deadline", label: "Deadline" }, { value: "newest", label: "Newest" }]} />
        <T v="label">Closing within</T>
        <View style={styles.wrap}>
          {[["", "Any time"], ["3", "3 days"], ["7", "A week"], ["30", "A month"]].map(([v, l]) => <Chip key={v} label={l} active={draft.closing === v} onPress={() => setDraft({ ...draft, closing: v })} />)}
        </View>
        <T v="label">Show only</T>
        <View style={styles.wrap}>
          <Chip label="I'm eligible for" active={draft.eligible} onPress={() => setDraft({ ...draft, eligible: !draft.eligible })} />
          <Chip label="Remote" active={draft.remote} onPress={() => setDraft({ ...draft, remote: !draft.remote })} />
          <Chip label="Events" active={draft.events} onPress={() => setDraft({ ...draft, events: !draft.events })} />
        </View>
        <T v="label">County</T>
        <View style={styles.wrap}>
          <Chip label="Anywhere" active={!draft.county} onPress={() => setDraft({ ...draft, county: "" })} />
          {tax?.counties.map((c) => <Chip key={c} label={c} active={draft.county === c} onPress={() => setDraft({ ...draft, county: c })} />)}
        </View>
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
  countText: { fontFamily: fonts.bold, fontSize: 10, color: colors.emerald950 },
  tabs: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  sub: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.sand200 },
  subOn: { backgroundColor: colors.emerald100 },
  subText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink500 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  clear: { flexDirection: "row", alignItems: "center", gap: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
