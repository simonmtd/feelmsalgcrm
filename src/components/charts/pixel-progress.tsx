import { cn } from "@/lib/utils";

/** Chunky XP-style progress bar with an ink outline, like the status bar in the pixel-art reference. */
export function PixelProgress({
  percent,
  className,
  barClass = "bg-gold-500",
}: {
  percent: number;
  className?: string;
  barClass?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={cn(
        "h-4 w-full overflow-hidden rounded-sm border-2 border-ink bg-wood-900",
        className
      )}
    >
      <div
        className={cn("h-full border-r-2 border-ink/40", clamped === 0 && "border-r-0", barClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
