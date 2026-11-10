import { cn } from "@/lib/utils";

/** Tiny 7-day sparkline bars; today's bar is highlighted. */
export function MiniBars({
  values,
  color = "bg-brand",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-10 items-end gap-[3px]">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("w-[5px] rounded-full", i === values.length - 1 ? color : "bg-surface-3")}
          style={{ height: `${v > 0 ? Math.max(15, (v / max) * 100) : 10}%` }}
        />
      ))}
    </div>
  );
}
