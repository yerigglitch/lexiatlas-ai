"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import InlineAlert from "@/components/ui/inline-alert";
import PageHeader from "@/components/ui/page-header";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const DEFAULT_BACKOFFICE_PROVIDER = "mistral";
  const [chatApiKey, setChatApiKey] = useState("");
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");
  const [providers, setProviders] = useState<
    Array<{
      id: string;
      label: string;
      type: string;
      defaultBaseUrl: string;
      defaultChatModel: string;
      defaultEmbeddingModel: string;
      serverKeyAvailable: boolean;
      oauthConfigured: boolean;
      oauthConnected: boolean;
      apiKeyStored: boolean;
    }>
  >([]);
  const [providerSelection, setProviderSelection] = useState("mistral");
  const [chatProvider, setChatProvider] = useState("mistral");
  const [embeddingProvider, setEmbeddingProvider] = useState("mistral");
  const [chatAuthMode, setChatAuthMode] = useState<"api_key" | "oauth" | "server">("api_key");
  const [embeddingAuthMode, setEmbeddingAuthMode] = useState<"api_key" | "oauth" | "server">(
    "api_key"
  );
  const [chatBaseUrl, setChatBaseUrl] = useState("");
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [settingsMenu, setSettingsMenu] = useState<"general" | "chat" | "embeddings" | "admin">("general");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    setLoading(true);
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/settings/ai", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      });
      const payload = await res.json();
      const providerList = payload?.providers || [];
      setProviders(providerList);

      const settings = payload?.settings || {};
      const savedChatProvider =
        settings.chatProvider || settings.provider || providerList[0]?.id || "mistral";
      const savedEmbeddingProvider = settings.embeddingProvider || savedChatProvider;
      const chatConfig = providerList.find((p: any) => p.id === savedChatProvider);
      const embeddingConfig = providerList.find((p: any) => p.id === savedEmbeddingProvider);
      const savedChatAuth =
        settings.chatAuthMode ||
        settings.authMode ||
        (settings.keyMode === "server" ? "server" : "api_key");
      const savedEmbeddingAuth =
        settings.embeddingAuthMode ||
        settings.authMode ||
        (settings.keyMode === "server" ? "server" : "api_key");
      const isDefault =
        savedChatAuth === "server" &&
        savedEmbeddingAuth === "server" &&
        savedChatProvider === DEFAULT_BACKOFFICE_PROVIDER &&
        savedEmbeddingProvider === DEFAULT_BACKOFFICE_PROVIDER;

      setChatProvider(savedChatProvider);
      setEmbeddingProvider(savedEmbeddingProvider);
      setChatAuthMode(savedChatAuth);
      setEmbeddingAuthMode(savedEmbeddingAuth);
      setProviderSelection(isDefault ? "__default__" : "custom");
      setChatBaseUrl(settings.chatBaseUrl || settings.baseUrl || chatConfig?.defaultBaseUrl || "");
      setEmbeddingBaseUrl(settings.embeddingBaseUrl || embeddingConfig?.defaultBaseUrl || "");
      setChatModel(settings.chatModel || settings.model || chatConfig?.defaultChatModel || "");
      setEmbeddingModel(settings.embeddingModel || embeddingConfig?.defaultEmbeddingModel || "");
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    const chat = providers.find((p) => p.id === chatProvider);
    const embedding = providers.find((p) => p.id === embeddingProvider);
    if (!chat || !embedding) return;
    if (chatAuthMode === "oauth" && !chat.oauthConfigured) {
      setChatAuthMode("api_key");
    }
    if (chatAuthMode === "server" && !chat.serverKeyAvailable) {
      setChatAuthMode("api_key");
    }
    if (embeddingAuthMode === "oauth" && !embedding.oauthConfigured) {
      setEmbeddingAuthMode("api_key");
    }
    if (embeddingAuthMode === "server" && !embedding.serverKeyAvailable) {
      setEmbeddingAuthMode("api_key");
    }
  }, [providers, chatProvider, embeddingProvider, chatAuthMode, embeddingAuthMode]);

  const saveApiKey = async (providerId: string, apiKeyValue: string) => {
    setError(null);
    setSuccess(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/settings/api-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({ apiKey: apiKeyValue, provider: providerId })
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de l'enregistrement");
      return;
    }

    setSuccess(`Clé ${providerId} enregistrée.`);
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, apiKeyStored: true } : p))
    );
  };

  const handleSaveChatApiKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveApiKey(chatProvider, chatApiKey);
    setChatApiKey("");
  };

  const handleSaveEmbeddingApiKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveApiKey(embeddingProvider, embeddingApiKey);
    setEmbeddingApiKey("");
  };

  const handleSaveSettings = async () => {
    setSettingsMessage(null);
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/settings/rag", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({
        settings: {
          provider: chatProvider,
          authMode: chatAuthMode,
          keyMode: providerSelection === "__default__" ? "server" : "user",
          model: chatModel,
          baseUrl: chatBaseUrl,
          chatProvider,
          chatAuthMode,
          chatModel,
          chatBaseUrl,
          embeddingProvider,
          embeddingAuthMode,
          embeddingModel,
          embeddingBaseUrl
        }
      })
    });

    if (!res.ok) {
      setSettingsMessage("Erreur lors de la sauvegarde.");
      return;
    }

    setSettingsMessage("Réglages IA enregistrés.");
  };

  const runTest = async (kind: "chat" | "embedding") => {
    setTestMessage(null);
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const payload =
      kind === "chat"
        ? {
            kind,
            provider: chatProvider,
            authMode: chatAuthMode,
            baseUrl: chatBaseUrl,
            model: chatModel
          }
        : {
            kind,
            provider: embeddingProvider,
            authMode: embeddingAuthMode,
            baseUrl: embeddingBaseUrl,
            model: embeddingModel
          };

    const res = await fetch("/api/settings/ai/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const responsePayload = await res.json();
    if (!res.ok) {
      setTestMessage(responsePayload?.error || "Test échoué.");
      return;
    }
    setTestMessage(kind === "chat" ? "Test chat OK." : "Test embeddings OK.");
  };

  if (loading) {
    return <main className="app-loading" aria-live="polite"><div className="ui-skeleton-line" /><div className="ui-skeleton-line short" /></main>;
  }

  const selectedChatProvider = providers.find((p) => p.id === chatProvider);
  const selectedEmbeddingProvider = providers.find((p) => p.id === embeddingProvider);
  const chatNeedsBaseUrl = selectedChatProvider?.type === "openai_compat";
  const embeddingNeedsBaseUrl = selectedEmbeddingProvider?.type === "openai_compat";
  const chatHasServerKey = Boolean(selectedChatProvider?.serverKeyAvailable);
  const embeddingHasServerKey = Boolean(selectedEmbeddingProvider?.serverKeyAvailable);
  const chatOauthReady = Boolean(selectedChatProvider?.oauthConfigured);
  const embeddingOauthReady = Boolean(selectedEmbeddingProvider?.oauthConfigured);
  const chatOauthConnected = Boolean(selectedChatProvider?.oauthConnected);
  const embeddingOauthConnected = Boolean(selectedEmbeddingProvider?.oauthConnected);
  const activeProfile =
    providerSelection === "__default__"
      ? "Back-office (Mistral serveur)"
      : `${selectedChatProvider?.label || chatProvider} (chat) + ${selectedEmbeddingProvider?.label || embeddingProvider} (embeddings)`;

  return (
    <main className="module settings-v2">
      <PageHeader
        title="Réglages IA"
        subtitle="Fournisseurs, authentification, tests et configuration opérationnelle."
        actions={
          <button className="ghost" onClick={() => router.push("/app")}>
            Retour
          </button>
        }
      />

      <section className="settings-summary-card">
        <h2>Configuration active</h2>
        <p className="muted">{activeProfile}</p>
        <div className="settings-summary-grid">
          <div>
            <strong>Chat</strong>
            <span>{selectedChatProvider?.label || chatProvider} · {chatAuthMode}</span>
          </div>
          <div>
            <strong>Embeddings</strong>
            <span>{selectedEmbeddingProvider?.label || embeddingProvider} · {embeddingAuthMode}</span>
          </div>
          <div>
            <strong>Statut OAuth</strong>
            <span>
              {chatOauthConnected || embeddingOauthConnected ? "Connecté" : "Non connecté"}
            </span>
          </div>
        </div>
      </section>

      <section className="module-card">
        <label>
          Rubrique
          <select
            value={settingsMenu}
            onChange={(event) => setSettingsMenu(event.target.value as "general" | "chat" | "embeddings" | "admin")}
          >
            <option value="general">Général</option>
            <option value="chat">Chat</option>
            <option value="embeddings">Embeddings</option>
            <option value="admin">Administration</option>
          </select>
        </label>
      </section>

      <section className="module-grid">
        <div className="module-list">
          <div className="module-card settings-config-card">
            <h2>1. Profil et fournisseurs IA</h2>
            <p className="muted">
              Choisissez un profil simple ou personnalisez chat/embeddings.
            </p>
            <label>
              Profil
              <select
                value={providerSelection}
                onChange={(e) => {
                  const nextSelection = e.target.value;
                  setProviderSelection(nextSelection);
                  if (nextSelection === "__default__") {
                    setChatProvider(DEFAULT_BACKOFFICE_PROVIDER);
                    setEmbeddingProvider(DEFAULT_BACKOFFICE_PROVIDER);
                    setChatAuthMode("server");
                    setEmbeddingAuthMode("server");
                    setChatBaseUrl("");
                    setEmbeddingBaseUrl("");
                    setChatModel("");
                    setEmbeddingModel("");
                    setSettingsMessage(null);
                    setSuccess(null);
                    setError(null);
                    return;
                  }
                  setProviderSelection("custom");
                  const nextChat = providers.find((p) => p.id === chatProvider);
                  const nextEmbedding = providers.find((p) => p.id === embeddingProvider);
                  setChatBaseUrl(nextChat?.defaultBaseUrl || "");
                  setEmbeddingBaseUrl(nextEmbedding?.defaultBaseUrl || "");
                  setChatModel(nextChat?.defaultChatModel || "");
                  setEmbeddingModel(nextEmbedding?.defaultEmbeddingModel || "");
                  setSettingsMessage(null);
                  setSuccess(null);
                  setError(null);
                }}
              >
                <option value="__default__">Par défaut (back-office)</option>
                <option value="custom">Personnaliser</option>
              </select>
            </label>

            {providerSelection !== "__default__" && settingsMenu !== "admin" && (
              <>
                {settingsMenu === "general" && (
                  <>
                    <div className="module-note">Presets rapides</div>
                    <div className="form-row">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setChatProvider("groq");
                          setChatAuthMode("api_key");
                          setChatBaseUrl("https://api.groq.com/openai/v1");
                          setChatModel("llama-3.3-70b-versatile");
                          setEmbeddingProvider("cohere");
                          setEmbeddingAuthMode("api_key");
                          setEmbeddingBaseUrl("https://api.cohere.com");
                          setEmbeddingModel("embed-multilingual-v3.0");
                          setSettingsMessage(null);
                        }}
                      >
                        RAG premium (Groq + Cohere)
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setChatProvider("gemini");
                          setChatAuthMode("api_key");
                          setChatBaseUrl("https://generativelanguage.googleapis.com/v1beta");
                          setChatModel("gemini-2.5-pro");
                          setEmbeddingProvider("mistral");
                          setEmbeddingAuthMode("server");
                          setEmbeddingBaseUrl("");
                          setEmbeddingModel("");
                          setSettingsMessage(null);
                        }}
                      >
                        RAG stable (Gemini + Mistral)
                      </button>
                    </div>
                  </>
                )}

                {(settingsMenu === "general" || settingsMenu === "chat") && (
                  <>
                    <div className="module-note">2. Chat</div>
                <label>
                  Fournisseur chat
                  <select
                    value={chatProvider}
                    onChange={(e) => {
                      const next = e.target.value;
                      setChatProvider(next);
                      const cfg = providers.find((p) => p.id === next);
                      if (next === "mistral") {
                        setChatBaseUrl("");
                        setChatModel("");
                      } else {
                        setChatBaseUrl(cfg?.defaultBaseUrl || "");
                        setChatModel(cfg?.defaultChatModel || "");
                      }
                      setSettingsMessage(null);
                      setSuccess(null);
                      setError(null);
                    }}
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Authentification chat
                  <select
                    value={chatAuthMode}
                    onChange={(e) => {
                      setChatAuthMode(e.target.value as "api_key" | "oauth" | "server");
                      setSettingsMessage(null);
                    }}
                  >
                    <option value="api_key">Clé API</option>
                    {chatOauthReady && <option value="oauth">OAuth</option>}
                    {chatHasServerKey && <option value="server">Clé back-office</option>}
                  </select>
                </label>
                {chatNeedsBaseUrl && (
                  <label>
                    Base URL chat
                    <input
                      value={chatBaseUrl}
                      onChange={(e) => setChatBaseUrl(e.target.value)}
                      placeholder="https://api.provider.com"
                    />
                  </label>
                )}
                <label>
                  Modèle chat
                  <input
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value)}
                    placeholder={selectedChatProvider?.defaultChatModel || "model-chat"}
                  />
                </label>
                {selectedChatProvider && !selectedChatProvider.defaultChatModel && (
                  <p className="muted">
                    Modèle chat non défini par défaut pour ce fournisseur. Renseignez-le.
                  </p>
                )}
                {chatAuthMode === "api_key" && (
                  <form onSubmit={handleSaveChatApiKey}>
                    <p className="muted">
                    {selectedChatProvider?.apiKeyStored
                        ? "Une clé est déjà enregistrée pour ce fournisseur."
                        : "Aucune clé enregistrée pour ce fournisseur."}
                    </p>
                    <label>
                      Clé API chat
                      <input
                        type="password"
                        value={chatApiKey}
                        onChange={(e) => setChatApiKey(e.target.value)}
                        placeholder="sk-..."
                        required
                      />
                    </label>
                    {error && <InlineAlert tone="error">{error}</InlineAlert>}
                    {success && <InlineAlert tone="success">{success}</InlineAlert>}
                    <button className="ghost" type="submit">
                      Enregistrer la clé chat
                    </button>
                  </form>
                )}
                {chatAuthMode === "oauth" && (
                  <div>
                    <p className="muted">
                      {chatOauthConnected
                        ? "OAuth connecté."
                        : chatOauthReady
                          ? "OAuth prêt. Connectez-vous pour autoriser l'accès."
                          : "OAuth non configuré côté serveur."}
                    </p>
                    <button
                      className="ghost"
                      type="button"
                      disabled={!chatOauthReady}
                      onClick={async () => {
                        const supabase = createBrowserSupabase();
                        const { data } = await supabase.auth.getSession();
                        if (!data.session) {
                          router.push("/login");
                          return;
                        }
                        const res = await fetch(`/api/oauth/${chatProvider}/start?format=json&redirect=/app/settings`, {
                          headers: { Authorization: `Bearer ${data.session.access_token}` }
                        });
                        const payload = await res.json();
                        if (payload?.url) {
                          window.location.href = payload.url;
                        }
                      }}
                    >
                      {chatOauthConnected ? "Reconnecter OAuth" : "Connecter OAuth"}
                    </button>
                  </div>
                )}
                <button
                  className="ghost"
                  type="button"
                  onClick={() => runTest("chat")}
                >
                  Tester le chat
                </button>
                  </>
                )}

                {(settingsMenu === "general" || settingsMenu === "embeddings") && (
                  <>
                    <div className="module-note">3. Embeddings</div>
                <label>
                  Fournisseur embeddings
                  <select
                    value={embeddingProvider}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEmbeddingProvider(next);
                      const cfg = providers.find((p) => p.id === next);
                      if (next === "mistral") {
                        setEmbeddingBaseUrl("");
                        setEmbeddingModel("");
                      } else {
                        setEmbeddingBaseUrl(cfg?.defaultBaseUrl || "");
                        setEmbeddingModel(cfg?.defaultEmbeddingModel || "");
                      }
                      setSettingsMessage(null);
                      setSuccess(null);
                      setError(null);
                    }}
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Authentification embeddings
                  <select
                    value={embeddingAuthMode}
                    onChange={(e) => {
                      setEmbeddingAuthMode(e.target.value as "api_key" | "oauth" | "server");
                      setSettingsMessage(null);
                    }}
                  >
                    <option value="api_key">Clé API</option>
                    {embeddingOauthReady && <option value="oauth">OAuth</option>}
                    {embeddingHasServerKey && <option value="server">Clé back-office</option>}
                  </select>
                </label>
                {embeddingNeedsBaseUrl && (
                  <label>
                    Base URL embeddings
                    <input
                      value={embeddingBaseUrl}
                      onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
                      placeholder="https://api.provider.com"
                    />
                  </label>
                )}
                <label>
                  Modèle embeddings
                  <input
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder={selectedEmbeddingProvider?.defaultEmbeddingModel || "model-embed"}
                  />
                </label>
                {selectedEmbeddingProvider && !selectedEmbeddingProvider.defaultEmbeddingModel && (
                  <p className="muted">
                    Pas de modèle embeddings par défaut pour ce fournisseur. Choisissez-en un ou utilisez Mistral.
                  </p>
                )}
                {embeddingAuthMode === "api_key" && (
                  <form onSubmit={handleSaveEmbeddingApiKey}>
                    <p className="muted">
                    {selectedEmbeddingProvider?.apiKeyStored
                        ? "Une clé est déjà enregistrée pour ce fournisseur."
                        : "Aucune clé enregistrée pour ce fournisseur."}
                    </p>
                    <label>
                      Clé API embeddings
                      <input
                        type="password"
                        value={embeddingApiKey}
                        onChange={(e) => setEmbeddingApiKey(e.target.value)}
                        placeholder="sk-..."
                        required
                      />
                    </label>
                    {error && <InlineAlert tone="error">{error}</InlineAlert>}
                    {success && <InlineAlert tone="success">{success}</InlineAlert>}
                    <button className="ghost" type="submit">
                      Enregistrer la clé embeddings
                    </button>
                  </form>
                )}
                {embeddingAuthMode === "oauth" && (
                  <div>
                    <p className="muted">
                      {embeddingOauthConnected
                        ? "OAuth connecté."
                        : embeddingOauthReady
                          ? "OAuth prêt. Connectez-vous pour autoriser l'accès."
                          : "OAuth non configuré côté serveur."}
                    </p>
                    <button
                      className="ghost"
                      type="button"
                      disabled={!embeddingOauthReady}
                      onClick={async () => {
                        const supabase = createBrowserSupabase();
                        const { data } = await supabase.auth.getSession();
                        if (!data.session) {
                          router.push("/login");
                          return;
                        }
                        const res = await fetch(`/api/oauth/${embeddingProvider}/start?format=json&redirect=/app/settings`, {
                          headers: { Authorization: `Bearer ${data.session.access_token}` }
                        });
                        const payload = await res.json();
                        if (payload?.url) {
                          window.location.href = payload.url;
                        }
                      }}
                    >
                      {embeddingOauthConnected ? "Reconnecter OAuth" : "Connecter OAuth"}
                    </button>
                  </div>
                )}
                <button
                  className="ghost"
                  type="button"
                  onClick={() => runTest("embedding")}
                >
                  Tester les embeddings
                </button>
                  </>
                )}
              </>
            )}

            {settingsMessage && <InlineAlert tone="success">{settingsMessage}</InlineAlert>}
            {testMessage && <InlineAlert tone="info">{testMessage}</InlineAlert>}
            <button className="cta" type="button" onClick={handleSaveSettings}>
              Sauvegarder les réglages
            </button>
          </div>

          {settingsMenu === "admin" && <div className="module-card">
            <h2>Accès & rôles</h2>
            <p className="muted">Gérez les collaborateurs et leurs permissions.</p>
            <button className="ghost" type="button" onClick={() => router.push("/app/settings/roles")}>
              Ouvrir
            </button>
          </div>}

          {settingsMenu === "admin" && <div className="module-card">
            <h2>Sécurité</h2>
            <p className="muted">Journalisation, contrôles et bonnes pratiques.</p>
            <button className="ghost" type="button" onClick={() => router.push("/app/settings/security")}>
              Ouvrir
            </button>
          </div>}
        </div>

        {settingsMenu === "admin" && <aside className="module-panel">
          <h2>Actions admin</h2>
          <ul>
            <li>Configurer SMTP pour l&apos;envoi.</li>
            <li>Configurer Yousign pour signatures.</li>
            <li>Consulter l&apos;usage dans Statistiques.</li>
          </ul>
          <button className="ghost" onClick={() => router.push("/app/settings/email")}>
            SMTP
          </button>
          <button className="ghost" onClick={() => router.push("/app/settings/yousign")}>
            Yousign
          </button>
          <button className="ghost" onClick={() => router.push("/app/settings/stats")}>
            Statistiques
          </button>
        </aside>}
      </section>
    </main>
  );
}
