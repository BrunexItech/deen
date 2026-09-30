import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, ChevronLeft, type LucideIcon } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { router } from "expo-router";
import { colors, fonts, radius, shadow } from "@/lib/theme";

/* ---------- Typography ---------- */

type Variant = "display" | "title" | "h2" | "h3" | "body" | "bodyStrong" | "small" | "caption" | "label" | "overline";

const TYPE: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: colors.ink900 },
  title: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: colors.ink900 },
  h2: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2, color: colors.ink900 },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.ink900 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.ink700 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.ink900 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink500 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.ink400 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.ink700 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.6, textTransform: "uppercase", color: colors.gold600 },
};

export function T({ v = "body", style, color, center, ...rest }: TextProps & { v?: Variant; color?: string; center?: boolean }) {
  return <Text {...rest} style={[TYPE[v], color ? { color } : null, center ? { textAlign: "center" } : null, style]} />;
}

export function Arabic({ children, size = 24, color = colors.emerald800, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: fonts.arabic, fontSize: size, lineHeight: size * 1.9, color, textAlign: "right", writingDirection: "rtl" }, style]}>{children}</Text>;
}

/* ---------- Pressable with spring feedback ---------- */

export function Tap({ children, style, onPress, haptic = true, scale = 0.97, disabled, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; scale?: number; children: ReactNode }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={() => (s.value = withSpring(scale, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 18, stiffness: 300 }))}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
    >
      <Animated.View style={[anim, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ---------- Buttons ---------- */

type BtnVariant = "primary" | "gold" | "secondary" | "ghost" | "danger";

export function Button({ title, onPress, variant = "primary", loading, disabled, icon: Icon, style, size = "lg" }: {
  title: string; onPress?: () => void; variant?: BtnVariant; loading?: boolean; disabled?: boolean; icon?: LucideIcon; style?: StyleProp<ViewStyle>; size?: "md" | "lg";
}) {
  const height = size === "lg" ? 54 : 44;
  const fg = variant === "primary" || variant === "danger" ? colors.white : variant === "gold" ? colors.emerald950 : colors.ink900;
  const content = (
    <View style={[styles.btnInner, { height }]}>
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} strokeWidth={2.2} /> : null}
      <Text style={[styles.btnText, { color: fg, fontSize: size === "lg" ? 16 : 14 }]}>{title}</Text>
    </View>
  );
  const off = disabled || loading;
  return (
    <Tap onPress={onPress} disabled={off} style={[{ opacity: off ? 0.55 : 1, borderRadius: radius.md, overflow: "hidden" }, style]}>
      {variant === "primary" ? (
        <LinearGradient colors={[colors.emerald600, colors.emerald800]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>{content}</LinearGradient>
      ) : variant === "gold" ? (
        <LinearGradient colors={["#EBCB82", colors.gold600]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>{content}</LinearGradient>
      ) : (
        <View style={variant === "secondary" ? styles.btnSecondary : variant === "danger" ? { backgroundColor: colors.rose600 } : null}>{content}</View>
      )}
    </Tap>
  );
}

export function IconButton({ icon: Icon, onPress, color = colors.ink900, bg = colors.white, size = 42, badge, label }: {
  icon: LucideIcon; onPress?: () => void; color?: string; bg?: string; size?: number; badge?: number; label: string;
}) {
  return (
    <Tap onPress={onPress} accessibilityLabel={label} style={[styles.iconBtn, { width: size, height: size, backgroundColor: bg }]}>
      <Icon size={size * 0.46} color={color} strokeWidth={2} />
      {!!badge && <View style={styles.dot}><Text style={styles.dotText}>{badge > 9 ? "9+" : badge}</Text></View>}
    </Tap>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const body = <View style={[styles.card, padded && { padding: 16 }, style]}>{children}</View>;
  return onPress ? <Tap onPress={onPress} scale={0.985}>{body}</Tap> : body;
}

export function Section({ title, action, onAction, children, style }: { title: string; action?: string; onAction?: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 26 }, style]}>
      <View style={styles.sectionHead}>
        <T v="h2">{title}</T>
        {action && <Pressable onPress={onAction} hitSlop={10}><T v="label" color={colors.emerald700}>{action}</T></Pressable>}
      </View>
      {children}
    </View>
  );
}

/* ---------- Chips & badges ---------- */

export function Chip({ label, active, onPress, icon: Icon }: { label: string; active?: boolean; onPress?: () => void; icon?: LucideIcon }) {
  return (
    <Tap onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {Icon && <Icon size={14} color={active ? colors.white : colors.ink700} />}
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Tap>
  );
}

type Tone = "neutral" | "good" | "gold" | "warn" | "bad" | "info";
const TONES: Record<Tone, [string, string]> = {
  neutral: [colors.sand200, colors.ink700], good: [colors.emerald50, colors.emerald700], gold: [colors.gold50, colors.gold700],
  warn: [colors.amber50, colors.amber800], bad: [colors.rose50, colors.rose600], info: [colors.sky50, colors.sky800],
};

export function Badge({ label, tone = "neutral", icon: Icon }: { label: string; tone?: Tone; icon?: LucideIcon }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {Icon && <Icon size={12} color={fg} strokeWidth={2.4} />}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* ---------- Inputs ---------- */

export const Input = forwardRef<TextInput, TextInputProps & { label?: string; hint?: string; error?: string; icon?: LucideIcon }>(
  function Input({ label, hint, error, icon: Icon, style, ...rest }, ref) {
    return (
      <View style={{ gap: 7 }}>
        {label && <T v="label">{label}</T>}
        <View style={[styles.input, error ? { borderColor: colors.rose600 } : null]}>
          {Icon && <Icon size={18} color={colors.ink400} />}
          <TextInput ref={ref} placeholderTextColor={colors.ink300} style={[styles.inputText, style]} {...rest} />
        </View>
        {error ? <T v="caption" color={colors.rose600}>{error}</T> : hint ? <T v="caption">{hint}</T> : null}
      </View>
    );
  },
);

export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Tap key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, value === o.value && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === o.value && { color: colors.ink900 }]}>{o.label}</Text>
        </Tap>
      ))}
    </View>
  );
}

/* ---------- States ---------- */

export function Empty({ icon: Icon, title, body, action, onAction }: { icon: LucideIcon; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon size={28} color={colors.emerald700} /></View>
      <T v="h3" center>{title}</T>
      {body && <T v="small" center style={{ maxWidth: 280 }}>{body}</T>}
      {action && <Button title={action} onPress={onAction} size="md" style={{ marginTop: 12, minWidth: 180 }} />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <Empty icon={AlertCircle} title="Couldn't load this" body={message ?? "Check your connection and try again."} action={onRetry ? "Try again" : undefined} onAction={onRetry} />;
}

/* ---------- Header ---------- */

export function Header({ title, subtitle, right, back = true, dark = false }: { title?: string; subtitle?: string; right?: ReactNode; back?: boolean; dark?: boolean }) {
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} bg={dark ? "rgba(255,255,255,0.12)" : colors.white} color={dark ? colors.white : colors.ink900} />
      ) : <View style={{ width: 42 }} />}
      <View style={{ flex: 1, alignItems: "center" }}>
        {title && <T v="h3" numberOfLines={1} color={dark ? colors.white : undefined}>{title}</T>}
        {subtitle && <T v="caption" numberOfLines={1} color={dark ? colors.emerald100 : undefined}>{subtitle}</T>}
      </View>
      <View style={{ minWidth: 42, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.sand200 }, style]} />;
}

const styles = StyleSheet.create({
  btnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 20 },
  btnText: { fontFamily: fonts.bold, letterSpacing: 0.1 },
  btnSecondary: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.sand300, borderRadius: radius.md },
  iconBtn: { borderRadius: 14, alignItems: "center", justifyContent: "center", ...shadow.card },
  dot: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.gold500, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: colors.sand100 },
  dotText: { fontFamily: fonts.bold, fontSize: 9, color: colors.emerald950 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.sand200, ...shadow.card },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingHorizontal: 20 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 36, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.sand300 },
  chipActive: { backgroundColor: colors.emerald700, borderColor: colors.emerald700 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink700 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: radius.pill, alignSelf: "flex-start" },
  badgeText: { fontFamily: fonts.bold, fontSize: 11 },
  input: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.sand300, paddingHorizontal: 14, minHeight: 54 },
  inputText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink900, paddingVertical: 12 },
  segment: { flexDirection: "row", backgroundColor: colors.sand200, borderRadius: 14, padding: 4 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11 },
  segmentActive: { backgroundColor: colors.white, ...shadow.card },
  segmentText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink500 },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 30, gap: 8 },
  emptyIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.emerald50, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
});
