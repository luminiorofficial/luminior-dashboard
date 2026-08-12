import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";

export const OTP_TTL_SECONDS = 10 * 60;
export const RESET_SESSION_TTL_SECONDS = 10 * 60;
export const RESET_COOKIE_NAME = "luminior_password_reset";

function resetSecret(): string {
  const secret = process.env.PASSWORD_RESET_SECRET ?? process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "PASSWORD_RESET_SECRET (or AUTH_SECRET) must contain at least 32 characters",
    );
  }
  return secret;
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function secureHash(value: string): string {
  return createHmac("sha256", resetSecret()).update(value).digest("hex");
}

export function hashOtp(email: string, otp: string): string {
  return secureHash(`otp:${normalizeEmail(email)}:${otp}`);
}

export function hashIdentifier(email: string): string {
  return secureHash(`email:${normalizeEmail(email)}`);
}

export function hashIp(ip: string): string {
  return secureHash(`ip:${ip}`);
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwarded ||
    "unknown"
  ).slice(0, 128);
}

export const resetCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: RESET_SESSION_TTL_SECONDS,
};
