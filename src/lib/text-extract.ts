// Import internal parser entry to avoid pdf-parse debug side effects in ESM bundling.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

export async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type;

  if (mime === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mime: string,
  filename: string
) {
  if (mime === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

type ChunkOptions = {
  maxChars?: number;
  overlapChars?: number;
};

function sliceWithWordBoundary(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
}

export function chunkText(text: string, options: ChunkOptions = {}) {
  const maxChars = options.maxChars ?? 1200;
  const overlapChars = options.overlapChars ?? 200;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChars) {
      if (current.trim()) {
        const trimmed = current.trim();
        chunks.push(trimmed);
        const overlap = trimmed.slice(Math.max(0, trimmed.length - overlapChars));
        current = overlap ? `${overlap}\n\n${para}` : para;
        if (current.length > maxChars) {
          const slice = sliceWithWordBoundary(current, maxChars);
          chunks.push(slice.trim());
          current = current.slice(slice.length).trim();
        }
        continue;
      }
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
