/** Cross-source lead de-duplication helpers. */

/** Normalize an email for equality checks (lowercase, trimmed). */
export function normEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e || null;
}

/**
 * A company+role signature used to spot the same person arriving from two
 * sources when no email is available yet (Apollo search masks it). Not perfect
 * across languages, but reliably catches "same role at the same company".
 */
export function companyTitleKey(
  company: string | null | undefined,
  title: string | null | undefined
): string | null {
  const c = norm(company);
  const t = norm(title);
  if (!c || !t) return null;
  return `${c}|${t}`;
}

/** Normalize a company name for grouping (so "Møller Bil" collapses regardless
 *  of casing/accents/punctuation). Returns null for blanks. */
export function normCompany(company: string | null | undefined): string | null {
  return norm(company) || null;
}

/** Same person at the same company — the strongest name-based match (catches a
 *  re-import even when the job title differs between sources). */
export function companyContactKey(
  company: string | null | undefined,
  contact: string | null | undefined
): string | null {
  const c = norm(company);
  const n = norm(contact);
  if (!c || !n) return null;
  return `${c}|${n}`;
}

/**
 * A Norwegian MOBILE number (8 digits starting with 4 or 9), used as a dedup
 * key. We only key on mobiles — shared corporate switchboard numbers (starting
 * 2/3/5/6/7) would otherwise falsely merge different people at one company.
 */
export function mobileKey(phone: string | null | undefined): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0047")) d = d.slice(4);
  else if (d.startsWith("47") && d.length === 10) d = d.slice(2);
  return d.length === 8 && /^[49]/.test(d) ? d : null;
}

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
