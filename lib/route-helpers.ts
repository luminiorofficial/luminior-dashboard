import "server-only";
import { AuthError, requireSession } from "@/lib/userSession";
import { canUserAccessAccount, getAccountByAccountId } from "@/lib/data";
import type { Account } from "@/types";

export async function resolveAccountId(req: Request): Promise<number> {
  const session = await requireSession();
  const raw = new URL(req.url).searchParams.get("account");
  const requested = raw != null && raw !== "" ? Number(raw) : NaN;
  const accountId = Number.isInteger(requested) && requested > 0 ? requested : Number(session.account_id);

  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new AuthError(400, "Missing or invalid account id");
  }
  if (!(await canUserAccessAccount(session, accountId))) {
    throw new AuthError(403, "You do not have access to this account");
  }
  return accountId;
}

export async function resolveAccount(req: Request): Promise<Account> {
  const accountId = await resolveAccountId(req);
  const account = await getAccountByAccountId(accountId);
  if (!account) throw new AuthError(404, "Account not found");
  return account;
}

export function safeClientMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const message = err instanceof Error ? err.message : "";
  if (!message) return fallback;
  return INTERNAL_IDENTIFIER_PATTERNS.some((re) => re.test(message))
    ? fallback
    : message;
}

const INTERNAL_IDENTIFIER_PATTERNS: RegExp[] = [
  /[A-Za-z]:\\/,
  /\b(?:src|app|lib|node_modules)\//,
  /\.(?:ts|tsx|js|jsx|sql|json)\b/,
  /\bdbo\./i,
  /\btbl_/i,
  /\bsp_/i,
];
