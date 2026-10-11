import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MobileMenu, NavLinks } from "./Nav";

export const API = process.env.API_ORIGIN ?? "http://127.0.0.1:8020";

export async function load<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const r = await fetch(`${API}/api/v1${path}`, { next: { revalidate } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-sand-200/80 bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="DEEN home">
          <img src="/deen-icon.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-[15px] font-extrabold tracking-[0.25em] text-brand-900">DEEN</span>
        </Link>
        <NavLinks />
        <div className="flex items-center gap-2">
          <Link href="/pay" className="hidden rounded-xl px-3.5 py-2 text-sm font-semibold text-brand-800 ring-1 ring-sand-300 hover:bg-sand-100 sm:inline-flex">Pay fee</Link>
          <a href="/downloads/deen.apk" className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-900">
            <Download size={16} /> <span className="hidden sm:inline">Get the app</span><span className="sm:hidden">App</span>
          </a>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-brand-950 text-brand-100/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <img src="/deen-icon.png" alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
            <span className="font-extrabold tracking-[0.25em] text-white">DEEN</span>
          </div>
          <p className="mt-3 text-sm">Development and Education Empowerment Network.</p>
          <p className="text-sm">Empower. Equip. Elevate.</p>
        </div>
        <FooterCol title="Members" links={[["/how-it-works", "How it works"], ["/opportunities", "Opportunities"], ["/membership", "Membership"], ["/pay", "Pay the fee"], ["/downloads/deen.apk", "Get the Android app"]]} />
        <FooterCol title="Help" links={[["/safety", "Stay safe"], ["/faq", "Questions"], ["/contact", "Contact us"], ["/organizations", "For organizations"], ["/login", "Partner sign in"]]} />
        <FooterCol title="DEEN" links={[["/about", "About DEEN"], ["/privacy", "Privacy policy"], ["/delete-account", "Delete my account"]]} />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} DEEN · Kenya</span>
          <span>&ldquo;Whoever guides someone to goodness has a reward like the one who does it.&rdquo; Sahih Muslim 1893</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => <li key={href}><Link href={href} className="hover:text-white">{label}</Link></li>)}
      </ul>
    </div>
  );
}

/** Frame for every public page: header, content, footer. */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Title banner at the top of each inner page. */
export function PageHero({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="pattern-khatam relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 text-white">
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold-400">{eyebrow}</div>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-brand-50/80">{intro}</p>}
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

export function Section({ id, eyebrow, title, intro, children, tone = "white" }: {
  id?: string; eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode; tone?: "white" | "sand";
}) {
  return (
    <section id={id} className={tone === "sand" ? "bg-sand-100" : "bg-white"}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        {eyebrow && <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold-600">{eyebrow}</div>}
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">{title}</h2>
        {intro && <p className="mt-3 max-w-2xl text-lg text-ink-500">{intro}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/** "Read more" link to another page. */
export function More({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-8 inline-flex items-center gap-2 font-semibold text-brand-700 hover:text-brand-900">
      {children} <ArrowRight size={18} />
    </Link>
  );
}

/** Closing call to action used at the bottom of pages. */
export function GetStarted() {
  return (
    <section className="bg-sand-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-16 text-center">
        <img src="/deen-icon.png" alt="" className="h-16 w-16 object-contain" />
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Start today. It&apos;s free to join.</h2>
        <p className="mt-2 text-lg text-ink-500">Get the DEEN app and find your next opportunity.</p>
        <a href="/downloads/deen.apk" className="mt-6 inline-flex items-center gap-2.5 rounded-2xl bg-brand-800 px-6 py-4 font-bold text-white hover:bg-brand-900">
          <Download size={20} /> Get the Android app
        </a>
      </div>
    </section>
  );
}
