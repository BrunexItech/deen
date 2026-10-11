/** DEEN design tokens: shared with the web portal so the brand reads as one system. */
export const colors = {
  // D.E.E.N brand, sampled from the official logo: teal and black. "gold" is the
  // accent scale (a lighter teal); the name is kept so every screen picks it up.
  brand950: "#04292B",
  brand900: "#063A3C",
  brand800: "#075052",
  brand700: "#086769",
  brand600: "#087D7E",
  brand500: "#1A9596",
  brand400: "#4DB3B4",
  brand100: "#D5EEEE",
  brand50: "#EDF8F8",

  gold700: "#0A6466",
  gold600: "#0B7C7D",
  gold500: "#2FB5B0",
  gold400: "#6FD3CE",
  gold100: "#D3F1EF",
  gold50: "#ECF9F8",

  leaf700: "#237A24",
  leaf600: "#2E9A2E",
  leaf500: "#43B02A",
  leaf100: "#DDF3D3",
  leaf50: "#F0FAEC",

  // Neutrals: cool and clean (names kept so every screen picks them up).
  sand50: "#FAFBFC",
  sand100: "#F4F6F9",
  sand200: "#E6EAF0",
  sand300: "#D3D9E2",

  ink900: "#0B1526",
  ink700: "#334155",
  ink500: "#5B6B80",
  ink400: "#8492A6",
  ink300: "#B6C0CD",

  white: "#FFFFFF",
  rose600: "#E11D48",
  rose50: "#FFF1F2",
  amber50: "#FFFBEB",
  amber800: "#92400E",
  sky50: "#F0F9FF",
  sky800: "#075985",
};

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
  arabic: "Amiri_400Regular",
  arabicBold: "Amiri_700Bold",
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = (n: number) => n * 4;

export const shadow = {
  card: { shadowColor: "#0B1526", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  float: { shadowColor: "#00255F", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
};

export const CATEGORY_META: Record<string, { color: string; tint: string; icon: string; label: string }> = {
  education: { color: "#004485", tint: "#E6EEF8", icon: "graduation", label: "Education" },
  career: { color: "#0B57A4", tint: "#E8F0FA", icon: "briefcase", label: "Career" },
  entrepreneurship: { color: "#C98516", tint: "#FDF3E1", icon: "trending", label: "Business" },
  community: { color: "#2E9A2E", tint: "#E9F6E4", icon: "users", label: "Community" },
  islamic_economy: { color: "#7C3AED", tint: "#F1EBFE", icon: "landmark", label: "Islamic Economy" },
  support: { color: "#BE123C", tint: "#FDECF0", icon: "heart", label: "Support" },
};
