import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-server";
import { isEmailV2Enabled } from "./feature";

export async function requireEmailV2Auth(request: NextRequest) {
  if (!isEmailV2Enabled()) {
    return { errorResponse: NextResponse.json({ error: "Email v2 disabled" }, { status: 404 }) };
  }
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { authContext };
}

export function asApiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 400 });
}
