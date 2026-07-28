"use client";

import { useActionState } from "react";
import { changeOwnPassword, type PasswordActionState } from "@/lib/actions/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PasswordActionState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, initialState);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Bytt passord</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Nytt passord</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Gjenta nytt passord</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state?.success && <p className="text-sm text-forest-700">{state.success}</p>}
          <Button type="submit" disabled={pending} className="mt-1 self-start">
            {pending ? "Lagrer…" : "Lagre nytt passord"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
