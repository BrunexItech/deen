import { BadgeCheck, CalendarDays, Download, MapPin } from "lucide-react";
import type { Metadata } from "next";

const API = process.env.API_ORIGIN ?? "http://127.0.0.1:8020";

interface Preview {
  id: string; title: string; summary: string; deadline: string | null; days_left: number | null; location: string;
  amount_label: string | null; is_event: boolean; starts_at: string | null;
  organization: { name: string; verification: string; logo_url: string | null };
}

async function load(id: string): Promise<Preview | null> {
  try {
    const r = await fetch(`${API}/api/v1/public/opportunities/${encodeURIComponent(id)}`, { next: { revalidate: 120 } });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const o = await load((await params).id);
  if (!o) return { title: "Opportunity" };
  return { title: o.title, description: `${o.organization.name}: ${o.summary}`, openGraph: { title: o.title, description: o.summary, images: ["/deen-icon.png"] } };
}

export default async function SharedOpportunity({ params }: { params: Promise<{ id: string }> }) {
  const o = await load((await params).id);
  return (
    <div className="pattern-khatam flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-800 to-emerald-950 p-5">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-2.5">
          <img src="/deen-icon.png" alt="" className="h-9 w-9 rounded-lg" />
          <span className="font-extrabold tracking-[0.3em] text-emerald-800">DEEN</span>
        </div>
        {o ? (
          <>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-500">
              {o.organization.name}{o.organization.verification !== "pending" && <BadgeCheck size={16} className="text-emerald-600" />}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{o.title}</h1>
            {o.amount_label && <div className="mt-1 text-lg font-bold text-emerald-700">{o.amount_label}</div>}
            <p className="mt-3 text-ink-700">{o.summary}</p>
            <div className="mt-5 space-y-2 text-sm text-ink-700">
              <div className="flex items-center gap-2"><MapPin size={16} className="text-ink-400" />{o.location}</div>
              {(o.deadline || o.starts_at) && (
                <div className="flex items-center gap-2"><CalendarDays size={16} className="text-ink-400" />
                  {o.is_event && o.starts_at ? new Date(o.starts_at).toLocaleDateString("en-KE", { dateStyle: "full" }) : `Closes in ${o.days_left} day${o.days_left === 1 ? "" : "s"}`}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold">This opportunity has closed</h1>
            <p className="mt-2 text-ink-500">But there are many more waiting for you on DEEN.</p>
          </>
        )}
        <a href="/downloads/deen.apk" className="mt-7 flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-4 font-bold text-white hover:bg-emerald-800">
          <Download size={18} /> Get DEEN to apply
        </a>
        <p className="mt-3 text-center text-xs text-ink-400">Verified opportunities for the Muslim community in Kenya.</p>
      </div>
    </div>
  );
}
