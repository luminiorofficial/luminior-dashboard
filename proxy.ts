// ---------------------------------------------------------------------------
// Route protection — Next.js 16 "Proxy" convention (proxy.ts; the old
// middleware.ts name still works but is deprecated). Uses auth.config.ts (no
// Node-only imports, so this bundles for the edge runtime) — the Credentials/
// Google providers themselves live in auth.ts and never run here, only the
// JWT is read.
// ---------------------------------------------------------------------------
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/sign-in", "/forgot-password", "/reset-password"];

// /sign-up is deliberately not a public auth page — the app belongs to one
// company and new accounts are only created through an admin's invite link
// (?ref=…, shared from the Team page). Visiting /sign-up without a ref code
// bounces to /sign-in instead of showing a public registration form.
const INVITE_ONLY_PAGES = ["/sign-up"];

export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);
  const isAuthPage = AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
  const isInvitePage = INVITE_ONLY_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );

  if (isInvitePage && !isLoggedIn && !searchParams.get("ref")) {
    return Response.redirect(new URL("/sign-in", req.nextUrl.origin));
  }

  if (!isLoggedIn && !isAuthPage && !isInvitePage) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("redirect", pathname);
    return Response.redirect(signInUrl);
  }

  if (isLoggedIn && (isAuthPage || isInvitePage)) {
    return Response.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
