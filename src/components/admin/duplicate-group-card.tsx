"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Merge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mergeDuplicates } from "@/lib/actions/duplicates";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import { LEAD_STATUS_VARIANT } from "@/lib/status-styles";
import { cn, formatPhoneParts, relativeAge } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types";
import type { DupGroup } from "@/lib/duplicates";

/** One group of probable duplicates: pick the lead to keep, merge the rest into it. */
export function DuplicateGroupCard({ group, sellerNames }: { group: DupGroup; sellerNames: Record<string, string> }) {
  // Default keeper: the one called most recently (it has the live history), else the oldest.
  const [keeper, setKeeper] = useState(() => {
    const called = group.leads.filter((l) => l.last_call_at).sort((a, b) => b.last_call_at!.localeCompare(a.last_call_at!));
    return (called[0] ?? group.leads[0]).id;
  });
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  if (done) {
    return <div className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">{done}</div>;
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <p className="text-sm font-medium text-fg">
          {group.leads.length} leads · <span className="text-muted">{group.reasons.join(", ")}</span>
        </p>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await mergeDuplicates(keeper, group.leads.map((l) => l.id).filter((id) => id !== keeper));
              if (r.error) setError(r.error);
              else setDone(`Slått sammen – ${r.merged} duplikat${r.merged === 1 ? "" : "er"} markert, historikken flyttet.`);
            })
          }
        >
          <Merge /> Behold valgt, slå sammen
        </Button>
      </div>
      <div className="divide-y divide-line">
        {group.leads.map((l) => (
          <label
            key={l.id}
            className={cn("flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors", keeper === l.id ? "bg-brand-soft" : "hover:bg-surface-2/60")}
          >
            <input type="radio" name={`keep-${group.leads[0].id}`} checked={keeper === l.id} onChange={() => setKeeper(l.id)} className="h-4 w-4 accent-brand" />
            <div className="min-w-48 flex-1">
              <Link href={`/leads/${l.id}`} target="_blank" className="font-medium text-fg hover:underline">
                {l.company_name ?? "Ukjent firma"}
              </Link>
              <p className="text-xs text-subtle">{[l.contact_name, l.job_title].filter(Boolean).join(" · ") || "–"}</p>
            </div>
            <span className="w-28 text-[13px] text-fg-2">{l.phone ? formatPhoneParts(l.phone).number : "–"}</span>
            <span className="w-52 truncate text-[13px] text-fg-2">{l.email ?? "–"}</span>
            <Badge variant={LEAD_STATUS_VARIANT[l.status as LeadStatus]}>{LEAD_STATUS_LABELS[l.status as LeadStatus]}</Badge>
            <span className="w-24 text-xs text-subtle">{l.assigned_to ? sellerNames[l.assigned_to] ?? "Selger" : "Ikke tildelt"}</span>
            <span className="w-28 text-right text-xs text-subtle">
              {l.source} · {relativeAge(l.created_at, now)}
            </span>
            {keeper === l.id && <span className="text-xs font-medium text-brand">Beholdes</span>}
          </label>
        ))}
      </div>
      {error && <p className="px-4 pb-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
