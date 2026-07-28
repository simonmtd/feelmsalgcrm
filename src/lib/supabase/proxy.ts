import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MOCK, DEMO_COOKIE } from "@/lib/demo/mode";

/**
 * Optimistic auth check run on every request by proxy.ts (Next.js 16's
 * successor to middleware.ts). Refreshes the Supabase session cookie and
 * redirects unauthenticated users away from protected routes. Real
 * authorization still happens server-side via lib/dal.ts.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  const isCronRoute = path.startsWith("/api/cron");

  if (DEMO_MOCK) {
    // The proxy runs in a separate runtime from the server components, so it
    // can't see the in-memory demo store to validate the cookie — it only
    // knows whether a cookie exists. A logged-out user is sent to /login here;
    // the reverse (logged-in user visiting /login → dashboard) is handled in
    // the login page itself, which CAN validate the profile. Doing it here on
    // mere cookie presence caused an infinite redirect loop whenever a restart
    // reseeded the store and invalidated an old cookie.
    const uid = request.cookies.get(DEMO_COOKIE)?.value;
    if (!uid && !isAuthRoute && !isCronRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isAuthRoute && !isCronRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
