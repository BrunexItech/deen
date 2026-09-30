import type { ExpoConfig } from "expo/config";

// Test builds talk to a LAN API over plain HTTP; store builds must use HTTPS only.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.149:8020";
const allowCleartext = API_URL.startsWith("http://");

const config: ExpoConfig = {
  name: "DEEN",
  slug: "deen",
  scheme: "deen",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: "#F6F4EE",
  description: "Verified opportunities for the Muslim community in Kenya: scholarships, jobs, business funding, support and community programmes.",
  android: {
    package: "africa.deen.app",
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#0B5D4B",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    // No adb/cloud backups of app data: tokens live in the keystore, but defence in depth.
    allowBackup: false,
    permissions: [
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
      "android.permission.CAMERA",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.POST_NOTIFICATIONS",
    ],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
    ],
    predictiveBackGestureEnabled: false,
  },
  ios: { bundleIdentifier: "africa.deen.app", supportsTablet: false },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-image",
    "expo-font",
    "expo-web-browser",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 180, backgroundColor: "#062E25" }],
    ["expo-local-authentication", { faceIDPermission: "DEEN uses Face ID to keep your account locked." }],
    ["expo-location", { locationWhenInUsePermission: "DEEN uses your location for accurate prayer times and the Qibla direction." }],
    ["expo-image-picker", { cameraPermission: "DEEN uses the camera to photograph your ID for identity verification.", photosPermission: false, microphonePermission: false }],
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#C9A34E" }],
    ["expo-build-properties", { android: { usesCleartextTraffic: allowCleartext } }],
    "./plugins/withReleaseSigning",
  ],
  experiments: { typedRoutes: true },
  extra: { apiUrl: API_URL, eas: { projectId: process.env.EAS_PROJECT_ID } },
};

export default config;
