import { Amiri_400Regular, Amiri_700Bold } from "@expo-google-fonts/amiri";
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold, useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppLock, ToastHost } from "@/components/Overlays";
import { ApiError } from "@/lib/api";
import { registerForPush, routeFromNotification } from "@/lib/push";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 350, fade: true });
SystemUI.setBackgroundColorAsync(colors.sand100).catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

// Refetch stale data when the app returns to the foreground.
AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold, Amiri_400Regular, Amiri_700Bold,
  });
  const { status, boot } = useSession();

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (fontsLoaded && status !== "booting") SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, status]);

  useEffect(() => {
    if (status !== "ready") return;
    registerForPush();
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      routeFromNotification(r.notification.request.content.data as Record<string, unknown>));
    return () => sub.remove();
  }, [status]);

  useEffect(() => {
    if (status === "signedOut") queryClient.clear();
  }, [status]);

  if (!fontsLoaded || status === "booting") return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand100 }, animation: "slide_from_right" }}>
              <Stack.Protected guard={status === "signedOut"}>
                <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
              </Stack.Protected>
              <Stack.Protected guard={status === "ready"}>
                <Stack.Screen name="(app)" options={{ animation: "fade" }} />
              </Stack.Protected>
            </Stack>
            <AppLock />
            <ToastHost />
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
