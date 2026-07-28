import "server-only";

/**
 * Sends a transactional email via Resend. No-ops (logs) when RESEND_API_KEY is
 * unset, so the app works fine before email is configured. Set RESEND_FROM to a
 * verified sender, e.g. "Feelm Leads <varsler@feelm.no>".
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    console.warn("[sendEmail] RESEND_API_KEY/RESEND_FROM ikke satt — hopper over e-post til", opts.to);
    return { ok: false, error: "email_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[sendEmail] Resend-feil", res.status, body);
      return { ok: false, error: `resend_${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("[sendEmail]", error);
    return { ok: false, error: "network" };
  }
}
