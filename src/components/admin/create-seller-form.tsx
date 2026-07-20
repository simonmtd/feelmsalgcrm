"use client";

import { useActionState } from "react";
import { createSeller, type FormActionState } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const initialState: FormActionState = {};

export function CreateSellerForm() {
  const [state, action, pending] = useActionState(createSeller, initialState);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">Navn</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-post</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Midlertidig passord</Label>
        <Input id="password" name="password" type="text" minLength={8} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role">Rolle</Label>
        <Select id="role" name="role" defaultValue="seller">
          <option value="seller">Selger</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      <div className="flex items-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Oppretter…" : "Opprett bruker"}
        </Button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="text-sm text-green-600">{state.success}</p>}
      </div>
    </form>
  );
}
