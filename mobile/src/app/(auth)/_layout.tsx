import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

// "welcome" (not index) so the signed-out stack never shares "/" with the signed-in home.
export const unstable_settings = { initialRouteName: "welcome" };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand100 }, animation: "slide_from_right" }}>
      <Stack.Screen name="welcome" options={{ animation: "fade" }} />
    </Stack>
  );
}
