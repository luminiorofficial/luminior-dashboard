import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/db/users";
import { accountEmailSchema, accountPasswordSchema } from "@/lib/auth-validation";

const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: accountEmailSchema,
  password: accountPasswordSchema,
  // The code from a company's "?ref=" invite link. Omitted only for the very
  // first account ever created (registerUser bootstraps that one to superadmin).
  ref: z.string().trim().max(24).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { id } = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      refCode: parsed.data.ref ?? null,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
