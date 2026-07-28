import Link from "next/link";
import { List, Map } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex gap-1 rounded-sm border-2 border-ink bg-wood-800 p-1">
      {options.map(({ view, label, icon: Icon }) => (
        <Link
          key={view}
          href={hrefFor(view)}
          className={cn(
            "flex items-center gap-1.5 rounded-[2px] px-2 py-1 font-pixel text-[10px] uppercase transition-colors",
            view === active
              ? "border border-ink bg-gold-500 text-ink"
              : "text-wood-200 hover:text-gold-100"
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </Link>
      ))}
    </div>
  );
}
