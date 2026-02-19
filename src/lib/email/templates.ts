import type { AuthContext } from "@/lib/auth-server";
import { createServiceSupabase } from "@/lib/supabase-server";
import type { EmailTemplateV2, EmailTemplateVariable } from "./types";
import { extractTemplateVariables, renderEmailTemplate } from "./templating";
import { validateTemplateVariables } from "./validation";

function normalizeTemplate(template: Record<string, unknown> | null): EmailTemplateV2 | null {
  if (!template) return null;
  const variables = Array.isArray(template.variables)
    ? (template.variables as EmailTemplateVariable[])
    : [];
  return {
    id: String(template.id || ""),
    tenant_id: String(template.tenant_id || ""),
    created_by: template.created_by ? String(template.created_by) : null,
    updated_by: template.updated_by ? String(template.updated_by) : null,
    name: String(template.name || ""),
    description: template.description ? String(template.description) : null,
    subject_template: String(template.subject_template || ""),
    body_template: String(template.body_template || ""),
    variables,
    is_archived: Boolean(template.is_archived),
    created_at: String(template.created_at || ""),
    updated_at: String(template.updated_at || "")
  };
}

export async function listEmailTemplates(auth: AuthContext) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("email_templates_v2")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data || []).map((row) => normalizeTemplate(row as Record<string, unknown>));
}

export async function createEmailTemplate(
  auth: AuthContext,
  payload: {
    name?: string;
    description?: string | null;
    subject_template?: string;
    body_template?: string;
    variables?: unknown;
  }
) {
  const name = String(payload.name || "").trim();
  const subjectTemplate = String(payload.subject_template || "");
  const bodyTemplate = String(payload.body_template || "");
  if (!name) throw new Error("Template name is required");
  if (!subjectTemplate.trim()) throw new Error("Template subject is required");
  if (!bodyTemplate.trim()) throw new Error("Template body is required");

  const variables = validateTemplateVariables(payload.variables);
  const inferred = Array.from(
    new Set([
      ...extractTemplateVariables(subjectTemplate),
      ...extractTemplateVariables(bodyTemplate)
    ])
  );

  // Merge inferred variables that are not explicitly configured.
  const merged = [...variables];
  inferred.forEach((key) => {
    if (!merged.some((entry) => entry.key === key)) {
      merged.push({ key, required: true });
    }
  });

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("email_templates_v2")
    .insert({
      tenant_id: auth.tenantId,
      created_by: auth.userId,
      updated_by: auth.userId,
      name,
      description: payload.description || null,
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      variables: merged
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeTemplate(data as Record<string, unknown>);
}

export async function getEmailTemplateById(auth: AuthContext, id: string) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("email_templates_v2")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return normalizeTemplate(data as Record<string, unknown>);
}

export async function updateEmailTemplate(
  auth: AuthContext,
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    subject_template?: string;
    body_template?: string;
    variables?: unknown;
  }
) {
  const updates: Record<string, unknown> = {
    updated_by: auth.userId
  };
  if (payload.name !== undefined) updates.name = String(payload.name || "").trim();
  if (payload.description !== undefined) updates.description = payload.description || null;
  if (payload.subject_template !== undefined) updates.subject_template = payload.subject_template;
  if (payload.body_template !== undefined) updates.body_template = payload.body_template;
  if (payload.variables !== undefined) {
    updates.variables = validateTemplateVariables(payload.variables);
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("email_templates_v2")
    .update(updates)
    .eq("tenant_id", auth.tenantId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeTemplate(data as Record<string, unknown>);
}

export async function archiveEmailTemplate(auth: AuthContext, id: string) {
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("email_templates_v2")
    .update({ is_archived: true, updated_by: auth.userId })
    .eq("tenant_id", auth.tenantId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function renderEmailTemplateById(
  auth: AuthContext,
  id: string,
  values: Record<string, unknown>
) {
  const template = await getEmailTemplateById(auth, id);
  if (!template) {
    throw new Error("Template not found");
  }
  return renderEmailTemplate({
    subjectTemplate: String(template.subject_template || ""),
    bodyTemplate: String(template.body_template || ""),
    values
  });
}
