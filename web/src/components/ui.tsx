"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { Tone } from "@/lib/format";
import { DeenLoader } from "./Loader";

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode;
}>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-[15px]",
        variant === "primary" && "bg-brand-700 text-white shadow-sm hover:bg-brand-800",
        variant === "gold" && "bg-gradient-to-b from-gold-400 to-gold-600 text-brand-950 shadow-sm hover:brightness-105",
        variant === "secondary" && "border border-sand-300 bg-white text-ink-900 hover:border-brand-600/40 hover:bg-brand-50",
        variant === "ghost" && "text-ink-700 hover:bg-sand-200/60",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
      {...rest}
    >
      {loading ? <DeenLoader size={18} /> : icon}
      {children}
    </button>
  );
});

/* ---------- Surfaces ---------- */

export function Card({ className, children, pad = true }: { className?: string; children: ReactNode; pad?: boolean }) {
  return <div className={clsx("rounded-2xl border border-sand-200 bg-white shadow-card", pad && "p-5", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-fade-up">
        {eyebrow && <div className="mb-1.5 text-xs font-bold uppercase tracking-[0.18em] text-gold-600">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Badges ---------- */

const TONES: Record<Tone, string> = {
  neutral: "bg-sand-200/70 text-ink-700",
  info: "bg-sky-50 text-sky-800 ring-1 ring-sky-200/70",
  good: "bg-leaf-50 text-leaf-800 ring-1 ring-leaf-200/70",
  warn: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70",
  bad: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70",
  gold: "bg-gold-50 text-gold-700 ring-1 ring-gold-400/40",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

/* ---------- Form ---------- */

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

const control = "w-full rounded-xl border border-sand-300 bg-white px-3.5 text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 disabled:bg-sand-100";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(control, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(control, "min-h-[96px] py-2.5 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(control, "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235e6b66%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left">
      <span className={clsx("mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition", checked ? "bg-brand-600" : "bg-sand-300")}>
        <span className={clsx("h-5 w-5 rounded-full bg-white shadow transition", checked && "translate-x-5")} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </span>
    </button>
  );
}

/** Pick several values from a fixed list, shown as tappable chips. */
export function ChipSelect({ options, value, onChange, max }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : max && value.length >= max ? value : [...value, o.value])}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
              on ? "border-brand-700 bg-brand-700 text-white" : "border-sand-300 bg-white text-ink-700 hover:border-brand-600/50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free-text tags: type and press Enter. */
export function TagInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => {
    const tag = t.trim();
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  };
  const matches = draft ? suggestions.filter((s) => s.toLowerCase().includes(draft.toLowerCase()) && !value.includes(s)).slice(0, 6) : [];
  return (
    <div>
      <div className={clsx(control, "flex min-h-11 flex-wrap items-center gap-1.5 py-1.5")}>
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-[13px] font-medium text-brand-800">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove ${t}`}>
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[120px] flex-1 bg-transparent py-1 outline-none placeholder:text-ink-300"
        />
      </div>
      {matches.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {matches.map((m) => (
            <button key={m} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(m)} className="rounded-full bg-sand-200/70 px-2.5 py-1 text-xs text-ink-700 hover:bg-brand-50">
              + {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Overlays ---------- */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx("max-h-[92vh] w-full animate-fade-up overflow-hidden rounded-t-3xl bg-white shadow-float sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
          <h2 className="text-base font-bold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-sand-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-sand-200 bg-sand-50 px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Data display ---------- */

export function Stat({ label, value, hint, icon, tone = "emerald" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "emerald" | "gold" | "ink" }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-medium text-ink-500">{label}</div>
          <div className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight text-ink-900">{value}</div>
          {hint && <div className="mt-2 text-xs text-ink-400">{hint}</div>}
        </div>
        {icon && (
          <div className={clsx("rounded-xl p-2.5", tone === "emerald" && "bg-brand-50 text-brand-700", tone === "gold" && "bg-gold-50 text-gold-600", tone === "ink" && "bg-sand-100 text-ink-700")}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 rounded-2xl bg-brand-50 p-4 text-brand-700">{icon}</div>}
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-sand-200/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition",
            value === t.value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={clsx("rounded-full px-1.5 text-[11px]", value === t.value ? "bg-brand-50 text-brand-700" : "bg-sand-300/60")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  if (src) return <img src={src} alt={name} width={size} height={size} className="rounded-xl object-cover" style={{ width: size, height: size }} />;
  return (
    <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}
