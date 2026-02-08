export async function extractTextWithOcr(pdfBuffer: Buffer, serviceUrl: string) {
  const url = serviceUrl.replace(/\/$/, "");
  const formData = new FormData();
  const file = new Blob([pdfBuffer], { type: "application/pdf" });
  formData.append("file", file, "document.pdf");

  const response = await fetch(`${url}/extract`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "OCR failed");
  }

  const data = (await response.json()) as { text?: string };
  return data.text || "";
}
