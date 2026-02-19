import type { RenderResult } from "./types";

const TOKEN_REGEX = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function extractTemplateVariables(input: string) {
  const found = new Set<string>();
  let match = TOKEN_REGEX.exec(input);
  while (match) {
    found.add(match[1]);
    match = TOKEN_REGEX.exec(input);
  }
  return Array.from(found);
}

export function renderTemplateString(template: string, values: Record<string, unknown>) {
  return template.replace(TOKEN_REGEX, (_full, key: string) => {
    const value = values[key];
    if (value === null || value === undefined) {
      return `{{${key}}}`;
    }
    return String(value);
  });
}

export function renderEmailTemplate(params: {
  subjectTemplate: string;
  bodyTemplate: string;
  values: Record<string, unknown>;
}): RenderResult {
  const subject = renderTemplateString(params.subjectTemplate, params.values);
  const bodyHtml = renderTemplateString(params.bodyTemplate, params.values);
  const unresolved = new Set<string>([
    ...extractTemplateVariables(subject),
    ...extractTemplateVariables(bodyHtml)
  ]);

  return {
    subject,
    bodyHtml,
    unresolved: Array.from(unresolved)
  };
}
