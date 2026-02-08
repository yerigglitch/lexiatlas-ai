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

  const supabase = createServiceSupabase();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("rag_settings")
      .eq("user_id", authContext.userId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ settings: data?.rag_settings || null });
  }

  if (req.method === "POST") {
    const { settings } = req.body || {};
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: authContext.userId,
      tenant_id: authContext.tenantId,
      rag_settings: settings,
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
