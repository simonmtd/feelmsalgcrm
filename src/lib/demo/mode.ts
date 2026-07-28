/**
 * When set, every Supabase client (server, admin) and the auth proxy are
 * swapped for an in-memory mock backed by realistic seed data, and the
 * HubSpot sync pulls from a fake contact list instead of the real API.
 * Lets the app run end-to-end without any real Supabase project or
 * HubSpot token. See src/lib/demo/store.ts for the seed data.
 *
 * Demo mode accepts a fixed password for every seeded user, so it is a total
 * auth bypass. It is therefore hard-disabled in production builds regardless of
 * the env var — never rely on this alone; also keep DEMO_MOCK out of the prod
 * environment.
 */
export const DEMO_MOCK =
  process.env.DEMO_MOCK === "1" && process.env.NODE_ENV !== "production";

export const DEMO_PASSWORD = "demo1234";

export const DEMO_COOKIE = "demo_uid";
