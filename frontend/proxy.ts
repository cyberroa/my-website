import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Next.js 16+ network boundary (renamed from middleware → proxy). */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Legacy /admin bookmarks → /workbench (also covered by next.config redirects)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const dest = pathname.replace(/^\/admin/, "/workbench") || "/workbench";
    const u = request.nextUrl.clone();
    u.pathname = dest;
    return NextResponse.redirect(u);
  }

  const isWorkbenchLogin = pathname === "/workbench/login";

  if (pathname.startsWith("/workbench") && !isWorkbenchLogin) {
    if (!user) {
      const u = new URL("/workbench/login", request.url);
      return NextResponse.redirect(u);
    }
    const allow = process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST || "";
    if (allow.trim()) {
      const allowed = new Set(
        allow
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      );
      const email = user.email?.toLowerCase();
      if (!email || !allowed.has(email)) {
        return NextResponse.redirect(new URL("/workbench/login?error=forbidden", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/workbench/:path*", "/admin", "/admin/:path*", "/auth/callback"],
};
