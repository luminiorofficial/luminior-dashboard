import { NextResponse } from "next/server";
import { z } from "zod";
import { accountEmailSchema } from "@/lib/auth-validation";
import { getUserByEmail } from "@/lib/db/users";
import {
  checkAndRecordPasswordResetRateLimit,
  createPasswordResetOtp,
  invalidatePasswordResetOtp,
} from "@/lib/db/password-resets";
import { sendPasswordResetOtp } from "@/lib/email/password-reset";
import {
  OTP_TTL_SECONDS,
  generateOtp,
  getClientIp,
  hashIdentifier,
  hashIp,
  hashOtp,
} from "@/lib/password-reset/security";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "If an account exists with this email, we have sent a password reset OTP.";
const requestSchema = z.object({ email: accountEmailSchema });

function genericResponse() {
  return NextResponse.json(
    { message: GENERIC_MESSAGE },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" },
      { status: 400 },
    );
  }

  const email = parsed.data.email;
  try {
    const ipHash = hashIp(getClientIp(request));
    const identifierHash = hashIdentifier(email);
    const rate = await checkAndRecordPasswordResetRateLimit({
      action: "request",
      identifierHash,
      ipHash,
      identifierLimit: 5,
      ipLimit: 20,
      windowSeconds: 15 * 60,
      cooldownSeconds: 60,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before requesting another OTP." },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rate.retryAfterSeconds),
          },
        },
      );
    }

    const user = await getUserByEmail(email);
    if (!user) return genericResponse();

    const otp = generateOtp();
    const resetId = await createPasswordResetOtp({
      userId: user.id,
      otpHash: hashOtp(email, otp),
      expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      requestedIpHash: ipHash,
    });

    try {
      await sendPasswordResetOtp(user.email, otp);
    } catch {
      await invalidatePasswordResetOtp(resetId).catch(() => undefined);
      // Do not log the email, OTP, SMTP credentials, or provider response.
      console.error("Password reset email delivery failed");
    }
  } catch {
    // Keep operational failures indistinguishable from an unknown email.
    console.error("Password reset request failed");
  }

  return genericResponse();
}
