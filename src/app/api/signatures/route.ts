import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContext } from "@/lib/auth-server";
import { getYousignSettings } from "@/lib/yousign";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("signature_requests")
    .select("*")
    .eq("tenant_id", authContext.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data || [] });
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { documentId, signerName, signerEmail } = body || {};

  if (!documentId || !signerName || !signerEmail) {
    return NextResponse.json(
      { error: "Missing documentId, signerName or signerEmail" },
      { status: 400 }
    );
  }

  const settings = await getYousignSettings(authContext.tenantId);
  if (!settings || !settings.apiKey) {
    return NextResponse.json(
      { error: "Yousign non configuré" },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("signature_requests")
    .insert({
      tenant_id: authContext.tenantId,
      created_by: authContext.userId,
      document_id: documentId,
      status: "pending_api",
      signer_name: signerName,
      signer_email: signerEmail
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    request: data,
    warning: "Intégration Yousign en attente : branchement API à finaliser."
  });
}
