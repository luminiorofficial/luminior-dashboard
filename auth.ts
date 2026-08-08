import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import authConfig from "@/auth.config";
import {
  getUserByEmail,
  getUserById,
  getUserAccountIds,
  upsertOAuthUser,
  type DbUser,
} from "@/lib/db/users";
import { getAccounts } from "@/lib/data";

/**
 * The account a user lands on by default = their first accessible store. Admins
 * and Superadmins (a strict superset of Admin) can reach every account, so
 * their default is the first account overall; regular users default to their
 * first linked account (empty string if none yet). Only a fallback — the
 * account switcher's ?account= overrides it on every data request. Shared by
 * the Credentials and Google paths so both behave the same.
 */
async function resolveDefaultAccountId(user: Pick<DbUser, "id" | "role">): Promise<string> {
  if (user.role === "admin" || user.role === "superadmin") {
    const all = await getAccounts();
    return all[0] ? String(all[0].accountId) : "";
  }
  const ids = await getUserAccountIds(user.id);
  return ids[0] != null ? String(ids[0]) : "";
}

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
          account_id: await resolveDefaultAccountId(user),
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
    // row in dbo.tbl_users here so the rest of the app can treat a Google user
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
        token.account_id = (user as { account_id?: string }).account_id;
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
      // email and stamp our id/role/default account onto the token. Guarded by
      // `account?.provider` so it only runs on the initial sign-in, not refreshes.
      if (account?.provider === "google" && token.email) {
        const dbUser = await getUserByEmail(String(token.email));
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.account_id = await resolveDefaultAccountId(dbUser);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string | undefined;
        (session.user as { account_id?: string }).account_id =
          token.account_id as string | undefined;
      }
      return session;
    },
  },
});
