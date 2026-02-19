const MISTRAL_API_URL = "https://api.mistral.ai/v1";

export type MistralMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

import { ProviderError } from "@/lib/ai-errors";

async function mistralRequest<T>(path: string, apiKey: string, body: unknown) {
  const response = await fetch(`${MISTRAL_API_URL}${path}`, {
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
      provider: "mistral",
      status: response.status,
      code: payload?.code || payload?.error || null,
      type: payload?.type || null,
      message: payload?.detail || payload?.message || text || "Mistral error",
      raw: text
    });
  }

  return (await response.json()) as T;
}

export async function embedTexts(apiKey: string, inputs: string[]) {
  const data = await mistralRequest<{ data: { embedding: number[] }[] }>(
    "/embeddings",
    apiKey,
    {
      model: "mistral-embed",
      input: inputs
    }
  );

  return data.data.map((item) => item.embedding);
}

export async function chatComplete(
  apiKey: string,
  {
    model = "mistral-small-latest",
    messages,
    temperature = 0.2
  }: {
    model?: string;
    messages: MistralMessage[];
    temperature?: number;
  }
) {
  const data = await mistralRequest<{
    choices: { message: { content: string } }[];
  }>("/chat/completions", apiKey, {
    model,
    messages,
    temperature
  });

  return data.choices[0]?.message?.content || "";
}
