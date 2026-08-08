"use client";

import { useCallback } from "react";
import { signIn as nextSignIn, signOut as nextSignOut, useSession } from "next-auth/react";
import { apiMutate } from "@/lib/fetcher";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function useAuth() {
  const sessionResult = useSession() ?? {};
  const { data: session, status } = sessionResult as {
    data?: {
      user?: {
        id?: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
      } | null;
    } | null;
    status?: string;
  };

  const user = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? session.user.email ?? "User",
        email: session.user.email ?? "",
        role: session.user.role ?? "user",
      }
    : null;

  const loading = status === "loading";

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await nextSignIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return Boolean(result?.ok);
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    const created = await apiMutate<{ id: string }>("POST", "/api/auth/register", {
      body: { fullName, email, password },
    });
    if (!created?.id) {
      return false;
    }
    const result = await nextSignIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return Boolean(result?.ok);
  }, []);

  const signOut = useCallback(() => {
    void nextSignOut({ redirectTo: "/sign-in" });
  }, []);

  return { user, loading, signIn, signUp, signOut };
}
