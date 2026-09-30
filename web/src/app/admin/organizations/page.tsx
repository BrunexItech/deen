"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Loader";
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from "@/components/ui";
import { get, post, qs } from "@/lib/api";
import { useCan } from "@/lib/auth";
import { fmtDate, num, titleCase, VERIFICATION } from "@/lib/format";
import { useTaxonomy } from "@/lib/hooks";
import { ORG_TYPES, type AdminOrg } from "@/lib/types";

function CreateOrgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: tax } = useTaxonomy();
  const blank = { name: "", org_type: "ngo", tagline: "", description: "", website: "", email: "", phone: "", county: "", registration_number: "", verification: "pending", admin_email: "", admin_name: "" };
  const [f, setF] = useState(blank);
  const [invite, setInvite] = useState<{ link: string; email_sent: boolean } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const set = (k: keyof typeof blank, v: string) => setF({ ...f, [k]: v });
  const create = useMutation({
    mutationFn: () => post<AdminOrg & { invite: { link: string; email_sent: boolean } | null }>("/admin/organizations", Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === "" ? null : v]))),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin", "orgs"] });
      toast.success(`${r.name} created`);
      if (r.invite) { setInvite(r.invite); setCreatedId(r.id); } else { onClose(); router.push(`/admin/organizations/${r.id}`); }
    },
  });
  const close = () => { setF(blank); setInvite(null); onClose(); if (createdId) router.push(`/admin/organizations/${createdId}`); };

  return (
    <Modal open={open} onClose={close} title={invite ? "Organization created" : "Onboard an organization"} wide
      footer={invite ? <Button onClick={close}>Done</Button> : <><Button variant="ghost" onClick={close}>Cancel</Button><Button loading={create.isPending} disabled={f.name.length < 2} onClick={() => create.mutate()}>Create organization</Button></>}>
      {invite ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-700">{invite.email_sent ? "We emailed the invitation." : "Email isn't configured yet. Share this one-time link with the representative (valid 7 days):"}</p>
          <div className="flex items-center gap-2 rounded-xl bg-sand-100 p-3">
            <code className="flex-1 truncate text-xs">{invite.link}</code>
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => { navigator.clipboard.writeText(invite.link); toast.success("Link copied"); }}>Copy</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organization name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Type"><Select value={f.org_type} onChange={(e) => set("org_type", e.target.value)}>{ORG_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select></Field>
          <Field label="County"><Select value={f.county} onChange={(e) => set("county", e.target.value)}><option value="">—</option>{tax?.counties.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Tagline" className="sm:col-span-2"><Input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field>
          <Field label="About" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Website"><Input value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
          <Field label="Registration number"><Input value={f.registration_number} onChange={(e) => set("registration_number", e.target.value)} /></Field>
          <Field label="Contact email"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Contact phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Verification level" className="sm:col-span-2">
            <Tabs value={f.verification} onChange={(v) => set("verification", v)} tabs={[{ value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "trusted", label: "Trusted" }]} />
          </Field>
          <div className="rounded-2xl border border-dashed border-sand-300 p-4 sm:col-span-2">
            <div className="mb-3 text-sm font-bold">Invite their first administrator</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={f.admin_name} onChange={(e) => set("admin_name", e.target.value)} placeholder="Full name" />
              <Input type="email" value={f.admin_email} onChange={(e) => set("admin_email", e.target.value)} placeholder="Email" />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function OrgList() {
  const can = useCan();
  const params = useSearchParams();
  const [verification, setVerification] = useState(params.get("verification") ?? "");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "orgs", verification, q], queryFn: () => get<AdminOrg[]>(`/admin/organizations${qs({ verification, q })}`) });

  return (
    <>
      <PageHeader
        eyebrow="Trust & review"
        title="Organizations"
        subtitle="Organizations never self-register: DEEN onboards, verifies and grades every one of them."
        actions={can("orgs.manage") && <Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Onboard organization</Button>}
      />
      <Card pad={false}>
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={verification} onChange={setVerification} tabs={[{ value: "", label: "All" }, { value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "trusted", label: "Trusted" }]} />
          <div className="relative lg:w-72">
            <Search size={16} className="absolute left-3 top-3.5 text-ink-300" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organizations" className="pl-9" />
          </div>
        </div>
        {isLoading ? <TableSkeleton /> : !data?.length ? (
          <Empty icon={<Building2 size={26} />} title="No organizations yet" body="Onboard the first partner organization to start distributing opportunities." />
        ) : (
          <div className="divide-y divide-sand-200">
            {data.map((o) => (
              <Link key={o.id} href={`/admin/organizations/${o.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-emerald-50/40">
                <Avatar name={o.name} src={o.logo_url} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{o.name}</span>
                    {o.status === "suspended" && <Badge tone="bad">Suspended</Badge>}
                    {o.premium && <Badge tone="gold">Premium</Badge>}
                  </div>
                  <div className="truncate text-xs text-ink-400">{titleCase(o.type)} · {o.county ?? "—"} · onboarded {fmtDate(o.created_at)}</div>
                </div>
                <div className="hidden text-right text-sm text-ink-500 sm:block">{num(o.opportunities ?? 0)} opportunities<br /><span className="text-xs">{num(o.team ?? 0)} team</span></div>
                <Badge tone={VERIFICATION[o.verification].tone}>{VERIFICATION[o.verification].label}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
      <CreateOrgModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function OrganizationsPage() {
  return <Suspense><OrgList /></Suspense>;
}
