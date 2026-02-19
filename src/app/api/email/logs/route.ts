import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { listEmailEvents } from "@/lib/email/events";
import { isEmailV2Enabled } from "@/lib/email/feature";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "20");

  // Deprecated compatibility endpoint.
  if (!isEmailV2Enabled()) {
    const supabase = createServiceSupabase();
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;
    let query = supabase
      .from("email_logs")
      .select("*", { count: "exact" })
      .eq("tenant_id", authContext.tenantId)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (q) {
      query = query.ilike("to_email", `%${q}%`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [], total: count || 0 });
  }

  try {
    const result = await listEmailEvents(authContext, {
      status,
      recipient: q,
      page,
      pageSize
    });

    const logs = result.events.map((event: Record<string, unknown>) => ({
      id: event.id,
      to_email: event.recipient_email,
      subject:
        ((event.email_drafts as Record<string, unknown> | null)?.subject as string | undefined) || "",
      status: event.status,
      error: event.error || null,
      created_at: event.created_at
    }));
    return NextResponse.json({ logs, total: result.total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
