import { ArrowRight, BadgeCheck, Briefcase, Download, Fingerprint, GraduationCap, HandHeart, Rocket, Sparkles, Users } from "lucide-react";
import Link from "next/link";

const API = process.env.API_ORIGIN ?? "http://127.0.0.1:8020";

async function stats() {
  try {
    const r = await fetch(`${API}/api/v1/public/stats`, { next: { revalidate: 300 } });
    return r.ok ? ((await r.json()) as { live_opportunities: number; verified_organizations: number; members: number }) : null;
  } catch {
    return null;
  }
}

const CATEGORIES = [
  { icon: GraduationCap, title: "Scholarships", body: "University, Islamic studies, Qur'an and Arabic programmes." },
  { icon: Briefcase, title: "Jobs", body: "Graduate programmes, internships, remote and local roles." },
  { icon: Rocket, title: "Business", body: "Halal grants, interest-free financing and accelerators." },
  { icon: HandHeart, title: "Support", body: "Zakat, sadaqah, medical, education and emergency help." },
  { icon: Sparkles, title: "Learning", body: "Mentorship, certifications and professional training." },
  { icon: Users, title: "Community", body: "Events, volunteering, youth and sisters' programmes." },
];

export default async function Landing() {
  const s = await stats();
  return (
    <div className="bg-sand-100">
      <header className="pattern-khatam relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 text-white">
        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <img src="/deen-icon.png" alt="DEEN" className="h-10 w-10 rounded-xl ring-1 ring-gold-400/40" />
            <span className="text-lg font-extrabold tracking-[0.3em]">DEEN</span>
          </div>
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-emerald-50/80 ring-1 ring-white/20 hover:bg-white/10">Partner sign in</Link>
        </nav>
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-10 lg:grid-cols-[1.15fr_1fr] lg:pt-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-gold-400 ring-1 ring-gold-400/30">
              <BadgeCheck size={14} /> Every organization verified by DEEN
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
              The door to opportunity for the <span className="text-gold-400">Muslim community</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-emerald-50/80">
              Scholarships, jobs, business funding, zakat support and community programmes from trusted organizations, matched to you personally.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="/downloads/deen.apk" className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 px-6 py-4 font-bold text-emerald-950 shadow-lg shadow-black/20 transition hover:brightness-105">
                <Download size={20} /> Download for Android
              </a>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 font-semibold ring-1 ring-white/25 hover:bg-white/10">
                For organizations <ArrowRight size={18} />
              </Link>
            </div>
            {s && (
              <div className="mt-12 flex gap-10 border-t border-white/10 pt-8">
                {[["Live opportunities", s.live_opportunities], ["Verified organizations", s.verified_organizations], ["Members", s.members]].map(([l, n]) => (
                  <div key={l}><div className="text-3xl font-extrabold text-gold-400">{Number(n).toLocaleString()}</div><div className="text-sm text-emerald-100/60">{l}</div></div>
                ))}
              </div>
            )}
          </div>
          <div className="relative mx-auto w-full max-w-[340px]">
            <div className="absolute -inset-10 rounded-full bg-gold-400/20 blur-3xl" />
            <div className="relative rounded-[2.6rem] border-[10px] border-emerald-950 bg-sand-100 p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between text-ink-900">
                <div><div className="text-xs text-ink-400">Assalamu alaikum</div><div className="font-bold">Amina</div></div>
                <img src="/deen-icon.png" alt="" className="h-8 w-8 rounded-lg" />
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-4 text-white">
                <div className="text-xs text-gold-400">For you today</div>
                <div className="mt-1 text-2xl font-extrabold">5 scholarships</div>
                <div className="text-sm text-emerald-50/70">match your profile</div>
              </div>
              {["Al-Noor University Scholarship", "Halal Startup Grant", "Graduate Developer Programme"].map((t, i) => (
                <div key={t} className="mt-3 rounded-2xl bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-gold-600">{["92% MATCH", "85% MATCH", "78% MATCH"][i]}</span><BadgeCheck size={14} className="text-emerald-600" /></div>
                  <div className="mt-1 text-sm font-bold text-ink-900">{t}</div>
                  <div className="text-xs text-ink-400">Closes in {[6, 12, 18][i]} days</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Everything in one trusted place</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink-500">No more hunting through WhatsApp groups and Facebook pages. DEEN reviews every opportunity before it reaches you.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-sand-200 bg-white p-6 shadow-card">
              <div className="mb-4 inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Icon size={22} /></div>
              <div className="text-lg font-bold">{title}</div>
              <p className="mt-1 text-sm text-ink-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-20 md:grid-cols-3">
        {[
          { icon: Fingerprint, title: "Secure by design", body: "Biometric unlock, encrypted data and verified identities. Your information is protected under Kenya's Data Protection Act." },
          { icon: Sparkles, title: "Matched to you", body: "DEEN's matching engine explains why each opportunity fits your education, skills, location and goals." },
          { icon: HandHeart, title: "Measured by impact", body: "We measure success by how many people actually benefit. Share your story when you get it." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-3xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-7 text-white">
            <Icon className="text-gold-400" size={26} />
            <div className="mt-4 text-lg font-bold">{title}</div>
            <p className="mt-1 text-sm text-emerald-50/70">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-sand-200 py-10 text-center text-sm text-ink-400">
        <p className="font-arabic text-xl text-emerald-800" dir="rtl" lang="ar">مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ</p>
        <p className="mt-1">&ldquo;Whoever guides someone to goodness has a reward like the one who does it.&rdquo; (Sahih Muslim 1893)</p>
        <p className="mt-6">© {new Date().getFullYear()} DEEN · Kenya</p>
      </footer>
    </div>
  );
}
