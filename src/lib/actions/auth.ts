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

export interface PasswordActionState {
  error?: string;
  success?: string;
}

/** Lets the logged-in user change their own password. */
export async function changeOwnPassword(
  _prevState: PasswordActionState | undefined,
  formData: FormData
): Promise<PasswordActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Passordet må være minst 8 tegn." };
  if (password !== confirm) return { error: "Passordene er ikke like." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Du er ikke logget inn." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[changeOwnPassword]", error);
    return { error: "Kunne ikke endre passordet. Prøv igjen." };
  }

  return { success: "Passordet ble endret." };
}
