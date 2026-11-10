"use client";

import { useTransition } from "react";
import { updateLeadStatus } from "@/lib/actions/leads";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types";

// The stages a seller moves a lead through during the day, in order.
const QUICK_STEPS: LeadStatus[] = ["contacted", "follow_up", "won", "lost"];

// Active = the status colour; idle buttons hint at it on hover.
const STEP_STYLE: Record<LeadStatus, { active: string; hover: string }> = {
  new: { active: "", hover: "" },
  assigned: { active: "", hover: "" },
  contacted: { active: "bg-warning-soft text-warning border-transparent", hover: "hover:text-warning" },
  follow_up: { active: "bg-info-soft text-info border-transparent", hover: "hover:text-info" },
  won: { active: "bg-success-soft text-success border-transparent", hover: "hover:text-success" },
  lost: { active: "bg-danger-soft text-danger border-transparent", hover: "hover:text-danger" },
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
              "rounded-full border border-line px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default",
              active
                ? STEP_STYLE[step].active
                : cn("text-muted hover:border-line-strong", STEP_STYLE[step].hover),
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
