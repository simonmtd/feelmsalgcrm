"use client";

import { useTransition } from "react";
import { switchActiveNiche } from "@/lib/actions/leads";
import { Select } from "@/components/ui/select";
import type { Niche } from "@/lib/types";

export function NicheSwitcher({
  niches,
  activeNicheId,
}: {
  niches: Niche[];
  activeNicheId: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={activeNicheId ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value;
        if (!value) return;
        startTransition(() => {
          switchActiveNiche(value);
        });
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
