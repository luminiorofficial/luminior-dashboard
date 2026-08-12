import { NextResponse } from "next/server";
import { z } from "zod";
import { accountEmailSchema } from "@/lib/auth-validation";
import {
  checkAndRecordPasswordResetRateLimit,
  verifyPasswordResetOtp,
} from "@/lib/db/password-resets";
import {
  RESET_COOKIE_NAME,
  RESET_SESSION_TTL_SECONDS,
  generateResetToken,
  getClientIp,
  hashIdentifier,
  hashIp,
  hashOtp,
  resetCookieOptions,
  secureHash,
} from "@/lib/password-reset/security";

export const runtime = "nodejs";

const verifySchema = z.object({
  email: accountEmailSchema,
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const identifierHash = hashIdentifier(parsed.data.email);
    const ipHash = hashIp(getClientIp(request));
    const rate = await checkAndRecordPasswordResetRateLimit({
      action: "verify",
      identifierHash,
      ipHash,
      identifierLimit: 10,
      ipLimit: 40,
      windowSeconds: 15 * 60,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please request a new OTP later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const resetToken = generateResetToken();
    const verified = await verifyPasswordResetOtp({
      email: parsed.data.email,
      otpHash: hashOtp(parsed.data.email, parsed.data.otp),
      resetTokenHash: secureHash(resetToken),
      resetTokenExpiresAt: new Date(
        Date.now() + RESET_SESSION_TTL_SECONDS * 1000,
      ),
    });
    if (!verified) {
      return NextResponse.json(
        { error: "The OTP is invalid, expired, or has already been used." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(RESET_COOKIE_NAME, resetToken, resetCookieOptions);
    return response;
  } catch {
    console.error("Password reset OTP verification failed");
    return NextResponse.json(
      { error: "We could not verify the OTP. Please try again." },
      { status: 500 },
    );
  }
}
