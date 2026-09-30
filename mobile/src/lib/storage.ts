/** Everything sensitive lives in the Android Keystore-backed SecureStore, never AsyncStorage. */
import * as SecureStore from "expo-secure-store";

const KEYS = {
  refresh: "deen.refresh",
  device: "deen.device",
  biometric: "deen.biometric",
  server: "deen.server",
  onboarded: "deen.welcome_seen",
} as const;

const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function get(key: string) {
  try {
    return await SecureStore.getItemAsync(key, opts);
  } catch {
    return null;
  }
}

async function set(key: string, value: string | null) {
  if (value === null) await SecureStore.deleteItemAsync(key, opts).catch(() => undefined);
  else await SecureStore.setItemAsync(key, value, opts);
}

export const secure = {
  getRefresh: () => get(KEYS.refresh),
  setRefresh: (v: string | null) => set(KEYS.refresh, v),
  getBiometric: async () => (await get(KEYS.biometric)) === "1",
  setBiometric: (on: boolean) => set(KEYS.biometric, on ? "1" : null),
  getServer: () => get(KEYS.server),
  setServer: (v: string | null) => set(KEYS.server, v),
  welcomeSeen: async () => (await get(KEYS.onboarded)) === "1",
  setWelcomeSeen: () => set(KEYS.onboarded, "1"),
  /** Stable per-install device id: binds sessions to this phone. */
  async deviceId(): Promise<string> {
    const existing = await get(KEYS.device);
    if (existing) return existing;
    const id = `and-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    await set(KEYS.device, id);
    return id;
  },
  async clearSession() {
    await set(KEYS.refresh, null);
    await set(KEYS.biometric, null);
  },
};
