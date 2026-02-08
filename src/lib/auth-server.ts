import { NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";

export type AuthContext = {
  userId: string;
  tenantId: string;
};

export async function getAuthContextFromToken(token: string | null) {
  if (!token) return null;

  const supabase = createServiceSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    userId: userData.user.id,
    tenantId: profile.tenant_id as string
  } satisfies AuthContext;
}

export async function getAuthContext(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return getAuthContextFromToken(token || null);
}
