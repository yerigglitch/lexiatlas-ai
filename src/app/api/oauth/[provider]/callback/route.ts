import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { decryptString, encryptString } from "@/lib/crypto";
import { getAiProvider, isOauthConfigured } from "@/lib/ai-providers";
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

  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  let statePayload: { userId: string; provider: string; redirect: string } | null = null;
  try {
    statePayload = JSON.parse(decryptString(state));
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  if (!statePayload || statePayload.provider !== provider.id) {
    return NextResponse.json({ error: "Invalid state provider" }, { status: 400 });
  }

  const tokenResponse = await fetch(provider.oauth.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: provider.oauth.clientId,
      client_secret: provider.oauth.clientSecret,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/${provider.id}/callback`
    })
  });

  if (!tokenResponse.ok) {
    const message = await tokenResponse.text();
    return NextResponse.json({ error: message || "OAuth token exchange failed" }, { status: 400 });
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokenPayload.access_token) {
    return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
  }

  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
    : null;

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("user_oauth_tokens").upsert({
    user_id: statePayload.userId,
    provider: provider.id,
    encrypted_access_token: encryptString(tokenPayload.access_token),
    encrypted_refresh_token: tokenPayload.refresh_token
      ? encryptString(tokenPayload.refresh_token)
      : null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString()
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const redirect = statePayload.redirect || "/app/settings";
  return NextResponse.redirect(new URL(`${redirect}?oauth=connected&provider=${provider.id}`, request.nextUrl.origin));
}
