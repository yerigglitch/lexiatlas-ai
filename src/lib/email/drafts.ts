import type { AuthContext } from "@/lib/auth-server";
import { createServiceSupabase } from "@/lib/supabase-server";
import type { EmailDraft, RecipientField } from "./types";
import { validateDraftPayload } from "./validation";

function normalizeJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeDraft(row: Record<string, unknown> | null): EmailDraft | null {
  if (!row) return null;
  return {
    id: String(row.id || ""),
    tenant_id: String(row.tenant_id || ""),
    created_by: row.created_by ? String(row.created_by) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    template_id: row.template_id ? String(row.template_id) : null,
    title: String(row.title || ""),
    to_recipients: normalizeJsonArray<RecipientField>(row.to_recipients),
    cc_recipients: normalizeJsonArray<RecipientField>(row.cc_recipients),
    bcc_recipients: normalizeJsonArray<RecipientField>(row.bcc_recipients),
    subject: String(row.subject || ""),
    body_html: String(row.body_html || ""),
    status: (String(row.status || "draft") as EmailDraft["status"]),
    last_error: row.last_error ? String(row.last_error) : null,
    last_sent_at: row.last_sent_at ? String(row.last_sent_at) : null,
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || "")
  };
}

export async function listEmailDrafts(auth: AuthContext) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => normalizeDraft(row as Record<string, unknown>));
}

export async function getEmailDraftById(auth: AuthContext, id: string) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return normalizeDraft(data as Record<string, unknown>);
}

export async function createEmailDraft(
  auth: AuthContext,
  payload: {
    template_id?: string | null;
    title?: string;
    to_recipients?: unknown[];
    cc_recipients?: unknown[];
    bcc_recipients?: unknown[];
    subject?: string;
    body_html?: string;
  }
) {
  const validated = validateDraftPayload({
    to_recipients: payload.to_recipients as never[],
    cc_recipients: payload.cc_recipients as never[],
    bcc_recipients: payload.bcc_recipients as never[],
    subject: payload.subject || "Nouvel email",
    body_html: payload.body_html || "<p></p>"
  });

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("email_drafts")
    .insert({
      tenant_id: auth.tenantId,
      created_by: auth.userId,
      updated_by: auth.userId,
      template_id: payload.template_id || null,
      title: (payload.title || "Brouillon").trim(),
      to_recipients: validated.to,
      cc_recipients: validated.cc,
      bcc_recipients: validated.bcc,
      subject: validated.subject,
      body_html: validated.bodyHtml
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeDraft(data as Record<string, unknown>);
}

export async function updateEmailDraft(
  auth: AuthContext,
  id: string,
  payload: {
    template_id?: string | null;
    title?: string;
    to_recipients?: unknown[];
    cc_recipients?: unknown[];
    bcc_recipients?: unknown[];
    subject?: string;
    body_html?: string;
  }
) {
  const updates: Record<string, unknown> = {
    updated_by: auth.userId
  };

  if (payload.title !== undefined) updates.title = String(payload.title || "").trim();
  if (payload.template_id !== undefined) updates.template_id = payload.template_id || null;

  if (
    payload.to_recipients !== undefined ||
    payload.cc_recipients !== undefined ||
    payload.bcc_recipients !== undefined
  ) {
    const validatedRecipients = validateDraftPayload({
      to_recipients: (payload.to_recipients as never[]) || [],
      cc_recipients: (payload.cc_recipients as never[]) || [],
      bcc_recipients: (payload.bcc_recipients as never[]) || [],
      subject: payload.subject || "placeholder",
      body_html: payload.body_html || "<p>placeholder</p>"
    });
    updates.to_recipients = validatedRecipients.to;
    updates.cc_recipients = validatedRecipients.cc;
    updates.bcc_recipients = validatedRecipients.bcc;
  }

  if (payload.subject !== undefined) {
    const subject = payload.subject.trim();
    if (!subject) throw new Error("Subject cannot be empty");
    updates.subject = subject;
  }
  if (payload.body_html !== undefined) {
    const body = payload.body_html.trim();
    if (!body) throw new Error("Body cannot be empty");
    updates.body_html = body;
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("email_drafts")
    .update(updates)
    .eq("tenant_id", auth.tenantId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeDraft(data as Record<string, unknown>);
}

export async function markDraftSent(auth: AuthContext, id: string) {
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("email_drafts")
    .update({
      status: "sent",
      last_error: null,
      last_sent_at: new Date().toISOString(),
      updated_by: auth.userId
    })
    .eq("tenant_id", auth.tenantId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markDraftFailed(auth: AuthContext, id: string, message: string) {
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("email_drafts")
    .update({
      status: "failed",
      last_error: message,
      updated_by: auth.userId
    })
    .eq("tenant_id", auth.tenantId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createSendEvents(
  auth: AuthContext,
  params: {
    draftId: string;
    recipients: string[];
    status: "sent" | "failed";
    messageId?: string | null;
    error?: string | null;
  }
) {
  const supabase = createServiceSupabase();
  const rows = params.recipients.map((recipient) => ({
    tenant_id: auth.tenantId,
    draft_id: params.draftId,
    recipient_email: recipient,
    message_id: params.messageId || null,
    status: params.status,
    error: params.error || null
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("email_send_events").insert(rows);
  if (error) throw new Error(error.message);
}
