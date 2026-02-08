import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContext } from "@/lib/auth-server";
import { encryptString } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("yousign_settings")
    .select("id, environment, legal_name, from_email, encrypted_api_key")
    .eq("tenant_id", authContext.tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data
      ? {
          id: data.id,
          environment: data.environment,
          legal_name: data.legal_name,
          from_email: data.from_email,
          hasKey: Boolean(data.encrypted_api_key)
        }
      : null
  });
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { apiKey, environment, legalName, fromEmail } = body || {};

  const supabase = createServiceSupabase();
  const payload: Record<string, unknown> = {
    tenant_id: authContext.tenantId,
    created_by: authContext.userId,
    environment: environment || "sandbox",
    legal_name: legalName || "LexiAtlas AI",
    from_email: fromEmail || null
  };

  if (apiKey) {
    payload.encrypted_api_key = encryptString(apiKey);
  }

  const { error } = await supabase.from("yousign_settings").upsert(payload, {
    onConflict: "tenant_id"
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
