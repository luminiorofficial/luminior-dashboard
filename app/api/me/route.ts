import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, errorResponse, requireSession } from "@/lib/userSession";
import { getCompanyById } from "@/lib/db/accounts";
import { getUserByEmail, getUserById, updateUserProfile } from "@/lib/db/users";
import type { SessionUser } from "@/types";

/**
 * "Get all my data" — the single bootstrap call the client makes right after the
 * credentials check passes. Returns the signed-in user's full details plus the
 * one company profile. The client caches both in Zustand.
 */
export async function GET() {
  try {
    const session = await requireSession();

    // Keyed by id, not email: email is self-editable (PATCH below), so between a
    // change and the token refresh the token's address is stale. The id never
    // moves, and email/full_name come from the row itself so the response
    // reflects the edit immediately either way.
    const dbUser = await getUserById(session.id);
    if (!dbUser?.is_active) {
      throw new AuthError(403, "This account has been deactivated");
    }
    const user: SessionUser = {
      id: session.id,
      email: dbUser?.email ?? session.email,
      fullName: dbUser?.full_name ?? null,
      role: session.role,
    };

    const company = dbUser?.company_id ? await getCompanyById(dbUser.company_id) : null;

    return NextResponse.json({ user, company });
  } catch (err) {
    return errorResponse(err);
  }
}

const patchSchema = z.object({
  fullName: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
});

/**
 * Self-service profile edit. Writes only the display name and login email of the
 * *session's own* user — the id comes from the session, never the body, so this
 * cannot be pointed at someone else's row. Role and is_active are privileges and
 * are not writable here; password has its own (future) flow.
 *
 * Changing the email changes the credentials the user signs in with, so the
 * client must refresh its token afterwards (see `emailChanged` in the response)
 * or the session keeps carrying the old address.
 */
export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => null);

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    if (parsed.data.email === undefined && parsed.data.fullName === undefined) {
      throw new AuthError(400, "Nothing to update");
    }

    const current = await getUserById(session.id);
    if (!current) throw new AuthError(404, "User not found");

    const email = parsed.data.email ?? current.email;
    // An empty name clears the field rather than storing "" — null is what the
    // rest of the app already falls back on when a user has no display name.
    const fullName =
      parsed.data.fullName === undefined
        ? current.full_name
        : parsed.data.fullName || null;

    const emailChanged = email !== current.email;

    // A NULL password_hash marks an OAuth-only (Google) user. We key those rows
    // by email on every sign-in, so moving the address would orphan this row and
    // silently mint a fresh, empty one on their next Google login.
    if (emailChanged && !current.password_hash) {
      throw new AuthError(
        400,
        "Your email is managed by Google and can't be changed here.",
      );
    }

    // Friendly 409 ahead of the write. The proc re-checks under the unique
    // index, so a racing signup still can't slip a duplicate past us.
    if (emailChanged && (await getUserByEmail(email))) {
      throw new AuthError(409, "An account with this email already exists.");
    }

    const updated = await updateUserProfile({ id: session.id, email, fullName });
    if (!updated) {
      throw new AuthError(409, "An account with this email already exists.");
    }

    const user: SessionUser = {
      id: updated.id,
      email: updated.email,
      fullName: updated.full_name,
      role: session.role,
    };

    return NextResponse.json({ user, emailChanged });
  } catch (err) {
    return errorResponse(err);
  }
}
