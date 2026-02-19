import type { RecipientField } from "./types";
import type { EmailTemplateVariable } from "./types";

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEMPLATE_VAR_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function normalizeRecipient(input: RecipientField | string): RecipientField {
  if (typeof input === "string") {
    return { email: input.trim().toLowerCase() };
  }
  return {
    email: String(input.email || "").trim().toLowerCase(),
    name: input.name?.trim()
  };
}

function dedupeRecipients(values: RecipientField[]) {
  const out: RecipientField[] = [];
  const seen = new Set<string>();
  values.forEach((entry) => {
    if (!entry.email || seen.has(entry.email)) return;
    seen.add(entry.email);
    out.push(entry);
  });
  return out;
}

export function validateRecipientList(input: Array<RecipientField | string> | null | undefined, fieldName: string) {
  const list = Array.isArray(input) ? input.map(normalizeRecipient) : [];
  const deduped = dedupeRecipients(list);
  const invalid = deduped.filter((entry) => !SIMPLE_EMAIL_REGEX.test(entry.email));
  if (invalid.length > 0) {
    throw new Error(`Invalid ${fieldName} email: ${invalid[0].email}`);
  }
  return deduped;
}

export function validateDraftPayload(payload: {
  to_recipients?: Array<RecipientField | string>;
  cc_recipients?: Array<RecipientField | string>;
  bcc_recipients?: Array<RecipientField | string>;
  subject?: string;
  body_html?: string;
  requireAtLeastOneRecipient?: boolean;
}) {
  const to = validateRecipientList(payload.to_recipients, "to");
  const cc = validateRecipientList(payload.cc_recipients, "cc");
  const bcc = validateRecipientList(payload.bcc_recipients, "bcc");
  if (payload.requireAtLeastOneRecipient && to.length === 0) {
    throw new Error("At least one recipient is required");
  }

  const subject = (payload.subject || "").trim();
  const bodyHtml = (payload.body_html || "").trim();
  if (!subject) {
    throw new Error("Subject cannot be empty");
  }
  if (!bodyHtml) {
    throw new Error("Body cannot be empty");
  }

  return { to, cc, bcc, subject, bodyHtml };
}

export function validateTemplateVariables(input: unknown) {
  if (!Array.isArray(input)) return [];
  const out: EmailTemplateVariable[] = input
    .map((entry) => {
      const raw = (entry || {}) as Record<string, unknown>;
      const key = String(raw.key || "").trim();
      return {
        key,
        ...(raw.label ? { label: String(raw.label) } : {}),
        required: Boolean(raw.required)
      };
    })
    .filter((entry) => entry.key.length > 0);

  const unique = new Set<string>();
  out.forEach((entry) => {
    if (!TEMPLATE_VAR_KEY_REGEX.test(entry.key)) {
      throw new Error(`Invalid variable key: ${entry.key}`);
    }
    if (unique.has(entry.key)) {
      throw new Error(`Duplicate variable key: ${entry.key}`);
    }
    unique.add(entry.key);
  });

  return out;
}

export function assertNoUnresolvedVariables(unresolved: string[]) {
  if (unresolved.length > 0) {
    throw new Error(`Unresolved template variables: ${unresolved.join(", ")}`);
  }
}
