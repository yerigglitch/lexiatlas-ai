type PdfParseFn = (buffer: Buffer) => Promise<{ text: string }>;
type MammothLike = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

let pdfParseFn: PdfParseFn | null = null;
let mammothLib: MammothLike | null = null;

async function getPdfParse() {
  if (!pdfParseFn) {
    // Use internal entry to avoid debug side effects in ESM bundling.
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    pdfParseFn = mod.default as PdfParseFn;
  }
  return pdfParseFn;
}

async function getMammoth() {
  if (!mammothLib) {
    const mod = await import("mammoth");
    mammothLib = mod.default as MammothLike;
  }
  return mammothLib;
}

export async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type;

  if (mime === "application/pdf") {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    const mammoth = await getMammoth();
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
    const pdfParse = await getPdfParse();
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    const mammoth = await getMammoth();
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

type ChunkOptions = {
  maxChars?: number;
  overlapChars?: number;
};

const LEGAL_HEADING_RE =
  /^(article|chapitre|section|titre|partie|annexe|sommaire|visa|expose|dispositif)\b/i;

function sliceWithWordBoundary(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
}

function isHeadingLike(line: string) {
  const cleaned = line.trim();
  if (!cleaned || cleaned.length > 110) return false;
  if (/^[-*•]\s+/.test(cleaned)) return false;
  if (/^\d+[.)]\s+/.test(cleaned)) return false;
  if (LEGAL_HEADING_RE.test(cleaned)) return true;
  if (/^[A-Z0-9À-ÖØ-Þ\s'’"()\-.:]{4,}$/.test(cleaned) && cleaned.split(" ").length <= 12) {
    return true;
  }
  if (/:$/.test(cleaned) && cleaned.split(" ").length <= 12) {
    return true;
  }
  return false;
}

export function normalizeToMarkdown(text: string) {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return "";

  const lines = normalized.split("\n");
  const out: string[] = [];
  let blankStreak = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      blankStreak += 1;
      if (blankStreak <= 1) out.push("");
      continue;
    }
    blankStreak = 0;

    if (/^[-*•·▪◦]\s+/.test(line)) {
      out.push(`- ${line.replace(/^[-*•·▪◦]\s+/, "").trim()}`);
      continue;
    }

    if (/^\(?\d{1,3}[.)]\s+/.test(line)) {
      const next = line.replace(/^\(?(\d{1,3})[.)]\s+/, "$1. ").trim();
      out.push(next);
      continue;
    }

    if (isHeadingLike(line)) {
      const heading = line.replace(/:+$/, "").replace(/\s{2,}/g, " ").trim();
      out.push(`## ${heading}`);
      continue;
    }

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
