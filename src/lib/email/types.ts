export type EmailStatus = "draft" | "sent" | "failed";
export type EmailEventStatus = "sent" | "failed";

export type RecipientField = {
  email: string;
  name?: string;
};

export type EmailTemplateVariable = {
  key: string;
  label?: string;
  required?: boolean;
};

export type EmailTemplateV2 = {
  id: string;
  tenant_id: string;
  created_by: string | null;
  updated_by: string | null;
  name: string;
  description: string | null;
  subject_template: string;
  body_template: string;
  variables: EmailTemplateVariable[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailDraft = {
  id: string;
  tenant_id: string;
  created_by: string | null;
  updated_by: string | null;
  template_id: string | null;
  title: string;
  to_recipients: RecipientField[];
  cc_recipients: RecipientField[];
  bcc_recipients: RecipientField[];
  subject: string;
  body_html: string;
  status: EmailStatus;
  last_error: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailSendEvent = {
  id: string;
  tenant_id: string;
  draft_id: string;
  recipient_email: string;
  message_id: string | null;
  status: EmailEventStatus;
  error: string | null;
  created_at: string;
};

export type RenderResult = {
  subject: string;
  bodyHtml: string;
  unresolved: string[];
};
