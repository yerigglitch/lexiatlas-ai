import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { extractTextFromBuffer, chunkText, normalizeToMarkdown } from "@/lib/text-extract";
import { extractTextWithOcr } from "@/lib/ocr";
import { Provider } from "@/lib/llm";
import { getAuthContext } from "@/lib/auth-server";
import { getUserApiKey } from "@/lib/api-keys";
import { getAiProvider } from "@/lib/ai-providers";
import { getUserOauthToken } from "@/lib/oauth-tokens";
import { mapProviderError } from "@/lib/ai-errors";
import { embedTextsBatched } from "@/lib/embed-batch";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const title = String(formData.get("title") || file.name || "Source");
  const originalName = file.name || "source";
  const tenantId = String(formData.get("tenantId") || authContext.tenantId || "");
  const userId = String(formData.get("userId") || authContext.userId || "");

  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
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
  const storedKey = userId && provider !== "custom" ? await getUserApiKey(userId, provider) : null;
  const serverKey = providerConfig.envServerKey || "";
  const oauthToken = userId && authMode === "oauth" ? await getUserOauthToken(userId, provider) : null;
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

  const supabase = createServiceSupabase();
  const safeName = originalName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const storagePath = `${tenantId}/${Date.now()}-${safeName || "source"}`;

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const uploadResult = await supabase.storage.from("sources").upload(storagePath, fileBuffer, {
    contentType: file.type || undefined,
    upsert: false
  });
  if (uploadResult.error) {
    return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
  }

  const sourceInsert = await supabase
    .from("sources")
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      title,
      source_type: "upload",
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

  let text = await extractTextFromBuffer(fileBuffer, file.type || "", originalName);
  if (!text.trim() && (file.type === "application/pdf" || originalName.toLowerCase().endsWith(".pdf"))) {
    const ocrUrl = process.env.OCR_SERVICE_URL || "";
    if (ocrUrl) {
      try {
        text = await extractTextWithOcr(fileBuffer, ocrUrl);
      } catch {
        // Ignore and keep original text
      }
    }
  }

  const markdownText = normalizeToMarkdown(text);
  const chunks = chunkText(markdownText || text, { maxChars: 1200, overlapChars: 200 });
  if (!chunks.length) {
    await supabase.from("sources").update({ status: "empty" }).eq("id", sourceInsert.data.id);
    return NextResponse.json({ error: "Document vide ou illisible (OCR requis)." }, { status: 400 });
  }

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
    tenant_id: tenantId,
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
