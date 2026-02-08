import { env } from "@/lib/env";

export async function convertDocxToPdf(docxBuffer: Buffer) {
  const url = env.pdfConverterUrl || "";
  if (!url) {
    throw new Error("Missing PDF_CONVERTER_URL");
  }

  const formData = new FormData();
  const file = new Blob([docxBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  formData.append("file", file, "document.docx");

  const response = await fetch(`${url.replace(/\/$/, "")}/convert`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "PDF conversion failed");
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
