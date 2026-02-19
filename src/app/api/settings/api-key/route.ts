import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { encryptString } from "@/lib/crypto";
import { getAiProvider } from "@/lib/ai-providers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const provider = request.nextUrl.searchParams.get("provider") || "";
    const providerConfig = getAiProvider(provider);
    if (!providerConfig) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

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

    const { data, error } = await supabase
      .from("user_api_keys")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .eq("provider", provider)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ hasKey: !!data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const { apiKey, provider } = (await request.json()) as {
      apiKey?: string;
      provider?: string;
    };

    const providerConfig = getAiProvider(provider || "");
    if (!providerConfig) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "Missing apiKey" }, { status: 400 });
    }

    const supabase = createServiceSupabase();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message || "Invalid user" },
        { status: 401 }
      );
    }

    const encrypted = encryptString(apiKey);

    const { error } = await supabase.from("user_api_keys").upsert({
      user_id: userData.user.id,
      provider: providerConfig.id,
      encrypted_key: encrypted
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
