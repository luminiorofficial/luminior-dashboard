// ---------------------------------------------------------------------------
// Edge-safe NextAuth config (no Node-only imports). Shared by:
//   • src/auth.ts        — adds the Credentials provider (bcrypt + MSSQL, Node)
//   • src/proxy.ts        — middleware reads the JWT here (must stay edge-safe)
// Keeping the provider's authorize() out of this file is what lets the
// middleware bundle for the edge runtime without pulling in mssql/bcrypt.
// ---------------------------------------------------------------------------
import type { NextAuthConfig } from "next-auth";

// The Luminior Research browser extension calls this backend from marketplace
// pages (amazon.in, flipkart.com…) — a *cross-site* request. A cross-site fetch
// only carries the session cookie when it's `SameSite=None; Secure`, so in
// production we relax SameSite from NextAuth's default "lax" to "none".
// Locally we keep the default (Secure cookies aren't sent over http://localhost).
const configuredAuthUrl =
  process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
const configuredForLocalHttp =
  configuredAuthUrl.startsWith("http://localhost") ||
  configuredAuthUrl.startsWith("http://127.0.0.1");
const useSecureCookies =
  process.env.NODE_ENV === "production" && !configuredForLocalHttp;

export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  trustHost: true,
  cookies: useSecureCookies
    ? {
        sessionToken: {
          name: "__Secure-authjs.session-token",
          options: {
            httpOnly: true,
            sameSite: "none",
            path: "/",
            secure: true,
          },
        },
      }
    : undefined,
  providers: [], // real providers are attached in src/auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string;
        session.user.role = token.role as string | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
