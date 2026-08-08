import { NextResponse } from "next/server";
import { execProcOne } from "@/lib/db";

export async function GET() {
  try {
    console.log("[DEBUG] Testing database connection...");
    const result = await execProcOne("sp_GetUserByEmail", { Email: "test@example.com" });
    console.log("[DEBUG] Database connection successful. Result:", result);
    return NextResponse.json({
      status: "ok",
      message: "Database connection working",
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[DEBUG] Database connection failed:", message);
    return NextResponse.json(
      {
        status: "error",
        message: `Database connection failed: ${message}`,
      },
      { status: 500 },
    );
  }
}
