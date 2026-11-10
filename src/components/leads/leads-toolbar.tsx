"use client";

import { useState } from "react";
import { Phone, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NewLeadForm } from "@/components/leads/new-lead-form";
import { LogCallForm } from "@/components/leads/log-call-form";
import { LEAD_STATUS_LABELS, FILMING_STATUS_LABELS } from "@/lib/types";
import type { Niche } from "@/lib/types";

/**
 * One row for everything you do *to* the list: search + filters (apply on
 * change, no «Filtrer» button), the view switch, and the two create actions,
 * whose forms open underneath instead of each taking a row of their own.
 */
export function LeadsToolbar({
  filters,
  hidden,
  viewToggle,
  niches,
  defaultNicheId,
}: {
  filters: { q?: string; status?: string; filming?: string; quality?: string };
  /** Params to carry through a filter submit (todo, view). */
  hidden: Record<string, string | undefined>;
  viewToggle: React.ReactNode;
  niches: Pick<Niche, "id" | "name">[];
  defaultNicheId?: string | null;
}) {
  const [panel, setPanel] = useState<"new" | "call" | null>(null);
  const toggle = (p: "new" | "call") => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          method="get"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onChange={(e) => {
            // Selects apply immediately; the search box applies on Enter.
            if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
          }}
        >
          {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              name="q"
              aria-label="Søk"
              defaultValue={filters.q ?? ""}
              placeholder="Søk i leads…"
              className="pl-9"
            />
          </div>
          <Select name="status" aria-label="Status" defaultValue={filters.status ?? ""} className="w-auto">
            <option value="">Alle statuser</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select name="filming" aria-label="Filming" defaultValue={filters.filming ?? ""} className="w-auto">
            <option value="">All filming</option>
            {Object.entries(FILMING_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select name="quality" aria-label="Kvalitet" defaultValue={filters.quality ?? ""} className="w-auto">
            <option value="">Med/uten tlf.</option>
            <option value="phone">Kun med telefon</option>
          </Select>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {viewToggle}
          <Button type="button" variant="outline" size="sm" aria-expanded={panel === "call"} onClick={() => toggle("call")}>
            <Phone /> Logg samtale
          </Button>
          <Button type="button" variant="outline" size="sm" aria-expanded={panel === "new"} onClick={() => toggle("new")}>
            <Plus /> Ny lead
          </Button>
        </div>
      </div>

      {panel === "new" && (
        <NewLeadForm niches={niches} defaultNicheId={defaultNicheId} onClose={() => setPanel(null)} />
      )}
      {panel === "call" && <LogCallForm onClose={() => setPanel(null)} />}
    </div>
  );
}
