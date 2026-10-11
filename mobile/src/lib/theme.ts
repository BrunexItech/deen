/** DEEN design tokens: shared with the web portal so the brand reads as one system. */
export const colors = {
  // DEEN brand, sampled from the official logo: navy wordmark, royal-blue sky,
  // gold arch and green growth bars.
  brand950: "#001733",
  brand900: "#00255F",
  brand800: "#00316F",
  brand700: "#004485",
  brand600: "#0B57A4",
  brand500: "#2A72C2",
  brand400: "#5B96D8",
  brand100: "#DCE8F7",
  brand50: "#EEF4FC",

  gold700: "#9A6410",
  gold600: "#C98516",
  gold500: "#E39D29",
  gold400: "#F2BE5C",
  gold100: "#FCEBC8",
  gold50: "#FEF7E8",

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
