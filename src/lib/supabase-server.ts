import { createClient } from "@supabase/supabase-js";
import { env, requireEnv } from "./env";

export function createServiceSupabase() {
  return createClient(
    requireEnv(env.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(env.supabaseServiceRoleKey, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false
      }
    }
  );
}
