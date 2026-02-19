import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-server";
import { extractTextWithOcr } from "@/lib/ocr";

export const runtime = "nodejs";

let pdfDocumentFactory: (typeof import("pdf-lib"))["PDFDocument"] | null = null;

async function getPdfDocumentFactory() {
  if (!pdfDocumentFactory) {
    const mod = await import("pdf-lib");
    pdfDocumentFactory = mod.PDFDocument;
  }
  return pdfDocumentFactory;
}

function parseContact(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(\+33|0)[1-9](?:[\s.-]?\d{2}){4}/);
  const postalMatch = text.match(/\b\d{5}\b/);

  const nameLine = lines.find((line) => !line.includes("@") && !line.match(/\d{2}/));
  const orgLine = lines.find((line) => line.toLowerCase().includes("cabinet")) || lines[1];
  const addressLine = lines.find((line) => line.match(/\d{1,4}\s+\w+/));
  const cityLine = postalMatch
    ? lines.find((line) => line.includes(postalMatch[0]) && line !== addressLine)
    : undefined;

  return {
    name: nameLine || "",
    organization: orgLine || "",
    email: emailMatch?.[0] || "",
    phone: phoneMatch?.[0] || "",
    address_line: addressLine || "",
    postal_code: postalMatch?.[0] || "",
    city: cityLine || "",
    country: "France",
    raw_text: text
  };
}

async function imageToPdf(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const PDFDocument = await getPdfDocumentFactory();
  const pdf = await PDFDocument.create();

  const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
  const image = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  const pdfBytes = await pdf.save();
  return Buffer.from(pdfBytes);
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const ocrUrl = process.env.OCR_SERVICE_URL || "";
  if (!ocrUrl) {
    return NextResponse.json({ error: "OCR service not configured" }, { status: 400 });
  }

  const pdfBuffer = await imageToPdf(file);
  const text = await extractTextWithOcr(pdfBuffer, ocrUrl);
  if (!text.trim()) {
    return NextResponse.json({ error: "OCR vide ou illisible" }, { status: 400 });
  }

  const parsed = parseContact(text);
  return NextResponse.json({ parsed, text });
}
