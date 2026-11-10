"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createApiKey, revokeApiKey, setSellerHandle, type ApiKeyRow } from "@/lib/actions/api-keys";
import { relativeAge } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type Seller = Pick<Profile, "id" | "full_name" | "email"> & { handle: string | null };

function HandleRow({ seller }: { seller: Seller }) {
  const [value, setValue] = useState(seller.handle ?? "");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 truncate text-sm text-fg-2">{seller.full_name ?? seller.email}</span>
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="f.eks. simon" className="h-8 w-36" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending || value === (seller.handle ?? "")}
        onClick={() =>
          startTransition(async () => {
            const r = await setSellerHandle(seller.id, value);
            setMsg(r.error ? { text: r.error, error: true } : { text: "Lagret" });
          })
        }
      >
        Lagre
      </Button>
      {msg && <span className={msg.error ? "text-xs text-danger" : "text-xs text-success"}>{msg.text}</span>}
    </div>
  );
}

/** Admin: create/revoke lead-API keys (one per seller's bot) and set seller handles. */
export function ApiKeysCard({ keys, sellers }: { keys: ApiKeyRow[]; sellers: Seller[] }) {
  const [name, setName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());
  const sellerName = (id: string | null) => {
    const s = sellers.find((x) => x.id === id);
    return s ? s.full_name ?? s.email : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <KeyRound className="h-4 w-4" /> API-nøkler (Grok-boter)
        </CardTitle>
        <CardDescription>
          Brukes av boter som sender leads til <code className="text-fg-2">/api/leads</code>. En nøkkel knyttet til en selger
          tildeler alle leads til den selgeren; en admin-nøkkel krever <code className="text-fg-2">assigned_to</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn, f.eks. grok-simon" className="w-56" aria-label="Navn på nøkkel" />
          <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)} className="w-auto" aria-label="Selger">
            <option value="">Admin-nøkkel (alle selgere)</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? s.email}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            disabled={isPending || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await createApiKey(name, sellerId || null);
                if (r.error) setError(r.error);
                else {
                  setNewKey(r.key!);
                  setCopied(false);
                  setName("");
                }
              })
            }
          >
            Lag nøkkel
          </Button>
        </div>
        {error && <p className="-mt-3 text-sm text-danger">{error}</p>}

        {newKey && (
          <div className="flex flex-col gap-2 rounded-xl border border-brand/40 bg-brand-soft p-4">
            <p className="text-sm font-medium text-fg">Kopier nøkkelen nå – den vises bare denne ene gangen.</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-bg px-3 py-2 font-mono text-xs text-fg">{newKey}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(newKey);
                    setCopied(true);
                  } catch {
                    // clipboard blocked – select the text manually
                  }
                }}
              >
                {copied ? <Check /> : <Copy />} {copied ? "Kopiert" : "Kopier"}
              </Button>
            </div>
            <p className="text-xs text-muted">Boten sender den som <code>Authorization: Bearer &lt;nøkkel&gt;</code>.</p>
          </div>
        )}

        {keys.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wider text-subtle">
                  <th className="py-2 pr-4">Navn</th>
                  <th className="py-2 pr-4">Selger</th>
                  <th className="py-2 pr-4">Laget</th>
                  <th className="py-2 pr-4">Sist brukt</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-fg">{k.name}</td>
                    <td className="py-2.5 pr-4 text-fg-2">{sellerName(k.seller_id) ?? <Badge>Admin</Badge>}</td>
                    <td className="py-2.5 pr-4 text-muted">{relativeAge(k.created_at, now)}</td>
                    <td className="py-2.5 pr-4 text-muted">{k.last_used_at ? relativeAge(k.last_used_at, now) : "Aldri"}</td>
                    <td className="py-2.5 text-right">
                      {k.revoked_at ? (
                        <Badge variant="red">Trukket tilbake</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => startTransition(async () => void (await revokeApiKey(k.id)))}
                          className="text-danger hover:bg-danger-soft hover:text-danger"
                        >
                          Trekk tilbake
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-5">
          <p className="text-sm font-medium text-fg">Selgernavn i API-et</p>
          <p className="text-xs text-muted">
            Det boten skriver i <code>assigned_to</code>, f.eks. «simon». Uten navn brukes fornavnet automatisk.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            {sellers.map((s) => (
              <HandleRow key={s.id} seller={s} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
