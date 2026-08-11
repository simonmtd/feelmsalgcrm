"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { LeadNicheSelect } from "@/components/admin/lead-niche-select";
import { LeadAssignSelect } from "@/components/admin/lead-assign-select";
import { bulkAssignLeads, distributeLeadsEvenly } from "@/lib/actions/admin";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import { LEAD_STATUS_VARIANT } from "@/lib/status-styles";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Lead, Niche, Profile } from "@/lib/types";

type Seller = Pick<Profile, "id" | "full_name" | "email">;

function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  indeterminate?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border-2 border-ink transition-colors",
        checked || indeterminate ? "bg-gold-500" : "bg-white hover:bg-gold-100"
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2.5 bg-ink" />
      ) : checked ? (
        <span className="font-pixel text-[10px] leading-none text-ink">x</span>
      ) : null}
    </button>
  );
}

export function BulkAssignLeadsTable({
  leads,
  niches,
  sellers,
  workload = {},
  total,
}: {
  leads: Lead[];
  niches: Niche[];
  sellers: Seller[];
  /** sellerId -> number of open leads they currently hold */
  workload?: Record<string, number>;
  /** Total matching leads across all pages (leads is just the current page). */
  total?: number;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sellerId, setSellerId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleOne(id: string) {
    setMessage(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setMessage(null);
    setSelectedIds(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }

  function handleAssign(target: string) {
    const ids = [...selectedIds];
    startTransition(async () => {
      const result = await bulkAssignLeads(ids, target || null);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const sellerName =
        sellers.find((s) => s.id === target)?.full_name ?? "puljen (ikke tildelt)";
      setMessage(
        `${result.assigned} ${result.assigned === 1 ? "lead" : "leads"} fordelt til ${sellerName}.`
      );
      setSelectedIds(new Set());
      setSellerId("");
    });
  }

  function handleDistribute() {
    const ids = [...selectedIds];
    startTransition(async () => {
      const result = await distributeLeadsEvenly(ids, sellers.map((s) => s.id));
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage(
        `${result.assigned} ${result.assigned === 1 ? "lead" : "leads"} fordelt jevnt på ${sellers.length} selgere.`
      );
      setSelectedIds(new Set());
      setSellerId("");
    });
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            {total != null && total > leads.length
              ? `${leads.length} av ${total} leads`
              : `${leads.length} leads`}
          </CardTitle>
          {selectedIds.size > 0 && (
            <span className="font-pixel text-[10px] uppercase tracking-wide text-forest-700">
              {selectedIds.size} valgt
            </span>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-col gap-3 rounded-sm border-2 border-ink bg-gold-100 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-wood-600">Belastning nå:</span>
            {sellers.map((seller) => (
              <span
                key={seller.id}
                className="rounded-[2px] border border-ink bg-parchment px-1.5 py-0.5 text-xs text-wood-900"
              >
                {(seller.full_name ?? seller.email).split(" ")[0]}:{" "}
                <span className="font-mono font-bold">{workload[seller.id] ?? 0}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-wood-800">Fordel {selectedIds.size} valgte til:</span>
            <Select
              aria-label="Velg selger for de valgte leadsene"
              value={sellerId}
              disabled={isPending}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-52"
            >
              <option value="">Velg selger…</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.full_name ?? seller.email} ({workload[seller.id] ?? 0} åpne)
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={isPending || !sellerId}
              onClick={() => handleAssign(sellerId)}
            >
              {isPending ? "Fordeler…" : "Fordel"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending || sellers.length === 0}
              onClick={handleDistribute}
              title="Round-robin over alle aktive selgere"
            >
              Fordel jevnt
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleAssign("")}
            >
              Fjern tildeling
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setSelectedIds(new Set())}
            >
              Nullstill
            </Button>
          </div>
          </div>
        )}

        {message && (
          <p className="rounded-sm border-2 border-ink bg-forest-100 px-3 py-2 text-sm text-forest-700">
            {message}
          </p>
        )}
      </CardHeader>

      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/25 text-left text-xs uppercase text-wood-700">
              <th className="w-8 py-2 pr-3">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  label={allSelected ? "Fjern alle valg" : "Velg alle leads i filteret"}
                />
              </th>
              <th className="py-2 pr-4">Firma</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Deal size</th>
              <th className="py-2 pr-4">Niche</th>
              <th className="py-2 pr-4">Selger</th>
              <th className="py-2 pr-4">Opprettet</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const checked = selectedIds.has(lead.id);
              return (
                <tr
                  key={lead.id}
                  className={cn("border-b border-ink/15", checked && "bg-gold-100")}
                >
                  <td className="py-2 pr-3">
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleOne(lead.id)}
                      label={`Velg ${lead.company_name ?? "lead"}`}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <a
                      href={`/leads/${lead.id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {lead.company_name ?? "Ukjent firma"}
                    </a>
                    <p className="text-xs text-wood-700">{lead.contact_name}</p>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">{formatCurrency(lead.deal_size)}</td>
                  <td className="py-2 pr-4">
                    <LeadNicheSelect
                      leadId={lead.id}
                      nicheId={lead.niche_id}
                      niches={niches}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <LeadAssignSelect
                      leadId={lead.id}
                      assignedTo={lead.assigned_to}
                      sellers={sellers}
                    />
                  </td>
                  <td className="py-2 pr-4 text-wood-700">{formatDate(lead.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!leads.length && (
          <p className="py-6 text-center text-sm text-wood-700">
            Ingen leads matcher filteret.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
