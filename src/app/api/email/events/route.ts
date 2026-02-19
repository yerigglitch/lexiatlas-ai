import { NextRequest, NextResponse } from "next/server";
import { listEmailEvents } from "@/lib/email/events";
import { asApiError, requireEmailV2Auth } from "@/lib/email/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { authContext, errorResponse } = await requireEmailV2Auth(request);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const recipient = url.searchParams.get("recipient");
    const draftId = url.searchParams.get("draftId");
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");
    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || "20");

    const result = await listEmailEvents(authContext, {
      status,
      recipient,
      draftId,
      fromDate,
      toDate,
      page,
      pageSize
    });
    return NextResponse.json(result);
  } catch (error) {
    return asApiError(error);
  }
}
