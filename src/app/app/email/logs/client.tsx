"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";

type EmailEvent = {
  id: string;
  draft_id: string;
  recipient_email: string;
  message_id?: string | null;
  status: "sent" | "failed";
  error?: string | null;
  created_at: string;
  email_drafts?: {
    title?: string | null;
    subject?: string | null;
  } | null;
};

export default function EmailLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [status, setStatus] = useState("all");
  const [recipient, setRecipient] = useState("");
  const [draftId, setDraftId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const getAccessToken = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return null;
    }
    return data.session.access_token;
  }, [router]);

  const loadEvents = useCallback(async (nextPage = page) => {
    const token = await getAccessToken();
    if (!token) return;

    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (recipient) params.set("recipient", recipient);
    if (draftId) params.set("draftId", draftId);
    if (fromDate) params.set("fromDate", `${fromDate}T00:00:00.000Z`);
    if (toDate) params.set("toDate", `${toDate}T23:59:59.999Z`);
    params.set("page", String(nextPage));
    params.set("pageSize", String(pageSize));

    const res = await fetch(`/api/email/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await res.json();
    setEvents(payload.events || []);
    setTotal(payload.total || 0);
    setLoading(false);
  }, [getAccessToken, page, status, recipient, draftId, fromDate, toDate]);

  useEffect(() => {
    loadEvents(page);
  }, [loadEvents, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const handleExport = () => {
    const rows = [
      ["created_at", "status", "recipient_email", "draft_id", "subject", "error", "message_id"],
      ...events.map((event) => [
        event.created_at,
        event.status,
        event.recipient_email,
        event.draft_id,
        event.email_drafts?.subject || "",
        event.error || "",
        event.message_id || ""
      ])
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/\"/g, "\"\"")}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `email-events-page-${page}.csv`;
    link.click();
  };

  if (loading) {
    return <main className="app-loading" aria-live="polite"><div className="ui-skeleton-line" /><div className="ui-skeleton-line short" /></main>;
  }

  return (
    <main className="email-templates-page">
      <PageHeader
        title="Historique emails"
        subtitle="Suivez les envois, filtres avancés et export CSV."
        actions={
          <>
            <button className="ghost" type="button" onClick={() => router.push("/app/email")}>
              Retour
            </button>
            <button type="button" className="ghost" onClick={handleExport}>
              Export CSV (page)
            </button>
          </>
        }
      />

      <section className="email-grid">
        <form
          className="email-panel"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            loadEvents(1);
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
            Destinataire
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </label>
          <label>
            ID brouillon
            <input value={draftId} onChange={(e) => setDraftId(e.target.value)} />
          </label>
          <label>
            Date début
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label>
            Date fin
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <button className="cta" type="submit">Filtrer</button>
        </form>

        <section className="email-panel email-logs-panel">
          <h2>Événements</h2>
          {events.length === 0 && (
            <EmptyState
              title="Aucun événement"
              description="Aucun envoi ne correspond aux filtres actuels."
            />
          )}
          {events.map((event) => (
            <article key={event.id} className="module-card">
              <h3>{event.recipient_email}</h3>
              <p>{event.email_drafts?.subject || "(sans objet)"}</p>
              <p>Brouillon: {event.draft_id}</p>
              <p>Statut: {event.status}</p>
              <p>{new Date(event.created_at).toLocaleString("fr-FR")}</p>
              {event.error && <p className="error">{event.error}</p>}
            </article>
          ))}
          {total > pageSize && (
            <div className="pager">
              <button
                className="ghost"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Précédent
              </button>
              <span>Page {page} / {totalPages}</span>
              <button
                className="ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Suivant
              </button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
