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
    .from("smtp_settings")
    .select("id, host, port, username, from_name, from_email")
    .eq("tenant_id", authContext.tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data || null });
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { host, port, username, password, fromName, fromEmail } = body || {};

  if (!host || !port || !username || !password) {
    return NextResponse.json({ error: "Missing SMTP fields" }, { status: 400 });
  }

  const encrypted = encryptString(password);
  const supabase = createServiceSupabase();

  const { error } = await supabase.from("smtp_settings").upsert({
    tenant_id: authContext.tenantId,
    created_by: authContext.userId,
    host,
    port,
    username,
    encrypted_password: encrypted,
    from_name: fromName,
    from_email: fromEmail
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
