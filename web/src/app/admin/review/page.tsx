"use client";

import { OppTable } from "@/components/admin/OppTable";
import { PageHeader } from "@/components/ui";

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trust & review"
        title="Review queue"
        subtitle="Every submission is scanned automatically for missing information, risky links, fee requests and duplicates. Highest risk first."
      />
      <OppTable queue />
    </>
  );
}
