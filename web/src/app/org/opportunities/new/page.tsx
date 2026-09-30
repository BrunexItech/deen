"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { OpportunityForm, draftFrom, payloadFrom } from "@/components/OpportunityForm";
import { Button, PageHeader } from "@/components/ui";
import { post } from "@/lib/api";

export default function NewOrgOpportunity() {
  const router = useRouter();
  const [draft, setDraft] = useState(draftFrom());
  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const r = await post<{ id: string }>("/org/opportunities", payloadFrom(draft));
      if (submit) await post(`/org/opportunities/${r.id}/submit`).catch((e) => { toast.error(`Saved as draft. ${e.message}`); });
      return { id: r.id, submit };
    },
    onSuccess: ({ id, submit }) => { toast.success(submit ? "Submitted to DEEN for review" : "Draft saved"); router.push(`/org/opportunities/${id}`); },
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New opportunity" subtitle="The more complete it is, the better DEEN can match it to the right members, and the faster it's approved." />
      <OpportunityForm value={draft} onChange={setDraft} />
      <div className="sticky bottom-4 mt-5 flex justify-end gap-2 rounded-2xl border border-sand-200 bg-white/90 p-3 shadow-float backdrop-blur">
        <Button variant="secondary" disabled={draft.title.length < 5} loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>Save draft</Button>
        <Button disabled={draft.title.length < 5} loading={save.isPending && save.variables === true} onClick={() => save.mutate(true)}>Submit for review</Button>
      </div>
    </div>
  );
}
