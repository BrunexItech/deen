import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BadgeCheck, MapPin, Plus, Search, Store } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardSkeleton } from "@/components/Loader";
import { Badge, Chip, Empty, Header, IconButton, Input, T, Tap } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { colors } from "@/lib/theme";
import type { Listing } from "@/lib/types";

export default function Directory() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(text), 300); return () => clearTimeout(t); }, [text]);
  const cats = useQuery({ queryKey: ["dir-cats"], queryFn: () => get<{ key: string; label: string }[]>("/directory/categories"), staleTime: Infinity });
  const list = useQuery({ queryKey: ["directory", q, category], queryFn: () => get<Listing[]>(`/directory${qs({ q, category })}`) });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Halal directory" subtitle="Muslim businesses & professionals" right={<IconButton icon={Plus} label="List yours" onPress={() => router.push("/directory/mine")} />} />
      <View style={{ paddingHorizontal: 20 }}><Input icon={Search} placeholder="Doctors, caterers, tutors…" value={text} onChangeText={setText} /></View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}>
          <Chip label="All" active={!category} onPress={() => setCategory("")} />
          {cats.data?.map((c) => <Chip key={c.key} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />)}
        </ScrollView>
      </View>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}
        renderItem={({ item: d }) => (
          <Tap onPress={() => router.push(`/directory/${d.id}`)} style={styles.card} scale={0.985}>
            <View style={styles.icon}><Store size={20} color={colors.emerald700} /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <T v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{d.name}</T>
                {d.verified && <BadgeCheck size={15} color={colors.emerald600} />}
              </View>
              <T v="small" numberOfLines={1}>{d.headline}</T>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" }}>
                <Badge label={d.category_label} />
                {d.halal_certified && <Badge label="Halal certified" tone="good" />}
                {d.county && <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><MapPin size={12} color={colors.ink400} /><T v="caption">{d.county}</T></View>}
              </View>
            </View>
          </Tap>
        )}
        ListEmptyComponent={list.isLoading ? <CardSkeleton /> : <Empty icon={Store} title="No listings yet" body="Run a business or practice? List it free and reach the community." action="List my business" onAction={() => router.push("/directory/mine")} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.sand200 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.emerald50, alignItems: "center", justifyContent: "center" },
});
