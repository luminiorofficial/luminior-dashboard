import { z } from "zod";

const PLACEHOLDER_DOMAINS = new Set(["example.com", "example.net", "example.org"]);

export const accountEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(255)
  .refine(
    (email) => !PLACEHOLDER_DOMAINS.has(email.split("@")[1] ?? ""),
    "Use a real email address, not a placeholder domain",
  );

// Kept in one place so registration, admin-created accounts, and password
// resets cannot drift onto different password policies.
export const accountPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");
