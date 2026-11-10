import type { LucideIcon } from "lucide-react";
import { InfoPopover } from "@/components/ui/info-popover";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerIcon: CenterIcon,
}: {
  segments: DonutSegment[];
  centerIcon?: LucideIcon;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const size = 176;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = segments.length > 1 ? 3 : 0;

  const arcs: { label: string; color: string; dash: number; offset: number }[] = [];
  let cumulative = 0;
  for (const s of segments) {
    const fraction = s.value / total;
    const rawDash = fraction * c;
    arcs.push({
      label: s.label,
      color: s.color,
      dash: Math.max(0, rawDash - gap),
      offset: -cumulative * c,
    });
    cumulative += fraction;
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-surface-3)" strokeWidth={stroke} fill="none" />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={arc.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${arc.dash} ${c - arc.dash}`}
              strokeLinecap="round"
              strokeDashoffset={arc.offset}
            />
          ))}
        </svg>
        {CenterIcon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <InfoPopover
              title="Fordeling"
              triggerLabel="Vis forklaring for statusfordelingen"
              align="left"
              trigger={
                <span className="flex flex-col items-center leading-none">
                  <span className="display text-5xl text-fg">{total}</span>
                  <span className="mt-1.5 flex items-center gap-1 text-xs text-muted">
                    <CenterIcon className="h-3 w-3" /> leads
                  </span>
                </span>
              }
            >
              <p>
                Andel av {total} {total === 1 ? "lead" : "leads"} per status. Statuser uten
                leads vises ikke.
              </p>
              <ul className="mt-1 space-y-0.5">
                {segments.map((s) => (
                  <li key={s.label} className="flex justify-between gap-3">
                    <span>{s.label}</span>
                    <span className="font-bold">{s.value}</span>
                  </li>
                ))}
              </ul>
            </InfoPopover>
          </div>
        )}
      </div>
      <ul className="flex w-full flex-col gap-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-fg-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
            <span className="font-medium text-fg">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
