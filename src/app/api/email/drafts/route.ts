import { NextRequest, NextResponse } from "next/server";
import { createEmailDraft, listEmailDrafts } from "@/lib/email/drafts";
import { asApiError, requireEmailV2Auth } from "@/lib/email/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const drafts = await listEmailDrafts(authContext);
    return NextResponse.json({ drafts });
  } catch (error) {
    return asApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const draft = await createEmailDraft(authContext, body || {});
    return NextResponse.json({ draft });
  } catch (error) {
    return asApiError(error);
  }
}
