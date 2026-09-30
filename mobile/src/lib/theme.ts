/** DEEN design tokens: shared with the web portal so the brand reads as one system. */
export const colors = {
  emerald950: "#031F18",
  emerald900: "#062E25",
  emerald800: "#0A4034",
  emerald700: "#0B5D4B",
  emerald600: "#0F7A61",
  emerald500: "#16977A",
  emerald400: "#3DB592",
  emerald100: "#DCEFE7",
  emerald50: "#EEF7F3",

  gold700: "#8F6A1F",
  gold600: "#B7862C",
  gold500: "#C9A34E",
  gold400: "#DFC07A",
  gold100: "#F6ECD2",
  gold50: "#FBF6E9",

  sand50: "#FBFAF6",
  sand100: "#F6F4EE",
  sand200: "#ECE8DD",
  sand300: "#DDD7C8",

  ink900: "#0F1A17",
  ink700: "#2C3A35",
  ink500: "#5E6B66",
  ink400: "#7F8A86",
  ink300: "#A7B0AC",

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
  card: { shadowColor: "#0F1A17", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  float: { shadowColor: "#062E25", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
};

export const CATEGORY_META: Record<string, { color: string; tint: string; icon: string; label: string }> = {
  education: { color: "#0F766E", tint: "#E6F4F2", icon: "graduation", label: "Scholarships" },
  employment: { color: "#1D4ED8", tint: "#EAF0FE", icon: "briefcase", label: "Jobs" },
  business: { color: "#B45309", tint: "#FDF3E4", icon: "rocket", label: "Business" },
  support: { color: "#BE123C", tint: "#FDECF0", icon: "heart", label: "Support" },
  learning: { color: "#7C3AED", tint: "#F1EBFE", icon: "sparkles", label: "Learning" },
  community: { color: "#047857", tint: "#E5F4EE", icon: "users", label: "Community" },
};
