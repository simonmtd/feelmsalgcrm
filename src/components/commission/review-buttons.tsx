"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { reviewCommission } from "@/lib/actions/commission";
import { cn } from "@/lib/utils";
import type { CommissionStatus } from "@/lib/types";

/** Admin: Ja / Nei on a commission claim. The active choice is highlighted; clicking the other one changes it. */
export function ReviewButtons({ meetingId, status }: { meetingId: string; status: CommissionStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function review(approve: boolean) {
    startTransition(async () => {
      const res = await reviewCommission(meetingId, approve);
      setError(res.ok ? null : res.error ?? "Noe gikk galt.");
    });
  }

  const base =
    "inline-flex items-center gap-1 rounded-sm border-2 border-ink px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0_0_var(--color-ink)] transition-colors disabled:opacity-50";
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => review(true)}
          className={cn(base, status === "approved" ? "bg-forest-500 text-parchment" : "bg-wood-100 text-wood-900 hover:bg-forest-400")}
        >
          <Check className="h-3.5 w-3.5" /> Ja
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => review(false)}
          className={cn(base, status === "rejected" ? "bg-red-400 text-ink" : "bg-wood-100 text-wood-900 hover:bg-red-400")}
        >
          <X className="h-3.5 w-3.5" /> Nei
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
