"use client";

import { useState, useTransition } from "react";
import { resetSellerPassword } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordButton({ sellerId }: { sellerId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await resetSellerPassword(sellerId, password);
      setMessage(result.error ?? result.success ?? null);
      if (result.success) setPassword("");
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Nytt passord
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nytt passord (min 8)"
          className="w-44"
          minLength={8}
        />
        <Button type="button" size="sm" disabled={isPending || password.length < 8} onClick={submit}>
          {isPending ? "…" : "Sett"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setMessage(null); }}>
          Avbryt
        </Button>
      </div>
      {message && <p className="text-xs text-wood-700">{message}</p>}
    </div>
  );
}
