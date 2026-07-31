"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { fetchApolloLeads } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

/**
 * Admin control: pull fresh ICP-matched prospects from Apollo, optionally
 * narrowed to one bransje (niche). "Alle bransjer" pulls across the whole ICP.
 */
export function FetchApolloButton({
  niches,
  count = 25,
}: {
  niches: { id: string; name: string }[];
  count?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [nicheId, setNicheId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={nicheId}
        onChange={(e) => setNicheId(e.target.value)}
        className="w-44"
        aria-label="Bransje"
      >
        <option value="">Alle bransjer</option>
        {niches.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </Select>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const res = await fetchApolloLeads(count, nicheId || null);
            setMsg(res.message);
          })
        }
      >
        <Download className="h-3.5 w-3.5" />
        {isPending ? "Henter…" : "Hent nye leads"}
      </Button>
      {msg && <span className="text-xs text-forest-700">{msg}</span>}
    </div>
  );
}
