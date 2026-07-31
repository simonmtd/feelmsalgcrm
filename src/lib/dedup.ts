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

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
