"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { enrichLeadsBatch } from "@/lib/actions/admin";
import { ENRICH_BATCH_MAX, ENRICH_PHONE_CREDITS } from "@/lib/enrichment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function EnrichBatchPanel({
  missingAll,
  missingAssigned,
}: {
  missingAll: number;
  missingAssigned: number;
}) {
  const [scope, setScope] = useState<"assigned" | "all">("assigned");
  const [limit, setLimit] = useState(10);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const available = scope === "assigned" ? missingAssigned : missingAll;
  const willProcess = Math.min(limit, available, ENRICH_BATCH_MAX);
  const estCredits = willProcess * ENRICH_PHONE_CREDITS;

  function run() {
    setConfirming(false);
    setResult(null);
    startTransition(async () => {
      const res = await enrichLeadsBatch({ scope, limit: willProcess });
      setResult(res.message);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Berik manglende telefon (Apollo)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-wood-700">
          Henter telefon/e-post fra Apollo for leads som mangler telefon. Fyller kun
          tomme felter. Telefon koster ~{ENRICH_PHONE_CREDITS} credits per lead.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enrich-scope">Omfang</Label>
            <Select
              id="enrich-scope"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as "assigned" | "all");
                setConfirming(false);
              }}
              className="w-56"
            >
              <option value="assigned">
                Kun tildelte leads ({missingAssigned})
              </option>
              <option value="all">Alle uten telefon ({missingAll})</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enrich-limit">Antall (maks {ENRICH_BATCH_MAX})</Label>
            <Input
              id="enrich-limit"
              type="number"
              min={1}
              max={ENRICH_BATCH_MAX}
              value={limit}
              onChange={(e) => {
                setLimit(Math.max(1, Math.min(ENRICH_BATCH_MAX, Number(e.target.value) || 1)));
                setConfirming(false);
              }}
              className="w-28"
            />
          </div>

          {!confirming ? (
            <Button
              type="button"
              disabled={isPending || willProcess === 0}
              onClick={() => setConfirming(true)}
            >
              {isPending ? "Beriker…" : `Berik ${willProcess} leads`}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">
                Berik {willProcess} leads (~{estCredits} credits)?
              </span>
              <Button type="button" size="sm" disabled={isPending} onClick={run}>
                Bekreft
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => setConfirming(false)}
              >
                Avbryt
              </Button>
            </div>
          )}
        </div>

        {willProcess === 0 && (
          <p className="text-xs text-wood-600">
            Ingen leads uten telefon i valgt omfang.
          </p>
        )}
        {result && <p className="text-sm text-forest-700">{result}</p>}
      </CardContent>
    </Card>
  );
}
