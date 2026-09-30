"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageLoader } from "@/components/Loader";
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { get, patch, upload } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { titleCase, VERIFICATION } from "@/lib/format";
import { useTaxonomy } from "@/lib/hooks";
import type { AdminOrg } from "@/lib/types";

type Profile = AdminOrg & { description: string | null; phone: string | null; address: string | null; logo_file_id: string | null };

export default function OrgProfile() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: tax } = useTaxonomy();
  const { data } = useQuery({ queryKey: ["org", "profile"], queryFn: () => get<Profile>("/org/profile") });
  const [f, setF] = useState<Partial<Profile>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (data) setF(data); }, [data]);
  const isAdmin = me?.role === "org_admin";

  const save = useMutation({
    mutationFn: () => patch<Profile>("/org/profile", { tagline: f.tagline || null, description: f.description || null, website: f.website || null, email: f.email || null, phone: f.phone || null, county: f.county || null, address: f.address || null, logo_file_id: f.logo_file_id }),
    onSuccess: (r) => { toast.success("Profile updated"); qc.setQueryData(["org", "profile"], r); qc.invalidateQueries({ queryKey: ["me"] }); },
  });
  const logo = useMutation({
    mutationFn: (file: File) => upload(file, "logo"),
    onSuccess: (r) => setF((x) => ({ ...x, logo_file_id: r.id, logo_url: r.url })),
  });

  if (!data) return <PageLoader />;
  const v = VERIFICATION[data.verification];
  return (
    <div className="max-w-3xl">
      <PageHeader title="Organization profile" subtitle="What members see on your opportunities and organization page. Your name and verification are managed by DEEN." />
      <Card className="mb-5">
        <div className="flex items-center gap-5">
          <Avatar name={data.name} src={f.logo_url} size={72} />
          <div className="flex-1">
            <div className="text-lg font-bold">{data.name}</div>
            <div className="mt-1 flex items-center gap-2"><Badge tone={v.tone}>{v.label}</Badge><span className="text-sm text-ink-500">{titleCase(data.type)}</span></div>
          </div>
          {isAdmin && (
            <>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && logo.mutate(e.target.files[0])} />
              <Button variant="secondary" icon={<Upload size={15} />} loading={logo.isPending} onClick={() => fileRef.current?.click()}>Logo</Button>
            </>
          )}
        </div>
      </Card>
      <Card>
        <fieldset disabled={!isAdmin} className="grid gap-4 sm:grid-cols-2">
          <Field label="Tagline" className="sm:col-span-2"><Input value={f.tagline ?? ""} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
          <Field label="About" className="sm:col-span-2"><Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-[140px]" /></Field>
          <Field label="Website"><Input value={f.website ?? ""} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="County"><Select value={f.county ?? ""} onChange={(e) => setF({ ...f, county: e.target.value })}><option value="">—</option>{tax?.counties.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        </fieldset>
        {isAdmin ? <Button className="mt-5" loading={save.isPending} onClick={() => save.mutate()}>Save profile</Button> : <p className="mt-4 text-sm text-ink-400">Only organization admins can edit the profile.</p>}
      </Card>
    </div>
  );
}
