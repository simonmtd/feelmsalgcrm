"use client";

import { useState, useTransition } from "react";
import { updateDailyLeadCount } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DailyLeadCountForm({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(initialValue.toString());
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="daily_lead_count">Antall leads per selger per dag</Label>
      <div className="flex items-center gap-2">
        <Input
          id="daily_lead_count"
          type="number"
          min={1}
          className="w-32"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || !value}
          onClick={() =>
            startTransition(async () => {
              await updateDailyLeadCount(Number(value));
              setSaved(true);
            })
          }
        >
          Lagre
        </Button>
        {saved && <span className="text-sm text-green-600">Lagret</span>}
      </div>
    </div>
  );
}
