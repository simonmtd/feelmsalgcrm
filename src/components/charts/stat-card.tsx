import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MiniBars } from "@/components/charts/mini-bars";
import { PixelProgress } from "@/components/charts/pixel-progress";
import { InfoPopover } from "@/components/ui/info-popover";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "green" | "orange" | "purple";

const TONES: Record<StatTone, { icon: string; bar: string }> = {
  blue: { icon: "text-info", bar: "bg-info" },
  green: { icon: "text-success", bar: "bg-success" },
  orange: { icon: "text-brand", bar: "bg-brand" },
  purple: { icon: "text-violet", bar: "bg-violet" },
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
    <Card className="relative overflow-hidden">
      <CardContent className="flex h-full flex-col gap-5 pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <Icon className={cn("h-4 w-4", colors.icon)} />
            {label}
          </p>
          <InfoPopover
            title={label}
            triggerLabel={`Vis forklaring for ${label}`}
            trigger={
              <span className="flex h-6 w-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg">
                <Info className="h-3.5 w-3.5" />
              </span>
            }
          >
            {info}
          </InfoPopover>
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="display text-[44px] text-fg">{value}</p>
              <p
                className={cn(
                  "mt-2 flex items-center gap-1 text-xs font-medium",
                  trend === 0 ? "text-subtle" : positive ? "text-success" : "text-danger"
                )}
              >
                {positive ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                )}
                {/* A near-zero baseline produces meaningless four-digit percentages */}
                {Math.abs(trend) > 999 ? "999+" : Math.abs(trend)}%
                <span className="font-normal text-subtle">siste uke</span>
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
