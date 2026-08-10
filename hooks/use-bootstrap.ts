"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut, useSession as useNextAuthSession } from "next-auth/react";
import { apiGet, FetchError } from "@/lib/fetcher";
import { useAuthStore } from "@/store/auth-store";
import { useCompanyStore } from "@/store/company-store";
import type { SafeAccount, SessionUser } from "@/types";

interface MeResponse {
  user: SessionUser;
  company: SafeAccount | null;
}

/**
 * Post-login bootstrap. Once NextAuth has verified the email + password, fetches
 * the user's full details and the company profile in one /api/me call and stores
 * both in Zustand. Clears them on sign-out.
 */
export function useBootstrap() {
  const { status, data: session, update } = useNextAuthSession();
  const setUser = useAuthStore((s) => s.setUser);
  const setCompany = useCompanyStore((s) => s.setCompany);
  const resetCompany = useCompanyStore((s) => s.reset);
  const sessionUserKey = session?.user?.id ?? session?.user?.email ?? null;
  const previousSessionKey = useRef<string | null>(null);

  useEffect(() => {
    if (previousSessionKey.current && previousSessionKey.current !== sessionUserKey) {
      resetCompany();
    }
    previousSessionKey.current = sessionUserKey;
  }, [sessionUserKey, resetCompany]);

  const query = useQuery({
    queryKey: ["me", sessionUserKey],
    queryFn: () => apiGet<MeResponse>("/api/me"),
    enabled: status === "authenticated" && Boolean(sessionUserKey),
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
  });

  // Populate the stores when the data arrives.
  useEffect(() => {
    if (query.data) {
      setUser(query.data.user);
      setCompany(query.data.company);
    }
  }, [query.data, setUser, setCompany]);

  // /api/me always reads the live role from the DB (see getSession()), but
  // the JWT cookie itself — what proxy.ts reads for page-level routing —
  // only refreshes on next login or this explicit update() call. When a Super
  // Admin changes someone's role (or their own) from a different browser, the
  // affected session would otherwise keep routing on the stale role until they
  // log out. Detecting the mismatch here and calling update() closes that gap
  // automatically, within one polling interval, with no manual logout needed.
  useEffect(() => {
    const liveRole = query.data?.user.role;
    const tokenRole = session?.user?.role;
    if (liveRole && tokenRole && liveRole !== tokenRole) {
      void update();
    }
  }, [query.data?.user.role, session?.user?.role, update]);

  // Clear everything on sign-out.
  useEffect(() => {
    if (status === "unauthenticated") {
      setUser(null);
      resetCompany();
    }
  }, [status, setUser, resetCompany]);

  // Deactivated accounts are logged out on the next identity heartbeat. Their
  // historical CRM records remain in SQL; only access is revoked.
  useEffect(() => {
    if (query.error instanceof FetchError && query.error.status === 403) {
      void signOut({ redirectTo: "/sign-in" });
    }
  }, [query.error]);

  return { sessionStatus: status, ...query };
}
