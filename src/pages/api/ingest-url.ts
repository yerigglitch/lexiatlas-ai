import type { NextApiRequest, NextApiResponse } from "next";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContextFromToken } from "@/lib/auth-server";
import { embedTexts, Provider } from "@/lib/llm";
import { getUserMistralKey } from "@/lib/mistral-key";
import { createSimplePdf } from "@/lib/pdf";
import { chunkText } from "@/lib/text-extract";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const authContext = await getAuthContextFromToken(token);

  const { url, title } = req.body || {};
  if (!url || !authContext?.tenantId) {
    return res.status(400).json({ error: "Missing url or tenantId" });
  }

  const provider = (req.headers["x-provider"] || "mistral") as Provider;
  const keyMode = (req.headers["x-key-mode"] || "user") as string;
  const headerKey = (req.headers["x-api-key"] || "") as string;
  const headerBaseUrl = (req.headers["x-base-url"] || "") as string;
  const embeddingModel = (req.headers["x-embedding-model"] || "") as string;
  const storedKey = authContext.userId && provider === "mistral"
    ? await getUserMistralKey(authContext.userId)
    : null;
  const serverKey = process.env.MISTRAL_DEFAULT_API_KEY || "";
  const apiKey =
    provider === "custom"
      ? headerKey
      : keyMode === "server"
        ? serverKey
        : headerKey || storedKey || serverKey;

  if (provider === "custom" && keyMode !== "custom") {
    return res.status(400).json({ error: "Custom provider requires keyMode=custom" });
  }

  if (provider === "custom" && (!headerBaseUrl || !embeddingModel)) {
    return res.status(400).json({ error: "Missing custom baseUrl or embedding model" });
  }

  if (!apiKey) {
    return res.status(400).json({ error: "Missing API key" });
  }

  const fetchRes = await fetch(url);
  if (!fetchRes.ok) {
    return res.status(400).json({ error: "URL non accessible" });
  }

  const html = await fetchRes.text();
  const text = stripHtml(html);
  if (!text) {
    return res.status(400).json({ error: "Contenu vide" });
  }

  const pdfBytes = await createSimplePdf(title || "Source web", text.slice(0, 100000));

  const supabase = createServiceSupabase();
  const filename = safeName(title || "source-web") || "source-web";
  const storagePath = `${authContext.tenantId}/${Date.now()}-${filename}.pdf`;

  const uploadResult = await supabase.storage
    .from("sources")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });

  if (uploadResult.error) {
    return res.status(500).json({ error: uploadResult.error.message });
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
    return res.status(500).json({ error: sourceInsert.error?.message || "Source insert failed" });
  }

  const chunks = chunkText(text);
  const embeddings = await embedTexts(provider, apiKey, chunks, {
    baseUrl: headerBaseUrl || undefined,
    model: embeddingModel || undefined
  });

  if (embeddings.some((vec) => vec.length !== 1024)) {
    return res.status(400).json({ error: "Embedding dimension mismatch. Expected 1024." });
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
    return res.status(500).json({ error: chunkInsert.error.message });
  }

  await supabase.from("sources").update({ status: "ready" }).eq("id", sourceInsert.data.id);

  return res.status(200).json({ ok: true, sourceId: sourceInsert.data.id });
}
