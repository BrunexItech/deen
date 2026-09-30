import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InlineLoader } from "@/components/Loader";
import { ReminderCard } from "@/components/Reminder";
import { Chip, Header } from "@/components/ui";
import { get, qs } from "@/lib/api";
import type { Reminder } from "@/lib/types";

export default function Reminders() {
  const [kind, setKind] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["reminders", kind], queryFn: () => get<Reminder[]>(`/content/reminders${qs({ kind })}`) });
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Du'as & reminders" subtitle="Qur'an, hadith and du'a for your journey" />
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}>
        {[["", "All"], ["ayah", "Qur'an"], ["hadith", "Hadith"], ["dua", "Du'a"]].map(([k, l]) => <Chip key={k} label={l} active={kind === k} onPress={() => setKind(k)} />)}
      </View>
      <FlatList data={data ?? []} keyExtractor={(r) => r.id} contentContainerStyle={{ padding: 20, gap: 12 }}
        renderItem={({ item, index }) => <ReminderCard r={item} dark={index % 3 === 0} />}
        ListEmptyComponent={isLoading ? <InlineLoader /> : null} />
    </SafeAreaView>
  );
}
