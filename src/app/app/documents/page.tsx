"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import EmptyState from "@/components/ui/empty-state";
import InlineAlert from "@/components/ui/inline-alert";
import PageHeader from "@/components/ui/page-header";

type Template = {
  id: string;
  title: string;
};

export default function DocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [jsonData, setJsonData] = useState("{\n  \"client\": \"Jean Dupont\"\n}");
  const [exportPdf, setExportPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documents, setDocuments] = useState<
    { id: string; title: string; url?: string | null; created_at: string }[]
  >([]);

  useEffect(() => {
    const loadTemplates = async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/templates", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const payload = await res.json();
      setTemplates(payload.templates || []);
      const docsRes = await fetch("/api/documents", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const docsPayload = await docsRes.json();
      setDocuments(docsPayload.documents || []);
      setLoading(false);
    };

    loadTemplates();
  }, [router]);

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonData);
    } catch {
      setError("JSON invalide");
      return;
    }

    const supabase = createBrowserSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify({ templateId, title, data, exportPdf })
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de la génération");
      return;
    }

    const payload = await res.json();
    setSuccess("Document généré et stocké.");
    if (payload?.document) {
      setDocuments((prev) => [
        {
          id: payload.document.id,
          title: payload.document.title,
          url: payload.documentUrl,
          created_at: payload.document.created_at
        },
        ...(payload.pdfDocument
          ? [
              {
                id: payload.pdfDocument.id,
                title: payload.pdfDocument.title,
                url: payload.pdfUrl,
                created_at: payload.pdfDocument.created_at
              }
            ]
          : [])
      ]);
    }
  };

  if (loading) {
    return <main className="app-loading" aria-live="polite"><div className="ui-skeleton-line" /><div className="ui-skeleton-line short" /></main>;
  }

  return (
    <main className="module">
      <PageHeader
        title="Générer un document"
        subtitle="Utilisez un modèle Word et vos variables JSON."
        actions={
          <button className="ghost" onClick={() => router.push("/app")}>
            Retour
          </button>
        }
      />

      <section className="module-grid">
        <form className="module-card" onSubmit={handleGenerate}>
          <h2>Paramètres</h2>
          <label>
            Modèle
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
              <option value="">Sélectionner</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Titre
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Variables JSON
            <textarea
              rows={8}
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={exportPdf}
              onChange={(e) => setExportPdf(e.target.checked)}
            />
            Export PDF (rendu fidèle)
          </label>
          {error && <InlineAlert tone="error">{error}</InlineAlert>}
          {success && <InlineAlert tone="success">{success}</InlineAlert>}
          <button className="cta" type="submit">Générer</button>
        </form>

        <aside className="module-list">
          <article className="module-card">
            <h3>Exemple de variables</h3>
            <p>{"{{client}}"} → Jean Dupont</p>
            <p>{"{{date}}"} → 05/02/2026</p>
            <p>{"{{dossier}}"} → 24-AC-190</p>
          </article>
          <article className="module-card">
            <h3>Documents récents</h3>
            {documents.length === 0 && (
              <EmptyState
                title="Aucun document généré"
                description="Générez un document pour l’ajouter à l’historique."
              />
            )}
            {documents.map((doc) => (
              <p key={doc.id}>
                {doc.url ? (
                  <a className="link" href={doc.url} target="_blank" rel="noreferrer">
                    {doc.title}
                  </a>
                ) : (
                  doc.title
                )}
              </p>
            ))}
          </article>
        </aside>
      </section>
    </main>
  );
}
