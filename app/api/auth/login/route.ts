import { NextResponse } from "next/server";
import { verifyAuthUser } from "@/lib/auth-db";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    console.log("[LOGIN] Attempting login for:", email);
    
    const user = await verifyAuthUser(email, password);
    console.log("[LOGIN] Auth result:", user ? "success" : "failed");

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[LOGIN] Error:", message);
    return NextResponse.json({ error: `Authentication failed: ${message}` }, { status: 500 });
  }
}
