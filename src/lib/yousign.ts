import { decryptString } from "@/lib/crypto";
import { createServiceSupabase } from "@/lib/supabase-server";

export type YousignSettings = {
  environment: "sandbox" | "production";
  apiKey: string | null;
  legalName: string | null;
  fromEmail: string | null;
};

export async function getYousignSettings(tenantId: string) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("yousign_settings")
    .select("environment, encrypted_api_key, legal_name, from_email")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;

  const apiKey = data.encrypted_api_key
    ? (() => {
        try {
          return decryptString(data.encrypted_api_key);
        } catch {
          return null;
        }
      })()
    : null;

  return {
    environment: (data.environment || "sandbox") as "sandbox" | "production",
    apiKey,
    legalName: data.legal_name || null,
    fromEmail: data.from_email || null
  } satisfies YousignSettings;
}

export function getYousignBaseUrl(_environment: "sandbox" | "production") {
  return null;
}

export async function createQualifiedSignatureRequest(_settings: YousignSettings) {
  throw new Error("Yousign API integration pending. Add API key and wire endpoints.");
}
