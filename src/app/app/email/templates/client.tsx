"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import EmptyState from "@/components/ui/empty-state";
import InlineAlert from "@/components/ui/inline-alert";
import PageHeader from "@/components/ui/page-header";

type TemplateVariable = {
  key: string;
  label?: string;
  required?: boolean;
};

type Template = {
  id: string;
  name: string;
  description?: string | null;
  subject_template: string;
  body_template: string;
  variables: TemplateVariable[];
  updated_at: string;
};

function inferVariables(subject: string, body: string) {
  const regex = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
  const set = new Set<string>();
  for (const source of [subject, body]) {
    let match = regex.exec(source);
    while (match) {
      set.add(match[1]);
      match = regex.exec(source);
    }
    regex.lastIndex = 0;
  }
  return Array.from(set);
}

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("Bonjour {{client_name}}");
  const [bodyTemplate, setBodyTemplate] = useState("<p>Bonjour {{client_name}},</p>\n<p>...</p>");
  const [sampleJson, setSampleJson] = useState("{\"client_name\":\"Jean Dupont\"}");
  const [renderedSubject, setRenderedSubject] = useState("");
  const [renderedBody, setRenderedBody] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return null;
    }
    return data.session.access_token;
  }, [router]);

  const loadTemplates = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch("/api/email/templates", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Erreur de chargement");
      setLoading(false);
      return;
    }
    const rows = payload.templates || [];
    setTemplates(rows);
    if (rows.length > 0 && !selectedId) {
      setSelectedId(rows[0].id);
    }
    setLoading(false);
  }, [getAccessToken, selectedId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    const template = templates.find((entry) => entry.id === selectedId);
    if (!template) return;
    setName(template.name || "");
    setDescription(template.description || "");
    setSubjectTemplate(template.subject_template || "");
    setBodyTemplate(template.body_template || "");
    setRenderedSubject("");
    setRenderedBody("");
    setUnresolved([]);
    setError(null);
    setSuccess(null);
  }, [selectedId, templates]);

  const variables = useMemo(
    () => inferVariables(subjectTemplate, bodyTemplate),
    [subjectTemplate, bodyTemplate]
  );

  const saveTemplate = async () => {
    setError(null);
    setSuccess(null);
    const token = await getAccessToken();
    if (!token) return;

    const payload = {
      name,
      description,
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      variables: variables.map((key) => ({ key, required: true }))
    };

    const isUpdate = Boolean(selectedId);
    const res = await fetch(isUpdate ? `/api/email/templates/${selectedId}` : "/api/email/templates", {
      method: isUpdate ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Erreur d'enregistrement");
      return;
    }
    setSuccess("Template enregistré.");
    await loadTemplates();
    if (!isUpdate && body.template?.id) {
      setSelectedId(body.template.id);
    }
  };

  const archiveTemplate = async () => {
    if (!selectedId) return;
    setError(null);
    setSuccess(null);
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/email/templates/${selectedId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Impossible d'archiver");
      return;
    }
    setSuccess("Template archivé.");
    setSelectedId(null);
    await loadTemplates();
  };

  const runRenderTest = async () => {
    if (!selectedId) return;
    setError(null);
    let values: Record<string, unknown> = {};
    try {
      values = JSON.parse(sampleJson);
    } catch (_error) {
      setError("JSON invalide pour le test de rendu");
      return;
    }

    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/email/templates/${selectedId}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ values })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Erreur de rendu");
      return;
    }
    setRenderedSubject(payload.subject || "");
    setRenderedBody(payload.bodyHtml || "");
    setUnresolved(payload.unresolved || []);
  };

  if (loading) {
    return <main className="auth"><p>Chargement...</p></main>;
  }

  return (
    <main className="email-templates-page">
      <PageHeader
        title="Templates email"
        subtitle="Créez, testez et archivez vos modèles d'emails."
        actions={
          <>
            <button className="ghost" onClick={() => router.push("/app/email")}>Retour</button>
            <button
              className="ghost"
              onClick={() => {
                setSelectedId(null);
                setName("");
                setDescription("");
                setSubjectTemplate("Bonjour {{client_name}}");
                setBodyTemplate("<p>Bonjour {{client_name}},</p>\n<p>...</p>");
              }}
            >
              Nouveau
            </button>
            <button className="cta" onClick={saveTemplate}>Enregistrer</button>
          </>
        }
      />

      <section className="email-grid">
        <aside className="email-panel drafts-panel">
          <h2>Bibliothèque</h2>
          {templates.length === 0 && (
            <EmptyState
              title="Aucun template"
              description="Créez votre premier modèle pour accélérer la rédaction."
            />
          )}
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`draft-item ${selectedId === template.id ? "active" : ""}`}
              onClick={() => setSelectedId(template.id)}
            >
              <strong>{template.name}</strong>
              <span>{new Date(template.updated_at).toLocaleDateString("fr-FR")}</span>
            </button>
          ))}
        </aside>

        <section className="email-panel compose-panel">
          <h2>Éditeur</h2>
          <label>
            Nom
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Sujet template
            <input value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} />
          </label>
          <label>
            Corps template (HTML)
            <textarea rows={14} value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} />
          </label>
          <div className="module-note">
            Variables détectées: {variables.length > 0 ? variables.join(", ") : "Aucune"}
          </div>
          {selectedId && (
            <button className="ghost" type="button" onClick={archiveTemplate}>
              Archiver ce template
            </button>
          )}
          {error && <InlineAlert tone="error">{error}</InlineAlert>}
          {success && <InlineAlert tone="success">{success}</InlineAlert>}
        </section>

        <aside className="email-panel preview-panel">
          <h2>Test de rendu</h2>
          <label>
            Variables JSON
            <textarea rows={7} value={sampleJson} onChange={(e) => setSampleJson(e.target.value)} />
          </label>
          <button className="cta" type="button" disabled={!selectedId} onClick={runRenderTest}>
            Tester le rendu
          </button>
          {unresolved.length > 0 && (
            <div className="module-note">Variables non résolues: {unresolved.join(", ")}</div>
          )}
          <p><strong>Sujet rendu:</strong> {renderedSubject || "(non testé)"}</p>
          <article
            className="preview-body"
            dangerouslySetInnerHTML={{ __html: renderedBody || "<p>(non testé)</p>" }}
          />
        </aside>
      </section>
    </main>
  );
}
