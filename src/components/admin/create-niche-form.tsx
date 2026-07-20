"use client";

import { useActionState } from "react";
import { createNiche, type FormActionState } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormActionState = {};

export function CreateNicheForm() {
  const [state, action, pending] = useActionState(createNiche, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Navn på niche</Label>
        <Input id="name" name="name" placeholder="F.eks. Tannleger" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Oppretter…" : "Opprett niche"}
      </Button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
