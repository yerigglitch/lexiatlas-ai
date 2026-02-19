import nodemailer from "nodemailer";
import type { AuthContext } from "@/lib/auth-server";
import { decryptString } from "@/lib/crypto";
import { createServiceSupabase } from "@/lib/supabase-server";
import { assertNoUnresolvedVariables, validateDraftPayload } from "./validation";
import { createSendEvents, getEmailDraftById, markDraftFailed, markDraftSent } from "./drafts";
import { extractTemplateVariables } from "./templating";

type SendDraftResult = {
  draftId: string;
  messageId: string | null;
  recipients: string[];
  status: "sent" | "failed";
  error?: string;
};

function collectRecipientEmails(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return input
    .map((entry) => {
      const row = (entry || {}) as Record<string, unknown>;
      return String(row.email || "").trim().toLowerCase();
    })
    .filter(Boolean);
}

export async function sendDraft(auth: AuthContext, draftId: string): Promise<SendDraftResult> {
  const draft = await getEmailDraftById(auth, draftId);
  if (!draft) throw new Error("Draft not found");

  const unresolved = [
    ...extractTemplateVariables(String(draft.subject || "")),
    ...extractTemplateVariables(String(draft.body_html || ""))
  ];
  assertNoUnresolvedVariables(unresolved);

  const validated = validateDraftPayload({
    to_recipients: (draft.to_recipients || []) as never[],
    cc_recipients: (draft.cc_recipients || []) as never[],
    bcc_recipients: (draft.bcc_recipients || []) as never[],
    subject: String(draft.subject || ""),
    body_html: String(draft.body_html || ""),
    requireAtLeastOneRecipient: true
  });

  const supabase = createServiceSupabase();
  const { data: settings, error: settingsError } = await supabase
    .from("smtp_settings")
    .select("host, port, username, encrypted_password, from_name, from_email")
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (settingsError || !settings) {
    const message = settingsError?.message || "SMTP not configured";
    await markDraftFailed(auth, draftId, message);
    const recipients = [
      ...collectRecipientEmails(draft.to_recipients),
      ...collectRecipientEmails(draft.cc_recipients),
      ...collectRecipientEmails(draft.bcc_recipients)
    ];
    await createSendEvents(auth, {
      draftId,
      recipients,
      status: "failed",
      error: message
    });
    throw new Error(message);
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: {
      user: settings.username,
      pass: decryptString(settings.encrypted_password)
    }
  });

  try {
    const info = await transporter.sendMail({
      from: settings.from_email
        ? `${settings.from_name || "Cabinet"} <${settings.from_email}>`
        : settings.username,
      to: validated.to.map((entry) => entry.email).join(", "),
      cc: validated.cc.length > 0 ? validated.cc.map((entry) => entry.email).join(", ") : undefined,
      bcc: validated.bcc.length > 0 ? validated.bcc.map((entry) => entry.email).join(", ") : undefined,
      subject: validated.subject,
      html: validated.bodyHtml
    });

    const recipients = [
      ...validated.to.map((entry) => entry.email),
      ...validated.cc.map((entry) => entry.email),
      ...validated.bcc.map((entry) => entry.email)
    ];

    await markDraftSent(auth, draftId);
    await createSendEvents(auth, {
      draftId,
      recipients,
      status: "sent",
      messageId: info.messageId || null
    });

    return {
      draftId,
      messageId: info.messageId || null,
      recipients,
      status: "sent"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send error";
    const recipients = [
      ...validated.to.map((entry) => entry.email),
      ...validated.cc.map((entry) => entry.email),
      ...validated.bcc.map((entry) => entry.email)
    ];
    await markDraftFailed(auth, draftId, message);
    await createSendEvents(auth, {
      draftId,
      recipients,
      status: "failed",
      error: message
    });
    throw new Error(message);
  }
}
