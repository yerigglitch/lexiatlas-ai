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
    .from("sources")
    .select("id, title, source_type, status, created_at")
    .eq("tenant_id", authContext.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sources: data || [] });
}

export async function PATCH(request: NextRequest) {
  const { authContext, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, title } = (await request.json()) as { id?: string; title?: string };
  if (!id || !title) {
    return NextResponse.json({ error: "Missing id or title" }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("sources")
    .update({ title })
    .eq("id", id)
    .eq("tenant_id", authContext.tenantId)
    .select("id, title")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ source: data });
}

export async function DELETE(request: NextRequest) {
  const { authContext, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("sources")
    .select("storage_path")
    .eq("id", id)
    .eq("tenant_id", authContext.tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  await supabase.storage.from("sources").remove([data.storage_path]);
  await supabase.from("sources").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
