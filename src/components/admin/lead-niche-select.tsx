"use client";

import { useTransition } from "react";
import { classifyLeadNiche } from "@/lib/actions/admin";
import { Select } from "@/components/ui/select";
import type { Niche } from "@/lib/types";

export function LeadNicheSelect({
  leadId,
  nicheId,
  niches,
  className = "w-40",
}: {
  /** Overrides the default field look, e.g. a quiet in-table style. */
  className?: string;
  leadId: string;
  nicheId: string | null;
  niches: Niche[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      className={className}
      defaultValue={nicheId ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value;
        if (!value) return;
        startTransition(() => classifyLeadNiche(leadId, value));
      }}
    >
      <option value="" disabled>
        Velg niche…
      </option>
      {niches.map((niche) => (
        <option key={niche.id} value={niche.id}>
          {niche.name}
        </option>
      ))}
    </Select>
  );
}
