import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { Provider } from "@/lib/llm";
import { getAuthContext } from "@/lib/auth-server";
import { getUserApiKey } from "@/lib/api-keys";
import { getAiProvider } from "@/lib/ai-providers";
import { getUserOauthToken } from "@/lib/oauth-tokens";
import { mapProviderError } from "@/lib/ai-errors";
import { embedTextsBatched } from "@/lib/embed-batch";
import { createSimplePdf } from "@/lib/pdf";
import { chunkText } from "@/lib/text-extract";

export const runtime = "nodejs";

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, title } = (await request.json()) as { url?: string; title?: string };
  if (!url || !authContext.tenantId) {
    return NextResponse.json({ error: "Missing url or tenantId" }, { status: 400 });
  }

  const provider = (request.headers.get("x-embedding-provider") || request.headers.get("x-provider") || "mistral") as Provider;
  const authMode = request.headers.get("x-embedding-auth-mode") || request.headers.get("x-auth-mode") || "api_key";
  const headerKey = request.headers.get("x-api-key") || "";
  const headerBaseUrl = request.headers.get("x-embedding-base-url") || request.headers.get("x-base-url") || "";
  const embeddingModel = request.headers.get("x-embedding-model") || "";
  const providerConfig = getAiProvider(provider);
  if (!providerConfig) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  const resolvedBaseUrl = headerBaseUrl || providerConfig.defaultBaseUrl || "";
  const resolvedEmbeddingModel =
    embeddingModel ||
    providerConfig.defaultEmbeddingModel ||
    (provider === "openai" ? "text-embedding-3-small" : "");
  const storedKey = authContext.userId && provider !== "custom"
    ? await getUserApiKey(authContext.userId, provider)
    : null;
  const serverKey = providerConfig.envServerKey || "";
  const oauthToken = authContext.userId && authMode === "oauth"
    ? await getUserOauthToken(authContext.userId, provider)
    : null;
  const apiKey =
    provider === "custom"
      ? headerKey
      : authMode === "server"
        ? serverKey
        : authMode === "oauth"
          ? oauthToken || ""
          : headerKey || storedKey;

  const providerNeedsBaseUrl =
    providerConfig.type === "openai_compat" ||
    providerConfig.type === "google_gemini" ||
    providerConfig.type === "cohere";
  if (providerNeedsBaseUrl && !resolvedBaseUrl) {
    return NextResponse.json({ error: "Missing provider baseUrl" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 400 });
  }
  if (!resolvedEmbeddingModel) {
    return NextResponse.json(
      {
        error:
          "Ce fournisseur ne fournit pas de modèle embeddings par défaut. Choisissez un autre fournisseur d'embeddings ou renseignez un modèle."
      },
      { status: 400 }
    );
  }

  const fetchRes = await fetch(url);
  if (!fetchRes.ok) {
    return NextResponse.json({ error: "URL non accessible" }, { status: 400 });
  }

  const html = await fetchRes.text();
  const text = stripHtml(html);
  if (!text) {
    return NextResponse.json({ error: "Contenu vide" }, { status: 400 });
  }

  const pdfBytes = await createSimplePdf(title || "Source web", text.slice(0, 100000));
  const supabase = createServiceSupabase();
  const filename = safeName(title || "source-web") || "source-web";
  const storagePath = `${authContext.tenantId}/${Date.now()}-${filename}.pdf`;

  const uploadResult = await supabase.storage
    .from("sources")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
  if (uploadResult.error) {
    return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
  }

  const sourceInsert = await supabase
    .from("sources")
    .insert({
      tenant_id: authContext.tenantId,
      created_by: authContext.userId,
      title: title || url,
      source_type: "url",
      storage_path: storagePath,
      status: "processing"
    })
    .select("id")
    .single();

  if (sourceInsert.error || !sourceInsert.data) {
    return NextResponse.json(
      { error: sourceInsert.error?.message || "Source insert failed" },
      { status: 500 }
    );
  }

  const chunks = chunkText(text, { maxChars: 1200, overlapChars: 200 });
  let embeddings: number[][] = [];
  try {
    const batchSize = provider === "cohere" ? 96 : provider === "mistral" ? 24 : 128;
    const maxChars = provider === "mistral" ? 12000 : undefined;
    embeddings = await embedTextsBatched(
      provider,
      apiKey,
      chunks,
      {
        baseUrl: resolvedBaseUrl || undefined,
        model: resolvedEmbeddingModel || undefined,
        inputType: "search_document"
      },
      batchSize,
      maxChars
    );
  } catch (error) {
    const mapped = mapProviderError(error, provider);
    return NextResponse.json({ error: mapped.userMessage }, { status: mapped.status });
  }

  if (embeddings.some((vec) => vec.length !== 1024)) {
    return NextResponse.json({ error: "Embedding dimension mismatch. Expected 1024." }, { status: 400 });
  }

  const rows = chunks.map((content, index) => ({
    source_id: sourceInsert.data.id,
    tenant_id: authContext.tenantId,
    content,
    embedding: embeddings[index],
    token_count: Math.ceil(content.length / 4)
  }));
  const chunkInsert = await supabase.from("source_chunks").insert(rows);
  if (chunkInsert.error) {
    return NextResponse.json({ error: chunkInsert.error.message }, { status: 500 });
  }

  await supabase.from("sources").update({ status: "ready" }).eq("id", sourceInsert.data.id);
  return NextResponse.json({ ok: true, sourceId: sourceInsert.data.id });
}
