import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { encryptString } from "@/lib/crypto";
import { getAiProvider, isOauthConfigured } from "@/lib/ai-providers";
import { env } from "@/lib/env";
import { isFeatureOauthAdvancedEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: { provider: string } }
) {
  if (!isFeatureOauthAdvancedEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providerId = String(context.params.provider || "");
  const provider = getAiProvider(providerId);
  if (!provider || !provider.oauth || !isOauthConfigured(provider.oauth)) {
    return NextResponse.json({ error: "OAuth not configured for provider" }, { status: 400 });
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: userError?.message || "Invalid user" }, { status: 401 });
  }

  const redirectBase = env.supabaseUrl ? process.env.NEXT_PUBLIC_APP_URL || "" : "";
  if (!redirectBase) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 400 });
  }

  const redirectUri = `${redirectBase}/api/oauth/${provider.id}/callback`;
  const statePayload = encryptString(
    JSON.stringify({
      userId: userData.user.id,
      provider: provider.id,
      redirect: request.nextUrl.searchParams.get("redirect") || "/app/settings"
    })
  );

  const authUrl = new URL(provider.oauth.authorizeUrl);
  authUrl.searchParams.set("client_id", provider.oauth.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  if (provider.oauth.scopes) {
    authUrl.searchParams.set("scope", provider.oauth.scopes);
  }
  authUrl.searchParams.set("state", statePayload);

  if (request.nextUrl.searchParams.get("format") === "json") {
    return NextResponse.json({ url: authUrl.toString() });
  }

  return NextResponse.redirect(authUrl);
}
