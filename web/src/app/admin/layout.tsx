"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck, BarChart3, BookOpen, Building2, ClipboardCheck, CreditCard, Flag, LayoutGrid, Megaphone, ScrollText,
  Shield, Store, UserCog, Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Shell, type NavItem } from "@/components/Shell";
import { get } from "@/lib/api";
import { RequirePortal, useCan } from "@/lib/auth";

interface Attention {
  attention: { review_queue: number; pending_orgs: number; open_reports: number; identity_pending: number; directory_pending: number };
}

function AdminShell({ children }: { children: ReactNode }) {
  const can = useCan();
  const { data } = useQuery({
    queryKey: ["admin", "overview", 30],
    queryFn: () => get<Attention>("/admin/overview?days=30"),
    enabled: can("analytics.view"),
    refetchInterval: 60_000,
  });
  const a = data?.attention;
  const nav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: <BarChart3 size={18} />, perm: "analytics.view" },
    { href: "/admin/review", label: "Review queue", icon: <ClipboardCheck size={18} />, perm: "opps.view", badge: a?.review_queue, section: "Trust & review" },
    { href: "/admin/opportunities", label: "Opportunities", icon: <LayoutGrid size={18} />, perm: "opps.view", section: "Trust & review" },
    { href: "/admin/organizations", label: "Organizations", icon: <Building2 size={18} />, perm: "orgs.view", badge: a?.pending_orgs, section: "Trust & review" },
    { href: "/admin/identity", label: "Identity checks", icon: <BadgeCheck size={18} />, perm: "identity.review", badge: a?.identity_pending, section: "Trust & review" },
    { href: "/admin/reports", label: "Reports", icon: <Flag size={18} />, perm: "reports.manage", badge: a?.open_reports, section: "Trust & review" },
    { href: "/admin/members", label: "Members", icon: <Users size={18} />, perm: "users.view", section: "Community" },
    { href: "/admin/directory", label: "Directory", icon: <Store size={18} />, perm: "directory.manage", badge: a?.directory_pending, section: "Community" },
    { href: "/admin/announcements", label: "Announcements", icon: <Megaphone size={18} />, perm: "announce.send", section: "Community" },
    { href: "/admin/content", label: "Content & taxonomy", icon: <BookOpen size={18} />, perm: "opps.view", section: "Community" },
    { href: "/admin/billing", label: "Memberships", icon: <CreditCard size={18} />, perm: "payments.view", section: "Platform" },
    { href: "/admin/staff", label: "DEEN team", icon: <UserCog size={18} />, perm: "users.view", section: "Platform" },
    { href: "/admin/audit", label: "Audit log", icon: <ScrollText size={18} />, perm: "audit.view", section: "Platform" },
    { href: "/admin/security", label: "Security", icon: <Shield size={18} />, section: "Platform" },
  ];
  return <Shell nav={nav} context="admin">{children}</Shell>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequirePortal portal="admin">
      <AdminShell>{children}</AdminShell>
    </RequirePortal>
  );
}
