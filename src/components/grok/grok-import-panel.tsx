"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ClipboardPaste, Copy, Check } from "lucide-react";
import { importGrokLeads, type GrokImportResult } from "@/lib/actions/grok";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Step 1: the instructions to give Grok, with a copy button. */
export function GrokInstructionsCard({ instructions }: { instructions: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(instructions);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is selectable below.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4" /> 1. Instruksjoner til Grok
        </CardTitle>
        <CardDescription>
          Kopier dette inn som instruksjoner i et Grok-prosjekt (eller som første melding i en
          chat). Da svarer Grok med leads i et format CRM-et forstår.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button type="button" variant="outline" className="w-fit" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Kopiert!" : "Kopier instruksjoner"}
        </Button>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-sm border-2 border-ink/20 bg-white/70 p-3 font-mono text-xs text-wood-900">
          {instructions}
        </pre>
      </CardContent>
    </Card>
  );
}

/** Step 2: paste Grok's answer and import it. */
export function GrokPastePanel({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<GrokImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function doImport() {
    startTransition(async () => {
      const res = await importGrokLeads(text);
      setResult(res);
      if (res.ok && res.created.length) {
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4" /> 2. Lim inn svaret fra Grok
        </CardTitle>
        <CardDescription>
          Lim inn hele svaret. Duplikater, leads uten norsk telefon og selskaper teamet alt har
          ringt filtreres bort automatisk.{" "}
          {isAdmin
            ? "Leadsene tildeles selgeren i assigned_to."
            : "Leadsene havner direkte i «Mine leads»."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'```json\n{ "leads": [ … ] }\n```'}
          className="min-h-48 font-mono text-xs"
        />
        <Button type="button" className="w-fit" disabled={isPending || !text.trim()} onClick={doImport}>
          {isPending ? "Legger inn…" : "Legg inn leads"}
        </Button>

        {result && (
          <div className="flex flex-col gap-3 text-sm">
            <p className={result.ok ? "font-medium text-forest-700" : "text-red-600"}>{result.message}</p>

            {result.created.length > 0 && (
              <ul className="flex flex-col gap-1">
                {result.created.map((c) => (
                  <li key={c.id} className="text-wood-900">
                    ✅{" "}
                    <Link href={`/leads/${c.id}`} className="underline hover:text-forest-700">
                      {c.label}
                    </Link>{" "}
                    <span className="text-wood-700">→ {c.assignedTo}</span>
                    {c.warnings?.map((w) => (
                      <span key={w} className="block pl-5 text-xs text-wood-700">
                        {w}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            {result.rejected.length > 0 && (
              <ul className="flex flex-col gap-1">
                {result.rejected.map((r, i) => (
                  <li key={i} className="text-wood-800">
                    ❌ {r.label}: <span className="text-red-700">{r.message}</span>
                    {isAdmin && r.duplicateOf && (
                      <>
                        {" "}
                        (
                        <Link href={`/leads/${r.duplicateOf}`} className="underline">
                          se eksisterende
                        </Link>
                        )
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
