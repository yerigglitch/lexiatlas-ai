import { createServiceSupabase } from "@/lib/supabase-server";
import { decryptString } from "@/lib/crypto";

export const API_KEY_PROVIDERS = [
  "mistral",
  "openai",
  "gemini",
  "cohere",
  "groq",
  "custom",
  "anthropic",
  "kimi",
  "grok",
  "zai",
  "deepseek",
  "meta"
] as const;
export type ApiKeyProvider = (typeof API_KEY_PROVIDERS)[number];

export function isApiKeyProvider(value: string): value is ApiKeyProvider {
  return (API_KEY_PROVIDERS as readonly string[]).includes(value);
}

export async function getUserApiKey(userId: string, provider: ApiKeyProvider) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) return null;

  try {
    return decryptString(data.encrypted_key);
  } catch {
    return null;
  }
}

export async function getUserApiKeyProviders(userId: string) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", userId);

  if (error || !data) return [] as ApiKeyProvider[];

  return data
    .map((row) => row.provider)
    .filter((provider): provider is ApiKeyProvider => isApiKeyProvider(provider));
}
