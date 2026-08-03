"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Lead } from "@/lib/types";

type LeadOption = Pick<Lead, "id" | "company_name" | "contact_name">;

/**
 * Searchable customer picker for the meeting form. Type to filter existing
 * leads, or add a brand-new customer name. Emits the choice to the parent form
 * via hidden inputs: `lead_id` (existing) OR `new_customer` (new name).
 */
export function LeadCombobox({ leads }: { leads: LeadOption[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newCustomer, setNewCustomer] = useState<string>("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return leads.slice(0, 20);
    return leads
      .filter(
        (l) =>
          l.company_name?.toLowerCase().includes(q) ||
          l.contact_name?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [leads, q]);

  const exact = leads.some((l) => (l.company_name ?? "").toLowerCase() === q);
  const canAddNew = q.length >= 2 && !exact;

  function pickLead(l: LeadOption) {
    setSelectedId(l.id);
    setNewCustomer("");
    setQuery(l.company_name ?? "");
    setOpen(false);
  }
  function addNew() {
    setSelectedId("");
    setNewCustomer(query.trim());
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name="lead_id" value={selectedId} />
      <input type="hidden" name="new_customer" value={newCustomer} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-wood-600" />
        <Input
          value={query}
          placeholder="Søk kunde, eller skriv nytt navn…"
          className="pl-8"
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId("");
            setNewCustomer("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
        />
      </div>

      {(selectedId || newCustomer) && (
        <p className="mt-1 text-xs text-forest-700">
          {selectedId ? "✓ Valgt kunde" : `✓ Ny kunde: «${newCustomer}»`}
        </p>
      )}

      {open && (
        <ul
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-sm border-2 border-ink bg-parchment shadow-[3px_3px_0_0_var(--color-ink)]"
          onMouseDown={() => {
            // Keep the dropdown alive through the click (cancel blur-close).
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {canAddNew && (
            <li>
              <button
                type="button"
                onClick={addNew}
                className="flex w-full items-center gap-2 border-b border-ink/15 px-3 py-2 text-left text-sm font-medium text-forest-700 hover:bg-gold-200"
              >
                <Plus className="h-4 w-4" /> Legg til «{query.trim()}» som ny kunde
              </button>
            </li>
          )}
          {matches.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => pickLead(l)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-wood-100"
              >
                <span>
                  <span className="text-ink">{l.company_name ?? "Ukjent firma"}</span>
                  {l.contact_name && (
                    <span className="block text-xs text-wood-700">{l.contact_name}</span>
                  )}
                </span>
                {selectedId === l.id && <Check className="h-4 w-4 text-forest-700" />}
              </button>
            </li>
          ))}
          {matches.length === 0 && !canAddNew && (
            <li className="px-3 py-2 text-sm text-wood-600">Ingen treff.</li>
          )}
        </ul>
      )}
    </div>
  );
}
