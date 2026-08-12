import "server-only";
import { query, queryOne, withTransaction } from "./postgres";

export type PasswordResetAction = "request" | "verify" | "reset";

export async function checkAndRecordPasswordResetRateLimit(input: {
  action: PasswordResetAction;
  identifierHash: string;
  ipHash: string;
  identifierLimit: number;
  ipLimit: number;
  windowSeconds: number;
  cooldownSeconds?: number;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  return withTransaction(async (run) => {
    // Serialize requests for the same identifier/IP so concurrent requests
    // cannot all pass the count before any event is inserted.
    await run("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
      input.action,
      input.identifierHash,
    ]);
    await run("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
      input.action,
      input.ipHash,
    ]);

    const rows = await run<{
      identifier_count: number;
      ip_count: number;
      seconds_since_identifier: number | null;
    }>(
      `
      SELECT
        count(*) FILTER (WHERE identifier_hash = $2)::int AS identifier_count,
        count(*) FILTER (WHERE ip_hash = $3)::int AS ip_count,
        extract(epoch FROM (now() - max(created_at)
          FILTER (WHERE identifier_hash = $2)))::float8 AS seconds_since_identifier
      FROM tbl_password_reset_rate_limits
      WHERE action = $1
        AND created_at > now() - ($4::int * interval '1 second')
        AND (identifier_hash = $2 OR ip_hash = $3)
      `,
      [input.action, input.identifierHash, input.ipHash, input.windowSeconds],
    );

    const rate = rows[0];
    const cooldownRemaining = Math.max(
      0,
      (input.cooldownSeconds ?? 0) - (rate?.seconds_since_identifier ?? Infinity),
    );
    const overWindowLimit =
      (rate?.identifier_count ?? 0) >= input.identifierLimit ||
      (rate?.ip_count ?? 0) >= input.ipLimit;

    if (cooldownRemaining > 0 || overWindowLimit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(
          cooldownRemaining > 0 ? cooldownRemaining : input.windowSeconds,
        ),
      };
    }

    await run(
      `INSERT INTO tbl_password_reset_rate_limits
        (action, identifier_hash, ip_hash) VALUES ($1, $2, $3)`,
      [input.action, input.identifierHash, input.ipHash],
    );

    // Bound retained abuse data without putting email addresses or raw IPs in it.
    await run(
      "DELETE FROM tbl_password_reset_rate_limits WHERE created_at < now() - interval '24 hours'",
    );

    return { allowed: true, retryAfterSeconds: 0 };
  });
}

export async function createPasswordResetOtp(input: {
  userId: string;
  otpHash: string;
  expiresAt: Date;
  requestedIpHash: string;
}): Promise<string> {
  return withTransaction(async (run) => {
    await run(
      `
      UPDATE tbl_password_reset_otps
      SET otp_used_at = COALESCE(otp_used_at, now()),
          reset_token_hash = NULL,
          reset_token_expires_at = NULL
      WHERE user_id = $1 AND password_reset_at IS NULL
      `,
      [input.userId],
    );
    const rows = await run<{ id: string }>(
      `
      INSERT INTO tbl_password_reset_otps
        (user_id, otp_hash, expires_at, requested_ip_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [input.userId, input.otpHash, input.expiresAt, input.requestedIpHash],
    );
    if (!rows[0]) throw new Error("Failed to create password reset OTP");
    return rows[0].id;
  });
}

export function invalidatePasswordResetOtp(id: string): Promise<unknown[]> {
  return query(
    `UPDATE tbl_password_reset_otps
     SET otp_used_at = COALESCE(otp_used_at, now())
     WHERE id = $1`,
    [id],
  );
}

export async function verifyPasswordResetOtp(input: {
  email: string;
  otpHash: string;
  resetTokenHash: string;
  resetTokenExpiresAt: Date;
}): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `
    UPDATE tbl_password_reset_otps otp
    SET otp_used_at = now(),
        reset_token_hash = $3,
        reset_token_expires_at = $4
    FROM tbl_users users
    WHERE otp.user_id = users.id
      AND users.email = $1
      AND otp.otp_hash = $2
      AND otp.expires_at > now()
      AND otp.otp_used_at IS NULL
      AND otp.password_reset_at IS NULL
    RETURNING otp.id
    `,
    [input.email, input.otpHash, input.resetTokenHash, input.resetTokenExpiresAt],
  );
  return Boolean(row);
}

export async function consumePasswordResetToken(
  resetTokenHash: string,
  passwordHash: string,
): Promise<boolean> {
  return withTransaction(async (run) => {
    const rows = await run<{ id: string; user_id: string }>(
      `
      SELECT id, user_id
      FROM tbl_password_reset_otps
      WHERE reset_token_hash = $1
        AND reset_token_expires_at > now()
        AND otp_used_at IS NOT NULL
        AND password_reset_at IS NULL
      FOR UPDATE
      `,
      [resetTokenHash],
    );
    const reset = rows[0];
    if (!reset) return false;

    const users = await run<{ id: string }>(
      `UPDATE tbl_users SET password_hash = $2 WHERE id = $1 RETURNING id`,
      [reset.user_id, passwordHash],
    );
    if (!users[0]) return false;

    await run(
      `
      UPDATE tbl_password_reset_otps
      SET otp_used_at = COALESCE(otp_used_at, now()),
          password_reset_at = CASE WHEN id = $2 THEN now() ELSE password_reset_at END,
          reset_token_hash = NULL,
          reset_token_expires_at = NULL
      WHERE user_id = $1 AND password_reset_at IS NULL
      `,
      [reset.user_id, reset.id],
    );
    return true;
  });
}
