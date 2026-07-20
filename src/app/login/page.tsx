import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">Feelm Leads</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Logg inn for å se dine leads
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
