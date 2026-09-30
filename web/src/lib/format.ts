import type { OppStatus, Verification } from "./types";

const TZ = "Africa/Nairobi";

export function fmtDate(value?: string | null, withTime = false): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric", month: "short", year: "numeric", timeZone: TZ,
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export function ago(value?: string | null): string {
  if (!value) return "never";
  const s = (Date.now() - new Date(value).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(value);
}

export const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
export const num = (n: number) => n.toLocaleString("en-KE");
export const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const titleCase = (s: string) => s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const STATUS: Record<OppStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "In review", tone: "info" },
  info_requested: { label: "Info requested", tone: "warn" },
  verification: { label: "Verification", tone: "info" },
  approved: { label: "Approved", tone: "good" },
  published: { label: "Live", tone: "good" },
  rejected: { label: "Declined", tone: "bad" },
  expired: { label: "Expired", tone: "neutral" },
  archived: { label: "Closed", tone: "neutral" },
};

export const APP_STATUS: Record<string, { label: string; tone: Tone }> = {
  submitted: { label: "New", tone: "info" },
  in_review: { label: "In review", tone: "info" },
  shortlisted: { label: "Shortlisted", tone: "gold" },
  interview: { label: "Interview", tone: "gold" },
  accepted: { label: "Accepted", tone: "good" },
  rejected: { label: "Not selected", tone: "bad" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const VERIFICATION: Record<Verification, { label: string; tone: Tone }> = {
  pending: { label: "Pending verification", tone: "warn" },
  verified: { label: "Verified", tone: "good" },
  trusted: { label: "Trusted", tone: "gold" },
};

export type Tone = "neutral" | "info" | "good" | "warn" | "bad" | "gold";

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  platform_admin: "Platform Admin",
  verification_officer: "Verification Officer",
  content_manager: "Content Manager",
  finance_admin: "Finance Admin",
  support_agent: "Support Agent",
  org_admin: "Organization Admin",
  org_staff: "Organization Staff",
  member: "Member",
};
