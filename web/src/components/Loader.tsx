import clsx from "clsx";

/** The DEEN loader: the official emblem breathes at the centre while two arcs in the
 * logo's colours orbit it: gold and green on the inside, royal blue on the outside. */
export function DeenLoader({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <div className={clsx("deen-loader relative", className)} style={{ width: size, height: size }} role="img" aria-label="Loading">
      <svg className="orbit-slow absolute inset-0" viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="46" fill="none" stroke="#004485" strokeOpacity="0.12" strokeWidth="4" />
        <circle cx="50" cy="50" r="46" fill="none" stroke="#004485" strokeWidth="4" strokeLinecap="round" strokeDasharray="70 219" />
      </svg>
      <svg className="orbit absolute inset-0" viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#e39d29" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="52 187" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="#43b02a" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="26 213" strokeDashoffset="-119" />
      </svg>
      <img src="/deen-icon.png" alt="" className="emblem absolute object-contain" style={{ inset: size * 0.22, width: size * 0.56, height: size * 0.56 }} />
    </div>
  );
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 animate-fade-up">
      <DeenLoader size={64} />
      <p className="text-sm font-medium tracking-wide text-ink-400">{label}…</p>
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-sand-100">
      <DeenLoader size={88} />
      <span className="text-xs font-bold tracking-[0.5em] text-brand-800">DEEN</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 object-contain" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
