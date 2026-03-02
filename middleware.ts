import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

// Edge-safe auth instance — uses only authConfig (no Prisma, no bcrypt).
// The full auth.ts (with Prisma adapter) is only imported in API routes.
const { auth } = NextAuth(authConfig);


// Routes that bypass authentication entirely
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths through without any session check
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // No valid session — redirect to login, preserving the intended destination
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    // Only set callbackUrl for page routes (not API routes)
    if (!pathname.startsWith("/api/")) {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated — allow through
  return NextResponse.next();
});

export const config = {
  /*
   * Match all routes EXCEPT:
   *   - Next.js static files (_next/static, _next/image)
   *   - favicon.ico and public folder files
   *
   * This means the middleware runs on EVERY page and API route,
   * which is what we want — the allowlist above opens up /login and /api/auth.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
