import bcrypt from "bcryptjs";
import { execProcOne } from "@/lib/db";

export interface DbAuthUser {
  id: string;
  email: string;
  password_hash: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

export async function getAuthUserByEmail(email: string): Promise<DbAuthUser | null> {
  return execProcOne<DbAuthUser>("sp_GetUserByEmail", { Email: email.toLowerCase().trim() });
}

export async function createAuthUser(input: { email: string; password: string; fullName?: string | null }) {
  const existing = await getAuthUserByEmail(input.email);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const row = await execProcOne<{ id: string }>("sp_CreateUser", {
    Email: input.email.toLowerCase().trim(),
    PasswordHash: passwordHash,
    FullName: input.fullName ?? null,
    Role: "user",
  });

  if (!row) {
    throw new Error("Failed to create user");
  }

  return row.id;
}

export async function verifyAuthUser(email: string, password: string) {
  const user = await getAuthUserByEmail(email);
  if (!user || !user.is_active || !user.password_hash) {
    return null;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return null;
  }

  return {
    id: user.id,
    name: user.full_name ?? user.email,
    email: user.email,
    role: user.role,
  };
}
