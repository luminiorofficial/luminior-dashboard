// ---------------------------------------------------------------------------
// Users repository (PostgreSQL) — backs NextAuth credentials auth.
// ---------------------------------------------------------------------------
import "server-only";
import bcrypt from "bcryptjs";
import { query, queryOne } from "./postgres";

export type UserRole = "user" | "admin" | "superadmin";

export interface DbUser {
  id: string;
  email: string;
  /** NULL for OAuth-only accounts (Google) — they carry no password. */
  password_hash: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  /**
   * The company this user belongs to. NULL only for a fresh Google sign-in
   * that never came through an invite link — every other user (managers via
   * auto-provisioning, members via referral) always has one.
   */
  company_id: number | null;
  /** Who shared the invite link this user registered through, if any. */
  referred_by: string | null;
}

/** Row from sp_list_users — platform-wide directory shape (no password hash). */
export interface DbUserListItem {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  company_id: number | null;
  company_name: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Look up a user by email for authentication (includes the password hash). */
export function getUserByEmail(email: string): Promise<DbUser | null> {
  return queryOne<DbUser>("SELECT * FROM sp_get_user_by_email($1)", [
    email.toLowerCase().trim(),
  ]);
}

/**
 * Look up a user by primary key. Prefer this over getUserByEmail for an already
 * authenticated session: the id is immutable, while email is self-editable, so
 * an email-keyed lookup misses in the window after a change but before the
 * caller's token carries the new address.
 */
export function getUserById(id: string): Promise<DbUser | null> {
  return queryOne<DbUser>("SELECT * FROM sp_get_user_by_id($1)", [id]);
}

/**
 * Update the signed-in user's own profile (display name + login email).
 *
 * Returns the updated row, or `null` when the email already belongs to another
 * user — the function guards the UNIQUE constraint and writes nothing in that
 * case. Role, is_active and password_hash are deliberately not writable here.
 */
export function updateUserProfile(input: {
  id: string;
  email: string;
  fullName: string | null;
}): Promise<DbUser | null> {
  return queryOne<DbUser>("SELECT * FROM sp_update_user_profile($1, $2, $3)", [
    input.id,
    input.email.toLowerCase().trim(),
    input.fullName,
  ]);
}

/** All users for the team directory (no password hashes), oldest first. */
export async function listUsers(): Promise<DbUserListItem[]> {
  return query<DbUserListItem>("SELECT * FROM sp_list_users()");
}

/**
 * Create a user (password must already be bcrypt-hashed). Returns the new
 * id. `companyId` ties the new account to a company directly — used by the
 * "add team member" dialog, which stamps the creating admin's own company.
 */
export async function createUser(input: {
  email: string;
  passwordHash: string;
  fullName?: string | null;
  role?: UserRole;
  companyId?: number | null;
}): Promise<string> {
  const row = await queryOne<{ id: string }>(
    "SELECT * FROM sp_create_user($1, $2, $3, $4, $5)",
    [
      input.email.toLowerCase().trim(),
      input.passwordHash,
      input.fullName ?? null,
      input.role ?? "user",
      input.companyId ?? null,
    ],
  );
  if (!row) throw new Error("Failed to create user");
  return row.id;
}

/**
 * Self-registration entry point (the sign-up form). Delegates to
 * sp_register_user: the very first account ever created becomes the
 * superadmin (bootstrap); every registration after that requires a valid
 * invite/referral code and lands the new user as an active CRM member.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  fullName?: string | null;
  refCode?: string | null;
}): Promise<{ id: string; role: UserRole }> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const row = await queryOne<{ id: string; role: UserRole }>(
      "SELECT * FROM sp_register_user($1, $2, $3, $4)",
      [
        input.email.toLowerCase().trim(),
        passwordHash,
        input.fullName ?? null,
        input.refCode ?? null,
      ],
    );
    if (!row) throw new Error("Failed to create account");
    return { id: row.id, role: row.role };
  } catch (error) {
    const pgError = error as { message?: string; code?: string };
    if (pgError.message === "REFERRAL_REQUIRED") {
      throw new Error("An invite link from your admin is required to sign up.");
    }
    if (pgError.message === "INVALID_REFERRAL") {
      throw new Error("That invite link is invalid or has expired.");
    }
    if (pgError.code === "23505") {
      throw new Error("An account with this email already exists.");
    }
    throw error;
  }
}

/**
 * Manager-driven credential reset used when an existing identity is added to
 * the team. A login email is global, so its password is global too; the CRM
 * form makes this explicit before applying the new hash.
 */
export async function setUserPasswordByAdmin(input: {
  id: string;
  passwordHash: string;
  fullName: string;
}): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `
    UPDATE tbl_users
    SET password_hash = $2,
        full_name = CASE
          WHEN full_name IS NULL OR btrim(full_name) = '' THEN $3
          ELSE full_name
        END,
        is_active = true
    WHERE id = $1 AND role = 'user'
    RETURNING id;
    `,
    [input.id, input.passwordHash, input.fullName],
  );
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
  const row = await queryOne<DbUser>("SELECT * FROM sp_upsert_oauth_user($1, $2)", [
    input.email.toLowerCase().trim(),
    input.fullName ?? null,
  ]);
  if (!row) throw new Error("Failed to upsert OAuth user");
  return row;
}

/**
 * Change a user's role. Callers must enforce the superadmin-only rule and the
 * "don't demote the last superadmin" safeguard before calling this — the
 * function trusts its caller and just writes.
 */
export function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<DbUserListItem | null> {
  return queryOne<DbUserListItem>("SELECT * FROM sp_update_user_role($1, $2)", [
    userId,
    role,
  ]);
}

/**
 * Enable/disable a user's ability to sign in. Callers must enforce the
 * superadmin-only rule and the "don't lock out the last active superadmin"
 * safeguard before calling this — the function trusts its caller and just
 * writes.
 */
export function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<DbUserListItem | null> {
  return queryOne<DbUserListItem>("SELECT * FROM sp_set_user_active($1, $2)", [
    userId,
    isActive,
  ]);
}
