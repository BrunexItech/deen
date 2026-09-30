"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TableSkeleton } from "@/components/Loader";
import { Avatar, Badge, Button, Card, Empty, Input, PageHeader, Select } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { ago, fmtDate, num } from "@/lib/format";
import { useTaxonomy } from "@/lib/hooks";

interface MemberRow {
  id: string; full_name: string; phone: string; email: string | null; status: string; identity_status: string;
  created_at: string; last_active_at: string | null; county: string | null; education_level: string | null; age: number | null;
}

export default function MembersPage() {
  const { data: tax } = useTaxonomy();
  const [q, setQ] = useState("");
  const [county, setCounty] = useState("");
  const [identity, setIdentity] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "members", q, county, identity, page],
    queryFn: () => get<{ items: MemberRow[]; total: number }>(`/admin/members${qs({ q, county, identity, page, limit: 30 })}`),
    placeholderData: (prev) => prev,
  });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 30));

  return (
    <>
      <PageHeader eyebrow="Community" title="Members" subtitle={`${num(data?.total ?? 0)} Muslims on DEEN. Profiles, memberships, applications and account safety.`} />
      <Card pad={false}>
        <div className="grid gap-3 border-b border-sand-200 p-4 sm:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3.5 text-ink-300" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Name, phone or email" className="pl-9" />
          </div>
          <Select value={county} onChange={(e) => { setCounty(e.target.value); setPage(1); }}><option value="">All counties</option>{tax?.counties.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select value={identity} onChange={(e) => { setIdentity(e.target.value); setPage(1); }}>
            <option value="">Any identity status</option><option value="verified">Verified ID</option><option value="pending">Pending ID check</option><option value="none">Not verified</option>
          </Select>
        </div>
        {isLoading ? <TableSkeleton /> : !data?.items.length ? <Empty icon={<Users size={26} />} title="No members found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <tr><th className="px-5 py-3">Member</th><th className="px-3 py-3">County</th><th className="px-3 py-3">Education</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Last active</th><th className="px-3 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data.items.map((m) => (
                  <tr key={m.id} className="hover:bg-emerald-50/40">
                    <td className="px-5 py-3">
                      <Link href={`/admin/members/${m.id}`} className="flex items-center gap-3">
                        <Avatar name={m.full_name} size={34} />
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold">{m.full_name}{m.identity_status === "verified" && <BadgeCheck size={15} className="text-emerald-600" />}</div>
                          <div className="text-xs text-ink-400">{m.phone}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3">{m.county ?? "—"}</td>
                    <td className="px-3 py-3">{tax?.education_levels.find((e) => e.key === m.education_level)?.name ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-500">{fmtDate(m.created_at)}</td>
                    <td className="px-3 py-3 text-ink-500">{ago(m.last_active_at)}</td>
                    <td className="px-3 py-3">{m.status === "suspended" && <Badge tone="bad">Suspended</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-sand-200 px-5 py-3 text-sm text-ink-500">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} icon={<ChevronLeft size={14} />}>Prev</Button>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next <ChevronRight size={14} /></Button>
          </div>
        </div>
      </Card>
    </>
  );
}
