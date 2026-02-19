import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-server";
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

function buildCss(style: Record<string, unknown>) {
  const fontSize = safeInt(style.font_size_pt, 11, 10, 13);
  const margin = safeFloat(style.margin_cm, 2.5, 1.8, 3.2);
  const spacing = safeFloat(style.line_spacing, 1.12, 1.0, 1.5);
  return `
    :root { color-scheme: light; }
    body {
      margin: ${margin.toFixed(2)}cm;
      font-size: ${fontSize}px;
      line-height: ${spacing.toFixed(2)};
      font-family: "Georgia", "Times New Roman", serif;
      color: #1c2333;
      background: #fff;
    }
    h1,h2,h3 { font-family: "Georgia", serif; margin-top: 1.2em; margin-bottom: 0.5em; }
    p { margin: 0 0 0.8em; }
    ul,ol { margin: 0 0 1em 1.4em; }
    blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #d8dce4; color: #4d5a6a; }
  `;
}

export async function POST(request: NextRequest) {
  if (!isFeatureDocflowEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tmpPrefix = `docflow-html-${crypto.randomBytes(6).toString("hex")}`;
  const tmpDir = os.tmpdir();
  const mdPath = path.join(tmpDir, `${tmpPrefix}.md`);
  const htmlPath = path.join(tmpDir, `${tmpPrefix}.html`);

  try {
    const body = await request.json();
    const markdown = String(body?.markdown || "").trim();
    const docType = String(body?.docType || "").toUpperCase() as "NOTE" | "COURRIER";
    const style = (body?.style || {}) as Record<string, unknown>;

    if (!markdown) {
      return NextResponse.json({ error: "Missing markdown" }, { status: 400 });
    }
    if (!["NOTE", "COURRIER"].includes(docType)) {
      return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
    }

    await fs.writeFile(mdPath, markdownWithFrontMatter(markdown, docType, style), "utf-8");
    await execFileAsync("pandoc", [mdPath, "-o", htmlPath, "--standalone"]);
    const htmlDoc = await fs.readFile(htmlPath, "utf-8");
    const bodyMatch = htmlDoc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : htmlDoc;

    return NextResponse.json({
      html: bodyHtml,
      css: buildCss(style)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await Promise.allSettled([fs.unlink(mdPath), fs.unlink(htmlPath)]);
  }
}
