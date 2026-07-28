"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, recordFailure, clearRateLimit } from "@/lib/rate-limit";

export interface AuthActionState {
  error?: string;
}

export async function signIn(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Fyll ut e-post og passord." };
  }

  // Rate-limit per client IP + email so a single account or source can't be
  // brute-forced. Behind a proxy the first x-forwarded-for entry is the client.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const key = `login:${ip}:${email.toLowerCase()}`;

  const limit = checkRateLimit(key);
  if (limit.blocked) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return { error: `For mange innloggingsforsøk. Prøv igjen om ${minutes} minutt${minutes === 1 ? "" : "er"}.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    recordFailure(key);
    return { error: "Feil e-post eller passord." };
  }

  clearRateLimit(key);
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
