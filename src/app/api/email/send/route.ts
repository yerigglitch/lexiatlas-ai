import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { decryptString } from "@/lib/crypto";
import { createEmailDraft } from "@/lib/email/drafts";
import { isEmailV2Enabled } from "@/lib/email/feature";
import { sendDraft } from "@/lib/email/sender";
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

  if (!isEmailV2Enabled()) {
    // Deprecated path fallback while Email v2 is disabled.
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

  try {
    // Deprecated compatibility endpoint mapped to v2.
    const draft = await createEmailDraft(authContext, {
      title: `Legacy send ${new Date().toISOString()}`,
      to_recipients: [{ email: to }],
      cc_recipients: [],
      bcc_recipients: [],
      subject,
      body_html: html
    });
    if (!draft?.id) {
      throw new Error("Could not create compatibility draft");
    }
    const draftId = String(draft?.id || "");
    await sendDraft(authContext, draftId);

    // Preserve legacy response shape.
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
