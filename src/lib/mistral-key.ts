import { createServiceSupabase } from "@/lib/supabase-server";
import { decryptString } from "@/lib/crypto";

export async function getUserMistralKey(userId: string) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  try {
    return decryptString(data.encrypted_key);
  } catch {
    return null;
  }
}
