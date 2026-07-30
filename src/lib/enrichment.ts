/** Shared enrichment constants usable from both server actions and client UI. */

/** Per-run cap so the batch stays within the serverless time budget and can't
 *  accidentally burn thousands of credits in one click. */
export const ENRICH_BATCH_MAX = 25;

/** Apollo charges ~8 credits per revealed phone number (email is ~free). */
export const ENRICH_PHONE_CREDITS = 8;
