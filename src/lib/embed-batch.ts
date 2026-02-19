import { embedTexts, Provider } from "@/lib/llm";

export async function embedTextsBatched(
  provider: Provider,
  apiKey: string,
  inputs: string[],
  options?: { baseUrl?: string; model?: string; inputType?: "search_document" | "search_query" },
  batchSize = 128,
  maxBatchChars?: number
) {
  const results: number[][] = [];
  if (!maxBatchChars) {
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const vectors = await embedTexts(provider, apiKey, batch, options);
      results.push(...vectors);
    }
    return results;
  }

  let current: string[] = [];
  let currentChars = 0;

  const flush = async () => {
    if (!current.length) return;
    const vectors = await embedTexts(provider, apiKey, current, options);
    results.push(...vectors);
    current = [];
    currentChars = 0;
  };

  for (const input of inputs) {
    const nextChars = currentChars + input.length;
    if (current.length >= batchSize || nextChars > maxBatchChars) {
      await flush();
    }
    current.push(input);
    currentChars += input.length;
  }

  await flush();
  return results;
}
