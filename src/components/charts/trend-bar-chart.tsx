"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BarPoint {
  label: string;
  value: number;
}

export interface BarDataset {
  key: string;
  label: string;
  points: BarPoint[];
}

export function TrendBarChart({ title, datasets }: { title: string; datasets: BarDataset[] }) {
  const [active, setActive] = useState(datasets[0]?.key);
  const current = datasets.find((d) => d.key === active) ?? datasets[0];
  const total = current.points.reduce((sum, p) => sum + p.value, 0);
  const max = Math.max(1, ...current.points.map((p) => p.value));

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-1 rounded-sm border-2 border-ink bg-wood-800 p-1">
          {datasets.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setActive(d.key)}
              className={cn(
                "rounded-[2px] px-2 py-1 font-pixel text-[10px] uppercase transition-colors",
                d.key === active
                  ? "border border-ink bg-gold-500 text-ink"
                  : "text-wood-200 hover:text-gold-100"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-wood-700">
            Ingen leads registrert i denne perioden.
          </div>
        ) : (
          <div className="flex h-48 items-end gap-2 overflow-x-auto sm:gap-3">
            {current.points.map((p, i) => {
              const pct = p.value > 0 ? Math.max(4, (p.value / max) * 100) : 0;
              return (
                <div key={`${p.label}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                  <div className="relative h-40 w-full max-w-8 overflow-hidden rounded-sm border border-ink/30 bg-wood-100">
                    {pct > 0 && (
                      <div
                        className="absolute bottom-0 left-0 w-full border-t-2 border-ink bg-gradient-to-t from-forest-600 to-forest-400"
                        style={{ height: `${pct}%` }}
                      />
                    )}
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-wood-700">{p.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
