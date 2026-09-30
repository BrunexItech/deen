"use client";

import { BarChart3, Building2, FileStack, Inbox, MessageCircleQuestion, Shield, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Shell, type NavItem } from "@/components/Shell";
import { RequirePortal } from "@/lib/auth";

const NAV: NavItem[] = [
  { href: "/org", label: "Dashboard", icon: <BarChart3 size={18} /> },
  { href: "/org/opportunities", label: "Opportunities", icon: <FileStack size={18} /> },
  { href: "/org/applications", label: "Applications", icon: <Inbox size={18} /> },
  { href: "/org/questions", label: "Member questions", icon: <MessageCircleQuestion size={18} /> },
  { href: "/org/team", label: "Team", icon: <Users size={18} />, section: "Organization" },
  { href: "/org/profile", label: "Profile", icon: <Building2 size={18} />, section: "Organization" },
  { href: "/org/security", label: "Security", icon: <Shield size={18} />, section: "Organization" },
];

export default function OrgLayout({ children }: { children: ReactNode }) {
  return (
    <RequirePortal portal="org">
      <Shell nav={NAV} context="org">{children}</Shell>
    </RequirePortal>
  );
}
