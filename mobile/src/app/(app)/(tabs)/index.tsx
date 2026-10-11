import { router } from "expo-router";
import {
  Award, Bell, BookOpen, Briefcase, Building2, ChevronRight, ClipboardList, FileStack, GraduationCap, HandHeart, Landmark,
  Search, TrendingUp, UserRoundPen, Users, type LucideIcon,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeedSkeleton } from "@/components/Loader";
import { FeaturedCard, OpportunityCard } from "@/components/OpportunityCard";
import { Card, ErrorState, IconButton, Section, T, Tap } from "@/components/ui";
import { hijriLabel } from "@/lib/faith";
import { useFeed, useProfile, useUnread } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { colors, fonts } from "@/lib/theme";
import type { OppCard } from "@/lib/types";
import { fmtTime, usePrayer } from "@/lib/usePrayer";

// Home categories (spec section 33). Each opens Explore pre-filtered.
const QUICK: { label: string; icon: LucideIcon; params: Record<string, string>; color: string }[] = [
  { label: "Scholarships", icon: GraduationCap, params: { types: "scholarship" }, color: "#086769" },
  { label: "Grants", icon: Award, params: { types: "business_grant,funding,education_assistance" }, color: "#C98516" },
  { label: "Jobs", icon: Briefcase, params: { types: "job,graduate_trainee" }, color: "#087D7E" },
  { label: "Attachments", icon: Building2, params: { types: "attachment" }, color: "#2E9A2E" },
  { label: "Internships", icon: ClipboardList, params: { types: "internship" }, color: "#7C3AED" },
  { label: "Volunteer", icon: HandHeart, params: { types: "volunteer" }, color: "#BE123C" },
  { label: "Training", icon: BookOpen, params: { types: "training,workshop,seminar,certification" }, color: "#0F766E" },
  { label: "Fellowships", icon: Users, params: { types: "fellowship" }, color: "#0B7C7D" },
  { label: "Business", icon: TrendingUp, params: { category: "entrepreneurship" }, color: "#B45309" },
  { label: "Islamic Economy", icon: Landmark, params: { category: "islamic_economy" }, color: "#6D28D9" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Rail({ data }: { data: OppCard[] }) {
  return (
    <FlatList horizontal data={data} keyExtractor={(o) => o.id} renderItem={({ item }) => <OpportunityCard o={item} compact />}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} showsHorizontalScrollIndicator={false} />
  );
}

export default function Home() {
  const user = useSession((s) => s.user);
  const feed = useFeed();
  const unread = useUnread();
  const profile = useProfile();
  const prayer = usePrayer();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([feed.refetch(), unread.refetch(), profile.refetch()]);
    setRefreshing(false);
  }, [feed, unread, profile]);

  const f = feed.data;
  const first = user?.full_name.split(" ")[0] ?? "";

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand700} colors={[colors.brand700]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <T v="small">{greeting()} · {hijriLabel()}</T>
            <T v="title" numberOfLines={1}>Assalamu alaikum, {first}</T>
          </View>
          <IconButton icon={Bell} label="Notifications" badge={unread.data?.count} onPress={() => router.push("/notifications")} />
        </View>

        <Tap onPress={() => router.push("/search")} style={styles.search}>
          <Search size={19} color={colors.ink400} />
          <Text style={styles.searchText}>What are you looking for?</Text>
        </Tap>

        {prayer && (
          <Tap onPress={() => router.push("/deen")} style={styles.prayer}>
            <View style={styles.prayerDot} />
            <Text style={styles.prayerText}><Text style={{ fontFamily: fonts.bold }}>{prayer.next.name}</Text> at {fmtTime(prayer.next.at)} · in {prayer.countdown}</Text>
          </Tap>
        )}

        {feed.isLoading ? <FeedSkeleton /> : feed.isError ? <ErrorState message={(feed.error as Error).message} onRetry={() => feed.refetch()} /> : f && (
          <>
            <Animated.View entering={FadeInDown.duration(500)} style={{ paddingHorizontal: 20, marginTop: 16 }}>
              <Tap onPress={() => router.push("/explore")} style={styles.hero}>
                <View style={{ flex: 1 }}>
                  <T v="overline" color={colors.gold400}>Matched to you</T>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                    <Text style={styles.heroNumber}>{f.total_matches}</Text>
                    <T v="body" color={colors.brand100}>{f.total_matches === 1 ? "opportunity" : "opportunities"}</T>
                  </View>
                  {f.headline && <Text style={styles.headline} numberOfLines={2}>{f.headline}</Text>}
                </View>
                <ChevronRight size={22} color={colors.gold400} />
              </Tap>
            </Animated.View>

            {(!f.profile_ready || (profile.data && profile.data.completeness < 70)) && (
              <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
                <Card onPress={() => router.push("/onboarding")} style={styles.prompt}>
                  <View style={styles.promptIcon}><UserRoundPen size={20} color={colors.brand700} /></View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">Complete your profile ({profile.data?.completeness ?? 0}%)</T>
                    <T v="small">Better matches, fewer irrelevant opportunities.</T>
                  </View>
                  <ChevronRight size={18} color={colors.ink400} />
                </Card>
              </View>
            )}

            <Section title="Categories">
              <View style={styles.grid}>
                {QUICK.map(({ label, icon: Icon, params, color }) => (
                  <View key={label} style={styles.cell}>
                    <Tap onPress={() => router.push({ pathname: "/explore", params })} style={styles.quick}>
                      <View style={[styles.quickIcon, { backgroundColor: `${color}14` }]}><Icon size={20} color={color} /></View>
                      <Text style={styles.quickText} numberOfLines={1}>{label}</Text>
                    </Tap>
                  </View>
                ))}
              </View>
            </Section>

            <View style={styles.shortcuts}>
              {([
                [FileStack, "My applications", f.active_applications === 1 ? "1 in progress" : `${f.active_applications} in progress`, "/applications", colors.brand700],
                [GraduationCap, "Student & Graduate Hub", "Study, experience, career and growth", "/hub", colors.gold600],
              ] as const).map(([Icon, title, sub, href, color], i) => (
                <View key={href}>
                  {i > 0 && <View style={styles.rule} />}
                  <Tap onPress={() => router.push(href)} style={styles.shortcut} scale={0.99}>
                    <View style={[styles.shortcutIcon, { backgroundColor: `${color}14` }]}><Icon size={20} color={color} /></View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyStrong">{title}</T>
                      <T v="caption" numberOfLines={1}>{sub}</T>
                    </View>
                    <ChevronRight size={18} color={colors.ink300} />
                  </Tap>
                </View>
              ))}
            </View>

            <Section title="Recommended for you" action="See all" onAction={() => router.push("/explore")}>
              <View style={{ paddingHorizontal: 20, gap: 12 }}>
                {f.for_you.length === 0 && <T v="small">New opportunities are verified every day. Complete your profile to see your matches.</T>}
                {f.for_you.slice(0, 6).map((o, i) => (
                  <Animated.View key={o.id} entering={FadeInDown.delay(Math.min(i, 5) * 60).duration(400)}>
                    <OpportunityCard o={o} />
                  </Animated.View>
                ))}
              </View>
            </Section>

            {f.closing_soon.length > 0 && (
              <Section title="Closing soon" action="See all" onAction={() => router.push({ pathname: "/explore", params: { closing: "7", sort: "deadline" } })}>
                <Rail data={f.closing_soon} />
              </Section>
            )}

            {f.new.length > 0 && (
              <Section title="New opportunities" action="See all" onAction={() => router.push({ pathname: "/explore", params: { sort: "newest" } })}>
                <Rail data={f.new} />
              </Section>
            )}

            {f.featured.length > 0 && (
              <Section title="Featured">
                <FlatList horizontal data={f.featured} keyExtractor={(o) => o.id} renderItem={({ item }) => <FeaturedCard o={item} />}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} showsHorizontalScrollIndicator={false} />
              </Section>
            )}

            {f.events.length > 0 && <Section title="Upcoming events"><Rail data={f.events} /></Section>}

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 10 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginTop: 14, height: 52, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.sand300 },
  searchText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink400 },
  prayer: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 10, paddingHorizontal: 14, paddingVertical: 8 },
  prayerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold500 },
  prayerText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink500 },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, padding: 20, backgroundColor: colors.brand900 },
  heroNumber: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46, color: colors.white },
  headline: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: "rgba(255,255,255,0.75)", marginTop: 6 },
  prompt: { flexDirection: "row", alignItems: "center", gap: 12 },
  promptIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14 },
  cell: { width: "20%" },
  quick: { alignItems: "center", paddingVertical: 8, gap: 6 },
  quickIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  quickText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.ink700, textAlign: "center" },
  shortcuts: { marginHorizontal: 20, marginTop: 18, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.sand200, overflow: "hidden" },
  shortcut: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  shortcutIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rule: { height: 1, backgroundColor: colors.sand200, marginLeft: 66 },
});
