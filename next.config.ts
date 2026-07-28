import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response. A strict
 * Content-Security-Policy is intentionally left out for now because Next's
 * runtime injects inline scripts/styles that would need per-request nonces;
 * add it as a follow-up. These headers are safe and non-breaking.
 */
const securityHeaders = [
  // Block the app from being framed (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Stop MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which may carry ids) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny powerful browser features the app doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Force HTTPS for two years, including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
