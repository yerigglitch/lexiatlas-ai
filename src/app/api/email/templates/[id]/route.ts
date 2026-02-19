import { NextRequest, NextResponse } from "next/server";
import { archiveEmailTemplate, getEmailTemplateById, updateEmailTemplate } from "@/lib/email/templates";
import { asApiError, requireEmailV2Auth } from "@/lib/email/http";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const { id } = context.params;
    const template = await getEmailTemplateById(authContext, id);
    return NextResponse.json({ template });
  } catch (error) {
    return asApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const { id } = context.params;
    const body = await request.json();
    const template = await updateEmailTemplate(authContext, id, body || {});
    return NextResponse.json({ template });
  } catch (error) {
    return asApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const { id } = context.params;
    await archiveEmailTemplate(authContext, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return asApiError(error);
  }
}
