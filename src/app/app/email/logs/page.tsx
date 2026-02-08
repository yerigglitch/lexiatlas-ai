"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type EmailLog = {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  error?: string | null;
  created_at: string;
};

export default function EmailLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadLogs = useCallback(async (statusFilter = status, q = query, nextPage = page) => {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (q) params.set("q", q);
    params.set("page", String(nextPage));
    params.set("pageSize", String(pageSize));

    const res = await fetch(`/api/email/logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` }
    });
    const payload = await res.json();
    setLogs(payload.logs || []);
    setTotal(payload.total || 0);
    setLoading(false);
  }, [router, status, query, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = () => {
    const rows = [
      ["to_email", "subject", "status", "created_at", "error"],
      ...logs.map((log) => [
        log.to_email,
        log.subject,
        log.status,
        log.created_at,
        log.error || ""
      ])
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/\"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "email-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <main className="auth"><p>Chargement...</p></main>;
  }

  return (
    <main className="contacts">
      <header className="contacts-header">
        <div>
          <h1>Historique emails</h1>
          <p>Suivez les envois et les erreurs.</p>
        </div>
        <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
      </header>

      <section className="contacts-grid">
        <form
          className="contact-form"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            loadLogs(status, query, 1);
          }}
        >
          <h2>Filtres</h2>
          <label>
            Statut
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Tous</option>
              <option value="sent">Envoyés</option>
              <option value="failed">Échoués</option>
            </select>
          </label>
          <label>
            Recherche email
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button className="cta" type="submit">Filtrer</button>
          <button type="button" className="ghost" onClick={handleExport}>
            Export CSV (page)
          </button>
        </form>

        <div className="contact-list">
          {logs.length === 0 && <p>Aucun envoi.</p>}
          {logs.map((log) => (
            <article key={log.id} className="contact-card">
              <h3>{log.to_email}</h3>
              <p>{log.subject}</p>
              <p>Statut: {log.status}</p>
              <p>{new Date(log.created_at).toLocaleString("fr-FR")}</p>
              {log.error && <p className="error">{log.error}</p>}
            </article>
          ))}
          {total > pageSize && (
            <div className="pager">
              <button
                className="ghost"
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  loadLogs(status, query, next);
                }}
                disabled={page === 1}
              >
                Précédent
              </button>
              <span>
                Page {page} / {Math.ceil(total / pageSize)}
              </span>
              <button
                className="ghost"
                onClick={() => {
                  const next = Math.min(Math.ceil(total / pageSize), page + 1);
                  setPage(next);
                  loadLogs(status, query, next);
                }}
                disabled={page >= Math.ceil(total / pageSize)}
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
