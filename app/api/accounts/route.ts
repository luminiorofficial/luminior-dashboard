import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/userSession";
import { getAccessibleAccounts, toSafeAccount } from "@/lib/data";

export async function GET() {
  try {
    const session = await requireSession();
    const accounts = await getAccessibleAccounts(session);
    return NextResponse.json(accounts.map(toSafeAccount));
  } catch (error) {
    return errorResponse(error);
  }
}
