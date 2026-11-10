"use client";

import { useState } from "react";
import { Download, FileUp, Sparkles } from "lucide-react";
import { segmented } from "@/components/ui/segmented";

type ToolKey = "apollo" | "csv" | "enrich";

const TOOLS: { key: ToolKey; label: string; icon: typeof Download }[] = [
  { key: "apollo", label: "Hent fra Apollo", icon: Download },
  { key: "csv", label: "Importer CSV", icon: FileUp },
  { key: "enrich", label: "Berik telefon", icon: Sparkles },
];

/**
 * The lead-intake tools behind one toggle row, so the lead table isn't pushed
 * below three stacked panels. Panels stay mounted (just hidden) so an
 * in-progress CSV pick or form survives switching tools.
 */
export function LeadTools({
  apollo,
  csv,
  enrich,
  actions,
}: {
  apollo: React.ReactNode;
  csv: React.ReactNode;
  enrich: React.ReactNode;
  /** Right-aligned controls (view toggle, distribute button). */
  actions: React.ReactNode;
}) {
  const [open, setOpen] = useState<ToolKey | null>(null);
  const panels: Record<ToolKey, React.ReactNode> = { apollo, csv, enrich };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={segmented.root}>
          {TOOLS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-expanded={open === key}
              onClick={() => setOpen((cur) => (cur === key ? null : key))}
              className={segmented.item(open === key)}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {TOOLS.map(({ key }) => (
        <div key={key} hidden={open !== key}>
          {panels[key]}
        </div>
      ))}
    </div>
  );
}
