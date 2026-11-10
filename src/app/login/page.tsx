import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Wordmark } from "@/components/sidebar";
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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side: Feelm's loud type on a pink glow. */}
      <div className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[640px] w-[640px] rounded-full bg-brand/20 blur-[140px]" />
        <Wordmark className="relative text-5xl" />
        <div className="relative">
          <p className="display text-[clamp(64px,8vw,128px)] text-fg">
            Flere møter.
            <br />
            <span className="text-brand">Mindre styr.</span>
          </p>
          <p className="mt-6 max-w-md text-muted">
            Dagens leads, samtaler, møter og provisjon – samlet på ett sted for Feelm-teamet.
          </p>
        </div>
        <p className="relative text-xs text-subtle">© Feelm</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Wordmark className="mb-6 block text-4xl lg:hidden" />
            <h1 className="display text-5xl text-fg">Logg inn</h1>
            <p className="mt-2 text-sm text-muted">Logg inn for å se dine leads.</p>
          </div>
          <LoginForm />
          {DEMO_MOCK && (
            <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-xs text-fg-2">
              <p className="eyebrow">Demo-modus</p>
              <p className="mt-1">
                Passord for alle brukere: <span className="font-mono text-fg">{DEMO_PASSWORD}</span>
              </p>
              <ul className="mt-2 flex flex-col gap-0.5">
                {demoProfiles.map((p) => (
                  <li key={p.id}>
                    {p.email} <span className="text-subtle">({p.role})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
