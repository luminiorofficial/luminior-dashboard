import { NextResponse } from "next/server";
import { createAuthUser } from "@/lib/auth-db";

export async function POST(request: Request) {
  try {
    const { fullName, email, password } = await request.json();
    const id = await createAuthUser({ email, password, fullName });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
