"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { fetchApolloLeads } from "@/lib/actions/admin";
import {
  TITLE_GROUPS,
  EMPLOYEE_RANGES,
  NORWAY_AREAS,
} from "@/lib/prospecting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Admin control: pull fresh prospects from Apollo, filtered by titles, bransje,
 * area in Norway and company size. Only Norwegian companies (Brønnøysund-checked)
 * are imported. Import spends no reveal credits.
 */
export function FetchApolloPanel({
  niches,
}: {
  niches: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [titleKeys, setTitleKeys] = useState<string[]>([]);
  const [nicheId, setNicheId] = useState("");
  const [area, setArea] = useState("");
  const [employeeRange, setEmployeeRange] = useState("");
  const [count, setCount] = useState(25);
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleTitle(key: string) {
    setTitleKeys((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-4 w-4" /> Hent nye leads (Apollo)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-wood-700">
          Henter ferske norske prospekter fra Apollo (Brønnøysund-sjekket). Velg
          hvem du vil ha inn. Selve importen er gratis. Med «Berik automatisk» på
          låses kontaktinfo opp med én gang (~8 credits per lead, maks 25 beriket
          per henting).
        </p>

        {/* Titler */}
        <div className="flex flex-col gap-1.5">
          <Label>Titler {titleKeys.length === 0 && "(alle)"}</Label>
          <div className="flex flex-wrap gap-2">
            {TITLE_GROUPS.map((g) => {
              const active = titleKeys.includes(g.key);
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => toggleTitle(g.key)}
                  className={`rounded-sm border-2 border-ink px-2.5 py-1 text-xs shadow-[2px_2px_0_0_var(--color-ink)] transition-colors ${
                    active ? "bg-gold-400 text-ink" : "bg-wood-100 text-wood-800 hover:bg-gold-200"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prospect-niche">Bransje</Label>
            <Select
              id="prospect-niche"
              value={nicheId}
              onChange={(e) => setNicheId(e.target.value)}
              className="w-44"
            >
              <option value="">Alle bransjer</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prospect-area">Område</Label>
            <Select
              id="prospect-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-40"
            >
              {NORWAY_AREAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prospect-size">Antall ansatte</Label>
            <Select
              id="prospect-size"
              value={employeeRange}
              onChange={(e) => setEmployeeRange(e.target.value)}
              className="w-44"
            >
              <option value="">Alle størrelser</option>
              {EMPLOYEE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prospect-count">Antall leads (maks 100)</Label>
            <Input
              id="prospect-count"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
              }
              className="w-28"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prospect-autoenrich">Berikelse</Label>
            <label
              htmlFor="prospect-autoenrich"
              className="flex h-9 items-center gap-2 text-sm text-wood-800"
            >
              <input
                id="prospect-autoenrich"
                type="checkbox"
                checked={autoEnrich}
                onChange={(e) => setAutoEnrich(e.target.checked)}
                className="h-4 w-4 accent-gold-500"
              />
              Berik automatisk
            </label>
          </div>

          <Button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setMsg(null);
                const res = await fetchApolloLeads({
                  count,
                  nicheId: nicheId || null,
                  titleKeys,
                  employeeRange: employeeRange || null,
                  area: area || null,
                  autoEnrich,
                });
                setMsg(res.message);
              })
            }
          >
            {isPending
              ? autoEnrich
                ? "Henter & beriker…"
                : "Henter…"
              : `Hent ${count} leads`}
          </Button>
        </div>

        {msg && <p className="text-sm text-forest-700">{msg}</p>}
      </CardContent>
    </Card>
  );
}
