export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  mistralDefaultKey: process.env.MISTRAL_DEFAULT_API_KEY || "",
  openaiDefaultKey: process.env.OPENAI_DEFAULT_API_KEY || "",
  appEncryptionKey: process.env.APP_ENCRYPTION_KEY || "",
  pdfConverterUrl: process.env.PDF_CONVERTER_URL || "",
  rssProxyUrl: process.env.RSS_PROXY_URL || "",
};

export function requireEnv(value: string, name: string) {
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}
