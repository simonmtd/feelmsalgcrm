import Link from "next/link";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import { avatarToneFor, hashString } from "@/lib/avatar-color";
import type { Lead } from "@/lib/types";

const NICHE_VARIANTS: BadgeProps["variant"][] = ["blue", "green", "amber", "purple"];

function initialsFor(lead: Lead) {
  const source = lead.contact_name ?? lead.company_name ?? "?";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function RecentLeadRow({ lead }: { lead: Lead }) {
  const nicheVariant = lead.niche_id
    ? NICHE_VARIANTS[hashString(lead.niche_id) % NICHE_VARIANTS.length]
    : "default";

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/60 p-3 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          avatarToneFor(lead.id)
        )}
      >
        {initialsFor(lead)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">
          {lead.company_name ?? "Ukjent firma"}
        </p>
        <p className="truncate text-xs text-muted">{lead.contact_name ?? "–"}</p>
      </div>
      <div className="flex max-w-[45%] shrink-0 flex-col items-end gap-1.5">
        {lead.niche && (
          <Badge variant={nicheVariant} className="max-w-full truncate">
            {lead.niche.name}
          </Badge>
        )}
        <span className="whitespace-nowrap text-[11px] text-subtle">
          {formatDate(lead.assigned_date ?? lead.created_at)}
        </span>
      </div>
    </Link>
  );
}
