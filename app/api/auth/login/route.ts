import { NextResponse } from "next/server";
import { verifyAuthUser } from "@/lib/auth-db";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await verifyAuthUser(email, password);

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
