import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A key number: small label, big Anton value, optional hint. */
export function Stat({
  label,
  value,
  hint,
  accent = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Brand-pink value, for the one number that matters most on a page. */
  accent?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-4 pt-5">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <div>
          <p className={cn("display text-[40px]", accent ? "text-brand" : "text-fg")}>{value}</p>
          {hint && <p className="mt-2 text-xs text-subtle">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
