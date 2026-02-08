import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContext } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("tenant_id", authContext.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data });
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null) || file?.name || "Modèle";

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const storagePath = `${authContext.tenantId}/templates/${Date.now()}-${file.name}`;

  const uploadResult = await supabase.storage
    .from("templates")
    .upload(storagePath, file, { upsert: false });

  if (uploadResult.error) {
    return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("templates")
    .insert({
      tenant_id: authContext.tenantId,
      created_by: authContext.userId,
      title,
      storage_path: storagePath
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
