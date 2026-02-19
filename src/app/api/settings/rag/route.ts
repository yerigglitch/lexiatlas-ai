import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { requireAuth } from "@/lib/api-http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { authContext, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("rag_settings")
    .eq("user_id", authContext.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data?.rag_settings || null });
}

export async function POST(request: NextRequest) {
  const { authContext, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { settings } = (await request.json()) as { settings?: unknown };
  const supabase = createServiceSupabase();
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: authContext.userId,
    tenant_id: authContext.tenantId,
    rag_settings: settings || null,
    updated_at: new Date().toISOString()
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
