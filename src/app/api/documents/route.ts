import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContext } from "@/lib/auth-server";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { convertDocxToPdf } from "@/lib/pdf-converter";

export const runtime = "nodejs";

async function signDocumentUrl(storagePath: string) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 600);
  if (error) {
    return null;
  }
  return data?.signedUrl || null;
}

export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, storage_path, created_at")
    .eq("tenant_id", authContext.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const signed = await Promise.all(
    (data || []).map(async (doc) => ({
      ...doc,
      url: await signDocumentUrl(doc.storage_path)
    }))
  );

  return NextResponse.json({ documents: signed });
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { templateId, title, data, exportPdf } = body || {};

  if (!templateId || !data) {
    return NextResponse.json({ error: "Missing templateId or data" }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("storage_path")
    .eq("id", templateId)
    .eq("tenant_id", authContext.tenantId)
    .single();

  if (templateError || !template) {
    return NextResponse.json({ error: templateError?.message || "Template not found" }, { status: 404 });
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("templates")
    .download(template.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: downloadError?.message || "Download failed" }, { status: 500 });
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  doc.setData(data);
  doc.render();

  const buffer = doc.getZip().generate({ type: "nodebuffer" });
  const baseName = `${Date.now()}-${title || "document"}`;
  const outputPath = `${authContext.tenantId}/documents/${baseName}.docx`;

  const uploadResult = await supabase.storage
    .from("documents")
    .upload(outputPath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

  if (uploadResult.error) {
    return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
  }

  const { data: documentRow, error: insertError } = await supabase
    .from("documents")
    .insert({
      tenant_id: authContext.tenantId,
      created_by: authContext.userId,
      template_id: templateId,
      title: title || "Document",
      storage_path: outputPath
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  let pdfDocument = null;
  let pdfUrl: string | null = null;

  if (exportPdf) {
    const pdfBytes = await convertDocxToPdf(buffer);
    const pdfPath = `${authContext.tenantId}/documents/${baseName}.pdf`;

    const pdfUpload = await supabase.storage
      .from("documents")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf" });

    if (!pdfUpload.error) {
      const { data: pdfRow } = await supabase
        .from("documents")
        .insert({
          tenant_id: authContext.tenantId,
          created_by: authContext.userId,
          template_id: templateId,
          title: `${title || "Document"} (PDF)`,
          storage_path: pdfPath
        })
        .select("*")
        .single();
      pdfDocument = pdfRow || null;
      pdfUrl = await signDocumentUrl(pdfPath);
    }
  }

  const docUrl = await signDocumentUrl(outputPath);
  return NextResponse.json({
    document: documentRow,
    documentUrl: docUrl,
    pdfDocument,
    pdfUrl
  });
}
