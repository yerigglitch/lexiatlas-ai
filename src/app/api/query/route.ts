import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAuthContext } from "@/lib/auth-server";
import { chatComplete, embedTexts, Provider } from "@/lib/llm";
import { getUserApiKey } from "@/lib/api-keys";
import { getAiProvider } from "@/lib/ai-providers";
import { getUserOauthToken } from "@/lib/oauth-tokens";
import { mapProviderError } from "@/lib/ai-errors";
import { searchLegifrance, LegifranceError } from "@/lib/legifrance";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  const body = (await request.json()) as Record<string, any>;
  const question = body?.question;
  const bodyModel = body?.model;
  const sourceId = body?.sourceId;
  const sourceIds = body?.sourceIds;
  const responseMode = body?.responseMode;
  const externalSources = body?.externalSources;

  const sourceFilter: string[] =
    Array.isArray(sourceIds) && sourceIds.length ? sourceIds : sourceId ? [sourceId] : [];
  const legifranceSettings = externalSources?.legifrance || {};
  const legifranceEnabled = Boolean(legifranceSettings?.enabled);
  const legifranceExclusive = Boolean(legifranceSettings?.exclusive);
  const legifranceFonds = Array.isArray(legifranceSettings?.fonds)
    ? legifranceSettings.fonds.filter((fond: string) => Boolean(fond))
    : [];
  const legifranceMaxResults =
    typeof legifranceSettings?.maxResults === "number"
      ? Math.max(1, Math.min(10, legifranceSettings.maxResults))
      : 6;
  const legifranceCodeName =
    typeof legifranceSettings?.codeName === "string" ? legifranceSettings.codeName.trim() : "";
  const legifranceVersionDate =
    typeof legifranceSettings?.versionDate === "string" ? legifranceSettings.versionDate : "";

  const chatProvider = (request.headers.get("x-chat-provider") ||
    request.headers.get("x-provider") ||
    "mistral") as Provider;
  const embeddingProvider = (request.headers.get("x-embedding-provider") ||
    request.headers.get("x-provider") ||
    chatProvider) as Provider;
  const headerKey = request.headers.get("x-api-key") || "";
  const chatBaseUrl = request.headers.get("x-chat-base-url") || request.headers.get("x-base-url") || "";
  const embeddingBaseUrl =
    request.headers.get("x-embedding-base-url") || request.headers.get("x-base-url") || "";
  const embeddingModel = request.headers.get("x-embedding-model") || "";
  const chatAuthMode = request.headers.get("x-chat-auth-mode") || request.headers.get("x-auth-mode") || "api_key";
  const embeddingAuthMode =
    request.headers.get("x-embedding-auth-mode") || request.headers.get("x-auth-mode") || "api_key";

  const chatProviderConfig = getAiProvider(chatProvider);
  const embeddingProviderConfig = getAiProvider(embeddingProvider);
  if (!chatProviderConfig || !embeddingProviderConfig) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const resolvedChatBaseUrl = chatBaseUrl || chatProviderConfig.defaultBaseUrl || "";
  const resolvedEmbeddingBaseUrl = embeddingBaseUrl || embeddingProviderConfig.defaultBaseUrl || "";
  const resolvedEmbeddingModel =
    embeddingModel ||
    embeddingProviderConfig.defaultEmbeddingModel ||
    (embeddingProvider === "openai" ? "text-embedding-3-small" : "");
  const model =
    bodyModel ||
    chatProviderConfig.defaultChatModel ||
    (chatProvider === "openai" ? "gpt-4o-mini" : "mistral-small-latest");

  const chatStoredKey =
    authContext?.userId && chatProvider !== "custom"
      ? await getUserApiKey(authContext.userId, chatProvider)
      : null;
  const embeddingStoredKey =
    authContext?.userId && embeddingProvider !== "custom"
      ? await getUserApiKey(authContext.userId, embeddingProvider)
      : null;
  const chatServerKey = chatProviderConfig.envServerKey || "";
  const embeddingServerKey = embeddingProviderConfig.envServerKey || "";
  const chatOauthToken =
    authContext?.userId && chatAuthMode === "oauth"
      ? await getUserOauthToken(authContext.userId, chatProvider)
      : null;
  const embeddingOauthToken =
    authContext?.userId && embeddingAuthMode === "oauth"
      ? await getUserOauthToken(authContext.userId, embeddingProvider)
      : null;
  const chatApiKey =
    chatProvider === "custom"
      ? headerKey
      : chatAuthMode === "server"
        ? chatServerKey
        : chatAuthMode === "oauth"
          ? chatOauthToken || ""
          : headerKey || chatStoredKey;
  const embeddingApiKey =
    embeddingProvider === "custom"
      ? headerKey
      : embeddingAuthMode === "server"
        ? embeddingServerKey
        : embeddingAuthMode === "oauth"
          ? embeddingOauthToken || ""
          : headerKey || embeddingStoredKey;

  const useInternalSources = !(legifranceEnabled && legifranceExclusive);

  if (!question || !authContext?.tenantId) {
    return NextResponse.json({ error: "Missing question or tenantId" }, { status: 400 });
  }
  if (legifranceEnabled && legifranceFonds.length === 0) {
    return NextResponse.json({ error: "Sélectionnez au moins un fond Légifrance." }, { status: 400 });
  }

  const chatNeedsBaseUrl =
    chatProviderConfig.type === "openai_compat" ||
    chatProviderConfig.type === "google_gemini" ||
    chatProviderConfig.type === "cohere";
  const embeddingNeedsBaseUrl =
    embeddingProviderConfig.type === "openai_compat" ||
    embeddingProviderConfig.type === "google_gemini" ||
    embeddingProviderConfig.type === "cohere";
  if (chatNeedsBaseUrl && !resolvedChatBaseUrl) {
    return NextResponse.json({ error: "Missing chat provider baseUrl" }, { status: 400 });
  }
  if (useInternalSources && embeddingNeedsBaseUrl && !resolvedEmbeddingBaseUrl) {
    return NextResponse.json({ error: "Missing embedding provider baseUrl" }, { status: 400 });
  }
  if (!chatApiKey) {
    return NextResponse.json({ error: "Missing chat API key" }, { status: 400 });
  }
  if (useInternalSources && !embeddingApiKey) {
    return NextResponse.json({ error: "Missing embedding API key" }, { status: 400 });
  }
  if (useInternalSources && !resolvedEmbeddingModel) {
    return NextResponse.json(
      {
        error:
          "Ce fournisseur ne fournit pas de modèle embeddings par défaut. Choisissez un autre fournisseur d'embeddings ou renseignez un modèle."
      },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabase();
  const normalizedQuestion = String(question).trim();
  const questionTokens = normalizedQuestion.split(/\s+/).slice(0, 8).join(" ");
  const articleMatch = normalizedQuestion.match(/article\s+(\d+)/i);
  const articleNeedle = articleMatch ? `article ${articleMatch[1]}` : null;

  let lexicalMatches: any[] = [];
  let vectorMatches: any[] = [];
  if (useInternalSources) {
    const lexicalQuery = supabase
      .from("source_chunks")
      .select("id, source_id, content")
      .eq("tenant_id", authContext.tenantId)
      .textSearch("content_tsv", questionTokens, { type: "plain", config: "french" });
    if (sourceFilter.length) lexicalQuery.in("source_id", sourceFilter);

    const lexicalResult = await lexicalQuery.limit(12);
    if (lexicalResult.error) {
      return NextResponse.json({ error: lexicalResult.error.message }, { status: 500 });
    }

    let questionEmbedding: number[] = [];
    try {
      const [embedding] = await embedTexts(embeddingProvider, embeddingApiKey || "", [question], {
        baseUrl: resolvedEmbeddingBaseUrl || undefined,
        model: resolvedEmbeddingModel || undefined,
        inputType: "search_query"
      });
      questionEmbedding = embedding || [];
    } catch (error) {
      const mapped = mapProviderError(error, embeddingProvider);
      return NextResponse.json({ error: mapped.userMessage }, { status: mapped.status });
    }

    if (questionEmbedding.length !== 1024) {
      return NextResponse.json({ error: "Embedding dimension mismatch. Expected 1024." }, { status: 400 });
    }

    const matchResult = await supabase.rpc("match_source_chunks", {
      query_embedding: questionEmbedding,
      match_count: 6,
      tenant_id: authContext.tenantId
    });
    if (matchResult.error) {
      return NextResponse.json({ error: matchResult.error.message }, { status: 500 });
    }

    vectorMatches = (matchResult.data || [])
      .filter((m: any) => (sourceFilter.length ? sourceFilter.includes(m.source_id) : true))
      .map((item: any) => ({ ...item, origin: "vector" as const }));

    lexicalMatches = (lexicalResult.data || []).map((item: any) => ({
      ...item,
      score: 1,
      origin: "lexical" as const
    }));
  }

  let exactMatches: any[] = [];
  if (articleNeedle) {
    if (sourceFilter.length) {
      const perSource = await Promise.all(
        sourceFilter.map(async (sid) => {
          const { data, error } = await supabase
            .from("source_chunks")
            .select("id, source_id, content")
            .eq("tenant_id", authContext.tenantId)
            .eq("source_id", sid)
            .ilike("content", `%${articleNeedle}%`)
            .limit(4);
          if (error) throw error;
          return data || [];
        })
      );
      exactMatches = perSource.flat().map((item: any) => ({ ...item, score: 2.5, origin: "exact" as const }));
    } else {
      const exactQuery = await supabase
        .from("source_chunks")
        .select("id, source_id, content")
        .eq("tenant_id", authContext.tenantId)
        .ilike("content", `%${articleNeedle}%`)
        .limit(12);
      if (exactQuery.error) {
        return NextResponse.json({ error: exactQuery.error.message }, { status: 500 });
      }
      exactMatches = (exactQuery.data || []).map((item: any) => ({ ...item, score: 2.5, origin: "exact" as const }));
    }
  }

  let matches: any[] = [];
  if (useInternalSources && sourceFilter.length) {
    const perSource = new Map<string, any[]>();
    sourceFilter.forEach((id) => perSource.set(id, []));
    exactMatches.forEach((m) => perSource.set(m.source_id, [...(perSource.get(m.source_id) || []), m]));
    lexicalMatches.forEach((m) => {
      const list = perSource.get(m.source_id) || [];
      if (!list.find((x) => x.id === m.id)) list.push(m);
      perSource.set(m.source_id, list);
    });
    vectorMatches.forEach((m) => {
      const list = perSource.get(m.source_id) || [];
      if (!list.find((x) => x.id === m.id)) list.push(m);
      perSource.set(m.source_id, list);
    });
    matches = sourceFilter.flatMap((id) => perSource.get(id) || []);
  } else if (useInternalSources) {
    const merged = new Map<string, any>();
    exactMatches.forEach((m) => merged.set(m.id, m));
    lexicalMatches.forEach((m) => merged.set(m.id, m));
    vectorMatches.forEach((m) => {
      if (!merged.has(m.id)) merged.set(m.id, m);
    });
    matches = Array.from(merged.values());
  }

  const scoreWeight = (origin?: string) => (origin === "exact" ? 2.5 : origin === "lexical" ? 1.2 : 0);
  if (useInternalSources) {
    matches = matches
      .map((m: any) => ({ ...m, score: (m.score || 0) + scoreWeight(m.origin) }))
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .slice(0, 16);
  }

  const sourceIdsToFetch = Array.from(new Set(matches.map((m: any) => m.source_id)));
  const sourceTitleMap = new Map<string, string>();
  if (sourceIdsToFetch.length) {
    const sourceRes = await supabase.from("sources").select("id, title").in("id", sourceIdsToFetch);
    if (!sourceRes.error && sourceRes.data) {
      sourceRes.data.forEach((s) => sourceTitleMap.set(s.id, s.title));
    }
  }

  const mode = responseMode === "synthesis" ? "synthesis" : "per-source";
  let internalContext = "";
  if (useInternalSources) {
    if (sourceFilter.length) {
      const grouped = sourceFilter
        .map((sid) => {
          const title = sourceTitleMap.get(sid) || "Source";
          const items = matches
            .filter((m: any) => m.source_id === sid)
            .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
            .slice(0, 6);
          if (!items.length) {
            return mode === "synthesis"
              ? null
              : `${title} (id: ${sid})\nAucune information pertinente trouvée dans cette source.`;
          }
          return `${title} (id: ${sid})\n${items.map((m: any) => m.content).join("\n\n")}`;
        })
        .filter(Boolean) as string[];
      internalContext = grouped.join("\n\n---\n\n");
    } else {
      internalContext = matches
        .map((match: { content: string; source_id: string }, index: number) => {
          const title = sourceTitleMap.get(match.source_id) || `Source ${index + 1}`;
          return `${title} (id: ${match.source_id})\n${match.content}`;
        })
        .join("\n\n---\n\n");
    }
  }

  let externalContext = "";
  let externalCitations: any[] = [];
  if (legifranceEnabled && legifranceFonds.length) {
    try {
      const fondsToQuery = legifranceFonds.slice(0, 4);
      const externalResults = await Promise.all(
        fondsToQuery.map((fond: string) =>
          searchLegifrance({
            query: normalizedQuestion,
            fond,
            pageNumber: 1,
            pageSize: legifranceMaxResults,
            sort: "PERTINENCE",
            codeName: legifranceCodeName || undefined,
            versionDate: legifranceVersionDate || undefined
          }).then((items) => ({ fond, items }))
        )
      );

      const contextParts: string[] = [];
      externalResults.forEach(({ fond, items }) => {
        if (!items.length) return;
        const snippets = items.map((item: any) => item.snippet || item.title).filter(Boolean).join("\n\n");
        contextParts.push(`Légifrance (${fond})\n${snippets}`);
        externalCitations.push(
          ...items.map((item: any, index: number) => ({
            id: `legifrance-${fond}-${index}`,
            snippet: item.snippet || item.title,
            score: 0,
            source_title: `Légifrance · ${item.title}`,
            source_url: item.url || null
          }))
        );
      });
      externalContext = contextParts.join("\n\n---\n\n");
    } catch (error) {
      if (error instanceof LegifranceError) {
        return NextResponse.json({ error: error.userMessage }, { status: error.status });
      }
      return NextResponse.json({ error: "Erreur lors de l'appel Légifrance." }, { status: 500 });
    }
  }

  if (!internalContext && !externalContext) {
    return NextResponse.json({
      ok: true,
      answer: "Je ne sais pas répondre avec certitude sur la base des sources disponibles.",
      citations: []
    });
  }

  const context = [internalContext, externalContext].filter(Boolean).join("\n\n---\n\n");
  const sourceScope = legifranceExclusive
    ? "uniquement à partir des sources Légifrance fournies"
    : "uniquement à partir des sources fournies";
  const systemPrompt =
    mode === "synthesis"
      ? `Tu es un assistant juridique pour avocats français. Réponds ${sourceScope}. Si l'information n'est pas dans les sources, réponds exactement: "Je ne sais pas répondre avec certitude sur la base des sources disponibles." Ne fais aucune hypothèse. Produis une synthèse claire, compare les sources et mentionne explicitement les divergences. Cite chaque source utilisée avec son nom exact.`
      : `Tu es un assistant juridique pour avocats français. Réponds ${sourceScope}. Si l'information n'est pas dans les sources, réponds exactement: "Je ne sais pas répondre avec certitude sur la base des sources disponibles." Ne fais aucune hypothèse. Cite toujours les sources utilisées. Si plusieurs sources sont fournies, réponds pour chaque source en reprenant son nom exact.`;

  let answer = "";
  try {
    answer = await chatComplete(chatProvider, chatApiKey, {
      model,
      temperature: 0,
      baseUrl: resolvedChatBaseUrl || undefined,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: ${question}\n\nSources:\n${context}` }
      ]
    });
  } catch (error) {
    const mapped = mapProviderError(error, chatProvider);
    return NextResponse.json({ error: mapped.userMessage }, { status: mapped.status });
  }

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
    return NextResponse.json(
      { error: queryInsert.error?.message || "Query insert failed" },
      { status: 500 }
    );
  }

  const citationRows = matches.map((match: { id: string; source_id: string; content: string; score: number }) => ({
    query_id: queryInsert.data.id,
    source_id: match.source_id,
    chunk_id: match.id,
    snippet: match.content.slice(0, 420),
    score: match.score,
    source_title: sourceTitleMap.get(match.source_id) || null
  }));

  if (citationRows.length) {
    const citationInsert = await supabase.from("rag_citations").insert(citationRows);
    if (citationInsert.error) {
      return NextResponse.json({ error: citationInsert.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, answer, citations: [...citationRows, ...externalCitations] });
}
