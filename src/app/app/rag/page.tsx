"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import EmptyState from "@/components/ui/empty-state";
import InlineAlert from "@/components/ui/inline-alert";
import PageHeader from "@/components/ui/page-header";
import { listSearchMemory, saveKnowledge, upsertSearchMemory } from "@/lib/rag-memory";

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
  const [chatModel, setChatModel] = useState(MODELS[0]);
  const [chatProvider, setChatProvider] = useState("mistral");
  const [embeddingProvider, setEmbeddingProvider] = useState("mistral");
  const [chatAuthMode, setChatAuthMode] = useState("api_key");
  const [embeddingAuthMode, setEmbeddingAuthMode] = useState("api_key");
  const [chatBaseUrl, setChatBaseUrl] = useState("");
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [sourceMode, setSourceMode] = useState<"internal" | "legifrance" | "mix">(
    "internal"
  );
  const [legifranceFonds, setLegifranceFonds] = useState<string[]>(["CODE_ETAT"]);
  const [legifranceMaxResults, setLegifranceMaxResults] = useState(6);
  const [legifranceCodeName, setLegifranceCodeName] = useState("");
  const [legifranceVersionDate, setLegifranceVersionDate] = useState("");
  const [dictating, setDictating] = useState(false);

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
    upsertSearchMemory({
      id: entry.id,
      title: question.slice(0, 80),
      question: entry.question,
      answer: entry.answer,
      citations: entry.citations,
      createdAt: entry.createdAt
    });
  };


  const responseMarkdown = useMemo(() => answer || "", [answer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const entryId = new URLSearchParams(window.location.search).get("entry");
    if (!entryId) return;
    const entry = listSearchMemory().find((item) => item.id === entryId);
    if (!entry) return;
    setQuestion(entry.question);
    setAnswer(entry.answer);
    setCitations(entry.citations);
  }, []);

  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setQueryError("La dictée vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    setQueryError(null);
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setDictating(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        setQuestion((prev) => `${prev} ${transcript}`.trim());
      }
    };
    recognition.onerror = () => {
      setQueryError("Impossible de démarrer la dictée vocale.");
      setDictating(false);
    };
    recognition.onend = () => {
      setDictating(false);
    };
    recognition.start();
  };

  if (loading) {
    return <main className="app-loading" aria-live="polite"><div className="ui-skeleton-line" /><div className="ui-skeleton-line short" /></main>;
  }

  return (
    <main className="rag rag-v2">
      <PageHeader
        title="Recherche RAG"
        subtitle="Interrogez vos sources internes et Légifrance avec traçabilité."
        actions={
          <button className="cta" type="button" onClick={() => setShowUpload(true)}>
            Ajouter des sources
          </button>
        }
      />
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
                saveKnowledge({
                  id: entry.id,
                  title: question.slice(0, 80),
                  question: entry.question,
                  answer: entry.answer,
                  citations: entry.citations,
                  createdAt: entry.createdAt
                });
              }}
            >
              Sauvegarder dans Knowledge Base
            </button>
            <button type="button" className="mini-btn" onClick={() => router.push("/app/documents")}>
              Vers production documents
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

      <form className="rag-query" onSubmit={handleQuery}>
        <div className="query-mode">
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${sourceMode === "internal" ? "active" : ""}`}
              onClick={() => setSourceMode("internal")}
            >
              Interne
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
            <button type="button" className="mode-btn" onClick={() => setShowUpload(true)}>
              + Sources
            </button>
            <button type="button" className="mode-btn" onClick={startVoiceInput}>
              {dictating ? "● Dictée..." : "🎙 Dictée"}
            </button>
          </div>
          <div className="chip-list">
            {sources.slice(0, 8).map((source) => (
              <div key={source.id} className={`chip ${selectedSources.includes(source.id) ? "chip-active" : ""}`}>
                <button
                  type="button"
                  className="chip-label"
                  onClick={() =>
                    setSelectedSources((prev) =>
                      prev.includes(source.id)
                        ? prev.filter((id) => id !== source.id)
                        : [...prev, source.id]
                    )
                  }
                >
                  {source.title}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="query-bar">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Posez votre question..."
          />
          <button className="cta" type="submit" disabled={querying}>
            {querying ? "Recherche..." : "Envoyer"}
          </button>
        </div>
        {queryError && <InlineAlert tone="error">{queryError}</InlineAlert>}
      </form>


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
