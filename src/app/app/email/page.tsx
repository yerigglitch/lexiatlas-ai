"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function EmailPage() {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("<p>Bonjour,</p>\n<p>...</p>");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({ to, subject, html })
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de l'envoi");
      return;
    }

    setSuccess("Email envoyé.");
  };

  return (
    <main className="module">
      <header className="module-header">
        <div>
          <h1>Emails</h1>
          <p>Courriers sortants sécurisés via votre SMTP.</p>
        </div>
        <div className="module-actions">
          <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
          <button className="cta" onClick={() => router.push("/app/email/logs")}>Historique</button>
        </div>
      </header>

      <section className="module-grid">
        <form className="module-card" onSubmit={handleSend}>
          <h2>Composer</h2>
          <label>
            Destinataire
            <input value={to} onChange={(e) => setTo(e.target.value)} required />
          </label>
          <label>
            Objet
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </label>
          <label>
            Corps (HTML)
            <textarea rows={10} value={html} onChange={(e) => setHtml(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <button className="cta" type="submit">Envoyer</button>
        </form>

        <aside className="module-panel">
          <h2>Informations utiles</h2>
          <ul>
            <li>SMTP requis pour l&apos;envoi effectif.</li>
            <li>Historique complet dans l&apos;onglet Emails.</li>
            <li>Modèles de mail à venir.</li>
          </ul>
          <button className="ghost" onClick={() => router.push("/app/settings/email")}>
            Configurer SMTP
          </button>
        </aside>
      </section>

      <div className="floating-actions">
        <button className="icon-btn" type="button" onClick={() => router.push("/app/settings/email")} title="SMTP">
          <span className="icon-glyph" aria-hidden>✉</span>
        </button>
        <button className="icon-btn" type="button" onClick={() => router.push("/app/email/logs")} title="Historique">
          <span className="icon-glyph" aria-hidden>⟲</span>
        </button>
      </div>
    </main>
  );
}
