import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Bell, ChevronRight, Crown, Search, Sparkles, UserRoundPen } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeedSkeleton } from "@/components/Loader";
import { CATEGORY_ICON, FeaturedCard, OpportunityCard } from "@/components/OpportunityCard";
import { ReminderCard } from "@/components/Reminder";
import { Card, ErrorState, IconButton, Section, T, Tap } from "@/components/ui";
import { hijriLabel } from "@/lib/faith";
import { useFeed, useProfile, useToday, useUnread } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { CATEGORY_META, colors, fonts } from "@/lib/theme";
import { fmtTime, usePrayer } from "@/lib/usePrayer";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const user = useSession((s) => s.user);
  const feed = useFeed();
  const today = useToday();
  const unread = useUnread();
  const profile = useProfile();
  const prayer = usePrayer();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([feed.refetch(), today.refetch(), unread.refetch()]);
    setRefreshing(false);
  }, [feed, today, unread]);

  const f = feed.data;
  const first = user?.full_name.split(" ")[0] ?? "";

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.emerald700} colors={[colors.emerald700]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <T v="small">{greeting()} · {hijriLabel()}</T>
            <T v="title" numberOfLines={1}>Assalamu alaikum, {first}</T>
          </View>
          <IconButton icon={Search} label="Search" onPress={() => router.push("/search")} />
          <IconButton icon={Bell} label="Notifications" badge={unread.data?.count} onPress={() => router.push("/notifications")} />
        </View>

        {prayer && (
          <Tap onPress={() => router.push("/deen")} style={styles.prayer}>
            <View style={styles.prayerDot} />
            <Text style={styles.prayerText}>
              <Text style={{ fontFamily: fonts.bold }}>{prayer.next.name}</Text> at {fmtTime(prayer.next.at)} · in {prayer.countdown}
            </Text>
            <Text style={styles.prayerPlace}>{prayer.place}</Text>
          </Tap>
        )}

        {feed.isLoading ? <FeedSkeleton /> : feed.isError ? <ErrorState message={(feed.error as Error).message} onRetry={() => feed.refetch()} /> : f && (
          <>
            <Animated.View entering={FadeInDown.duration(500)} style={{ paddingHorizontal: 20, marginTop: 16 }}>
              <LinearGradient colors={[colors.emerald700, colors.emerald950]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroGlow} />
                <T v="overline" color={colors.gold400}>Matched for you today</T>
                <Text style={styles.heroNumber}>{f.total_matches}</Text>
                <T v="body" color={colors.emerald100}>
                  {f.total_matches === 1 ? "opportunity matches" : "opportunities match"} your profile
                </T>
                <View style={styles.heroChips}>
                  {f.summary.map((s) => {
                    const Icon = CATEGORY_ICON[s.category] ?? Sparkles;
                    return (
                      <Tap key={s.category} onPress={() => router.push({ pathname: "/explore", params: { category: s.category } })} style={styles.heroChip}>
                        <Icon size={13} color={colors.gold400} />
                        <Text style={styles.heroChipText}>{s.count} {CATEGORY_META[s.category]?.label ?? s.category}</Text>
                      </Tap>
                    );
                  })}
                </View>
              </LinearGradient>
            </Animated.View>

            {(!f.profile_ready || (profile.data && profile.data.completeness < 70)) && (
              <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
                <Card onPress={() => router.push("/onboarding")} style={styles.prompt}>
                  <View style={styles.promptIcon}><UserRoundPen size={20} color={colors.emerald700} /></View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">Complete your profile ({profile.data?.completeness ?? 0}%)</T>
                    <T v="small">Better matches, fewer irrelevant opportunities.</T>
                  </View>
                  <ChevronRight size={18} color={colors.ink400} />
                </Card>
              </View>
            )}

            {today.data?.reminder && (
              <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
                <ReminderCard r={today.data.reminder} />
              </View>
            )}

            {f.featured.length > 0 && (
              <Section title="Featured">
                <FlatList horizontal data={f.featured} keyExtractor={(o) => o.id} renderItem={({ item }) => <FeaturedCard o={item} />}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} showsHorizontalScrollIndicator={false} />
              </Section>
            )}

            {f.closing_soon.length > 0 && (
              <Section title="Closing soon" action="See all" onAction={() => router.push({ pathname: "/explore", params: { closing: "7" } })}>
                <FlatList horizontal data={f.closing_soon} keyExtractor={(o) => o.id} renderItem={({ item }) => <OpportunityCard o={item} compact />}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} showsHorizontalScrollIndicator={false} />
              </Section>
            )}

            {f.tier === "free" && (
              <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
                <Tap onPress={() => router.push("/membership")}>
                  <LinearGradient colors={["#F3DD9E", colors.gold500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upsell}>
                    <Crown size={22} color={colors.emerald950} />
                    <View style={{ flex: 1 }}>
                      <T v="bodyStrong" color={colors.emerald950}>Unlock every opportunity</T>
                      <T v="small" color={colors.emerald900}>Unlimited applications, member-only listings and smart alerts.</T>
                    </View>
                    <ChevronRight size={18} color={colors.emerald950} />
                  </LinearGradient>
                </Tap>
              </View>
            )}

            <Section title="Recommended for you" action="Explore" onAction={() => router.push("/explore")}>
              <View style={{ paddingHorizontal: 20, gap: 12 }}>
                {f.for_you.length === 0 && <T v="small">New opportunities are reviewed every day. Check back soon, in sha Allah.</T>}
                {f.for_you.map((o, i) => (
                  <Animated.View key={o.id} entering={FadeInDown.delay(Math.min(i, 6) * 60).duration(400)}>
                    <OpportunityCard o={o} />
                  </Animated.View>
                ))}
              </View>
            </Section>

            {f.events.length > 0 && (
              <Section title="Upcoming events">
                <FlatList horizontal data={f.events} keyExtractor={(o) => o.id} renderItem={({ item }) => <OpportunityCard o={item} compact />}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} showsHorizontalScrollIndicator={false} />
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 10 },
  prayer: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.sand200 },
  prayerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold500 },
  prayerText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink700 },
  prayerPlace: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink400 },
  hero: { borderRadius: 26, padding: 22, overflow: "hidden" },
  heroGlow: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(201,163,78,0.16)", top: -120, right: -80 },
  heroNumber: { fontFamily: fonts.extrabold, fontSize: 56, lineHeight: 64, color: colors.white, marginTop: 4 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(223,192,122,0.25)" },
  heroChipText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.white },
  prompt: { flexDirection: "row", alignItems: "center", gap: 12 },
  promptIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.emerald50, alignItems: "center", justifyContent: "center" },
  upsell: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, padding: 16 },
});
