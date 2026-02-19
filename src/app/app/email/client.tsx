"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type Recipient = { email: string; name?: string };
type Draft = {
  id: string;
  title: string;
  status: "draft" | "sent" | "failed";
  subject: string;
  body_html: string;
  to_recipients: Recipient[];
  cc_recipients: Recipient[];
  bcc_recipients: Recipient[];
  last_error?: string | null;
  updated_at: string;
};

const TOKEN_REGEX = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

function parseRecipients(value: string): Recipient[] {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({ email }));
}

function toRecipientString(value: Recipient[] | undefined) {
  return Array.isArray(value) ? value.map((entry) => entry.email).join(", ") : "";
}

function getUnresolvedTokens(subject: string, bodyHtml: string) {
  const found = new Set<string>();
  for (const target of [subject, bodyHtml]) {
    let match = TOKEN_REGEX.exec(target);
    while (match) {
      found.add(match[1]);
      match = TOKEN_REGEX.exec(target);
    }
    TOKEN_REGEX.lastIndex = 0;
  }
  return Array.from(found);
}

export default function EmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState("Brouillon");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p>Bonjour,</p>\n<p>...</p>");
  const [emailV2Enabled, setEmailV2Enabled] = useState(true);
  const draftInitializedRef = useRef(false);

  const unresolved = useMemo(() => getUnresolvedTokens(subject, bodyHtml), [subject, bodyHtml]);

  const getAccessToken = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return null;
    }
    return data.session.access_token;
  }, [router]);

  const loadDrafts = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch("/api/email/drafts", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 404) {
      setEmailV2Enabled(false);
      setLoading(false);
      return;
    }

    const payload = await res.json();
    const rows = (payload.drafts || []) as Draft[];
    setDrafts(rows);

    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("draft")
        : null;
    const initialDraftId = rows.some((entry) => entry.id === fromQuery)
      ? fromQuery
      : rows[0]?.id || null;

    if (initialDraftId && !draftInitializedRef.current) {
      draftInitializedRef.current = true;
      setSelectedDraftId(initialDraftId);
    }
    setLoading(false);
  }, [getAccessToken]);

  const loadDraft = useCallback((draftId: string | null, sourceDrafts: Draft[]) => {
    if (!draftId) return;
    const selected = sourceDrafts.find((entry) => entry.id === draftId);
    if (!selected) return;
    setTitle(selected.title || "Brouillon");
    setTo(toRecipientString(selected.to_recipients));
    setCc(toRecipientString(selected.cc_recipients));
    setBcc(toRecipientString(selected.bcc_recipients));
    setSubject(selected.subject || "");
    setBodyHtml(selected.body_html || "");
    setError(selected.last_error || null);
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    if (!selectedDraftId) return;
    router.replace(`/app/email?draft=${selectedDraftId}`);
    loadDraft(selectedDraftId, drafts);
  }, [selectedDraftId, router, drafts, loadDraft]);

  const createDraft = async () => {
    setError(null);
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch("/api/email/drafts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: "Nouveau brouillon",
        subject: "Nouvel email",
        body_html: "<p>Bonjour,</p>\n<p>...</p>",
        to_recipients: [],
        cc_recipients: [],
        bcc_recipients: []
      })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Impossible de créer le brouillon");
      return;
    }
    const next = payload.draft as Draft;
    const nextDrafts = [next, ...drafts];
    setDrafts(nextDrafts);
    setSelectedDraftId(next.id);
    loadDraft(next.id, nextDrafts);
  };

  useEffect(() => {
    if (!selectedDraftId || loading) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/email/drafts/${selectedDraftId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          to_recipients: parseRecipients(to),
          cc_recipients: parseRecipients(cc),
          bcc_recipients: parseRecipients(bcc),
          subject,
          body_html: bodyHtml
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Erreur d'enregistrement");
        setSaving(false);
        return;
      }
      const updated = payload.draft as Draft;
      setDrafts((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setSaving(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [selectedDraftId, title, to, cc, bcc, subject, bodyHtml, loading, getAccessToken]);

  const handleSend = async () => {
    if (!selectedDraftId) return;
    setError(null);
    setSuccess(null);
    setSending(true);
    const token = await getAccessToken();
    if (!token) {
      setSending(false);
      return;
    }
    const res = await fetch(`/api/email/drafts/${selectedDraftId}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Envoi impossible");
      setSending(false);
      return;
    }
    setSuccess("Email envoyé.");
    setSending(false);
    loadDrafts();
  };

  if (loading) {
    return <main className="auth"><p>Chargement...</p></main>;
  }

  if (!emailV2Enabled) {
    return (
      <main className="auth">
        <section className="auth-card">
          <h1>Emails v2 désactivé</h1>
          <p>Activez `EMAIL_V2_ENABLED=true` pour utiliser le nouvel espace email.</p>
          <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
        </section>
      </main>
    );
  }

  return (
    <main className="email-workspace">
      <header className="module-header">
        <div>
          <h1>Espace emails</h1>
          <p>Brouillons, prévisualisation, et envoi sécurisé via SMTP.</p>
        </div>
        <div className="module-actions">
          <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
          <button className="ghost" onClick={() => router.push("/app/email/logs")}>Historique</button>
          <button className="ghost" onClick={() => router.push("/app/email/templates")}>Templates email</button>
          <button className="cta" onClick={createDraft}>Nouveau brouillon</button>
        </div>
      </header>

      <section className="email-grid">
        <aside className="email-panel drafts-panel">
          <h2>Brouillons</h2>
          <div className="drafts-list">
            {drafts.map((draft) => (
              <button
                type="button"
                key={draft.id}
                className={`draft-item ${selectedDraftId === draft.id ? "active" : ""}`}
                onClick={() => setSelectedDraftId(draft.id)}
              >
                <strong>{draft.title}</strong>
                <span>{new Date(draft.updated_at).toLocaleString("fr-FR")}</span>
                <small className={`status-chip ${draft.status}`}>{draft.status}</small>
              </button>
            ))}
            {drafts.length === 0 && <p>Aucun brouillon.</p>}
          </div>
        </aside>

        <section className="email-panel compose-panel">
          <h2>Composer</h2>
          <label>
            Titre du brouillon
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            À (emails séparés par virgules)
            <input value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            Cc
            <input value={cc} onChange={(e) => setCc(e.target.value)} />
          </label>
          <label>
            Bcc
            <input value={bcc} onChange={(e) => setBcc(e.target.value)} />
          </label>
          <label>
            Objet
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label>
            Corps HTML
            <textarea rows={14} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
          </label>
          <div className="compose-footer">
            <span>{saving ? "Enregistrement..." : "Enregistré"}</span>
            <button
              className="cta"
              type="button"
              disabled={sending || saving || unresolved.length > 0 || !selectedDraftId}
              onClick={handleSend}
            >
              {sending ? "Envoi..." : "Envoyer"}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </section>

        <aside className="email-panel preview-panel">
          <h2>Prévisualisation</h2>
          {unresolved.length > 0 && (
            <div className="module-note">
              Variables non résolues: {unresolved.join(", ")}
            </div>
          )}
          <div className="preview-subject">
            <strong>Objet:</strong> {subject || "(vide)"}
          </div>
          <article
            className="preview-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml || "<p>(vide)</p>" }}
          />
        </aside>
      </section>
    </main>
  );
}
