import { embedTexts as mistralEmbed, chatComplete as mistralChat } from "@/lib/mistral";

export type Provider = "mistral" | "custom";

async function openaiCompatibleRequest<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: unknown
) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Provider error");
  }

  return (await response.json()) as T;
}

export async function embedTexts(
  provider: Provider,
  apiKey: string,
  inputs: string[],
  options?: { baseUrl?: string; model?: string }
) {
  if (provider === "custom") {
    if (!options?.baseUrl || !options?.model) {
      throw new Error("Missing baseUrl or embedding model");
    }
    const data = await openaiCompatibleRequest<{ data: { embedding: number[] }[] }>(
      options.baseUrl,
      apiKey,
      "/v1/embeddings",
      {
        model: options.model,
        input: inputs
      }
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
  if (provider === "custom") {
    if (!baseUrl) {
      throw new Error("Missing baseUrl");
    }
    const data = await openaiCompatibleRequest<{
      choices: { message: { content: string } }[];
    }>(baseUrl, apiKey, "/v1/chat/completions", {
      model,
      messages,
      temperature
    });

    return data.choices[0]?.message?.content || "";
  }

  return mistralChat(apiKey, { model, messages, temperature });
}
