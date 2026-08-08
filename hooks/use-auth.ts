"use client";

import { useCallback, useEffect, useState } from "react";
import { clearStoredSession, getStoredSession, persistSession } from "@/lib/auth";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStoredSession();
    setUser(session);
    setLoading(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return false;
      }

      const authenticated = await response.json();
      persistSession(authenticated);
      setUser(authenticated);
      return true;
    } catch {
      return false;
    }
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      if (!response.ok) {
        return false;
      }

      const created = await response.json();
      persistSession({
        id: created.id,
        name: fullName,
        email,
        role: "user",
      });
      setUser({
        id: created.id,
        name: fullName,
        email,
        role: "user",
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const signOut = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  return { user, loading, signIn, signUp, signOut };
}
