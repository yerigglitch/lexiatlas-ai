const MISTRAL_API_URL = "https://api.mistral.ai/v1";

export type MistralMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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
    throw new Error(`Mistral error: ${response.status} ${text}`);
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
