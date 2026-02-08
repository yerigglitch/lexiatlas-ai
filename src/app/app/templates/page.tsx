"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type Template = {
  id: string;
  title: string;
  created_at: string;
};

export default function TemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadTemplates = useCallback(async () => {
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
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleUpload = async () => {
    setError(null);

    if (!file) {
      setError("Sélectionnez un fichier .docx");
      return;
    }

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      body: formData
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de l'upload");
      return;
    }

    setFile(null);
    loadTemplates();
  };

  if (loading) {
    return <main className="auth"><p>Chargement...</p></main>;
  }

  return (
    <main className="module">
      <header className="module-header">
        <div>
          <h1>Modèles Word</h1>
          <p>Une bibliothèque sobre et rapide pour réutiliser vos formats cabinet.</p>
        </div>
        <div className="module-actions">
          <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
          <button className="cta" onClick={() => setShowUpload(true)}>Ajouter un modèle</button>
        </div>
      </header>

      <section className="module-grid">
        <div className="module-list">
          {templates.length === 0 && (
            <div className="module-empty">
              <p>Aucun modèle enregistré.</p>
              <button className="cta" onClick={() => setShowUpload(true)}>Importer un .docx</button>
            </div>
          )}
          {templates.map((tpl) => (
            <article key={tpl.id} className="module-card">
              <div>
                <h3>{tpl.title}</h3>
                <p>Ajouté le {new Date(tpl.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
            </article>
          ))}
        </div>

        <aside className="module-panel">
          <h2>Bonnes pratiques</h2>
          <ul>
            <li>Utilisez un format .docx propre (styles Word standard).</li>
            <li>Évitez les champs automatiques complexes.</li>
            <li>Un modèle = un usage (convention, courrier, requête).</li>
          </ul>
          <div className="module-note">
            Les variables seront détectées automatiquement lors de la génération.
          </div>
        </aside>
      </section>

      <div className="floating-actions">
        <button className="icon-btn" type="button" onClick={() => router.push("/app/settings")} title="Réglages">
          <span className="icon-glyph" aria-hidden>⚙</span>
        </button>
        <button className="icon-btn" type="button" onClick={() => router.push("/app/documents")} title="Générer">
          <span className="icon-glyph" aria-hidden>✧</span>
        </button>
      </div>

      {showUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <strong>Ajouter un modèle</strong>
              <button className="ghost" type="button" onClick={() => setShowUpload(false)}>
                Fermer
              </button>
            </div>
            <div className="modal-body">
              <label>
                Fichier .docx
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="cta" type="button" onClick={handleUpload}>
                Importer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
