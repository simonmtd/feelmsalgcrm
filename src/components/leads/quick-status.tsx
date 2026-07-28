"use client";

import { useTransition } from "react";
import { updateLeadStatus } from "@/lib/actions/leads";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types";

// The stages a seller moves a lead through during the day, in order.
const QUICK_STEPS: LeadStatus[] = ["contacted", "follow_up", "won", "lost"];

const STEP_STYLE: Record<LeadStatus, string> = {
  new: "",
  assigned: "",
  contacted: "hover:bg-gold-400",
  follow_up: "hover:bg-himmel-300",
  won: "hover:bg-forest-400",
  lost: "hover:bg-red-400",
};

/** Inline status buttons so a seller can advance a lead without opening it. */
export function QuickStatus({
  leadId,
  current,
}: {
  leadId: string;
  current: LeadStatus;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_STEPS.map((step) => {
        const active = current === step;
        return (
          <button
            key={step}
            type="button"
            disabled={isPending || active}
            aria-pressed={active}
            onClick={() => startTransition(() => updateLeadStatus(leadId, step))}
            className={cn(
              "rounded-sm border-2 border-ink px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-default",
              active
                ? "bg-ink text-parchment"
                : cn("bg-parchment text-ink", STEP_STYLE[step]),
              isPending && !active && "opacity-50"
            )}
          >
            {LEAD_STATUS_LABELS[step]}
          </button>
        );
      })}
    </div>
  );
}
