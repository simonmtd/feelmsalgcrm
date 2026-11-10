"use client";

import { useState, useTransition } from "react";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { claimCommission, withdrawCommission } from "@/lib/actions/commission";
import { COMMISSION_NOTE_MIN, COMMISSION_PER_MEETING } from "@/lib/commission";
import { COMMISSION_STATUS_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import type { Meeting } from "@/lib/types";

const STATUS_VARIANT = { pending: "amber", approved: "green", rejected: "red" } as const;

/** Commission status for a meeting, with "claim" (note required) / "withdraw" for its seller. */
export function CommissionCell({ meeting, canEdit }: { meeting: Meeting; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(meeting.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  if (meeting.type === "internal") return <span className="text-sm text-subtle">–</span>;

  if (meeting.commission_claimed) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant={STATUS_VARIANT[meeting.commission_status]}>
          {COMMISSION_STATUS_LABELS[meeting.commission_status]} ·{" "}
          {formatCurrency(meeting.commission_amount)}
        </Badge>
        {canEdit && meeting.commission_status === "pending" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await withdrawCommission(meeting.id);
                setError(res.ok ? null : res.error ?? null);
              })
            }
            className="text-xs text-subtle underline hover:text-fg disabled:opacity-50"
          >
            Trekk tilbake
          </button>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  if (!canEdit) return <span className="text-sm text-subtle">–</span>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-fg-2 transition-colors hover:bg-surface-3"
      >
        <Coins className="h-3.5 w-3.5" /> Krev {formatCurrency(COMMISSION_PER_MEETING)}
      </button>
    );
  }

  return (
    <div className="flex w-64 flex-col gap-1.5">
      <Textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notat: hvem møtte du, hva ble sagt, neste steg …"
        className="min-h-20 text-xs"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending || note.trim().length < COMMISSION_NOTE_MIN}
          onClick={() =>
            startTransition(async () => {
              const res = await claimCommission(meeting.id, note);
              if (res.ok) setOpen(false);
              setError(res.ok ? null : res.error ?? null);
            })
          }
          className="rounded-md border border-line bg-success-soft px-2 py-1 text-xs font-bold text-fg disabled:opacity-50"
        >
          Send til godkjenning
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-1 text-xs text-subtle hover:text-fg">
          Avbryt
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
