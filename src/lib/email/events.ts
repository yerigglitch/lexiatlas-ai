import type { AuthContext } from "@/lib/auth-server";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function listEmailEvents(
  auth: AuthContext,
  filters: {
    status?: string | null;
    recipient?: string | null;
    draftId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    page?: number;
    pageSize?: number;
  }
) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 20)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createServiceSupabase();
  let query = supabase
    .from("email_send_events")
    .select("*, email_drafts(title, subject)", { count: "exact" })
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.recipient) {
    query = query.ilike("recipient_email", `%${filters.recipient}%`);
  }
  if (filters.draftId) {
    query = query.eq("draft_id", filters.draftId);
  }
  if (filters.fromDate) {
    query = query.gte("created_at", filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte("created_at", filters.toDate);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);
  return {
    events: data || [],
    total: count || 0,
    page,
    pageSize
  };
}
