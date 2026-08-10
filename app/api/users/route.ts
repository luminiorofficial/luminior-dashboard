import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, errorResponse, requireSuperadmin } from "@/lib/userSession";
import { listUsers, setUserActive, updateUserRole, type UserRole } from "@/lib/db/users";

function toClient(user: {
  id: string; email: string; full_name: string | null; role: UserRole;
  is_active: boolean; company_id: number | null; company_name: string | null;
  referred_by: string | null;
  created_at: string;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    isActive: user.is_active,
    companyId: user.company_id,
    companyName: user.company_name,
    referredBy: user.referred_by,
    createdAt: user.created_at,
  };
}

/** Super Admin's user directory — every account, platform-wide. */
export async function GET() {
  try {
    await requireSuperadmin();
    const users = await listUsers();
    return NextResponse.json({ users: users.map(toClient) });
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin", "superadmin"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireSuperadmin();
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { userId, role, isActive } = parsed.data;
    if (role === undefined && isActive === undefined) {
      throw new AuthError(400, "Nothing to update");
    }
    if (userId === session.id && (role !== undefined || isActive === false)) {
      throw new AuthError(400, "You cannot change your own role or deactivate yourself");
    }

    const users = await listUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) throw new AuthError(404, "User not found");

    // Never leave the platform with zero active Super Admins — that would be
    // an unrecoverable lockout with no self-service way back in.
    const losingSuperadmin =
      target.role === "superadmin" &&
      ((role !== undefined && role !== "superadmin") || isActive === false);
    if (losingSuperadmin) {
      const otherActiveSuperadmins = users.filter(
        (u) => u.id !== userId && u.role === "superadmin" && u.is_active,
      );
      if (otherActiveSuperadmins.length === 0) {
        throw new AuthError(400, "At least one active Super Admin must remain");
      }
    }

    let updated = target;
    if (role !== undefined) {
      const row = await updateUserRole(userId, role);
      if (!row) throw new AuthError(404, "User not found");
      updated = row;
    }
    if (isActive !== undefined) {
      const row = await setUserActive(userId, isActive);
      if (!row) throw new AuthError(404, "User not found");
      updated = row;
    }

    return NextResponse.json({ user: toClient(updated) });
  } catch (error) {
    return errorResponse(error);
  }
}
