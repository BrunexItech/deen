import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-sand-100">
      <header className="pattern-khatam bg-gradient-to-br from-brand-800 to-brand-950 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-6">
          <Link href="/" className="flex items-center gap-3">
            <img src="/deen-icon.png" alt="" className="h-9 w-9 object-contain" />
            <span className="font-extrabold tracking-[0.3em]">DEEN</span>
          </Link>
        </div>
        <div className="mx-auto max-w-3xl px-5 pb-10">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-brand-100/70">Last updated {updated}</p>
        </div>
      </header>
      <article className="mx-auto max-w-3xl space-y-5 px-5 py-10 text-[15px] leading-relaxed text-ink-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
    </div>
  );
}
