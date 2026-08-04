"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { Plus, X } from "lucide-react";
import { createLead, type LeadFormState } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { Niche } from "@/lib/types";

const initialState: LeadFormState = {};

/** Lets a seller add a lead they found themselves, straight from the leads page. */
export function NewLeadForm({
  niches,
  defaultNicheId,
}: {
  niches: Pick<Niche, "id" | "name">[];
  defaultNicheId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createLead, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // On a successful create, blank the fields so the next lead starts clean.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Ny lead
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-pixel text-[11px] uppercase tracking-wide text-wood-800">
            Ny lead
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Lukk
          </Button>
        </div>
        <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="company_name">Firma *</Label>
            <Input
              id="company_name"
              name="company_name"
              required
              maxLength={200}
              placeholder="Firmanavn"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact_name">Kontaktperson</Label>
            <Input id="contact_name" name="contact_name" maxLength={200} placeholder="Navn" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="niche_id">Nisje</Label>
            <Select id="niche_id" name="niche_id" defaultValue={defaultNicheId ?? ""}>
              <option value="">Ingen</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              name="email"
              type="email"
              maxLength={200}
              placeholder="navn@firma.no"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" name="phone" type="tel" maxLength={50} placeholder="+47 …" />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Lagrer …" : "Legg til lead"}
            </Button>
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            {state.success && <p className="text-sm text-forest-700">{state.success}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
