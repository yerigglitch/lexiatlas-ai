import { NextRequest, NextResponse } from "next/server";
import { getEmailDraftById, updateEmailDraft } from "@/lib/email/drafts";
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
    const draft = await getEmailDraftById(authContext, id);
    return NextResponse.json({ draft });
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
    const draft = await updateEmailDraft(authContext, id, body || {});
    return NextResponse.json({ draft });
  } catch (error) {
    return asApiError(error);
  }
}
