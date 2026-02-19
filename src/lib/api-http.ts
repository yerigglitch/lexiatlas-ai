import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/auth-server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuth(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return { authContext: null as AuthContext | null, errorResponse: jsonError("Unauthorized", 401) };
  }
  return { authContext, errorResponse: null as NextResponse | null };
}
