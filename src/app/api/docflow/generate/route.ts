import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-server";
import { convertDocxToPdf } from "@/lib/pdf-converter";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isFeatureDocflowEnabled } from "@/lib/feature-flags";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

function safeFloat(input: unknown, fallback: number, min: number, max: number) {
  const value = Number(input);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function safeInt(input: unknown, fallback: number, min: number, max: number) {
  const value = Math.trunc(Number(input));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function markdownWithFrontMatter(markdown: string, docType: "NOTE" | "COURRIER", style: Record<string, unknown>) {
  const title = String(style.title || (docType === "NOTE" ? "Note" : "Courrier")).replace(/\n/g, " ").trim();
  const author = String(style.author || "Cabinet").replace(/\n/g, " ").trim();
  return `---\ntitle: "${title}"\nauthor: "${author}"\nlang: fr-FR\n---\n\n${markdown}`;
}

function buildDynamicTemplate(docType: "NOTE" | "COURRIER", style: Record<string, unknown>) {
  const fontSize = safeInt(style.font_size_pt, 11, 10, 13);
  const margin = safeFloat(style.margin_cm, 2.5, 1.8, 3.2);
  const spacing = safeFloat(style.line_spacing, 1.12, 1.0, 1.5);

  if (docType === "COURRIER") {
    return `\\documentclass[${fontSize}pt]{letter}
\\usepackage[a4paper,margin=${margin.toFixed(2)}cm]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[french]{babel}
\\usepackage{lmodern}
\\usepackage{setspace}
\\setstretch{${spacing.toFixed(2)}}
\\signature{$author$}
\\date{\\today}
\\begin{document}
\\begin{letter}{Destinataire}
\\opening{Madame, Monsieur,}
$body$
\\closing{Cordialement,}
\\end{letter}
\\end{document}
`;
  }

  return `\\documentclass[${fontSize}pt]{article}
\\usepackage[a4paper,margin=${margin.toFixed(2)}cm]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[french]{babel}
\\usepackage{lmodern}
\\usepackage{setspace}
\\setstretch{${spacing.toFixed(2)}}
\\title{\\textbf{$title$}}
\\author{$author$}
\\date{\\today}
\\begin{document}
\\maketitle
\\vspace{0.6cm}
$body$
\\end{document}
`;
}

async function convertDocxToPdfLocally(docxPath: string, outputDir: string) {
  await execFileAsync("soffice", [
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    outputDir,
    docxPath
  ]);
}

export async function POST(request: NextRequest) {
  if (!isFeatureDocflowEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tmpPrefix = `docflow-${crypto.randomBytes(6).toString("hex")}`;
  const tmpDir = os.tmpdir();
  const mdPath = path.join(tmpDir, `${tmpPrefix}.md`);
  const templatePath = path.join(tmpDir, `${tmpPrefix}.latex`);
  const docxPath = path.join(tmpDir, `${tmpPrefix}.docx`);
  const pdfPath = path.join(tmpDir, `${tmpPrefix}.pdf`);
  const outputBase = path.join(tmpDir, `${tmpPrefix}`);

  try {
    const body = await request.json();
    const markdown = String(body?.markdown || "").trim();
    const docType = String(body?.docType || "").toUpperCase() as "NOTE" | "COURRIER";
    const format = String(body?.format || "pdf").toLowerCase();
    const style = (body?.style || {}) as Record<string, unknown>;

    if (!markdown) {
      return NextResponse.json({ error: "Missing markdown" }, { status: 400 });
    }
    if (!["NOTE", "COURRIER"].includes(docType)) {
      return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
    }
    if (!["pdf", "docx"].includes(format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    await fs.writeFile(mdPath, markdownWithFrontMatter(markdown, docType, style), "utf-8");

    if (format === "docx") {
      await execFileAsync("pandoc", [mdPath, "-o", docxPath]);
      const docxBytes = await fs.readFile(docxPath);
      const filename = `${docType.toLowerCase()}-${Date.now()}.docx`;
      return new NextResponse(docxBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      });
    }

    // Preferred path: direct PDF via pandoc engine (no soffice required).
    const pdfEngine = process.env.DOCFLOW_PDF_ENGINE || "tectonic";
    try {
      await fs.writeFile(templatePath, buildDynamicTemplate(docType, style), "utf-8");
      await execFileAsync("pandoc", [
        mdPath,
        "-o",
        pdfPath,
        "--pdf-engine",
        pdfEngine,
        "--template",
        templatePath
      ]);
      const directPdf = await fs.readFile(pdfPath);
      const filename = `${docType.toLowerCase()}-${Date.now()}.pdf`;
      return new NextResponse(directPdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      });
    } catch (_directPdfError) {
      // Fallback path: DOCX then converter/soffice.
      await execFileAsync("pandoc", [mdPath, "-o", docxPath]);
      const docxBytes = await fs.readFile(docxPath);

      let pdfBytes: Buffer | null = null;
      try {
        pdfBytes = await convertDocxToPdf(docxBytes);
      } catch (_converterError) {
        try {
          await convertDocxToPdfLocally(docxPath, tmpDir);
          pdfBytes = await fs.readFile(pdfPath);
        } catch (fallbackError) {
          const message =
            fallbackError instanceof Error ? fallbackError.message : "DOCX->PDF conversion failed";
          return NextResponse.json(
            {
              error:
                `PDF conversion unavailable. ${message}. ` +
                `Install ${pdfEngine} (or set DOCFLOW_PDF_ENGINE), ` +
                "or start the local converter (docker-compose up pdf-converter), or use DOCX."
            },
            { status: 500 }
          );
        }
      }

      const filename = `${docType.toLowerCase()}-${Date.now()}.pdf`;
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await Promise.allSettled([
      fs.unlink(mdPath),
      fs.unlink(templatePath),
      fs.unlink(docxPath),
      fs.unlink(pdfPath),
      fs.unlink(`${outputBase}.pdf`),
      fs.unlink(`${outputBase}.docx`)
    ]);
  }
}
