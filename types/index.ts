import type { ProfileRole } from "@/features/auth/types";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  role: ProfileRole;
  accounts: string[];
}

export interface SessionPayload {
  id: string;
  email: string;
  role: ProfileRole;
  accounts: string[];
  account_id: string;
  iat: number;
  exp: number;
}

export interface Account {
  accountId: number;
  name: string;
  avatar: string;
  shopifyDomain: string;
  gmail?: string;
}

export interface SafeAccount {
  accountId: number;
  name: string;
  avatar: string;
  shopifyDomain: string;
  gmail?: string;
}
