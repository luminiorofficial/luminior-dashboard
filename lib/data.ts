import "server-only";
import { isMssqlConfigured } from "@/lib/db/mssql";
import { getAccountById, listAccounts as listAccountsDb } from "@/lib/db/accounts";
import { getUserAccountIds, listUsers } from "@/lib/db/users";
import type { ProfileRole } from "@/features/auth/types";
import type { Account, SafeAccount } from "@/types";

function toProfileRole(role: string): ProfileRole {
  return role === "superadmin" || role === "admin" ? role : "user";
}

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: ProfileRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getUsers(): Promise<Profile[]> {
  if (!isMssqlConfigured()) return [];
  const users = await listUsers();
  return users.map((u) => ({
    id: u.id,
    username: null,
    full_name: u.full_name,
    avatar_url: null,
    email: u.email,
    role: toProfileRole(u.role),
    is_active: u.is_active,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }));
}

export async function findUserByEmail(email: string): Promise<Profile | undefined> {
  const target = email.toLowerCase().trim();
  const users = await getUsers();
  return users.find((u) => (u.email ?? "").toLowerCase() === target);
}

export async function getAccounts(): Promise<Account[]> {
  if (!isMssqlConfigured()) return [];
  return listAccountsDb();
}

export async function getAccountByAccountId(accountId: number): Promise<Account | undefined> {
  if (!isMssqlConfigured()) return undefined;
  return (await getAccountById(accountId)) ?? undefined;
}

export function toSafeAccount(account: Account): SafeAccount {
  return {
    accountId: account.accountId,
    name: account.name,
    avatar: account.avatar,
    shopifyDomain: account.shopifyDomain,
    gmail: account.gmail,
  };
}

interface AccessSession {
  id: string;
  accounts: string[];
}

export async function getAccessibleAccounts(session: AccessSession): Promise<Account[]> {
  const accounts = await getAccounts();
  if (session.accounts.includes("all")) return accounts;
  if (!isMssqlConfigured()) return [];
  const ids = new Set(await getUserAccountIds(session.id));
  return accounts.filter((a) => ids.has(a.accountId));
}

export async function canUserAccessAccount(session: AccessSession, accountId: number): Promise<boolean> {
  if (session.accounts.includes("all")) return true;
  if (!isMssqlConfigured()) return false;
  const ids = await getUserAccountIds(session.id);
  return ids.includes(accountId);
}

export function canAccessAccount(allowed: string[], accountId: number) {
  return allowed.includes("all") || allowed.includes(String(accountId));
}
