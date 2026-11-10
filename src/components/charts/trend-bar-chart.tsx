"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { segmented } from "@/components/ui/segmented";

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
        <div className={segmented.root}>
          {datasets.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setActive(d.key)}
              className={segmented.item(d.key === active)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted">
            Ingen leads registrert i denne perioden.
          </div>
        ) : (
          <div className="flex h-56 items-end gap-2 overflow-x-auto pt-6 sm:gap-3">
            {current.points.map((p, i) => {
              const pct = p.value > 0 ? Math.max(4, (p.value / max) * 100) : 0;
              return (
                <div key={`${p.label}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                  <div className="group relative flex h-40 w-full max-w-9 items-end">
                    {pct > 0 ? (
                      <div
                        className="w-full rounded-t-md bg-brand/80 transition-colors group-hover:bg-brand"
                        style={{ height: `${pct}%` }}
                      >
                        <span className="block -translate-y-5 text-center text-[11px] font-medium text-fg-2">
                          {p.value}
                        </span>
                      </div>
                    ) : (
                      <div className="h-[3px] w-full rounded-full bg-surface-3" />
                    )}
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-muted">{p.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
