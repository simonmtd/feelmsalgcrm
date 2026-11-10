/**
 * Reads every row of a query, not just the first page. Supabase/PostgREST caps
 * a single response (1000 rows by default), so "select all leads" silently
 * returned a truncated list once the base grew past that. Pass a function that
 * applies `.range(from, to)` to a query with a stable `.order(...)`.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  { pageSize = 1000, max = 200_000 }: { pageSize?: number; max?: number } = {}
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data as T[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}
