"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

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
    return <main className="auth"><p>Chargement...</p></main>;
  }

  return (
    <main className="contacts">
      <header className="contacts-header">
        <div>
          <h1>Générer un document</h1>
          <p>Utilisez un modèle Word et vos variables JSON.</p>
        </div>
        <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
      </header>

      <section className="contacts-grid">
        <form className="contact-form" onSubmit={handleGenerate}>
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
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <button className="cta" type="submit">Générer</button>
        </form>

        <div className="contact-list">
          <article className="contact-card">
            <h3>Exemple de variables</h3>
            <p>{"{{client}}"} → Jean Dupont</p>
            <p>{"{{date}}"} → 05/02/2026</p>
            <p>{"{{dossier}}"} → 24-AC-190</p>
          </article>
          <article className="contact-card">
            <h3>Documents récents</h3>
            {documents.length === 0 && <p>Aucun document généré.</p>}
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
        </div>
      </section>
    </main>
  );
}
