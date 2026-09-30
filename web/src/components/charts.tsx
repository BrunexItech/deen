"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GRID = "#ece8dd";
const AXIS = { fontSize: 11, fill: "#7f8a86" };

function shortDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs shadow-float">
      <div className="mb-1 font-semibold text-ink-900">{label && /^\d{4}-/.test(label) ? shortDate(label) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b>{format ? format(p.value) : p.value.toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, series, height = 260, format }: {
  data: Record<string, number | string>[];
  series: { key: string; label: string; color: string }[];
  height?: number;
  format?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="1" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip format={format} />} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.2} fill={`url(#g-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, dataKey, labelKey, color = "#0f7a61", height = 240, colors }: {
  data: Record<string, number | string>[]; dataKey: string; labelKey: string; color?: string; height?: number; colors?: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey={labelKey} tick={{ ...AXIS, fill: "#2c3a35" }} axisLine={false} tickLine={false} width={120} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f6f4ee" }} />
        <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} barSize={16}>
          {data.map((_, i) => <Cell key={i} fill={colors?.[i % colors.length] ?? color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
