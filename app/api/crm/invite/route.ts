import { NextResponse } from "next/server";
import { AuthError, errorResponse, requireSession } from "@/lib/userSession";
import { getOrCreateReferralLink } from "@/lib/db/crm";

/**
 * Returns (creating on first request) the signed-in admin's standing invite
 * link. Anyone who signs up through it is auto-joined as an active CRM
 * member — see sp_register_user in db/function.sql.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (session.role !== "admin" && session.role !== "superadmin") {
      throw new AuthError(403, "Manager access required");
    }
    const code = await getOrCreateReferralLink(session.id);
    const base = process.env.AUTH_URL ?? new URL(request.url).origin;
    return NextResponse.json({ code, url: `${base}/sign-up?ref=${code}` });
  } catch (error) {
    return errorResponse(error);
  }
}
