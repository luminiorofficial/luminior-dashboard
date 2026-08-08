// ---------------------------------------------------------------------------
// Users repository (MSSQL) — backs NextAuth credentials auth.
// ---------------------------------------------------------------------------
import "server-only";
import { execProc, execProcOne, query } from "./mssql";

export type UserRole = "user" | "admin" | "superadmin";

export interface DbUser {
  id: string;
  email: string;
  /** NULL for OAuth-only accounts (Google) — they carry no password. */
  password_hash: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

/** Row from sp_ListUsers — team directory shape (no password hash). */
export interface DbUserListItem {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Look up a user by email for authentication (includes the password hash). */
export function getUserByEmail(email: string): Promise<DbUser | null> {
  return execProcOne<DbUser>("sp_GetUserByEmail", {
    Email: email.toLowerCase().trim(),
  });
}

/**
 * Look up a user by primary key. Prefer this over getUserByEmail for an already
 * authenticated session: the id is immutable, while email is self-editable, so
 * an email-keyed lookup misses in the window after a change but before the
 * caller's token carries the new address.
 */
export function getUserById(id: string): Promise<DbUser | null> {
  return execProcOne<DbUser>("sp_GetUserById", { UserId: id });
}

/**
 * Update the signed-in user's own profile (display name + login email).
 *
 * Returns the updated row, or `null` when the email already belongs to another
 * user — the proc guards the UNIQUE constraint and writes nothing in that case.
 * Role, is_active and password_hash are deliberately not writable here.
 */
export function updateUserProfile(input: {
  id: string;
  email: string;
  fullName: string | null;
}): Promise<DbUser | null> {
  return execProcOne<DbUser>("sp_UpdateUserProfile", {
    UserId: input.id,
    Email: input.email.toLowerCase().trim(),
    FullName: input.fullName,
  });
}

/** All users for the team directory (no password hashes), oldest first. */
export async function listUsers(): Promise<DbUserListItem[]> {
  const { recordset } = await execProc<DbUserListItem>("sp_ListUsers");
  return recordset;
}

/** Create a user (password must already be bcrypt-hashed). Returns the new id. */
export async function createUser(input: {
  email: string;
  passwordHash: string;
  fullName?: string | null;
  role?: UserRole;
}): Promise<string> {
  const row = await execProcOne<{ id: string }>("sp_CreateUser", {
    Email: input.email.toLowerCase().trim(),
    PasswordHash: input.passwordHash,
    FullName: input.fullName ?? null,
    Role: input.role ?? "user",
  });
  if (!row) throw new Error("Failed to create user");
  return row.id;
}

/**
 * Manager-driven credential reset used when an existing identity is added to
 * a CRM brand. A login email is global across brands, so its password is global
 * too; the CRM form makes this explicit before applying the new hash.
 */
export async function setUserPasswordByAdmin(input: {
  id: string;
  passwordHash: string;
  fullName: string;
}): Promise<boolean> {
  const rows = await query<{ id: string }>(`
    UPDATE dbo.tbl_users
    SET password_hash = @PasswordHash,
        full_name = CASE
          WHEN full_name IS NULL OR LTRIM(RTRIM(full_name)) = '' THEN @FullName
          ELSE full_name
        END,
        is_active = 1
    WHERE id = @UserId AND role = 'user';
    IF @@ROWCOUNT > 0 SELECT @UserId id;
  `, {
    UserId: input.id,
    PasswordHash: input.passwordHash,
    FullName: input.fullName,
  });
  return rows.length > 0;
}

/**
 * Create-or-fetch a user for an OAuth sign-in (Google). On first login the row
 * is inserted with a NULL password_hash; on later logins it's just returned.
 * Returns the full user so the auth layer can read role/id like the creds path.
 */
export async function upsertOAuthUser(input: {
  email: string;
  fullName?: string | null;
}): Promise<DbUser> {
  const row = await execProcOne<DbUser>("sp_UpsertOAuthUser", {
    Email: input.email.toLowerCase().trim(),
    FullName: input.fullName ?? null,
  });
  if (!row) throw new Error("Failed to upsert OAuth user");
  return row;
}

/** Account ids this user may access (empty for a user with no linked stores). */
export async function getUserAccountIds(userId: string): Promise<number[]> {
  const { recordset } = await execProc<{ account_id: number }>(
    "sp_ListUserAccountIds",
    { UserId: userId },
  );
  return recordset.map((r) => r.account_id);
}

/** Grant a user access to an account (idempotent). */
export async function linkUserAccount(
  userId: string,
  accountId: number,
): Promise<void> {
  await execProc("sp_LinkUserAccount", { UserId: userId, AccountId: accountId });
}

/**
 * Change a user's role. Callers must enforce the superadmin-only rule and the
 * "don't demote the last superadmin" safeguard before calling this — the proc
 * trusts its caller and just writes.
 */
export function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<DbUserListItem | null> {
  return execProcOne<DbUserListItem>("sp_UpdateUserRole", {
    UserId: userId,
    Role: role,
  });
}

/**
 * Enable/disable a user's ability to sign in. Callers must enforce the
 * superadmin-only rule and the "don't lock out the last active superadmin"
 * safeguard before calling this — the proc trusts its caller and just writes.
 */
export function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<DbUserListItem | null> {
  return execProcOne<DbUserListItem>("sp_SetUserActive", {
    UserId: userId,
    IsActive: isActive,
  });
}

/**
 * Every user's brand (account) links in one round trip, keyed by user id —
 * the Super Admin user directory's "which brands" column needs this for every
 * row at once rather than one lookup per user.
 */
export async function listAllUserAccountLinks(): Promise<Record<string, number[]>> {
  const rows = await query<{ user_id: string; account_id: number }>(`
    SELECT user_id, account_id FROM dbo.tbl_user_accounts
  `);
  const map: Record<string, number[]> = {};
  for (const row of rows) {
    (map[row.user_id] ??= []).push(row.account_id);
  }
  return map;
}
