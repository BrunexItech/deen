import { colors } from "./theme";

// Tracker statuses (spec section 18).
export const APP_STATUS: Record<string, { label: string; color: string; bg: string; step: number }> = {
  started: { label: "Application started", color: colors.ink700, bg: colors.sand200, step: 0 },
  submitted: { label: "Applied", color: colors.sky800, bg: colors.sky50, step: 1 },
  in_review: { label: "Under review", color: colors.sky800, bg: colors.sky50, step: 2 },
  shortlisted: { label: "Shortlisted", color: colors.gold700, bg: colors.gold50, step: 3 },
  interview: { label: "Interview", color: colors.gold700, bg: colors.gold50, step: 3 },
  accepted: { label: "Successful", color: colors.leaf700, bg: colors.leaf50, step: 4 },
  rejected: { label: "Unsuccessful", color: colors.ink500, bg: colors.sand200, step: 4 },
  withdrawn: { label: "Withdrawn", color: colors.ink500, bg: colors.sand200, step: 0 },
  closed: { label: "Application closed", color: colors.ink500, bg: colors.sand200, step: 0 },
};

export const PIPELINE = ["Applied", "Under review", "Shortlisted", "Decision"];

/** Statuses a member can set on applications made outside DEEN. */
export const SELF_STATUSES = ["started", "submitted", "in_review", "shortlisted", "interview", "accepted", "rejected", "closed"];
