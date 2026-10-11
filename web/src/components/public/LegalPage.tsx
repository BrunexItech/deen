import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./Site";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-sand-100">
      <SiteHeader />
      <header className="pattern-khatam bg-gradient-to-br from-brand-800 to-brand-950 text-white">
        <div className="relative z-10 mx-auto max-w-3xl px-5 py-12">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-brand-100/70">Last updated {updated}</p>
        </div>
      </header>
      <article className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-5 py-10 text-[15px] leading-relaxed text-ink-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
      <SiteFooter />
    </div>
  );
}
