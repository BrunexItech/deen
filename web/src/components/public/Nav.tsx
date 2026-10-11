"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const NAV = [
  ["/about", "About"],
  ["/how-it-works", "How it works"],
  ["/opportunities", "Opportunities"],
  ["/membership", "Membership"],
  ["/safety", "Safety"],
  ["/faq", "FAQ"],
  ["/organizations", "Organizations"],
] as const;

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm font-medium xl:flex" aria-label="Main">
      {NAV.map(([href, label]) => (
        <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
          className={`rounded-lg px-3 py-2 ${isActive(path, href) ? "bg-brand-50 text-brand-800" : "text-ink-500 hover:text-brand-700"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileMenu() {
  const path = usePathname();
  // Keyed on the page, so the menu closes after navigating.
  return <MobileMenuInner key={path} path={path} />;
}

function MobileMenuInner({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="xl:hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-sand-300">
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-sand-200 bg-white px-5 pb-5 pt-2 shadow-xl">
          {[["/", "Home"] as const, ...NAV, ["/pay", "Pay membership fee"] as const].map(([href, label]) => (
            <Link key={href} href={href}
              className={`block rounded-xl px-3 py-3 font-medium ${(href === "/" ? path === "/" : isActive(path, href)) ? "bg-brand-50 text-brand-800" : "text-ink-700"}`}>
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
