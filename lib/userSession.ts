// ─── Server-side auth helpers ─────────────────────────────────────────────────
import "server-only";
import { NextResponse } from "next/server";
import { getUserById } from "@/lib/db/users";
import type { ProfileRole } from "@/features/auth/types";
import type { SessionPayload } from "@/types";
import { auth } from "@/auth";

/** tbl_users.role is 'user' | 'admin' | 'superadmin' — normalise defensively. */
function toRole(role: unknown): ProfileRole {
  return role === "superadmin" || role === "admin" ? role : "user";
}

/**
 * Role is authorization-critical and must never be trusted from the JWT
 * alone: the token only refreshes on next login or an explicit client-side
 * update() (see edit-profile-dialog.tsx and useBootstrap), so a role change
 * made from another browser — e.g. a Super Admin promoting/demoting someone —
 * would otherwise silently keep the old privileges in effect for up to the
 * full session lifetime. Re-reading it here, on every request, is what makes
 * a role change (or a Super Admin's own self-promotion via SQL) take effect
 * immediately instead of requiring a manual logout.
 *
 * is_active is deliberately NOT enforced here — that stays with the callers
 * that already check it explicitly (api/me, the CRM routes) so the existing
 * 403-based auto-sign-out contract in useBootstrap is unaffected.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const session = await auth();
  const u = session?.user as any;
  if (!u) return null;

  const dbUser = await getUserById(u.id);
  const role = toRole(dbUser?.role ?? u.role);
  const now = Math.floor(Date.now() / 1000);

  return {
    id: u.id,
    email: u.email ?? "",
    role,
    iat: now,
    exp: now + 3600,
  };
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Not authenticated");
  return session;
}

/** Admin-or-better: Superadmin has every Admin capability plus its own Users module. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "superadmin") {
    throw new AuthError(403, "Admin access required");
  }
  return session;
}

/** Super Admin's exclusive module: user/role management. */
export async function requireSuperadmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "superadmin") {
    throw new AuthError(403, "Super Admin access required");
  }
  return session;
}

// Internal identifiers (DB schema/table/proc names, source-file paths) that must
// never reach the browser. A raw error whose message matches any of these is
// replaced with a generic fallback; the full error is still logged server-side.
const INTERNAL_IDENTIFIER_PATTERNS: RegExp[] = [
  /[A-Za-z]:\\/,
  /\b(?:src|app|lib|node_modules)\//,
  /\.(?:ts|tsx|js|jsx|sql|json)\b/,
  /\bdbo\./i,
  /\btbl_/i,
  /\bsp_/i,
];

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[errorResponse]", err);
  const raw = err instanceof Error ? err.message : "";
  const safe =
    raw && !INTERNAL_IDENTIFIER_PATTERNS.some((re) => re.test(raw))
      ? raw
      : "Something went wrong. Please try again.";
  return NextResponse.json({ error: safe }, { status: 500 });
}
