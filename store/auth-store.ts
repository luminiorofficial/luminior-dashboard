"use client";

import { create } from "zustand";
import type { SessionUser } from "@/types";

interface AuthState {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  /** Super Admin — the one-module (Users/role management) tier. */
  isSuperadmin: () => boolean;
  /** Admin — full CRM + Operations access. */
  isAdmin: () => boolean;
}

/** Holds the current authenticated user (full details) for client components. */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  isSuperadmin: () => get().user?.role === "superadmin",
  isAdmin: () => get().user?.role === "admin",
}));
