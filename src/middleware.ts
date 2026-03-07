import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard"];
// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("session_token")?.value;

  // Check if route is protected
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  if (isProtected && !sessionToken) {
    // Not logged in → redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && sessionToken) {
    // Cookie exists — redirect to dashboard.
    // If the session is actually stale (e.g. server restart cleared in-memory store),
    // the dashboard page will clear the cookie and redirect back here.
    // The "logged_out" param prevents an infinite loop: if we just came from
    // a failed session check, don't redirect again.
    if (request.nextUrl.searchParams.has("logged_out")) {
      const response = NextResponse.next();
      response.cookies.delete("session_token");
      return response;
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
