import { cn } from "@/lib/utils";

export function MiniBars({
  values,
  color = "bg-gold-500",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-10 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("w-2 rounded-none border border-ink/60", color)}
          style={{ height: `${v > 0 ? Math.max(15, (v / max) * 100) : 8}%` }}
        />
      ))}
    </div>
  );
}
