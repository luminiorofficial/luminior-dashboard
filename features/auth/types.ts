// Auth domain types — used by the team directory and account-scoping helpers.

export type ProfileRole = "user" | "admin" | "superadmin";

/** A team member, mapped from tbl_users by getUsers() in lib/data.ts. */
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
