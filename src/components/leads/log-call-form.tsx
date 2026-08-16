"use client";

import { useEffect, useRef, useActionState } from "react";
import { Phone } from "lucide-react";
import { logManualCall, type CallFormState } from "@/lib/actions/leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CALL_OUTCOME_LABELS } from "@/lib/types";

const initial: CallFormState = {};

/** Logs a cold call to a company that isn't in the lead list. */
export function LogCallForm() {
  const [state, formAction, isPending] = useActionState(logManualCall, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4" /> Logg samtale (utenfor lista)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="call-company">Bedrift</Label>
            <Input id="call-company" name="company" placeholder="Firmanavn" className="w-48" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="call-phone">Telefon</Label>
            <Input id="call-phone" name="phone" placeholder="+47 …" className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="call-outcome">Utfall</Label>
            <Select id="call-outcome" name="outcome" defaultValue="" className="w-44">
              <option value="">–</option>
              {Object.entries(CALL_OUTCOME_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Lagrer…" : "Registrer samtale"}
          </Button>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.success && <p className="text-sm text-forest-700">{state.success}</p>}
        </form>
        <p className="mt-2 text-xs text-wood-700">
          Ringte du noen fra lista? Bruk «Ring &amp; registrer utfall» på selve leaden — de
          telles automatisk.
        </p>
      </CardContent>
    </Card>
  );
}
