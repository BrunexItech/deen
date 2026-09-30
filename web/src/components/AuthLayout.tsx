import type { ReactNode } from "react";

/** Split-screen frame for sign-in, invitation and recovery pages. */
export function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="pattern-khatam relative hidden overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <img src="/deen-icon.png" alt="" className="h-11 w-11 object-contain" />
          <span className="text-xl font-extrabold tracking-[0.3em]">DEEN</span>
        </div>
        <div className="my-auto max-w-md">
          <p className="font-arabic text-3xl leading-relaxed text-gold-400" dir="rtl" lang="ar">
            وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ
          </p>
          <p className="mt-3 text-lg text-brand-50/90">&ldquo;And cooperate in righteousness and piety.&rdquo;</p>
          <p className="mt-1 text-sm text-brand-100/50">Qur&apos;an 5:2</p>
          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8 text-sm">
            <div><div className="text-2xl font-extrabold text-gold-400">Verified</div><div className="text-brand-100/60">every organization</div></div>
            <div><div className="text-2xl font-extrabold text-gold-400">Matched</div><div className="text-brand-100/60">to each member</div></div>
            <div><div className="text-2xl font-extrabold text-gold-400">Measured</div><div className="text-brand-100/60">by real impact</div></div>
          </div>
        </div>
        <p className="text-xs text-brand-100/40">© {new Date().getFullYear()} DEEN · Development and Education Empowerment Network · Discover. Verify. Apply. Grow.</p>
        <img src="/deen-icon.png" alt="" className="pointer-events-none absolute -bottom-32 -right-32 w-[460px] opacity-[0.08] grayscale" />
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px] animate-fade-up">
          <img src="/deen-logo.png" alt="DEEN, The Muslim Opportunity Platform" className="mx-auto mb-8 h-36 w-auto object-contain lg:hidden" />
          <h1 className="text-[26px] font-extrabold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
