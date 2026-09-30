"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { OpportunityForm, draftFrom, payloadFrom } from "@/components/OpportunityForm";
import { Button, Card, Field, PageHeader, Select } from "@/components/ui";
import { get, post } from "@/lib/api";

export default function NewOpportunityForOrg() {
  const router = useRouter();
  const [draft, setDraft] = useState(draftFrom());
  const [orgId, setOrgId] = useState("");
  const orgs = useQuery({ queryKey: ["admin", "orgs", "all"], queryFn: () => get<{ id: string; name: string }[]>("/admin/organizations") });
  const create = useMutation({
    mutationFn: () => post<{ id: string }>("/admin/opportunities", { ...payloadFrom(draft), organization_id: orgId }),
    onSuccess: (r) => { toast.success("Listed and sent to the review queue"); router.push(`/admin/opportunities/${r.id}`); },
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Opportunities" title="List an opportunity" subtitle="For opportunities the DEEN team sources directly. It enters the review queue like any other submission." />
      <Card className="mb-5">
        <Field label="On behalf of">
          <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Choose an organization…</option>
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
      </Card>
      <OpportunityForm value={draft} onChange={setDraft} staff />
      <div className="sticky bottom-4 mt-5 flex justify-end rounded-2xl border border-sand-200 bg-white/90 p-3 shadow-float backdrop-blur">
        <Button disabled={!orgId || draft.title.length < 5} loading={create.isPending} onClick={() => create.mutate()}>Create listing</Button>
      </div>
    </div>
  );
}
