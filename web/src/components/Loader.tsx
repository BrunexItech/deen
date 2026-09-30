import clsx from "clsx";

/** The DEEN loader: the khatam's two squares counter-rotate while a trace of gold
 * light runs around the star and the doorway light breathes at the centre. */
export function DeenLoader({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={clsx("deen-loader", className)}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Loading"
    >
      <defs>
        <linearGradient id="dl-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F1D78A" />
          <stop offset="1" stopColor="#B7862C" />
        </linearGradient>
        <radialGradient id="dl-light">
          <stop offset="0" stopColor="#FFF3C9" />
          <stop offset="1" stopColor="#E2B654" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="sq-a">
        <rect x="24" y="24" width="52" height="52" rx="4" fill="none" stroke="#0B5D4B" strokeOpacity="0.9" strokeWidth="5" />
      </g>
      <g className="sq-b">
        <rect x="24" y="24" width="52" height="52" rx="4" fill="none" stroke="url(#dl-gold)" strokeWidth="5" />
        <rect className="trace" x="24" y="24" width="52" height="52" rx="4" fill="none" stroke="#FFF3C9" strokeWidth="5" strokeLinecap="round" />
      </g>
      <circle className="light" cx="50" cy="50" r="13" fill="url(#dl-light)" />
      <circle cx="50" cy="50" r="4.5" fill="#E2B654" />
    </svg>
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
      <DeenLoader size={76} />
      <span className="text-xs font-bold tracking-[0.5em] text-emerald-700">DEEN</span>
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
          <Skeleton className="h-10 w-10 rounded-xl" />
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
