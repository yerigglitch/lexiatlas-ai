import { NextRequest, NextResponse } from "next/server";
import { asApiError, requireEmailV2Auth } from "@/lib/email/http";
import { createEmailTemplate, listEmailTemplates } from "@/lib/email/templates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const templates = await listEmailTemplates(authContext);
    return NextResponse.json({ templates });
  } catch (error) {
    return asApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const template = await createEmailTemplate(authContext, body || {});
    return NextResponse.json({ template });
  } catch (error) {
    return asApiError(error);
  }
}
