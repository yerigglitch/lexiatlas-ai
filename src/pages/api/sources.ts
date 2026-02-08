import type { NextApiRequest, NextApiResponse } from "next";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContextFromToken } from "@/lib/auth-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const authContext = await getAuthContextFromToken(token);

  if (!authContext) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "PATCH") {
    const { id, title } = req.body || {};
    if (!id || !title) {
      return res.status(400).json({ error: "Missing id or title" });
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
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ source: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query as { id?: string };
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("sources")
      .select("storage_path")
      .eq("id", id)
      .eq("tenant_id", authContext.tenantId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Source not found" });
    }

    await supabase.storage.from("sources").remove([data.storage_path]);
    await supabase.from("sources").delete().eq("id", id);

    return res.status(200).json({ ok: true });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("sources")
    .select("id, title, source_type, status, created_at")
    .eq("tenant_id", authContext.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ sources: data || [] });
}
