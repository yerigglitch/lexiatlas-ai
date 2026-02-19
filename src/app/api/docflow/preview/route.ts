import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { chatComplete, Provider } from "@/lib/llm";
import { getUserApiKey } from "@/lib/api-keys";
import { getAiProvider } from "@/lib/ai-providers";
import { getUserOauthToken } from "@/lib/oauth-tokens";
import { isFeatureDocflowEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are a legal formatting assistant. " +
  "Task: classify the input text as NOTE or COURRIER, then structure it into Markdown, and propose a document style. " +
  "Critical rule: do NOT rewrite, paraphrase, summarize, or add words. " +
  "You may only reorganize with headings/lists/paragraph breaks and preserve original wording. " +
  "Return strict JSON only with keys: doc_type, markdown, style. " +
  "style is an object with optional keys: title, author, font_size_pt, margin_cm, line_spacing.";

function parseJsonPayload(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(fenced);
  }
}

export async function POST(request: NextRequest) {
  if (!isFeatureDocflowEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawText = String(body?.rawText || "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "Missing rawText" }, { status: 400 });
    }

    const supabase = createServiceSupabase();
    const { data: prefs, error: prefsError } = await supabase
      .from("user_preferences")
      .select("rag_settings")
      .eq("user_id", authContext.userId)
      .maybeSingle();
    if (prefsError) {
      return NextResponse.json({ error: prefsError.message }, { status: 500 });
    }

    const settings = (prefs?.rag_settings || {}) as Record<string, string>;
    const provider = ((settings.chatProvider || settings.provider || "mistral") as Provider);
    const model =
      settings.chatModel ||
      settings.model ||
      (provider === "openai" ? "gpt-4o-mini" : "mistral-small-latest");
    const authMode = settings.chatAuthMode || settings.authMode || "api_key";
    const providerConfig = getAiProvider(provider);
    if (!providerConfig) {
      return NextResponse.json({ error: "Invalid provider configuration" }, { status: 400 });
    }

    const baseUrl = settings.chatBaseUrl || settings.baseUrl || providerConfig.defaultBaseUrl || undefined;
    const storedKey = provider !== "custom" ? await getUserApiKey(authContext.userId, provider) : null;
    const oauthToken =
      authMode === "oauth" ? await getUserOauthToken(authContext.userId, provider) : null;
    const apiKey =
      provider === "custom"
        ? ""
        : authMode === "server"
          ? providerConfig.envServerKey || ""
          : authMode === "oauth"
            ? oauthToken || ""
            : storedKey || providerConfig.envServerKey || "";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing chat API key in your backoffice settings." },
        { status: 400 }
      );
    }

    const output = await chatComplete(provider, apiKey, {
      model,
      baseUrl,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Input text follows. Return JSON only.\n\n${rawText}` }
      ]
    });

    const payload = parseJsonPayload(output);
    const docType = String(payload?.doc_type || "").toUpperCase();
    const markdown = String(payload?.markdown || "").trim();
    const style = payload?.style && typeof payload.style === "object" ? payload.style : {};

    if (!["NOTE", "COURRIER"].includes(docType)) {
      return NextResponse.json({ error: "Invalid doc_type returned by model" }, { status: 400 });
    }
    if (!markdown) {
      return NextResponse.json({ error: "Model returned empty markdown" }, { status: 400 });
    }

    return NextResponse.json({
      docType,
      markdown,
      style,
      provider,
      model
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
