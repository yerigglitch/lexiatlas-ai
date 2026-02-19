type PdfLib = typeof import("pdf-lib");

let pdfLib: PdfLib | null = null;

async function getPdfLib() {
  if (!pdfLib) {
    pdfLib = await import("pdf-lib");
  }
  return pdfLib;
}

export async function createSimplePdf(title: string, text: string) {
  const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const margin = 50;
  const maxWidth = width - margin * 2;

  const lines = wrapText(text, font, fontSize, maxWidth);
  let y = height - margin;

  if (title) {
    page.drawText(title, {
      x: margin,
      y,
      size: 16,
      font,
      color: rgb(0.12, 0.14, 0.2)
    });
    y -= 28;
  }

  lines.forEach((line) => {
    if (y < margin) {
      const newPage = pdf.addPage();
      y = newPage.getSize().height - margin;
      newPage.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.15, 0.16, 0.18)
      });
      y -= 18;
    } else {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.15, 0.16, 0.18)
      });
      y -= 18;
    }
  });

  return pdf.save();
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number) {
  const words = text.replace(/\r\n/g, "\n").split(/\s+/);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });

  if (current) lines.push(current);

  return lines.flatMap((line) => line.split("\n"));
}
