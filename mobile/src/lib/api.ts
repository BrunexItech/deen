/** DEEN API client.
 *
 * The short-lived access token lives only in memory. The refresh token lives in the
 * device keystore and rotates on every use (the server revokes the session if an old
 * one is ever replayed). A 401 triggers exactly one shared refresh, then a retry. */
import Constants from "expo-constants";
import * as Device from "expo-device";
import { secure } from "./storage";

const DEFAULT_API = (process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.149:8020").replace(/\/$/, "");

let baseUrl = DEFAULT_API;
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export const apiConfig = {
  async init() {
    baseUrl = ((await secure.getServer()) ?? DEFAULT_API).replace(/\/$/, "");
  },
  get baseUrl() {
    return baseUrl;
  },
  get defaultUrl() {
    return DEFAULT_API;
  },
  async setServer(url: string | null) {
    await secure.setServer(url);
    baseUrl = (url ?? DEFAULT_API).replace(/\/$/, "");
  },
  setAccess(token: string | null) {
    accessToken = token;
  },
  onSessionLost(cb: () => void) {
    onSessionLost = cb;
  },
  fileUrl(path: string | null | undefined) {
    return path ? (path.startsWith("http") ? path : `${baseUrl}${path}`) : undefined;
  },
  authHeader(): Record<string, string> {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  },
};

export async function deviceInfo() {
  return {
    device_id: await secure.deviceId(),
    device_name: [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || "Android phone",
    platform: "android",
  };
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: unknown;
}

export async function storeTokens(t: TokenResponse) {
  accessToken = t.access_token;
  await secure.setRefresh(t.refresh_token);
}

export async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refresh = await secure.getRefresh();
    if (!refresh) return false;
    try {
      const r = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!r.ok) {
        if (r.status === 401) await secure.clearSession();
        return false;
      }
      await storeTokens(await r.json());
      return true;
    } catch {
      return false;
    }
  })().finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, "");
  }
  if (status === 0) return "No connection. Check your internet and try again.";
  return status >= 500 ? "Something went wrong on our side. Please try again." : "Request failed";
}

type Opts = { method?: string; body?: unknown; form?: FormData; auth?: boolean; retry?: boolean };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, form, auth = true, retry = true } = opts;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-App-Version": Constants.expoConfig?.version ?? "1.0.0",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, messageFrom(null, 0));
  }
  if (res.status === 401 && auth && retry && !path.startsWith("/auth/login")) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
    onSessionLost?.();
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new ApiError(res.status, messageFrom(data, res.status), data);
  return data as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: "POST", body });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

export async function uploadFile(uri: string, purpose: string, name = "upload.jpg", type = "image/jpeg") {
  const form = new FormData();
  form.append("purpose", purpose);
  // React Native's FormData accepts { uri, name, type } file descriptors.
  form.append("file", { uri, name, type } as unknown as Blob);
  return api<{ id: string; url: string; filename: string }>("/files", { method: "POST", form });
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
