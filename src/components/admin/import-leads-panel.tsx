"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileUp } from "lucide-react";
import { importApolloLeads, type ImportLeadRow } from "@/lib/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Minimal RFC4180 CSV parser — handles quoted fields, escaped "" and CRLF. */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, ""); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Apollo export can hold several phone columns.
const PHONE_KEYS = [
  "mobile phone",
  "corporate phone",
  "work direct phone",
  "other phone",
  "home phone",
  "company phone",
  "phone",
];

/** Among a person's phone columns, prefer a Norwegian number (a foreign mobile
 *  shouldn't win over a +47 corporate line); the server drops it either way. */
function pickPhone(values: string[]): string {
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
  const norsk = nonEmpty.find((v) => {
    const c = v.replace(/[^\d+]/g, "");
    if (c.startsWith("+")) return c.startsWith("+47");
    if (c.startsWith("0047")) return true;
    if (c.startsWith("00")) return false;
    return c.replace(/\D/g, "").length === 8;
  });
  return norsk ?? nonEmpty[0] ?? "";
}

function mapRows(table: string[][]): { rows: ImportLeadRow[]; recognized: boolean } {
  if (table.length < 2) return { rows: [], recognized: false };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const gi = (name: string) => header.indexOf(name);
  const recognized = header.includes("company") || header.includes("email") || header.includes("first name");

  const iFirst = gi("first name");
  const iLast = gi("last name");
  const iName = gi("name");
  const iCompany = gi("company");
  const iEmail = gi("email");
  const iTitle = gi("title");
  const iWebsite = gi("website");
  const iIndustry = gi("industry");
  const iApollo = gi("apollo contact id");
  const phoneIdxs = PHONE_KEYS.map(gi).filter((i) => i >= 0);

  const rows = table
    .slice(1)
    .filter((r) => r.some((c) => (c ?? "").trim()))
    .map((r) => {
      const g = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
      const contact = [g(iFirst), g(iLast)].filter(Boolean).join(" ") || g(iName);
      const phone = pickPhone(phoneIdxs.map((pi) => r[pi] ?? ""));
      return {
        company_name: g(iCompany),
        contact_name: contact,
        email: g(iEmail),
        phone,
        website: g(iWebsite),
        industry: g(iIndustry),
        job_title: g(iTitle),
        apollo_person_id: g(iApollo),
      } satisfies ImportLeadRow;
    })
    .filter((row) => row.company_name || row.contact_name);

  return { rows, recognized };
}

/** Admin: import an Apollo.io CSV export straight into the lead pool. */
export function ImportLeadsPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportLeadRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(null);
    setError(null);
    setRows([]);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const { rows: parsed, recognized } = mapRows(parseCsv(text));
      if (!recognized) {
        setError("Fant ikke forventede kolonner (Company, Email, First Name …). Er dette en Apollo-CSV?");
        return;
      }
      if (parsed.length === 0) {
        setError("Fant ingen leads i filen.");
        return;
      }
      setRows(parsed);
    } catch {
      setError("Kunne ikke lese filen. Er den en gyldig CSV?");
    }
  }

  function doImport() {
    startTransition(async () => {
      const res = await importApolloLeads(rows);
      setMsg(res.message);
      if (res.ok) {
        setRows([]);
        setFileName(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-4 w-4" /> Importer leads fra fil (Apollo CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-wood-700">
          Eksporter en liste fra Apollo.io som CSV og last den opp her. Leadsene kommer inn
          ferdig utfylt med telefon, e-post, firma og tittel — helt gratis (ingen credits).
          De havner i pool-en så du kan fordele dem og sette nisje som vanlig. Duplikater og
          utenlandske telefonnumre filtreres automatisk bort.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="hidden"
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Velg CSV-fil
          </Button>
          {fileName && <span className="text-sm text-wood-800">{fileName}</span>}
          {rows.length > 0 && (
            <Button type="button" disabled={isPending} onClick={doImport}>
              {isPending ? "Importerer…" : `Importer ${rows.length} leads`}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-forest-700">{msg}</p>}
      </CardContent>
    </Card>
  );
}
