import "server-only";
import { DEMO_MOCK } from "@/lib/demo/mode";

const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api/enheter";

/** Organisasjonsformer that mean the entity is foreign, not a Norwegian company. */
const FOREIGN_FORMS = new Set(["NUF", "UTLA"]);

/** Legal-form tokens to strip when comparing a company name to a brreg name. */
const SUFFIXES = new Set([
  "as", "asa", "ans", "da", "ba", "sa", "ks", "enk", "nuf", "ab",
  "oyj", "plc", "gmbh", "ltd", "inc", "llc",
]);

export interface BrregMatch {
  orgNumber: string;
  name: string;
}

/** Lowercase, drop punctuation, and strip a trailing legal-form token. */
function normalize(name: string): string {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9æøå]+/i)
    .filter(Boolean);
  if (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

function nameMatches(apollo: string, brreg: string): boolean {
  const a = normalize(apollo);
  const b = normalize(brreg);
  if (a.length < 3) return false;
  return a === b || b.startsWith(a + " ") || a.startsWith(b + " ");
}

interface BrregEntity {
  organisasjonsnummer?: string;
  navn?: string;
  konkurs?: boolean;
  organisasjonsform?: { kode?: string };
  forretningsadresse?: { land?: string };
}

/**
 * Verifies a company name against the Brønnøysund entity registry and returns
 * the org number only if a name-matching entity exists that is a genuine
 * Norwegian company — registered in Norway and not a foreign form (NUF/UTLA) or
 * bankrupt. Returns null otherwise (so the caller can drop the lead). Fails
 * closed on any error. Free, no auth. Returns a fake match in demo mode.
 */
export async function verifyNorwegianCompany(
  name: string | null
): Promise<BrregMatch | null> {
  if (!name || name.trim().length < 2) return null;

  if (DEMO_MOCK) {
    const digits = Math.abs(
      [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)
    )
      .toString()
      .padStart(9, "0")
      .slice(0, 9);
    return { orgNumber: digits, name };
  }

  try {
    const res = await fetch(
      `${BRREG_BASE}?navn=${encodeURIComponent(name.trim())}&size=5`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { _embedded?: { enheter?: BrregEntity[] } };
    const enheter = data._embedded?.enheter ?? [];

    for (const e of enheter) {
      if (e.konkurs) continue;
      if (e.forretningsadresse?.land !== "Norge") continue;
      if (e.organisasjonsform?.kode && FOREIGN_FORMS.has(e.organisasjonsform.kode)) continue;
      if (!e.organisasjonsnummer) continue;
      if (!nameMatches(name, e.navn ?? "")) continue;
      return { orgNumber: e.organisasjonsnummer, name: e.navn ?? name };
    }
    return null;
  } catch (err) {
    console.error("[verifyNorwegianCompany]", err);
    return null;
  }
}
