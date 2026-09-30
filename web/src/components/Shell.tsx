"use client";

import clsx from "clsx";
import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useMe, useSignOut } from "@/lib/auth";
import { ROLE_LABEL, VERIFICATION } from "@/lib/format";
import { Avatar, Badge } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  perm?: string;
  badge?: number;
  section?: string;
}

function Mark({ size = 30 }: { size?: number }) {
  return <img src="/deen-icon.png" alt="" width={size} height={size} className="rounded-[9px] shadow-sm ring-1 ring-gold-400/30" />;
}

export function Shell({ nav, children, context }: { nav: NavItem[]; children: ReactNode; context: "admin" | "org" }) {
  const { data: me } = useMe();
  const signOut = useSignOut();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = nav.filter((n) => !n.perm || me?.permissions.includes(n.perm));
  const root = context === "admin" ? "/admin" : "/org";
  const active = (href: string) => (href === root ? pathname === root : pathname.startsWith(href));

  let lastSection: string | undefined;
  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-emerald-900 via-emerald-900 to-emerald-950 text-white">
      <div className="pattern-khatam flex items-center gap-3 px-5 pb-5 pt-6">
        <Mark />
        <div>
          <div className="text-[17px] font-extrabold tracking-[0.28em]">DEEN</div>
          <div className="text-[11px] font-medium text-emerald-100/60">{context === "admin" ? "Control Center" : "Organization Portal"}</div>
        </div>
      </div>
      {context === "org" && me?.organization && (
        <div className="mx-4 mb-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="truncate text-sm font-semibold">{me.organization.name}</div>
          <div className="mt-1.5">
            <Badge tone={VERIFICATION[me.organization.verification].tone} className="!text-[11px]">
              {VERIFICATION[me.organization.verification].label}
            </Badge>
          </div>
        </div>
      )}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((n) => {
          const header = n.section && n.section !== lastSection ? n.section : null;
          lastSection = n.section ?? lastSection;
          return (
            <div key={n.href}>
              {header && <div className="px-3 pb-1.5 pt-4 text-[10.5px] font-bold uppercase tracking-[0.16em] text-emerald-100/40">{header}</div>}
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition",
                  active(n.href) ? "bg-white/10 text-white" : "text-emerald-50/70 hover:bg-white/5 hover:text-white",
                )}
              >
                {active(n.href) && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gold-400" />}
                <span className={clsx(active(n.href) ? "text-gold-400" : "text-emerald-100/50 group-hover:text-emerald-100/80")}>{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {!!n.badge && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold text-emerald-950">{n.badge}</span>}
              </Link>
            </div>
          );
        })}
      </nav>
      {me && (
        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <Avatar name={me.full_name} src={me.avatar_url} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{me.full_name}</div>
            <div className="truncate text-[11px] text-emerald-100/50">{ROLE_LABEL[me.role] ?? me.role}</div>
          </div>
          <button onClick={signOut} className="rounded-lg p-2 text-emerald-100/60 hover:bg-white/10 hover:text-white" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-[264px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-emerald-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] animate-fade-up">{sidebar}</div>
          <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full bg-white p-2 shadow" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-sand-200 bg-sand-100/85 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-sand-200" aria-label="Open menu">
          <Menu size={20} />
        </button>
        <Mark size={26} />
        <span className="text-sm font-extrabold tracking-[0.25em] text-emerald-800">DEEN</span>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}
