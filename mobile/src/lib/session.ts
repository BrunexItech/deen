/** App session: who is signed in, and whether the app is locked behind biometrics. */
import { create } from "zustand";
import { api, apiConfig, post, refreshSession, storeTokens, type TokenResponse } from "./api";
import { secure } from "./storage";
import type { Me } from "./types";

type Status = "booting" | "signedOut" | "ready";

interface SessionState {
  status: Status;
  user: Me | null;
  locked: boolean;
  biometric: boolean;
  /** Where to go once the signed-in stack mounts (onboarding, biometric setup). */
  pendingRoute: string | null;
  boot: () => Promise<void>;
  signIn: (t: TokenResponse, next?: string) => Promise<void>;
  takePendingRoute: () => string | null;
  signOut: (remote?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
  setBiometric: (on: boolean) => Promise<void>;
  lock: () => void;
  unlock: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  status: "booting",
  user: null,
  locked: false,
  biometric: false,
  pendingRoute: null,

  async boot() {
    await apiConfig.init();
    apiConfig.onSessionLost(() => get().signOut(false));
    const biometric = await secure.getBiometric();
    if (!(await secure.getRefresh()) || !(await refreshSession())) {
      set({ status: "signedOut", user: null, biometric: false });
      return;
    }
    try {
      const user = await api<Me>("/me");
      // A returning session opens locked: the phone owner must prove it's them.
      set({ status: "ready", user, biometric, locked: biometric });
    } catch {
      set({ status: "signedOut", user: null });
    }
  },

  async signIn(t, next) {
    await storeTokens(t);
    set({ status: "ready", user: t.user as Me, locked: false, pendingRoute: next ?? null });
  },

  takePendingRoute() {
    const r = get().pendingRoute;
    if (r) set({ pendingRoute: null });
    return r;
  },

  async signOut(remote = true) {
    if (remote) await post("/auth/logout").catch(() => undefined);
    apiConfig.setAccess(null);
    await secure.clearSession();
    set({ status: "signedOut", user: null, locked: false, biometric: false });
  },

  async refreshUser() {
    const user = await api<Me>("/me");
    set({ user });
  },

  async setBiometric(on) {
    await secure.setBiometric(on);
    set({ biometric: on });
    await api("/auth/sessions/current", { method: "PATCH", body: { biometric_enabled: on } }).catch(() => undefined);
  },

  lock() {
    if (get().biometric && get().status === "ready") set({ locked: true });
  },
  unlock() {
    set({ locked: false });
  },
}));
