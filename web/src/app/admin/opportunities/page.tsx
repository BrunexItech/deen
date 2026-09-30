"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { OppTable } from "@/components/admin/OppTable";
import { Button, PageHeader } from "@/components/ui";
import { useCan } from "@/lib/auth";

export default function OpportunitiesPage() {
  const can = useCan();
  return (
    <>
      <PageHeader
        eyebrow="Marketplace"
        title="Opportunities"
        subtitle="Everything DEEN distributes to members. Feature, re-tier, close or re-open listings."
        actions={can("opps.edit") && <Link href="/admin/opportunities/new"><Button icon={<Plus size={16} />}>List for an organization</Button></Link>}
      />
      <OppTable />
    </>
  );
}
