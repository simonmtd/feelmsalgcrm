"use client";

import { useTransition } from "react";
import { reassignLead } from "@/lib/actions/admin";
import { Select } from "@/components/ui/select";
import type { Profile } from "@/lib/types";

export function LeadAssignSelect({
  leadId,
  assignedTo,
  sellers,
}: {
  leadId: string;
  assignedTo: string | null;
  sellers: Pick<Profile, "id" | "full_name" | "email">[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      className="w-40"
      defaultValue={assignedTo ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value || null;
        startTransition(() => reassignLead(leadId, value));
      }}
    >
      <option value="">Ikke tildelt</option>
      {sellers.map((seller) => (
        <option key={seller.id} value={seller.id}>
          {seller.full_name ?? seller.email}
        </option>
      ))}
    </Select>
  );
}
