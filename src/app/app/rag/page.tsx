"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import EmptyState from "@/components/ui/empty-state";
import InlineAlert from "@/components/ui/inline-alert";
import PageHeader from "@/components/ui/page-header";

type Citation = {
  id: string;
  snippet: string;
  score: number;
  source_title?: string | null;
  source_url?: string | null;
};

type SourceItem = {
  id: string;
  title: string;
  status: string;
  source_type: string;
  created_at: string;
};

type AnswerEntry = {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  createdAt: string;
};

const MODELS = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest"
];
const OPENAI_DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const OPENAI_DEFAULT_EMBED_MODEL = "text-embedding-3-small";
const LEGIFRANCE_FONDS = [
  { id: "CODE_ETAT", label: "Codes en vigueur" },
  { id: "CODE_DATE", label: "Codes à date" },
  { id: "LODA_ETAT", label: "Lois & décrets (état)" },
  { id: "LODA_DATE", label: "Lois & décrets (date)" },
  { id: "KALI", label: "Conventions collectives" },
  { id: "JURI", label: "Jurisprudence" },
  { id: "JORF", label: "Journal officiel" }
];

export default function RagPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [question, setQuestion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [sourceTab, setSourceTab] = useState<"upload" | "paste" | "url">("upload");
  const [pasteText, setPasteText] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [responseMode, setResponseMode] = useState<"per-source" | "synthesis">(
    "per-source"
  );
  const [history, setHistory] = useState<AnswerEntry[]>([]);
  const [saved, setSaved] = useState<AnswerEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [chatModel, setChatModel] = useState(MODELS[0]);
  const [chatProvider, setChatProvider] = useState("mistral");
  const [embeddingProvider, setEmbeddingProvider] = useState("mistral");
  const [chatAuthMode, setChatAuthMode] = useState("api_key");
  const [embeddingAuthMode, setEmbeddingAuthMode] = useState("api_key");
  const [chatBaseUrl, setChatBaseUrl] = useState("");
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceMode, setSourceMode] = useState<"internal" | "legifrance" | "mix">(
    "internal"
  );
  const [legifranceFonds, setLegifranceFonds] = useState<string[]>(["CODE_ETAT"]);
  const [legifranceMaxResults, setLegifranceMaxResults] = useState(6);
  const [legifranceCodeName, setLegifranceCodeName] = useState("");
  const [legifranceVersionDate, setLegifranceVersionDate] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }

      const fetchSources = async () => {
        const res = await fetch("/api/sources", {
          headers: { Authorization: `Bearer ${data.session.access_token}` }
        });
        const payload = await res.json();
        if (!cancelled) {
          setSources(payload.sources || []);
        }
      };

      await fetchSources();
      interval = setInterval(fetchSources, 5000);

      const settingsRes = await fetch("/api/settings/ai", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const settingsPayload = await settingsRes.json();
      if (settingsPayload?.settings && !cancelled) {
        const s = settingsPayload.settings;
        const nextChatProvider = s.chatProvider || s.provider || "mistral";
        const nextEmbeddingProvider =
          s.embeddingProvider || s.chatProvider || s.provider || "mistral";
        setChatProvider(nextChatProvider);
        setEmbeddingProvider(nextEmbeddingProvider);
        setChatAuthMode(s.chatAuthMode || s.authMode || "api_key");
        setEmbeddingAuthMode(s.embeddingAuthMode || s.authMode || "api_key");
        setChatModel(s.chatModel || s.model || MODELS[0]);
        setChatBaseUrl(s.chatBaseUrl || s.baseUrl || "");
        setEmbeddingBaseUrl(s.embeddingBaseUrl || "");
        setEmbeddingModel(s.embeddingModel || s.customEmbeddingModel || "");
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [router]);

  useEffect(() => {
    if (chatProvider === "mistral" && !MODELS.includes(chatModel)) {
      setChatModel(MODELS[0]);
    }
    if (chatProvider === "openai") {
      if (!chatModel || MODELS.includes(chatModel)) {
        setChatModel(OPENAI_DEFAULT_CHAT_MODEL);
      }
    }
    if (embeddingProvider === "openai" && !embeddingModel) {
      setEmbeddingModel(OPENAI_DEFAULT_EMBED_MODEL);
    }
  }, [chatProvider, embeddingProvider, chatModel, embeddingModel]);

  const handleUploadFile = async () => {
    if (!file) {
      setUploadError("Sélectionnez un fichier PDF ou DOCX.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${data.session.access_token}`,
      "x-embedding-provider": embeddingProvider,
      "x-embedding-auth-mode": embeddingAuthMode
    };

    if (embeddingBaseUrl) headers["x-embedding-base-url"] = embeddingBaseUrl;
    if (embeddingModel) headers["x-embedding-model"] = embeddingModel;

    const res = await fetch("/api/ingest", {
      method: "POST",
      headers,
      body: formData
    });

    if (!res.ok) {
      const message = await res.text();
      setUploadError(message || "Erreur lors de l'upload");
      setUploading(false);
      return;
    }

    setUploadMessage("Source ajoutée et indexée.");
    setFile(null);
    setUploading(false);
  };

  const handlePasteText = async () => {
    if (!pasteText.trim()) {
      setUploadError("Collez un texte à indexer.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const blob = new Blob([pasteText], { type: "text/plain" });
    const formData = new FormData();
    formData.append("file", blob, "texte.txt");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${data.session.access_token}`,
      "x-embedding-provider": embeddingProvider,
      "x-embedding-auth-mode": embeddingAuthMode
    };

    if (embeddingBaseUrl) headers["x-embedding-base-url"] = embeddingBaseUrl;
    if (embeddingModel) headers["x-embedding-model"] = embeddingModel;

    const res = await fetch("/api/ingest", {
      method: "POST",
      headers,
      body: formData
    });

    if (!res.ok) {
      const message = await res.text();
      setUploadError(message || "Erreur lors de l'indexation");
      setUploading(false);
      return;
    }

    setUploadMessage("Texte ajouté et indexé.");
    setPasteText("");
    setUploading(false);
  };

  const handleUrl = async () => {
    if (!urlValue.trim()) {
      setUploadError("Ajoutez une URL valide.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      "x-embedding-provider": embeddingProvider,
      "x-embedding-auth-mode": embeddingAuthMode
    };

    if (embeddingBaseUrl) headers["x-embedding-base-url"] = embeddingBaseUrl;
    if (embeddingModel) headers["x-embedding-model"] = embeddingModel;

    const res = await fetch("/api/ingest-url", {
      method: "POST",
      headers,
      body: JSON.stringify({ url: urlValue })
    });

    if (!res.ok) {
      const message = await res.text();
      setUploadError(message || "Erreur lors de l'import URL");
      setUploading(false);
      return;
    }

    setUploadMessage("URL importée et indexée.");
    setUrlValue("");
    setUploading(false);
  };

  const handleQuery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQueryError(null);
    setAnswer(null);
    setCitations([]);

    if (!question.trim()) {
      setQueryError("Veuillez saisir une question.");
      return;
    }
    const legifranceEnabled = sourceMode !== "internal";
    const legifranceExclusive = sourceMode === "legifrance";
    if (legifranceEnabled && legifranceFonds.length === 0) {
      setQueryError("Sélectionnez au moins un fond Légifrance.");
      return;
    }

    setQuerying(true);
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      "x-chat-provider": chatProvider,
      "x-chat-auth-mode": chatAuthMode,
      "x-embedding-provider": embeddingProvider,
      "x-embedding-auth-mode": embeddingAuthMode
    };

    if (chatBaseUrl) headers["x-chat-base-url"] = chatBaseUrl;
    if (embeddingBaseUrl) headers["x-embedding-base-url"] = embeddingBaseUrl;
    if (embeddingModel) headers["x-embedding-model"] = embeddingModel;

    const res = await fetch("/api/query", {
      method: "POST",
      headers,
      body: JSON.stringify({
        question,
        model: chatModel,
        sourceIds: selectedSources,
        responseMode,
        externalSources: {
          legifrance: {
            enabled: legifranceEnabled,
            exclusive: legifranceExclusive,
            fonds: legifranceFonds,
            maxResults: legifranceMaxResults,
            codeName: legifranceCodeName.trim(),
            versionDate: legifranceVersionDate || null
          }
        }
      })
    });

    if (!res.ok) {
      const message = await res.text();
      setQueryError(message || "Erreur lors de la recherche");
      setQuerying(false);
      return;
    }

    const payload = await res.json();
    setAnswer(payload.answer || "");
    setCitations(payload.citations || []);
    setQuerying(false);

    const entry: AnswerEntry = {
      id: `${Date.now()}`,
      question,
      answer: payload.answer || "",
      citations: payload.citations || [],
      createdAt: new Date().toISOString()
    };
    setHistory((prev) => [entry, ...prev]);
  };


  const responseMarkdown = useMemo(() => answer || "", [answer]);

  if (loading) {
    return <main className="app-loading" aria-live="polite"><div className="ui-skeleton-line" /><div className="ui-skeleton-line short" /></main>;
  }

  return (
    <main className="rag rag-v2">
      <PageHeader
        title="Recherche RAG"
        subtitle="Interrogez vos sources internes et Légifrance avec traçabilité."
        actions={
          <>
            <button className="ghost" type="button" onClick={() => router.push("/app/settings")}>
              Réglages IA
            </button>
            <button className="cta" type="button" onClick={() => setShowUpload(true)}>
              Ajouter une source
            </button>
          </>
        }
      />

      <section className="rag-v2-grid">
        <article className="rag-v2-card">
          <div className="rag-sources-header">
            <h2>1. Sources</h2>
          </div>
          <p className="muted">Sélectionnez les sources à inclure dans la réponse.</p>
          <div className="chip-list">
            {sources.length === 0 && (
              <EmptyState
                title="Aucune source interne"
                description="Importez PDF, DOCX, texte ou URL pour commencer."
              />
            )}
            {sources.map((source) => {
              const selected = selectedSources.includes(source.id);
              return (
                <div key={source.id} className={`chip ${selected ? "chip-active" : ""}`}>
                  <button
                    type="button"
                    className="chip-label"
                    onClick={() => {
                      setSelectedSources((prev) =>
                        prev.includes(source.id)
                          ? prev.filter((id) => id !== source.id)
                          : [...prev, source.id]
                      );
                    }}
                  >
                    {source.title}
                  </button>
                  <div className="chip-actions">
                    <button
                      type="button"
                      className="chip-icon"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const next = window.prompt("Renommer la source", source.title);
                        if (!next) return;
                        const supabase = createBrowserSupabase();
                        const { data } = await supabase.auth.getSession();
                        if (!data.session) {
                          router.push("/login");
                          return;
                        }
                        const res = await fetch("/api/sources", {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${data.session.access_token}`
                          },
                          body: JSON.stringify({ id: source.id, title: next })
                        });
                        if (res.ok) {
                          setSources((prev) =>
                            prev.map((s) => (s.id === source.id ? { ...s, title: next } : s))
                          );
                        }
                      }}
                    >
                      <span className="chip-glyph" aria-hidden>✎</span>
                    </button>
                    <button
                      type="button"
                      className="chip-icon"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = window.confirm(`Supprimer la source "${source.title}" ?`);
                        if (!ok) return;
                        const supabase = createBrowserSupabase();
                        const { data } = await supabase.auth.getSession();
                        if (!data.session) {
                          router.push("/login");
                          return;
                        }
                        await fetch(`/api/sources?id=${source.id}`, {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${data.session.access_token}` }
                        });
                        setSources((prev) => prev.filter((s) => s.id !== source.id));
                        setSelectedSources((prev) => prev.filter((id) => id !== source.id));
                      }}
                    >
                      <span className="chip-glyph" aria-hidden>✕</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="source-mode">
            <span className="mode-label">Sources externes</span>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn ${sourceMode === "internal" ? "active" : ""}`}
                onClick={() => setSourceMode("internal")}
              >
                Internes
              </button>
              <button
                type="button"
                className={`mode-btn ${sourceMode === "mix" ? "active" : ""}`}
                onClick={() => setSourceMode("mix")}
              >
                Mix
              </button>
              <button
                type="button"
                className={`mode-btn ${sourceMode === "legifrance" ? "active" : ""}`}
                onClick={() => setSourceMode("legifrance")}
              >
                Légifrance
              </button>
            </div>
          </div>

          <div className="chip-list">
            {LEGIFRANCE_FONDS.map((fond) => {
              const selected = legifranceFonds.includes(fond.id);
              return (
                <div key={fond.id} className={`chip ${selected ? "chip-active" : ""}`}>
                  <button
                    type="button"
                    className="chip-label"
                    disabled={sourceMode === "internal"}
                    onClick={() => {
                      if (sourceMode === "internal") return;
                      setLegifranceFonds((prev) =>
                        prev.includes(fond.id)
                          ? prev.filter((id) => id !== fond.id)
                          : [...prev, fond.id]
                      );
                    }}
                  >
                    {fond.label}
                  </button>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rag-v2-card">
          <h2>2. Question</h2>
          <form className="rag-v2-form" onSubmit={handleQuery}>
            <div className="query-mode">
              <span className="mode-label">Mode de réponse</span>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={`mode-btn ${responseMode === "per-source" ? "active" : ""}`}
                  onClick={() => setResponseMode("per-source")}
                >
                  Par source
                </button>
                <button
                  type="button"
                  className={`mode-btn ${responseMode === "synthesis" ? "active" : ""}`}
                  onClick={() => setResponseMode("synthesis")}
                >
                  Synthèse
                </button>
              </div>
            </div>

            <div className="query-bar">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Tapez votre question ici"
              />
              <button className="cta" type="submit" disabled={querying}>
                {querying ? "Recherche..." : "Envoyer"}
              </button>
            </div>
            {queryError && <InlineAlert tone="error">{queryError}</InlineAlert>}

            <button
              type="button"
              className="ghost rag-advanced-toggle"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Masquer les options avancées" : "Afficher les options avancées"}
            </button>

            {showAdvanced && (
              <div className="rag-v2-advanced">
                <div className="form-row">
                  <label>
                    Fournisseur chat
                    <select value={chatProvider} onChange={(e) => setChatProvider(e.target.value)}>
                      <option value="mistral">Mistral</option>
                      <option value="openai">OpenAI</option>
                      <option value="cohere">Cohere</option>
                      <option value="groq">Groq</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label>
                    Authentification chat
                    <select value={chatAuthMode} onChange={(e) => setChatAuthMode(e.target.value)}>
                      <option value="api_key">Clé API</option>
                      <option value="oauth">OAuth</option>
                      <option value="server">Clé serveur</option>
                    </select>
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Fournisseur embeddings
                    <select
                      value={embeddingProvider}
                      onChange={(e) => setEmbeddingProvider(e.target.value)}
                    >
                      <option value="mistral">Mistral</option>
                      <option value="openai">OpenAI</option>
                      <option value="cohere">Cohere</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label>
                    Authentification embeddings
                    <select
                      value={embeddingAuthMode}
                      onChange={(e) => setEmbeddingAuthMode(e.target.value)}
                    >
                      <option value="api_key">Clé API</option>
                      <option value="oauth">OAuth</option>
                      <option value="server">Clé serveur</option>
                    </select>
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Modèle chat
                    <input value={chatModel} onChange={(e) => setChatModel(e.target.value)} />
                  </label>
                  <label>
                    Modèle embeddings
                    <input
                      value={embeddingModel}
                      onChange={(e) => setEmbeddingModel(e.target.value)}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Base URL chat
                    <input value={chatBaseUrl} onChange={(e) => setChatBaseUrl(e.target.value)} />
                  </label>
                  <label>
                    Base URL embeddings
                    <input
                      value={embeddingBaseUrl}
                      onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Nom du code Légifrance (optionnel)
                    <input
                      value={legifranceCodeName}
                      onChange={(e) => setLegifranceCodeName(e.target.value)}
                      placeholder="Ex: Code du travail"
                      disabled={sourceMode === "internal"}
                    />
                  </label>
                  <label>
                    Version à la date
                    <input
                      type="date"
                      value={legifranceVersionDate}
                      onChange={(e) => setLegifranceVersionDate(e.target.value)}
                      disabled={sourceMode === "internal"}
                    />
                  </label>
                </div>
                <label>
                  Résultats Légifrance par fond
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={legifranceMaxResults}
                    onChange={(e) => setLegifranceMaxResults(Number(e.target.value || 1))}
                    disabled={sourceMode === "internal"}
                  />
                </label>
              </div>
            )}
          </form>
        </article>
      </section>

      <section className="rag-v2-card rag-v2-answer">
        <div className="rag-response-header">
          <h2>3. Réponse</h2>
          <div className="rag-response-actions">
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                if (!answer) return;
                const entry: AnswerEntry = {
                  id: `${Date.now()}`,
                  question,
                  answer,
                  citations,
                  createdAt: new Date().toISOString()
                };
                setSaved((prev) => [entry, ...prev]);
              }}
            >
              Sauvegarder
            </button>
            <button type="button" className="mini-btn" onClick={() => setShowHistory((s) => !s)}>
              Historique
            </button>
            <button type="button" className="mini-btn" onClick={() => setShowSaved((s) => !s)}>
              Sauvegardées
            </button>
          </div>
        </div>

        {answer ? (
          <div className="rag-answer">
            <article className="history-card answer-card">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseMarkdown}</ReactMarkdown>
            </article>
            {citations.length > 0 && (
              <div className="citation-list">
                {citations.map((citation, index) => {
                  const preview =
                    citation.snippet.length > 160
                      ? `${citation.snippet.slice(0, 160)}…`
                      : citation.snippet;
                  return (
                    <button
                      key={citation.id}
                      type="button"
                      className="cite-card"
                      onClick={() => setActiveCitation(citation)}
                    >
                      <strong>
                        {citation.source_title || "Source"} #{index + 1}
                      </strong>
                      <span>{preview}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="Aucune réponse pour l'instant"
            description="Posez une question pour obtenir une synthèse référencée."
          />
        )}
      </section>

      {(showSaved || showHistory) && (
        <section className="rag-v2-grid">
          {showSaved && (
            <article className="rag-v2-card">
              <div className="panel-header">
                <strong>Réponses sauvegardées</strong>
                <button className="ghost" onClick={() => setShowSaved(false)} type="button">
                  Fermer
                </button>
              </div>
              {saved.length === 0 && <p className="muted">Aucune réponse sauvegardée.</p>}
              <div className="history-list">
                {saved.map((entry) => (
                  <article key={entry.id} className="history-card">
                    <div className="history-card-header">
                      <p className="muted">{entry.question}</p>
                      <button
                        type="button"
                        className="mini-icon"
                        onClick={() => navigator.clipboard.writeText(entry.answer)}
                        title="Copier la réponse"
                      >
                        ⧉
                      </button>
                    </div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.answer}</ReactMarkdown>
                  </article>
                ))}
              </div>
            </article>
          )}

          {showHistory && (
            <article className="rag-v2-card">
              <div className="panel-header">
                <strong>Historique</strong>
                <button className="ghost" onClick={() => setShowHistory(false)} type="button">
                  Fermer
                </button>
              </div>
              {history.length === 0 && <p className="muted">Aucune réponse enregistrée.</p>}
              <div className="history-list">
                {history.map((entry) => (
                  <article key={entry.id} className="history-card">
                    <div className="history-card-header">
                      <p className="muted">{entry.question}</p>
                      <button
                        type="button"
                        className="mini-icon"
                        onClick={() => navigator.clipboard.writeText(entry.answer)}
                        title="Copier la réponse"
                      >
                        ⧉
                      </button>
                    </div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.answer}</ReactMarkdown>
                  </article>
                ))}
              </div>
            </article>
          )}
        </section>
      )}


      {showUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <strong>Ajouter une source</strong>
              <button className="ghost" type="button" onClick={() => setShowUpload(false)}>
                Fermer
              </button>
            </div>
            <div className="modal-tabs">
              <button
                type="button"
                className={sourceTab === "upload" ? "tab active" : "tab"}
                onClick={() => setSourceTab("upload")}
              >
                Upload
              </button>
              <button
                type="button"
                className={sourceTab === "paste" ? "tab active" : "tab"}
                onClick={() => setSourceTab("paste")}
              >
                Coller texte
              </button>
              <button
                type="button"
                className={sourceTab === "url" ? "tab active" : "tab"}
                onClick={() => setSourceTab("url")}
              >
                URL
              </button>
            </div>
            <div className="modal-body">
              {sourceTab === "upload" && (
                <>
                  <label>
                    Fichier (PDF/DOCX)
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button className="cta" type="button" onClick={handleUploadFile} disabled={uploading}>
                    {uploading ? "Indexation..." : "Importer"}
                  </button>
                </>
              )}
              {sourceTab === "paste" && (
                <>
                  <label>
                    Texte brut
                    <textarea
                      rows={8}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                    />
                  </label>
                  <button className="cta" type="button" onClick={handlePasteText} disabled={uploading}>
                    {uploading ? "Indexation..." : "Indexer"}
                  </button>
                </>
              )}
              {sourceTab === "url" && (
                <>
                  <label>
                    URL
                    <input value={urlValue} onChange={(e) => setUrlValue(e.target.value)} />
                  </label>
                  <button className="cta" type="button" onClick={handleUrl} disabled={uploading}>
                    {uploading ? "Import..." : "Importer"}
                  </button>
                </>
              )}
              {uploadError && <p className="error">{uploadError}</p>}
              {uploadMessage && <p className="success">{uploadMessage}</p>}
            </div>
          </div>
        </div>
      )}

      {activeCitation && (
        <div className="citation-overlay">
          <div className="citation-modal">
            <div className="citation-header">
              <div>
                <strong>{activeCitation.source_title || "Source"}</strong>
                <span>Citation</span>
              </div>
              <button className="ghost" type="button" onClick={() => setActiveCitation(null)}>
                Fermer
              </button>
            </div>
            {activeCitation.source_url && (
              <a
                className="cite-link"
                href={activeCitation.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir la source
              </a>
            )}
            <p className="citation-text">{activeCitation.snippet}</p>
            <div className="citation-actions">
              <button
                className="cta"
                type="button"
                onClick={() => navigator.clipboard.writeText(activeCitation.snippet)}
              >
                Copier la citation
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
