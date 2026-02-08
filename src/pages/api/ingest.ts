import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs/promises";
import { createServiceSupabase } from "@/lib/supabase-server";
import { extractTextFromBuffer, chunkText } from "@/lib/text-extract";
import { extractTextWithOcr } from "@/lib/ocr";
import { embedTexts, Provider } from "@/lib/llm";
import { getAuthContextFromToken } from "@/lib/auth-server";
import { getUserMistralKey } from "@/lib/mistral-key";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const authContext = await getAuthContextFromToken(token);

  const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
  const { fields, files } = await new Promise<{
    fields: formidable.Fields;
    files: formidable.Files;
  }>((resolve, reject) => {
    form.parse(req, (err, flds, fls) => {
      if (err) reject(err);
      else resolve({ fields: flds, files: fls });
    });
  });

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file || !file.filepath) {
    return res.status(400).json({ error: "Missing file" });
  }

  const title = (fields.title as string) || file.originalFilename || "Source";
  const originalName = file.originalFilename || "source";
  const tenantId = (fields.tenantId as string) || authContext?.tenantId;
  const userId = (fields.userId as string) || authContext?.userId;

  if (!tenantId) {
    return res.status(400).json({ error: "Missing tenantId" });
  }

  const provider = (req.headers["x-provider"] || "mistral") as Provider;
  const keyMode = (req.headers["x-key-mode"] || "user") as string;
  const headerKey = (req.headers["x-api-key"] || "") as string;
  const headerBaseUrl = (req.headers["x-base-url"] || "") as string;
  const embeddingModel = (req.headers["x-embedding-model"] || "") as string;
  const storedKey = userId && provider === "mistral" ? await getUserMistralKey(userId) : null;
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

  const supabase = createServiceSupabase();
  const safeName = originalName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const storagePath = `${tenantId}/${Date.now()}-${safeName || "source"}`;

  const fileBuffer = await fs.readFile(file.filepath);
  const uploadResult = await supabase.storage.from("sources").upload(storagePath, fileBuffer, {
    contentType: file.mimetype || undefined,
    upsert: false
  });

  if (uploadResult.error) {
    return res.status(500).json({ error: uploadResult.error.message });
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
    return res.status(500).json({ error: sourceInsert.error?.message || "Source insert failed" });
  }

  let text = await extractTextFromBuffer(
    fileBuffer,
    file.mimetype || "",
    file.originalFilename || ""
  );
  if (!text.trim() && (file.mimetype === "application/pdf" || file.originalFilename?.toLowerCase().endsWith(".pdf"))) {
    const ocrUrl = process.env.OCR_SERVICE_URL || "";
    if (ocrUrl) {
      try {
        text = await extractTextWithOcr(fileBuffer, ocrUrl);
      } catch {
        // fallthrough to empty text handling
      }
    }
  }
  const chunks = chunkText(text);
  if (!chunks.length) {
    await supabase.from("sources").update({ status: "empty" }).eq("id", sourceInsert.data.id);
    return res.status(400).json({ error: "Document vide ou illisible (OCR requis)." });
  }
  const embeddings = await embedTexts(provider, apiKey, chunks, {
    baseUrl: headerBaseUrl || undefined,
    model: embeddingModel || undefined
  });

  if (embeddings.some((vec) => vec.length !== 1024)) {
    return res.status(400).json({ error: "Embedding dimension mismatch. Expected 1024." });
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
    return res.status(500).json({ error: chunkInsert.error.message });
  }

  await supabase.from("sources").update({ status: "ready" }).eq("id", sourceInsert.data.id);

  return res.status(200).json({ ok: true, sourceId: sourceInsert.data.id });
}
