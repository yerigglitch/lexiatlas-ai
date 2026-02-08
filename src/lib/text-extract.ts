import pdfParse from "pdf-parse";
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

export function chunkText(text: string, maxChars = 1800) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
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
