import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MiniBars } from "@/components/charts/mini-bars";
import { PixelProgress } from "@/components/charts/pixel-progress";
import { InfoPopover } from "@/components/ui/info-popover";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "green" | "orange" | "purple";

const TONES: Record<StatTone, { badge: string; bar: string }> = {
  blue: { badge: "bg-himmel-300 text-ink", bar: "bg-himmel-500" },
  green: { badge: "bg-forest-400 text-ink", bar: "bg-forest-500" },
  orange: { badge: "bg-gold-400 text-ink", bar: "bg-gold-500" },
  purple: { badge: "bg-purple-300 text-ink", bar: "bg-purple-500" },
};

export function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  tone,
  chartValues,
  ring,
  info,
}: {
  label: string;
  value: string | number;
  trend: number;
  icon: LucideIcon;
  tone: StatTone;
  chartValues?: number[];
  ring?: number;
  /** Explanation shown when the icon badge is clicked. */
  info: React.ReactNode;
}) {
  const positive = trend >= 0;
  const colors = TONES[tone];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-pixel text-[10px] uppercase leading-relaxed tracking-wide text-wood-800">
            {label}
          </p>
          <InfoPopover
            title={label}
            triggerLabel={`Vis forklaring for ${label}`}
            trigger={
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-sm border-2 border-ink shadow-[2px_2px_0_0_var(--color-ink)]",
                  colors.badge
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            }
          >
            {info}
          </InfoPopover>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-2xl font-bold text-ink">{value}</p>
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-xs font-medium",
                  positive ? "text-forest-600" : "text-red-600"
                )}
              >
                {positive ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                )}
                {/* A near-zero baseline produces meaningless four-digit percentages */}
                {Math.abs(trend) > 999 ? "999+" : Math.abs(trend)}% siste uke
              </p>
            </div>
            {chartValues && ring == null ? <MiniBars values={chartValues} color={colors.bar} /> : null}
          </div>
          {ring != null && <PixelProgress percent={ring} barClass={colors.bar} />}
        </div>
      </CardContent>
    </Card>
  );
}
