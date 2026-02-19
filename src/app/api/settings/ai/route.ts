import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAiProviders, isOauthConfigured } from "@/lib/ai-providers";
import { getUserApiKeyProviders } from "@/lib/api-keys";
import { getUserOauthStatus } from "@/lib/oauth-tokens";
import { isFeatureOauthAdvancedEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const supabase = createServiceSupabase();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message || "Invalid user" },
        { status: 401 }
      );
    }

    const { data: prefs, error: prefsError } = await supabase
      .from("user_preferences")
      .select("rag_settings")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (prefsError) {
      return NextResponse.json({ error: prefsError.message }, { status: 500 });
    }

    const providers = getAiProviders();
    const userKeyProviders = await getUserApiKeyProviders(userData.user.id);
    const oauthFeatureEnabled = isFeatureOauthAdvancedEnabled();

    const providerStatuses = await Promise.all(
      providers.map(async (provider) => {
        const oauthConnected = await getUserOauthStatus(userData.user.id, provider.id);
        return {
          id: provider.id,
          label: provider.label,
          type: provider.type,
          defaultBaseUrl: provider.defaultBaseUrl || "",
          defaultChatModel: provider.defaultChatModel || "",
          defaultEmbeddingModel: provider.defaultEmbeddingModel || "",
          serverKeyAvailable: Boolean(provider.envServerKey),
          oauthConfigured: oauthFeatureEnabled && isOauthConfigured(provider.oauth),
          oauthConnected: oauthFeatureEnabled ? oauthConnected : false,
          apiKeyStored: userKeyProviders.includes(provider.id)
        };
      })
    );

    return NextResponse.json({
      settings: prefs?.rag_settings || null,
      providers: providerStatuses
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
