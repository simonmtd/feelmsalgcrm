import Link from "next/link";
import { List, Map, Columns3 } from "lucide-react";
import { segmented } from "@/components/ui/segmented";

/**
 * Liste/Tavle/Kart switch. Renders as links so the current filters (which live in
 * the query string) are preserved when switching view.
 */
export type LeadView = "list" | "board" | "map";

export function ViewToggle({
  basePath,
  params,
  active,
  withBoard = false,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  active: LeadView;
  /** Offer the kanban board (only where it makes sense, e.g. a seller's own leads). */
  withBoard?: boolean;
}) {
  function hrefFor(view: LeadView) {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) q.set(key, value);
    }
    if (view !== "list") q.set("view", view);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const options = [
    { view: "list" as const, label: "Liste", icon: List },
    ...(withBoard ? [{ view: "board" as const, label: "Tavle", icon: Columns3 }] : []),
    { view: "map" as const, label: "Kart", icon: Map },
  ];

  return (
    <div className={segmented.root}>
      {options.map(({ view, label, icon: Icon }) => (
        <Link
          key={view}
          href={hrefFor(view)}
          className={segmented.item(view === active)}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </div>
  );
}
