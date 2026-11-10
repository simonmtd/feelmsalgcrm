import Link from "next/link";
import { List, Map } from "lucide-react";
import { segmented } from "@/components/ui/segmented";

/**
 * Liste/Kart switch. Renders as links so the current filters (which live in
 * the query string) are preserved when switching view.
 */
export function ViewToggle({
  basePath,
  params,
  active,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  active: "list" | "map";
}) {
  function hrefFor(view: "list" | "map") {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) q.set(key, value);
    }
    if (view === "map") q.set("view", "map");
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const options = [
    { view: "list" as const, label: "Liste", icon: List },
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
