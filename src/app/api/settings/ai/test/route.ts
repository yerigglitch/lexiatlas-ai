import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAiProvider } from "@/lib/ai-providers";
import { getUserApiKey } from "@/lib/api-keys";
import { getUserOauthToken } from "@/lib/oauth-tokens";
import { chatComplete, embedTexts, Provider } from "@/lib/llm";
import { mapProviderError } from "@/lib/ai-errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as {
      kind: "chat" | "embedding";
      provider: Provider;
      authMode: "api_key" | "oauth" | "server";
      baseUrl?: string;
      model?: string;
    };

    if (!body?.kind || !body?.provider) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const providerConfig = getAiProvider(body.provider);
    if (!providerConfig) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const resolvedBaseUrl = body.baseUrl || providerConfig.defaultBaseUrl || "";
    const resolvedModel = body.model ||
      (body.kind === "embedding"
        ? providerConfig.defaultEmbeddingModel
        : providerConfig.defaultChatModel) ||
      (body.provider === "openai"
        ? body.kind === "embedding"
          ? "text-embedding-3-small"
          : "gpt-4o-mini"
        : "");

    const userId = userData.user.id;
    const storedKey = body.authMode === "api_key"
      ? await getUserApiKey(userId, body.provider)
      : null;
    const oauthToken = body.authMode === "oauth"
      ? await getUserOauthToken(userId, body.provider)
      : null;
    const serverKey = providerConfig.envServerKey || "";

    const apiKey =
      body.authMode === "server"
        ? serverKey
        : body.authMode === "oauth"
          ? oauthToken || ""
          : storedKey || "";

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }

    const needsBaseUrl =
      providerConfig.type === "openai_compat" || providerConfig.type === "google_gemini";
    if (needsBaseUrl && !resolvedBaseUrl) {
      return NextResponse.json({ error: "Missing baseUrl" }, { status: 400 });
    }

    if (!resolvedModel) {
      return NextResponse.json({ error: "Missing model" }, { status: 400 });
    }

    try {
      if (body.kind === "embedding") {
        await embedTexts(body.provider, apiKey, ["test"], {
          baseUrl: resolvedBaseUrl || undefined,
          model: resolvedModel,
          inputType: "search_query"
        });
      } else {
        await chatComplete(body.provider, apiKey, {
          model: resolvedModel,
          temperature: 0.1,
          baseUrl: resolvedBaseUrl || undefined,
          messages: [
            { role: "system", content: "You are a test" },
            { role: "user", content: "Say OK" }
          ]
        });
      }
    } catch (error) {
      const mapped = mapProviderError(error, body.provider);
      return NextResponse.json({ error: mapped.userMessage }, { status: mapped.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
