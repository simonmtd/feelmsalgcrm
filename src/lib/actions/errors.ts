import "server-only";

/**
 * Logs the real error server-side and returns a safe, generic message for the
 * client. Raw Postgres/Supabase error strings can reveal schema details, so we
 * never surface them directly.
 */
export function safeError(context: string, error: unknown): string {
  console.error(`[${context}]`, error);
  return "Noe gikk galt. Prøv igjen, eller kontakt en administrator hvis det vedvarer.";
}

/** Throwing variant for actions that don't return a result object. */
export function throwSafe(context: string, error: unknown): never {
  throw new Error(safeError(context, error));
}
