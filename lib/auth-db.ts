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
  try {
    const result = await execProcOne<DbAuthUser>("sp_GetUserByEmail", { Email: email.toLowerCase().trim() });
    console.log("[DB] sp_GetUserByEmail returned:", result ? "user found" : "no user");
    return result;
  } catch (error) {
    console.error("[DB] sp_GetUserByEmail failed:", error);
    throw error;
  }
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
  console.log("[AUTH-DB] Looking up user:", email);
  const user = await getAuthUserByEmail(email);
  console.log("[AUTH-DB] User found:", user ? `${user.email} (active: ${user.is_active})` : "not found");
  
  if (!user) {
    console.log("[AUTH-DB] User not found");
    return null;
  }
  
  if (!user.is_active) {
    console.log("[AUTH-DB] User is inactive");
    return null;
  }
  
  if (!user.password_hash) {
    console.log("[AUTH-DB] User has no password hash (OAuth-only account)");
    return null;
  }

  console.log("[AUTH-DB] Comparing passwords...");
  const ok = await bcrypt.compare(password, user.password_hash);
  console.log("[AUTH-DB] Password match:", ok);
  
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
