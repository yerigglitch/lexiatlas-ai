import { createServiceSupabase } from "@/lib/supabase-server";
import { decryptString } from "@/lib/crypto";
import type { AiProviderId } from "@/lib/ai-providers";

export async function getUserOauthToken(userId: string, provider: AiProviderId) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("user_oauth_tokens")
    .select("encrypted_access_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) return null;

  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return null;
    }
  }

  try {
    return decryptString(data.encrypted_access_token);
  } catch {
    return null;
  }
}

export async function getUserOauthStatus(userId: string, provider: AiProviderId) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("user_oauth_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}
