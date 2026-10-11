import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Bell, BellRing, CalendarClock, CheckCheck, FileStack, Megaphone, Target, type LucideIcon } from "lucide-react-native";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InlineLoader } from "@/components/Loader";
import { Empty, Header, IconButton, T, Tap } from "@/components/ui";
import { get, post } from "@/lib/api";
import { routeFromNotification } from "@/lib/push";
import { keys } from "@/lib/queries";
import { colors } from "@/lib/theme";
import type { Notification } from "@/lib/types";

const ICON: Record<string, LucideIcon> = {
  matches: Target, deadlines: CalendarClock, applications: FileStack, subscription: BadgeCheck, announcements: Megaphone, organizations: BellRing,
};

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function Notifications() {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["notifications"],
    initialPageParam: "",
    queryFn: ({ pageParam }) => get<{ items: Notification[]; next_cursor: string | null }>(`/notifications${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (p) => p.next_cursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const refresh = () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: keys.unread }); };
  const readAll = useMutation({ mutationFn: () => post("/notifications/read-all"), onSuccess: refresh });
  const open = (n: Notification) => {
    if (!n.read) post(`/notifications/${n.id}/read`).then(refresh).catch(() => undefined);
    routeFromNotification(n.data);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Notifications" right={items.some((n) => !n.read) ? <IconButton icon={CheckCheck} label="Mark all read" onPress={() => readAll.mutate()} /> : undefined} />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        renderItem={({ item: n }) => {
          const Icon = ICON[n.kind] ?? Bell;
          return (
            <Tap onPress={() => open(n)} style={[styles.item, !n.read && styles.unread]} scale={0.99}>
              <View style={[styles.icon, !n.read && { backgroundColor: colors.gold50 }]}><Icon size={19} color={n.read ? colors.ink400 : colors.gold600} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{n.title}</T>
                  <T v="caption">{ago(n.created_at)}</T>
                </View>
                <T v="small" numberOfLines={3}>{n.body}</T>
              </View>
            </Tap>
          );
        }}
        ListEmptyComponent={q.isLoading ? <InlineLoader /> : <Empty icon={Bell} title="All caught up" body="New matches, deadline reminders and application updates will appear here." />}
        ListFooterComponent={q.isFetchingNextPage ? <InlineLoader /> : null}
        onEndReached={() => q.hasNextPage && q.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} colors={[colors.brand700]} tintColor={colors.brand700} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.sand200 },
  unread: { borderColor: colors.gold400, backgroundColor: "#FFFDF7" },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.sand100, alignItems: "center", justifyContent: "center" },
});
