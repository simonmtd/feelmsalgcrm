import "server-only";
import { getDemoStore } from "@/lib/demo/store";
import { MockQueryBuilder } from "@/lib/demo/query-builder";
import { DEMO_COOKIE } from "@/lib/demo/mode";
import type { Profile, UserRole } from "@/lib/types";

type CookieLike = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
};

function dbMethods() {
  const store = getDemoStore();
  return {
    from(table: string) {
      return new MockQueryBuilder(table as never, store);
    },
  };
}

export function createMockServerClient(cookieStore: CookieLike) {
  const store = getDemoStore();

  return {
    ...dbMethods(),
    auth: {
      async getUser() {
        const uid = cookieStore.get(DEMO_COOKIE)?.value;
        const profile = uid ? store.profiles.find((p) => p.id === uid) : undefined;
        if (!profile) return { data: { user: null }, error: null };
        return { data: { user: { id: profile.id, email: profile.email } }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const profile = store.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
        const validPassword = store.credentials[email.toLowerCase()];
        if (!profile || !validPassword || validPassword !== password) {
          return { data: { user: null, session: null }, error: { message: "Invalid credentials" } };
        }
        try {
          cookieStore.set(DEMO_COOKIE, profile.id, { httpOnly: true, path: "/", sameSite: "lax" });
        } catch {
          // Called from a Server Component render — safe to ignore, matches
          // the real Supabase server client's same try/catch (see server.ts).
        }
        return { data: { user: { id: profile.id, email: profile.email }, session: {} }, error: null };
      },
      async signOut() {
        try {
          cookieStore.delete(DEMO_COOKIE);
        } catch {
          // ignore, see above
        }
        return { error: null };
      },
      async updateUser({ password }: { password?: string }) {
        const uid = cookieStore.get(DEMO_COOKIE)?.value;
        const profile = uid ? store.profiles.find((p) => p.id === uid) : undefined;
        if (!profile) return { data: { user: null }, error: { message: "Not authenticated" } };
        if (password) store.credentials[profile.email.toLowerCase()] = password;
        return { data: { user: { id: profile.id, email: profile.email } }, error: null };
      },
    },
  };
}

export function createMockAdminClient() {
  const store = getDemoStore();

  return {
    ...dbMethods(),
    auth: {
      admin: {
        async createUser({
          email,
          password,
          user_metadata,
        }: {
          email: string;
          password: string;
          email_confirm?: boolean;
          user_metadata?: { full_name?: string | null; role?: string };
        }) {
          if (store.profiles.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
            return { data: null, error: { message: "En bruker med denne e-posten finnes allerede." } };
          }
          const now = new Date().toISOString();
          const profile: Profile = {
            id: crypto.randomUUID(),
            email,
            full_name: user_metadata?.full_name ?? null,
            role: (user_metadata?.role as UserRole) ?? "seller",
            active_niche_id: null,
            is_active: true,
            created_at: now,
          };
          store.profiles.push(profile);
          store.credentials[email.toLowerCase()] = password;
          return { data: { user: { id: profile.id, email } }, error: null };
        },
        async updateUserById(userId: string, attrs: { password?: string }) {
          const profile = store.profiles.find((p) => p.id === userId);
          if (!profile) return { data: null, error: { message: "Fant ikke bruker." } };
          if (attrs.password) store.credentials[profile.email.toLowerCase()] = attrs.password;
          return { data: { user: { id: profile.id, email: profile.email } }, error: null };
        },
      },
    },
  };
}
