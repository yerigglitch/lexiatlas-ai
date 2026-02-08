import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const { tenantName, fullName } = (await request.json()) as {
      tenantName?: string;
      fullName?: string;
    };

    if (!tenantName || !fullName) {
      return NextResponse.json(
        { error: "Missing tenantName or fullName" },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabase();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message || "Invalid user" },
        { status: 401 }
      );
    }

    const tenantInsert = await supabase
      .from("tenants")
      .insert({ name: tenantName })
      .select("id")
      .single();

    if (tenantInsert.error || !tenantInsert.data) {
      return NextResponse.json(
        { error: tenantInsert.error?.message || "Tenant insert failed" },
        { status: 500 }
      );
    }

    const profileInsert = await supabase.from("profiles").insert({
      id: userData.user.id,
      tenant_id: tenantInsert.data.id,
      full_name: fullName,
      role: "owner"
    });

    if (profileInsert.error) {
      return NextResponse.json(
        { error: profileInsert.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, tenantId: tenantInsert.data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
