import type { ProfileRole } from "@/features/auth/types";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  role: ProfileRole;
}

export interface SessionPayload {
  id: string;
  email: string;
  role: ProfileRole;
  iat: number;
  exp: number;
}

/** The one company profile the whole app belongs to. */
export interface Account {
  name: string;
  avatar: string;
  gmail?: string;
  phone?: string;
  address?: string;
  website?: string;
}

export type SafeAccount = Account;
