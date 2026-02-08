import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yousignRequestId = body?.data?.id || body?.id;
    const status = body?.data?.status || body?.status;

    if (!yousignRequestId || !status) {
      return NextResponse.json({ error: "Missing webhook payload" }, { status: 400 });
    }

    const supabase = createServiceSupabase();
    await supabase
      .from("signature_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("yousign_request_id", yousignRequestId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
