import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, errorResponse, requireSession } from "@/lib/userSession";
import { getCompanyById, updateCompanyByOwner } from "@/lib/db/accounts";
import { getUserById } from "@/lib/db/users";

/** The signed-in user's own company, or null if they aren't attached to one yet. */
export async function GET() {
  try {
    const session = await requireSession();
    const currentUser = await getUserById(session.id);
    if (!currentUser?.company_id) return NextResponse.json(null);
    return NextResponse.json(await getCompanyById(currentUser.company_id));
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  avatar: z.string().trim().max(500).optional(),
  gmail: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  website: z.string().trim().max(255).optional(),
});

const emptyToNull = (value: string | undefined) => (value && value.trim() ? value.trim() : null);

/**
 * Edit the company profile — restricted to the company's own owner (the
 * admin/superadmin it was auto-provisioned for), not just "any manager".
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    if (session.role !== "admin" && session.role !== "superadmin") {
      throw new AuthError(403, "Manager access required");
    }
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const updated = await updateCompanyByOwner(session.id, {
      name: parsed.data.name,
      avatar: parsed.data.avatar?.trim() ?? "",
      gmail: emptyToNull(parsed.data.gmail),
      phone: emptyToNull(parsed.data.phone),
      address: emptyToNull(parsed.data.address),
      website: emptyToNull(parsed.data.website),
    });
    if (!updated) throw new AuthError(404, "No company found for this account.");
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
