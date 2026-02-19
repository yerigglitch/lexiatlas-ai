import { embedTexts as mistralEmbed, chatComplete as mistralChat } from "@/lib/mistral";
import { ProviderError } from "@/lib/ai-errors";

export type Provider =
  | "mistral"
  | "openai"
  | "gemini"
  | "cohere"
  | "anthropic"
  | "kimi"
  | "grok"
  | "zai"
  | "deepseek"
  | "meta"
  | "custom";

const OPENAI_BASE_URL = "https://api.openai.com";

function joinBaseUrl(baseUrl: string, path: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/v1") && path.startsWith("/v1/")) {
    return `${trimmed}${path.slice(3)}`;
  }
  if (trimmed.endsWith("/v1") && path.startsWith("/v2/")) {
    return `${trimmed.slice(0, -3)}${path}`;
  }
  if (trimmed.endsWith("/api/paas/v4") && path.startsWith("/v1/")) {
    return `${trimmed}${path.slice(3)}`;
  }
  return `${trimmed}${path}`;
}

async function openaiCompatibleRequest<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: unknown
) {
  const url = joinBaseUrl(baseUrl, path);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: any = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    throw new ProviderError({
      provider: "openai_compat",
      status: response.status,
      code: payload?.error?.code || null,
      type: payload?.error?.type || null,
      message: payload?.error?.message || text || "Provider error",
      raw: text
    });
  }

  return (await response.json()) as T;
}

async function geminiRequest<T>(baseUrl: string, apiKey: string, path: string, body: unknown) {
  const url = joinBaseUrl(baseUrl, path);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: any = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    throw new ProviderError({
      provider: "gemini",
      status: response.status,
      code: payload?.error?.status || null,
      type: payload?.error?.status || null,
      message: payload?.error?.message || text || "Gemini error",
      raw: text
    });
  }

  return (await response.json()) as T;
}

async function cohereRequest<T>(baseUrl: string, apiKey: string, path: string, body: unknown) {
  const url = joinBaseUrl(baseUrl, path);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: any = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    throw new ProviderError({
      provider: "cohere",
      status: response.status,
      code: payload?.error?.type || null,
      type: payload?.error?.type || null,
      message: payload?.message || text || "Cohere error",
      raw: text
    });
  }

  return (await response.json()) as T;
}

function normalizeEmbedding(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (!norm || !Number.isFinite(norm)) return vector;
  return vector.map((v) => v / norm);
}

export async function embedTexts(
  provider: Provider,
  apiKey: string,
  inputs: string[],
  options?: { baseUrl?: string; model?: string; inputType?: "search_document" | "search_query" }
) {
  if (provider === "cohere") {
    if (!options?.baseUrl || !options?.model) {
      throw new Error("Missing baseUrl or embedding model");
    }
    const data = await cohereRequest<{ embeddings?: { float?: number[][] } }>(
      options.baseUrl,
      apiKey,
      "/v2/embed",
      {
        model: options.model,
        input_type: options.inputType || "search_document",
        embedding_types: ["float"],
        inputs: inputs.map((text) => ({
          content: [{ type: "text", text }]
        }))
      }
    );
    const vectors = data.embeddings?.float || [];
    return vectors.map((vector) => normalizeEmbedding(vector));
  }

  if (provider === "gemini") {
    if (!options?.baseUrl || !options?.model) {
      throw new Error("Missing baseUrl or embedding model");
    }
    const data = await geminiRequest<{
      embeddings: { values: number[] }[];
    }>(options.baseUrl, apiKey, `/models/${options.model}:embedContent`, {
      contents: inputs.map((text) => ({
        parts: [{ text }]
      })),
      outputDimensionality: 1024
    });
    return data.embeddings.map((item) => normalizeEmbedding(item.values || []));
  }

  if (provider !== "mistral") {
    const baseUrl = provider === "openai" ? OPENAI_BASE_URL : options?.baseUrl;
    if (!baseUrl || !options?.model) {
      throw new Error("Missing baseUrl or embedding model");
    }
    const body: Record<string, unknown> = {
      model: options.model,
      input: inputs
    };
    if (provider === "openai") {
      body.dimensions = 1024;
    }
    const data = await openaiCompatibleRequest<{ data: { embedding: number[] }[] }>(
      baseUrl,
      apiKey,
      "/v1/embeddings",
      body
    );
    return data.data.map((item) => item.embedding);
  }

  return mistralEmbed(apiKey, inputs);
}

export async function chatComplete(
  provider: Provider,
  apiKey: string,
  {
    model,
    messages,
    temperature = 0.2,
    baseUrl
  }: {
    model: string;
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    temperature?: number;
    baseUrl?: string;
  }
) {
  if (provider === "cohere") {
    if (!baseUrl) {
      throw new Error("Missing baseUrl");
    }
    const data = await cohereRequest<{
      message?: { content?: { type?: string; text?: string }[] };
    }>(baseUrl, apiKey, "/v2/chat", {
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      })),
      temperature
    });
    return data.message?.content?.find((part) => part.type === "text")?.text || "";
  }

  if (provider === "gemini") {
    if (!baseUrl) {
      throw new Error("Missing baseUrl");
    }
    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));
    const data = await geminiRequest<{
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }>(baseUrl, apiKey, `/models/${model}:generateContent`, {
      contents,
      generationConfig: { temperature }
    });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text;
  }

  if (provider !== "mistral") {
    const resolvedBaseUrl = provider === "openai" ? OPENAI_BASE_URL : baseUrl;
    if (!resolvedBaseUrl) {
      throw new Error("Missing baseUrl");
    }
    const data = await openaiCompatibleRequest<{
      choices: { message: { content: string } }[];
    }>(resolvedBaseUrl, apiKey, "/v1/chat/completions", {
      model,
      messages,
      temperature
    });

    return data.choices[0]?.message?.content || "";
  }

  return mistralChat(apiKey, { model, messages, temperature });
}
