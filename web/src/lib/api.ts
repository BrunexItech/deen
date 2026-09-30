/** Typed fetch wrapper for the DEEN API.
 *
 * Auth lives in httpOnly cookies set by the API (never readable from JS). Every
 * request identifies itself as the web client and carries the CSRF header; an
 * expired access cookie is refreshed once, transparently, then the call retries. */

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Client": "web", "X-Requested-With": "deen-web" },
    body: "{}",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) {
      const first = detail[0] as { msg: string; loc?: string[] };
      const field = first.loc?.at(-1);
      return (field && field !== "body" ? `${String(field).replaceAll("_", " ")}: ` : "") + first.msg.replace(/^Value error, /, "");
    }
  }
  return status >= 500 ? "Something went wrong on our side. Please try again." : "Request failed";
}

export async function api<T = unknown>(path: string, opts: { method?: Method; body?: unknown; form?: FormData; retry?: boolean } = {}): Promise<T> {
  const { method = "GET", body, form, retry = true } = opts;
  const headers: Record<string, string> = { "X-Client": "web", "X-Requested-With": "deen-web" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: "include",
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, messageFrom(data, res.status), data);
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: "POST", body });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

export async function upload(file: File, purpose: string): Promise<{ id: string; url: string; filename: string }> {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", file);
  return api("/files", { method: "POST", form });
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
