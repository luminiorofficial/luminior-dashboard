import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { accountPasswordSchema } from "@/lib/auth-validation";
import {
  checkAndRecordPasswordResetRateLimit,
  consumePasswordResetToken,
} from "@/lib/db/password-resets";
import {
  RESET_COOKIE_NAME,
  getClientIp,
  hashIp,
  resetCookieOptions,
  secureHash,
} from "@/lib/password-reset/security";

export const runtime = "nodejs";

const resetSchema = z
  .object({
    newPassword: accountPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function expireResetCookie(response: NextResponse) {
  response.cookies.set(RESET_COOKIE_NAME, "", {
    ...resetCookieOptions,
    maxAge: 0,
  });
  return response;
}

export async function POST(request: NextRequest) {
  const resetToken = request.cookies.get(RESET_COOKIE_NAME)?.value;

  if (!resetToken) {
    return expireResetCookie(
      NextResponse.json(
        { error: "Your reset session is invalid or expired. Request a new OTP." },
        { status: 400 },
      ),
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const resetTokenHash = secureHash(resetToken);
    const rate = await checkAndRecordPasswordResetRateLimit({
      action: "reset",
      identifierHash: resetTokenHash,
      ipHash: hashIp(getClientIp(request)),
      identifierLimit: 5,
      ipLimit: 20,
      windowSeconds: 15 * 60,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many reset attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const updated = await consumePasswordResetToken(resetTokenHash, passwordHash);
    if (!updated) {
      return expireResetCookie(
        NextResponse.json(
          { error: "Your reset session is invalid or expired. Request a new OTP." },
          { status: 400 },
        ),
      );
    }

    return expireResetCookie(
      NextResponse.json(
        { message: "Password updated successfully. Please login with your new password." },
        { headers: { "Cache-Control": "no-store" } },
      ),
    );
  } catch {
    console.error("Password reset failed");
    return NextResponse.json(
      { error: "We could not update your password. Please try again." },
      { status: 500 },
    );
  }
}
