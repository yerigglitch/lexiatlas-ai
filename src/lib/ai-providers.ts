import { env } from "@/lib/env";

export type AiProviderId =
  | "mistral"
  | "openai"
  | "gemini"
  | "cohere"
  | "groq"
  | "custom"
  | "anthropic"
  | "kimi"
  | "grok"
  | "zai"
  | "deepseek"
  | "meta";

export type AiProviderType =
  | "mistral"
  | "openai"
  | "openai_compat"
  | "google_gemini"
  | "cohere";

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
};

export type AiProviderConfig = {
  id: AiProviderId;
  label: string;
  type: AiProviderType;
  defaultBaseUrl?: string;
  defaultChatModel?: string;
  defaultEmbeddingModel?: string;
  envServerKey?: string;
  oauth?: OAuthConfig;
};

const providerList: AiProviderConfig[] = [
  {
    id: "mistral",
    label: "Mistral",
    type: "mistral",
    defaultChatModel: "mistral-small-latest",
    defaultEmbeddingModel: "mistral-embed",
    envServerKey: env.mistralDefaultKey,
    oauth: {
      clientId: process.env.MISTRAL_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.MISTRAL_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.MISTRAL_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.MISTRAL_OAUTH_TOKEN_URL || "",
      scopes: process.env.MISTRAL_OAUTH_SCOPES || ""
    }
  },
  {
    id: "openai",
    label: "OpenAI",
    type: "openai",
    defaultBaseUrl: "https://api.openai.com",
    defaultChatModel: "gpt-4o-mini",
    defaultEmbeddingModel: "text-embedding-3-small",
    envServerKey: env.openaiDefaultKey,
    oauth: {
      clientId: process.env.OPENAI_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.OPENAI_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.OPENAI_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.OPENAI_OAUTH_TOKEN_URL || "",
      scopes: process.env.OPENAI_OAUTH_SCOPES || ""
    }
  },
  {
    id: "gemini",
    label: "Gemini",
    type: "google_gemini",
    defaultBaseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
    defaultChatModel: process.env.GEMINI_DEFAULT_CHAT_MODEL || "gemini-2.5-pro",
    defaultEmbeddingModel: process.env.GEMINI_DEFAULT_EMBED_MODEL || "gemini-embedding-001",
    envServerKey: process.env.GEMINI_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.GEMINI_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.GEMINI_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.GEMINI_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.GEMINI_OAUTH_TOKEN_URL || "",
      scopes: process.env.GEMINI_OAUTH_SCOPES || ""
    }
  },
  {
    id: "cohere",
    label: "Cohere",
    type: "cohere",
    defaultBaseUrl: process.env.COHERE_BASE_URL || "https://api.cohere.com",
    defaultChatModel: process.env.COHERE_DEFAULT_CHAT_MODEL || "",
    defaultEmbeddingModel: process.env.COHERE_DEFAULT_EMBED_MODEL || "embed-multilingual-v3.0",
    envServerKey: process.env.COHERE_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.COHERE_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.COHERE_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.COHERE_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.COHERE_OAUTH_TOKEN_URL || "",
      scopes: process.env.COHERE_OAUTH_SCOPES || ""
    }
  },
  {
    id: "groq",
    label: "Groq",
    type: "openai_compat",
    defaultBaseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    defaultChatModel: process.env.GROQ_DEFAULT_CHAT_MODEL || "llama-3.3-70b-versatile",
    defaultEmbeddingModel: process.env.GROQ_DEFAULT_EMBED_MODEL || "",
    envServerKey: process.env.GROQ_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.GROQ_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.GROQ_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.GROQ_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.GROQ_OAUTH_TOKEN_URL || "",
      scopes: process.env.GROQ_OAUTH_SCOPES || ""
    }
  },
  {
    id: "custom",
    label: "Autre (compatible OpenAI)",
    type: "openai_compat",
    defaultBaseUrl: "",
    defaultChatModel: "",
    defaultEmbeddingModel: "",
    envServerKey: "",
    oauth: undefined
  },
  {
    id: "anthropic",
    label: "Anthropic",
    type: "openai_compat",
    defaultBaseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
    defaultChatModel: process.env.ANTHROPIC_DEFAULT_CHAT_MODEL || "",
    defaultEmbeddingModel: process.env.ANTHROPIC_DEFAULT_EMBED_MODEL || "",
    envServerKey: process.env.ANTHROPIC_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.ANTHROPIC_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.ANTHROPIC_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.ANTHROPIC_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.ANTHROPIC_OAUTH_TOKEN_URL || "",
      scopes: process.env.ANTHROPIC_OAUTH_SCOPES || ""
    }
  },
  {
    id: "kimi",
    label: "Kimi",
    type: "openai_compat",
    defaultBaseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
    defaultChatModel: process.env.KIMI_DEFAULT_CHAT_MODEL || "",
    defaultEmbeddingModel: process.env.KIMI_DEFAULT_EMBED_MODEL || "",
    envServerKey: process.env.KIMI_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.KIMI_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.KIMI_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.KIMI_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.KIMI_OAUTH_TOKEN_URL || "",
      scopes: process.env.KIMI_OAUTH_SCOPES || ""
    }
  },
  {
    id: "grok",
    label: "Grok",
    type: "openai_compat",
    defaultBaseUrl: process.env.GROK_BASE_URL || "https://api.x.ai",
    defaultChatModel: process.env.GROK_DEFAULT_CHAT_MODEL || "",
    defaultEmbeddingModel: process.env.GROK_DEFAULT_EMBED_MODEL || "",
    envServerKey: process.env.GROK_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.GROK_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.GROK_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.GROK_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.GROK_OAUTH_TOKEN_URL || "",
      scopes: process.env.GROK_OAUTH_SCOPES || ""
    }
  },
  {
    id: "zai",
    label: "Z.ai",
    type: "openai_compat",
    defaultBaseUrl: process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4",
    defaultChatModel: process.env.ZAI_DEFAULT_CHAT_MODEL || "glm-4.6",
    defaultEmbeddingModel: process.env.ZAI_DEFAULT_EMBED_MODEL || "",
    envServerKey: process.env.ZAI_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.ZAI_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.ZAI_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.ZAI_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.ZAI_OAUTH_TOKEN_URL || "",
      scopes: process.env.ZAI_OAUTH_SCOPES || ""
    }
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    type: "openai_compat",
    defaultBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    defaultChatModel: process.env.DEEPSEEK_DEFAULT_CHAT_MODEL || "deepseek-chat",
    defaultEmbeddingModel: process.env.DEEPSEEK_DEFAULT_EMBED_MODEL || "",
    envServerKey: process.env.DEEPSEEK_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.DEEPSEEK_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.DEEPSEEK_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.DEEPSEEK_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.DEEPSEEK_OAUTH_TOKEN_URL || "",
      scopes: process.env.DEEPSEEK_OAUTH_SCOPES || ""
    }
  },
  {
    id: "meta",
    label: "Meta",
    type: "openai_compat",
    defaultBaseUrl: process.env.META_BASE_URL || "",
    defaultChatModel: process.env.META_DEFAULT_CHAT_MODEL || "",
    defaultEmbeddingModel: process.env.META_DEFAULT_EMBED_MODEL || "",
    envServerKey: process.env.META_DEFAULT_API_KEY || "",
    oauth: {
      clientId: process.env.META_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.META_OAUTH_CLIENT_SECRET || "",
      authorizeUrl: process.env.META_OAUTH_AUTHORIZE_URL || "",
      tokenUrl: process.env.META_OAUTH_TOKEN_URL || "",
      scopes: process.env.META_OAUTH_SCOPES || ""
    }
  }
];

export function getAiProviders() {
  return providerList;
}

export function getAiProvider(providerId: string) {
  return providerList.find((provider) => provider.id === providerId) || null;
}

export function isOauthConfigured(config?: OAuthConfig | null) {
  if (!config) return false;
  return Boolean(
    config.clientId &&
      config.clientSecret &&
      config.authorizeUrl &&
      config.tokenUrl
  );
}
