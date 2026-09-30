import type { ReactNode } from "react";

/** Split-screen frame for sign-in, invitation and recovery pages. */
export function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="pattern-khatam relative hidden overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <img src="/deen-icon.png" alt="" className="h-11 w-11 rounded-xl ring-1 ring-gold-400/40" />
          <span className="text-xl font-extrabold tracking-[0.3em]">DEEN</span>
        </div>
        <div className="my-auto max-w-md">
          <p className="font-arabic text-3xl leading-relaxed text-gold-400" dir="rtl" lang="ar">
            وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ
          </p>
          <p className="mt-3 text-lg text-emerald-50/90">&ldquo;And cooperate in righteousness and piety.&rdquo;</p>
          <p className="mt-1 text-sm text-emerald-100/50">Qur&apos;an 5:2</p>
          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8 text-sm">
            <div><div className="text-2xl font-extrabold text-gold-400">Verified</div><div className="text-emerald-100/60">every organization</div></div>
            <div><div className="text-2xl font-extrabold text-gold-400">Matched</div><div className="text-emerald-100/60">to each member</div></div>
            <div><div className="text-2xl font-extrabold text-gold-400">Measured</div><div className="text-emerald-100/60">by real impact</div></div>
          </div>
        </div>
        <p className="text-xs text-emerald-100/40">© {new Date().getFullYear()} DEEN · Opportunity infrastructure for the Muslim community</p>
        <img src="/deen-mark.png" alt="" className="pointer-events-none absolute -bottom-40 -right-40 w-[520px] opacity-[0.07]" />
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px] animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/deen-icon.png" alt="" className="h-10 w-10 rounded-xl" />
            <span className="text-lg font-extrabold tracking-[0.3em] text-emerald-800">DEEN</span>
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
