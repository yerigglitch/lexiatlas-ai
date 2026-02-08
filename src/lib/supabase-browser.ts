import { createClient } from "@supabase/supabase-js";
import { env, requireEnv } from "./env";

export function createBrowserSupabase() {
  return createClient(
    requireEnv(env.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(env.supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
