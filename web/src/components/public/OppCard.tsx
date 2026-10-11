import { BadgeCheck, CalendarClock, MapPin } from "lucide-react";
import Link from "next/link";
import type { PublicOpp } from "./content";

export function OppCard({ o }: { o: PublicOpp }) {
  return (
    <Link href={`/o/${o.id}`} className="group flex flex-col rounded-2xl border border-sand-200 bg-white p-5 transition hover:border-brand-400 hover:shadow-card">
      <div className="flex items-center gap-2 text-xs font-semibold text-leaf-700"><BadgeCheck size={14} /> Checked by DEEN</div>
      <div className="mt-2 font-bold leading-snug group-hover:text-brand-700">{o.title}</div>
      <div className="mt-1 text-sm text-ink-500">{o.organization?.name}</div>
      {o.amount_label && <div className="mt-2 text-sm font-semibold text-brand-700">{o.amount_label}</div>}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm text-ink-500">
        {o.location && <span className="inline-flex items-center gap-1"><MapPin size={14} />{o.location}</span>}
        {o.days_left != null && (
          <span className={`inline-flex items-center gap-1 ${o.closing_soon ? "font-semibold text-gold-700" : ""}`}>
            <CalendarClock size={14} />{o.days_left <= 0 ? "Closes today" : o.days_left === 1 ? "1 day left" : `${o.days_left} days left`}
          </span>
        )}
      </div>
    </Link>
  );
}
