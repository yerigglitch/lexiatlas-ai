"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type DocumentItem = {
  id: string;
  title: string;
  created_at: string;
};

type SignatureRequest = {
  id: string;
  status: string;
  signer_name: string;
  signer_email: string;
  created_at: string;
};

export default function SignaturesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [form, setForm] = useState({
    documentId: "",
    signerName: "",
    signerEmail: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }

      const docsRes = await fetch("/api/documents", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const docsPayload = await docsRes.json();
      setDocuments(docsPayload.documents || []);

      const reqRes = await fetch("/api/signatures", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const reqPayload = await reqRes.json();
      setRequests(reqPayload.requests || []);

      setLoading(false);
    };

    load();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/signatures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify(form)
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de la demande");
      return;
    }

    const payload = await res.json();
    setSuccess(payload.warning || "Demande de signature créée.");
    setRequests((prev) => [payload.request, ...prev]);
  };

  if (loading) {
    return <main className="app-loading" aria-live="polite"><div className="ui-skeleton-line" /><div className="ui-skeleton-line short" /></main>;
  }

  return (
    <main className="contacts">
      <header className="contacts-header">
        <div>
          <h1>Signature qualifiée</h1>
          <p>Envoyez un document pour signature officielle.</p>
        </div>
        <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
      </header>

      <section className="contacts-grid">
        <form className="contact-form" onSubmit={handleSubmit}>
          <h2>Nouvelle demande</h2>
          <label>
            Document
            <select
              value={form.documentId}
              onChange={(e) => setForm({ ...form, documentId: e.target.value })}
              required
            >
              <option value="">Sélectionner</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nom du signataire
            <input
              value={form.signerName}
              onChange={(e) => setForm({ ...form, signerName: e.target.value })}
              required
            />
          </label>
          <label>
            Email du signataire
            <input
              type="email"
              value={form.signerEmail}
              onChange={(e) => setForm({ ...form, signerEmail: e.target.value })}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <button className="cta" type="submit">Créer la demande</button>
          <button
            type="button"
            className="ghost"
            onClick={() => router.push("/app/settings/yousign")}
          >
            Configurer Yousign
          </button>
        </form>

        <div className="contact-list">
          <article className="contact-card">
            <h3>Demandes récentes</h3>
            {requests.length === 0 && <p>Aucune demande.</p>}
            {requests.map((req) => (
              <p key={req.id}>
                {req.signer_name} · {req.signer_email} · {req.status}
              </p>
            ))}
          </article>
        </div>
      </section>
    </main>
  );
}
