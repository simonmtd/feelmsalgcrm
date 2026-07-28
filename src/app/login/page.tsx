import { redirect } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { DEMO_MOCK, DEMO_PASSWORD } from "@/lib/demo/mode";
import { getProfile } from "@/lib/dal";

export default async function LoginPage() {
  // Validated here (not in the proxy) so an already-authenticated user is sent
  // to the dashboard, while a stale/invalid cookie simply shows the login form.
  const profile = await getProfile();
  if (profile?.is_active) redirect("/dashboard");

  const demoProfiles = DEMO_MOCK
    ? (await import("@/lib/demo/store")).getDemoStore().profiles
    : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-himmel-300 via-himmel-100 to-wood-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-sm border-2 border-ink bg-gold-500 text-ink shadow-[3px_3px_0_0_var(--color-ink)]">
            <Clapperboard className="h-6 w-6" />
          </div>
          <h1 className="inline-block rounded-sm border-2 border-ink bg-gradient-to-b from-wood-600 to-wood-800 px-4 py-2.5 font-pixel text-sm uppercase tracking-wider text-gold-100 shadow-[3px_3px_0_0_var(--color-ink)]">
            Feelm Leads
          </h1>
          <p className="mt-3 text-sm text-wood-800">
            Logg inn for å se dine leads
          </p>
        </div>
        <LoginForm />
        {DEMO_MOCK && (
          <div className="mt-6 rounded-sm border-2 border-ink bg-gold-100 p-4 text-xs text-wood-900 shadow-[3px_3px_0_0_var(--color-ink)]">
            <p className="font-pixel text-[10px] uppercase tracking-wide">Demo-modus</p>
            <p className="mt-1">
              Passord for alle brukere: <span className="font-mono">{DEMO_PASSWORD}</span>
            </p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {demoProfiles.map((p) => (
                <li key={p.id} className="font-mono">
                  {p.email} <span className="font-sans text-wood-600">({p.role})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
