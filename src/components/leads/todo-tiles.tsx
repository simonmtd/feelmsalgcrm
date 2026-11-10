import Link from "next/link";
import { ArrowRight, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TodoTile {
  key: string | null;
  label: string;
  hint: string;
  count: number;
  href: string;
  /** Red number when > 0 – something is late. */
  urgent?: boolean;
}

/**
 * The "Å gjøre" filters as big number tiles: you see where it's burning before
 * you click, and the last tile starts the call queue.
 */
export function TodoTiles({
  tiles,
  active,
  queueCount,
  ringHref,
  action,
}: {
  tiles: TodoTile[];
  active: string | null;
  /** With ringHref: the pink «Start ringing» tile at the end. */
  queueCount?: number;
  ringHref?: string;
  /** Any other last tile (used instead of the ring tile). */
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.label}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl border p-4 transition-colors",
              isActive ? "border-brand/50 bg-brand-soft" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
            )}
          >
            <p className={cn("text-[13px] font-medium", isActive ? "text-brand" : "text-muted group-hover:text-fg-2")}>
              {t.label}
            </p>
            <div>
              <p
                className={cn(
                  "display text-[44px]",
                  isActive ? "text-brand" : t.count === 0 ? "text-subtle" : t.urgent ? "text-danger" : "text-fg"
                )}
              >
                {t.count}
              </p>
              <p className="mt-1.5 text-xs text-subtle">{t.hint}</p>
            </div>
          </Link>
        );
      })}

      {action}
      {ringHref && (
      <Link
        href={ringHref}
        className={cn(
          "group relative col-span-2 flex flex-col justify-between gap-4 overflow-hidden rounded-xl bg-brand p-4 text-brand-fg transition-colors hover:bg-brand-hover sm:col-span-1",
          !queueCount && "opacity-60"
        )}
      >
        {/* Oversized ghost icon: a bit of Feelm swagger in the corner. */}
        <PhoneCall className="pointer-events-none absolute -bottom-6 -right-5 h-28 w-28 rotate-[-12deg] opacity-15" />
        <p className="flex items-center justify-between text-[13px] font-semibold">
          Start ringing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </p>
        <div className="relative">
          <p className="display text-[44px]">{queueCount ?? 0}</p>
          <p className="mt-1.5 text-xs font-medium opacity-70">i køen nå</p>
        </div>
      </Link>
      )}
    </div>
  );
}
