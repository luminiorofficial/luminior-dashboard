// Auth domain types — used by the team directory and account-scoping helpers.

export type ProfileRole = "user" | "admin" | "superadmin";

/** A team member, mapped from dbo.tbl_users by getUsers() in src/lib/data.ts. */
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

/** One brand (dbo.tbl_accounts) as shown in a brand-assignment checkbox list. */
export interface BrandOption {
  accountId: number;
  name: string;
}
