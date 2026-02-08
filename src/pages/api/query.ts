import type { NextApiRequest, NextApiResponse } from "next";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContextFromToken } from "@/lib/auth-server";
import { chatComplete, embedTexts, Provider } from "@/lib/llm";
import { getUserMistralKey } from "@/lib/mistral-key";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const authContext = await getAuthContextFromToken(token);

  const { question, model: bodyModel, sourceId, sourceIds, responseMode } = req.body || {};
  const sourceFilter: string[] =
    Array.isArray(sourceIds) && sourceIds.length
      ? sourceIds
      : sourceId
        ? [sourceId]
        : [];
  const model = bodyModel || "mistral-small-latest";

  const provider = (req.headers["x-provider"] || "mistral") as Provider;
  const keyMode = (req.headers["x-key-mode"] || "user") as string;
  const headerKey = (req.headers["x-api-key"] || "") as string;
  const headerBaseUrl = (req.headers["x-base-url"] || "") as string;
  const embeddingModel = (req.headers["x-embedding-model"] || "") as string;
  const storedKey = authContext?.userId && provider === "mistral"
    ? await getUserMistralKey(authContext.userId)
    : null;
  const serverKey = process.env.MISTRAL_DEFAULT_API_KEY || "";
  const apiKey =
    provider === "custom"
      ? headerKey
      : keyMode === "server"
        ? serverKey
        : headerKey || storedKey || serverKey;

  if (!question || !authContext?.tenantId) {
    return res.status(400).json({ error: "Missing question or tenantId" });
  }

  if (provider === "custom" && keyMode !== "custom") {
    return res.status(400).json({ error: "Custom provider requires keyMode=custom" });
  }

  if (provider === "custom" && (!headerBaseUrl || !embeddingModel || !model)) {
    return res.status(400).json({ error: "Missing custom baseUrl or model" });
  }

  if (!apiKey) {
    return res.status(400).json({ error: "Missing API key" });
  }

  const supabase = createServiceSupabase();
  const normalizedQuestion = String(question).trim();
  const questionTokens = normalizedQuestion.split(/\s+/).slice(0, 8).join(" ");
  const articleMatch = normalizedQuestion.match(/article\s+(\d+)/i);
  const articleNeedle = articleMatch ? `article ${articleMatch[1]}` : null;

  const lexicalQuery = supabase
    .from("source_chunks")
    .select("id, source_id, content")
    .eq("tenant_id", authContext.tenantId)
    .textSearch("content_tsv", questionTokens, { type: "plain", config: "french" });

  if (sourceFilter.length) {
    lexicalQuery.in("source_id", sourceFilter);
  }

  const lexicalResult = await lexicalQuery.limit(12);

  if (lexicalResult.error) {
    return res.status(500).json({ error: lexicalResult.error.message });
  }

  const [questionEmbedding] = await embedTexts(provider, apiKey, [question], {
    baseUrl: headerBaseUrl || undefined,
    model: embeddingModel || undefined
  });

  if (questionEmbedding.length !== 1024) {
    return res.status(400).json({ error: "Embedding dimension mismatch. Expected 1024." });
  }

  const matchResult = await supabase.rpc("match_source_chunks", {
    query_embedding: questionEmbedding,
    match_count: 6,
    tenant_id: authContext.tenantId
  });

  if (matchResult.error) {
    return res.status(500).json({ error: matchResult.error.message });
  }

  const vectorMatches = (matchResult.data || []).filter((m: any) =>
    sourceFilter.length ? sourceFilter.includes(m.source_id) : true
  );

  let exactMatches: any[] = [];
  if (articleNeedle) {
    if (sourceFilter.length) {
      const perSource = await Promise.all(
        sourceFilter.map(async (sourceId) => {
          const { data, error } = await supabase
            .from("source_chunks")
            .select("id, source_id, content")
            .eq("tenant_id", authContext.tenantId)
            .eq("source_id", sourceId)
            .ilike("content", `%${articleNeedle}%`)
            .limit(4);
          if (error) throw error;
          return data || [];
        })
      );
      exactMatches = perSource.flat();
    } else {
      const exactQuery = await supabase
        .from("source_chunks")
        .select("id, source_id, content")
        .eq("tenant_id", authContext.tenantId)
        .ilike("content", `%${articleNeedle}%`)
        .limit(12);
      if (exactQuery.error) {
        return res.status(500).json({ error: exactQuery.error.message });
      }
      exactMatches = exactQuery.data || [];
    }
  }

  const lexicalMatches = (lexicalResult.data || []).map((item) => ({
    ...item,
    score: 1
  }));

  let matches: any[] = [];

  if (sourceFilter.length) {
    const perSource = new Map<string, any[]>();
    sourceFilter.forEach((id) => perSource.set(id, []));

    exactMatches.forEach((m) => {
      const list = perSource.get(m.source_id) || [];
      list.push(m);
      perSource.set(m.source_id, list);
    });

    lexicalMatches.forEach((m) => {
      const list = perSource.get(m.source_id) || [];
      if (!list.find((x) => x.id === m.id)) {
        list.push(m);
      }
      perSource.set(m.source_id, list);
    });

    vectorMatches.forEach((m: any) => {
      const list = perSource.get(m.source_id) || [];
      if (!list.find((x) => x.id === m.id)) {
        list.push(m);
      }
      perSource.set(m.source_id, list);
    });

    matches = sourceFilter.flatMap((id) => perSource.get(id) || []);
  } else {
    const merged = new Map<string, any>();
    exactMatches.forEach((m) => merged.set(m.id, m));
    lexicalMatches.forEach((m) => merged.set(m.id, m));
    vectorMatches.forEach((m: any) => {
      if (!merged.has(m.id)) merged.set(m.id, m);
    });
    matches = Array.from(merged.values());
  }
  if (matches.length === 0) {
    return res.status(200).json({
      ok: true,
      answer:
        "Je ne sais pas répondre avec certitude sur la base des sources disponibles.",
      citations: []
    });
  }
  const sourceIdsToFetch = Array.from(
    new Set(matches.map((m: any) => m.source_id))
  );
  const sourceTitleMap = new Map<string, string>();
  if (sourceIdsToFetch.length) {
    const sourceRes = await supabase
      .from("sources")
      .select("id, title")
      .in("id", sourceIdsToFetch);
    if (!sourceRes.error && sourceRes.data) {
      sourceRes.data.forEach((s) => sourceTitleMap.set(s.id, s.title));
    }
  }

  const mode = responseMode === "synthesis" ? "synthesis" : "per-source";
  let context = "";
  if (sourceFilter.length) {
    const grouped = sourceFilter.map((sourceId) => {
      const title = sourceTitleMap.get(sourceId) || "Source";
      const items = matches.filter((m: any) => m.source_id === sourceId).slice(0, 4);
      if (!items.length) {
        return mode === "synthesis"
          ? null
          : `${title} (id: ${sourceId})\nAucune information pertinente trouvée dans cette source.`;
      }
      const snippets = items.map((m: any) => m.content).join("\n\n");
      return `${title} (id: ${sourceId})\n${snippets}`;
    }).filter(Boolean) as string[];
    context = grouped.join("\n\n---\n\n");
  } else {
    context = matches
      .map((match: { content: string; source_id: string }, index: number) => {
        const title = sourceTitleMap.get(match.source_id) || `Source ${index + 1}`;
        return `${title} (id: ${match.source_id})\n${match.content}`;
      })
      .join("\n\n---\n\n");
  }
  const systemPrompt =
    mode === "synthesis"
      ? "Tu es un assistant juridique pour avocats français. Réponds uniquement à partir des sources fournies. Si l'information n'est pas dans les sources, réponds exactement: \"Je ne sais pas répondre avec certitude sur la base des sources disponibles.\" Ne fais aucune hypothèse. Produis une synthèse claire qui compare les sources et mentionne explicitement les différences. Cite les sources utilisées."
      : "Tu es un assistant juridique pour avocats français. Réponds uniquement à partir des sources fournies. Si l'information n'est pas dans les sources, réponds exactement: \"Je ne sais pas répondre avec certitude sur la base des sources disponibles.\" Ne fais aucune hypothèse. Cites toujours les sources utilisées. Si plusieurs sources sont fournies, réponds pour chaque source, même si la réponse est \"Je ne sais pas...\", en reprenant le nom de la source.";

  const answer = await chatComplete(provider, apiKey, {
    model,
    temperature: 0,
    baseUrl: headerBaseUrl || undefined,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `Question: ${question}\n\nSources:\n${context}`
      }
    ]
  });

  const queryInsert = await supabase
    .from("rag_queries")
    .insert({
      tenant_id: authContext.tenantId,
      user_id: authContext.userId,
      question,
      answer
    })
    .select("id")
    .single();

  if (queryInsert.error || !queryInsert.data) {
    return res.status(500).json({ error: queryInsert.error?.message || "Query insert failed" });
  }

  const citationRows = matches.map(
    (match: { id: string; source_id: string; content: string; score: number }) => ({
      query_id: queryInsert.data.id,
      source_id: match.source_id,
      chunk_id: match.id,
      snippet: match.content.slice(0, 420),
      score: match.score,
      source_title: sourceTitleMap.get(match.source_id) || null
    })
  );

  if (citationRows.length) {
    const citationInsert = await supabase.from("rag_citations").insert(citationRows);
    if (citationInsert.error) {
      return res.status(500).json({ error: citationInsert.error.message });
    }
  }

  return res.status(200).json({ ok: true, answer, citations: citationRows });
}
