import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContext } from "@/lib/auth-server";
import { decryptString } from "@/lib/crypto";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { to, subject, html } = body || {};

  if (!to || !subject || !html) {
    return NextResponse.json({ error: "Missing email fields" }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { data: settings, error: settingsError } = await supabase
    .from("smtp_settings")
    .select("host, port, username, encrypted_password, from_name, from_email")
    .eq("tenant_id", authContext.tenantId)
    .maybeSingle();

  if (settingsError || !settings) {
    return NextResponse.json(
      { error: settingsError?.message || "SMTP not configured" },
      { status: 400 }
    );
  }

  const password = decryptString(settings.encrypted_password);

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: {
      user: settings.username,
      pass: password
    }
  });

  try {
    await transporter.sendMail({
      from: settings.from_email
        ? `${settings.from_name || "Cabinet"} <${settings.from_email}>`
        : settings.username,
      to,
      subject,
      html
    });

    await supabase.from("email_logs").insert({
      tenant_id: authContext.tenantId,
      created_by: authContext.userId,
      to_email: to,
      subject,
      status: "sent"
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("email_logs").insert({
      tenant_id: authContext.tenantId,
      created_by: authContext.userId,
      to_email: to,
      subject,
      status: "failed",
      error: message
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
