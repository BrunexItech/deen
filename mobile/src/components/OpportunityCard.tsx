import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BadgeCheck, Bookmark, BookmarkCheck, Briefcase, CalendarDays, Clock, Crown, GraduationCap, HeartHandshake, Landmark, Lock, MapPin, Rocket, Sparkles, Users, type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { apiConfig } from "@/lib/api";
import { useToggleSave } from "@/lib/queries";
import { CATEGORY_META, colors, fonts, radius, shadow } from "@/lib/theme";
import type { OppCard, OrgMini } from "@/lib/types";
import { Badge, T, Tap } from "./ui";
import { Image } from "expo-image";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  education: GraduationCap, career: Briefcase, entrepreneurship: Rocket, community: Users, islamic_economy: Landmark,
  support: HeartHandshake,
};

export function MatchRing({ score, size = 46, dark = false }: { score: number; size?: number; dark?: boolean }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? colors.brand500 : score >= 45 ? colors.gold500 : colors.ink300;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? "rgba(255,255,255,0.15)" : colors.sand200} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ fontFamily: fonts.extrabold, fontSize: size * 0.27, color: dark ? colors.white : colors.ink900 }}>{score}</Text>
    </View>
  );
}

export function OrgLogo({ org, size = 40 }: { org: Pick<OrgMini, "name" | "logo_url">; size?: number }) {
  const uri = apiConfig.fileUrl(org.logo_url);
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.3 }} contentFit="cover" transition={200} />;
  const initials = org.name.split(" ").filter((w) => /[A-Za-z]/.test(w[0])).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <LinearGradient colors={[colors.brand600, colors.brand800]} style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.bold, color: colors.gold400, fontSize: size * 0.36 }}>{initials}</Text>
    </LinearGradient>
  );
}

export function Verified({ org, size = 14 }: { org: Pick<OrgMini, "verification">; size?: number }) {
  if (org.verification === "pending") return null;
  return <BadgeCheck size={size} color={org.verification === "trusted" ? colors.gold500 : colors.brand500} fill={org.verification === "trusted" ? colors.gold50 : colors.brand50} />;
}

function deadlineLabel(o: OppCard) {
  if (o.is_event && o.starts_at) {
    return new Date(o.starts_at).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
  }
  if (o.days_left === null) return "Open";
  if (o.days_left === 0) return "Closes today";
  if (o.days_left === 1) return "Closes tomorrow";
  return `${o.days_left} days left`;
}

export function OpportunityCard({ o, compact = false }: { o: OppCard; compact?: boolean }) {
  const save = useToggleSave();
  const meta = CATEGORY_META[o.category] ?? CATEGORY_META.community;
  const Icon = CATEGORY_ICON[o.category] ?? Sparkles;
  const blocked = o.match && !o.match.eligible;
  return (
    <Tap onPress={() => router.push(`/opportunity/${o.id}`)} scale={0.985} style={[styles.card, compact && { width: 290 }]}>
      <View style={styles.top}>
        <OrgLogo org={o.organization} size={40} />
        <View style={{ flex: 1 }}>
          <View style={styles.orgRow}>
            <T v="caption" numberOfLines={1} style={{ flexShrink: 1, color: colors.ink500 }}>{o.organization.name}</T>
            <Verified org={o.organization} size={13} />
          </View>
          <T v="h3" numberOfLines={2} style={{ marginTop: 1 }}>{o.title}</T>
        </View>
        {o.match && !blocked ? <MatchRing score={o.match.score} size={44} /> : null}
      </View>
      {!!o.amount_label && <Text style={styles.amount} numberOfLines={1}>{o.amount_label}</Text>}
      {!compact && <T v="small" numberOfLines={2} style={{ marginTop: 6 }}>{o.summary}</T>}
      {o.match && o.match.reasons.length > 0 && !blocked && (
        <View style={styles.reason}>
          <Sparkles size={13} color={colors.gold600} />
          <T v="caption" numberOfLines={1} style={{ color: colors.gold700, flex: 1 }}>{o.match.reasons[0]}</T>
        </View>
      )}
      {blocked && (
        <View style={[styles.reason, { backgroundColor: colors.sand100 }]}>
          <T v="caption" numberOfLines={1} style={{ flex: 1 }}>{o.match!.blockers[0]}</T>
        </View>
      )}
      <View style={styles.footer}>
        <View style={[styles.cat, { backgroundColor: meta.tint }]}>
          <Icon size={12} color={meta.color} />
          <Text style={[styles.catText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={styles.metaItem}>
          {o.is_event ? <CalendarDays size={13} color={o.closing_soon ? colors.rose600 : colors.ink400} /> : <Clock size={13} color={o.closing_soon ? colors.rose600 : colors.ink400} />}
          <Text style={[styles.metaText, o.closing_soon && { color: colors.rose600 }]}>{deadlineLabel(o)}</Text>
        </View>
        <View style={[styles.metaItem, { flexShrink: 1 }]}>
          <MapPin size={13} color={colors.ink400} />
          <Text style={styles.metaText} numberOfLines={1}>{o.location}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {o.locked ? (
          <Badge label={o.access_tier === "premium" ? "Premium" : "Members"} tone="gold" icon={o.access_tier === "premium" ? Crown : Lock} />
        ) : (
          <Tap onPress={() => save.mutate(o)} hitSlop={10} haptic>
            {o.saved ? <BookmarkCheck size={20} color={colors.brand700} fill={colors.brand100} /> : <Bookmark size={20} color={colors.ink400} />}
          </Tap>
        )}
      </View>
    </Tap>
  );
}

/** Large, image-free hero card for featured opportunities. */
export function FeaturedCard({ o }: { o: OppCard }) {
  const meta = CATEGORY_META[o.category] ?? CATEGORY_META.community;
  const Icon = CATEGORY_ICON[o.category] ?? Sparkles;
  return (
    <Tap onPress={() => router.push(`/opportunity/${o.id}`)} scale={0.98} style={{ width: 300 }}>
      <LinearGradient colors={[colors.brand700, colors.brand950]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featured}>
        <View style={styles.featuredGlow} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={[styles.cat, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <Icon size={12} color={colors.gold400} />
            <Text style={[styles.catText, { color: colors.gold400 }]}>{meta.label}</Text>
          </View>
          {o.match?.eligible ? <MatchRing score={o.match.score} size={40} dark /> : null}
        </View>
        <T v="h2" color={colors.white} numberOfLines={2} style={{ marginTop: 14 }}>{o.title}</T>
        {!!o.amount_label && <Text style={[styles.amount, { color: colors.gold400 }]} numberOfLines={1}>{o.amount_label}</Text>}
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <OrgLogo org={o.organization} size={26} />
          <T v="caption" color={colors.brand100} numberOfLines={1} style={{ flex: 1 }}>{o.organization.name}</T>
          <T v="caption" color={o.closing_soon ? colors.gold400 : colors.brand100}>{deadlineLabel(o)}</T>
        </View>
      </LinearGradient>
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.sand200, ...shadow.card },
  top: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  orgRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  amount: { fontFamily: fonts.bold, fontSize: 14, color: colors.brand700, marginTop: 10 },
  reason: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: colors.gold50, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  cat: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  catText: { fontFamily: fonts.bold, fontSize: 11 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink500 },
  featured: { height: 200, borderRadius: 24, padding: 18, overflow: "hidden", ...shadow.float },
  featuredGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(227,157,41,0.14)", top: -90, right: -70 },
});
