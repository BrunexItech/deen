import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function AppLayout() {
  const takePendingRoute = useSession((s) => s.takePendingRoute);

  useEffect(() => {
    const next = takePendingRoute();
    if (next) setTimeout(() => router.push(next as never), 50);
  }, [takePendingRoute]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand100 }, animation: "slide_from_right" }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="biometric-setup" options={{ gestureEnabled: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="apply/[id]" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="membership" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
