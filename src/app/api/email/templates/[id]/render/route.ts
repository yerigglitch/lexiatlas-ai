import { NextRequest, NextResponse } from "next/server";
import { asApiError, requireEmailV2Auth } from "@/lib/email/http";
import { renderEmailTemplateById } from "@/lib/email/templates";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const { id } = context.params;
    const body = await request.json();
    const values = (body?.values || {}) as Record<string, unknown>;
    const result = await renderEmailTemplateById(authContext, id, values);
    return NextResponse.json(result);
  } catch (error) {
    return asApiError(error);
  }
}
