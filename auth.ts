import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import authConfig from "@/auth.config";
import { getUserByEmail, getUserById, upsertOAuthUser } from "@/lib/db/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await getUserByEmail(email);
        if (!user || !user.is_active) return null;

        // OAuth-only accounts (Google) have no password_hash — they can't sign
        // in here. Guard before bcrypt.compare, which would throw on a NULL.
        if (!user.password_hash) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.full_name ?? undefined,
          role: user.role,
        };
      },
    }),

    // "Continue with Google". Credentials are read from AUTH_GOOGLE_ID /
    // AUTH_GOOGLE_SECRET. allowDangerousEmailAccountLinking lets someone who
    // first registered with email+password later sign in with Google on the
    // same address (we key users by email, so this is the behaviour we want).
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  // ── Callbacks ──────────────────────────────────────────────────────────────
  callbacks: {
    // Runs before a session is issued. For Google we mint (or find) the matching
    // row in tbl_users here so the rest of the app can treat a Google user
    // exactly like a credentials user. Returning false aborts the sign-in.
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;
        const dbUser = await upsertOAuthUser({ email, fullName: user.name ?? null });
        if (!dbUser.is_active) return false;
      }
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Credentials: `user` already carries our DB fields on first sign-in.
      if (user && account?.provider !== "google") {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }

      // A client called useSession().update() — it just edited its profile, so
      // re-stamp the identity fields the token caches. Everything is re-read
      // from the DB by id and the caller's payload is ignored on purpose: that
      // argument is attacker-controlled, and token.email is what API routes
      // authenticate as, so trusting it here would be an impersonation vector.
      if (trigger === "update" && token.id) {
        const dbUser = await getUserById(String(token.id));
        if (dbUser) {
          token.email = dbUser.email;
          token.name = dbUser.full_name ?? undefined;
          token.role = dbUser.role;
        }
      }

      // Google: `user` is Google's profile (its own id), so resolve OUR user by
      // email and stamp our id/role onto the token. Guarded by `account?.provider`
      // so it only runs on the initial sign-in, not refreshes.
      if (account?.provider === "google" && token.email) {
        const dbUser = await getUserByEmail(String(token.email));
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
});
