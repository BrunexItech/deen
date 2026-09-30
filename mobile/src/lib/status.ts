import { colors } from "./theme";

export const APP_STATUS: Record<string, { label: string; color: string; bg: string; step: number }> = {
  submitted: { label: "Sent", color: colors.sky800, bg: colors.sky50, step: 1 },
  in_review: { label: "In review", color: colors.sky800, bg: colors.sky50, step: 2 },
  shortlisted: { label: "Shortlisted", color: colors.gold700, bg: colors.gold50, step: 3 },
  interview: { label: "Interview", color: colors.gold700, bg: colors.gold50, step: 3 },
  accepted: { label: "Accepted", color: colors.brand700, bg: colors.brand50, step: 4 },
  rejected: { label: "Not selected", color: colors.ink500, bg: colors.sand200, step: 4 },
  withdrawn: { label: "Withdrawn", color: colors.ink500, bg: colors.sand200, step: 0 },
};

export const PIPELINE = ["Sent", "In review", "Shortlisted", "Decision"];
