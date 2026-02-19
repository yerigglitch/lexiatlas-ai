import { NextRequest, NextResponse } from "next/server";
import { asApiError, requireEmailV2Auth } from "@/lib/email/http";
import { sendDraft } from "@/lib/email/sender";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const { id } = context.params;
    const result = await sendDraft(authContext, id);
    return NextResponse.json(result);
  } catch (error) {
    return asApiError(error);
  }
}
