import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";
import { post } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Asks permission and registers this phone's Expo push token with DEEN. Silent on
 * failure: the app works fully without push, notifications stay in the in-app inbox. */
export async function registerForPush() {
  try {
    if (!Device.isDevice) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "DEEN",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#C9A34E",
        vibrationPattern: [0, 180, 120, 180],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return; // push tokens need an EAS project id (see README)
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await post("/notifications/push-tokens", { token, platform: Platform.OS });
  } catch {
    // Push is best-effort.
  }
}

/** Opens the right screen when a notification is tapped. */
export function routeFromNotification(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const screen = data.screen as string | undefined;
  const id = data.id as string | undefined;
  if (screen === "opportunity" && id) router.push(`/opportunity/${id}`);
  else if (screen === "application" && id) router.push(`/application/${id}`);
  else if (screen === "membership") router.push("/membership");
  else if (screen === "identity") router.push("/identity");
  else if (screen === "directory") router.push("/directory");
  else router.push("/notifications");
}
