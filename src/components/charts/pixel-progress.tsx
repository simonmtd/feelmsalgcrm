import { cn } from "@/lib/utils";

/** Slim progress bar. (Name kept from the old pixel theme so callers don't change.) */
export function PixelProgress({
  percent,
  className,
  barClass = "bg-brand",
}: {
  percent: number;
  className?: string;
  barClass?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full transition-[width]", barClass)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
