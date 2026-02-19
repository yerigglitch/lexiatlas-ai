export type LegifranceSearchParams = {
  query: string;
  fond: string;
  pageNumber?: number;
  pageSize?: number;
  sort?: "DATE_DESC" | "DATE_ASC" | "RELEVANCE" | "PERTINENCE";
  codeName?: string;
  versionDate?: string;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export class LegifranceError extends Error {
  status: number;
  userMessage: string;

  constructor(status: number, userMessage: string, message?: string) {
    super(message || userMessage);
    this.status = status;
    this.userMessage = userMessage;
  }
}

const DEFAULT_TOKEN_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const DEFAULT_BASE_URL = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";

function getLegifranceConfig() {
  return {
    clientId: process.env.LEGIFRANCE_CLIENT_ID || "",
    clientSecret: process.env.LEGIFRANCE_CLIENT_SECRET || "",
    tokenUrl: process.env.LEGIFRANCE_TOKEN_URL || DEFAULT_TOKEN_URL,
    baseUrl: process.env.LEGIFRANCE_BASE_URL || DEFAULT_BASE_URL
  };
}

async function fetchLegifranceToken() {
  const { clientId, clientSecret, tokenUrl } = getLegifranceConfig();
  if (!clientId || !clientSecret) {
    throw new LegifranceError(
      500,
      "Les identifiants Légifrance (PISTE) ne sont pas configurés côté serveur."
    );
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "openid"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error_description || payload?.error || response.statusText;
    throw new LegifranceError(
      response.status,
      "Erreur lors de l'authentification Légifrance (PISTE).",
      detail
    );
  }

  const token = payload?.access_token as string | undefined;
  const expiresIn = Number(payload?.expires_in || 0);
  if (!token) {
    throw new LegifranceError(500, "Token Légifrance introuvable dans la réponse.");
  }

  tokenCache = {
    token,
    expiresAt: Date.now() + Math.max(30, expiresIn - 60) * 1000
  };

  return token;
}

async function getLegifranceToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }
  return fetchLegifranceToken();
}

function normalizeLegifranceResult(result: any) {
  const title = result?.title || result?.titre || result?.titrage || result?.id || "Document";
  const url = result?.url || result?.lien || result?.link || result?.uri || null;
  const extracts = result?.sections?.[0]?.extracts || result?.extracts || [];
  const snippetFromExtracts = Array.isArray(extracts)
    ? extracts.map((e: any) => e?.value || e?.texte || e).filter(Boolean).join("\n")
    : "";
  const snippet =
    snippetFromExtracts || result?.summary || result?.resume || result?.description || "";

  return {
    id: result?.id || result?.cid || result?.cidTexte || result?.idTech || title,
    title,
    url,
    snippet: snippet.trim()
  };
}

export async function searchLegifrance(params: LegifranceSearchParams) {
  const { baseUrl } = getLegifranceConfig();
  const token = await getLegifranceToken();

  const filters: any[] = [];
  if (params.codeName) {
    filters.push({
      facette: "NOM_CODE",
      valeurs: [params.codeName]
    });
  }
  if (params.versionDate) {
    const timestamp = Date.parse(params.versionDate);
    if (!Number.isNaN(timestamp)) {
      filters.push({
        facette: "DATE_VERSION",
        singleDate: timestamp
      });
    }
  }

  const payload = {
    pageNumber: params.pageNumber || 1,
    pageSize: params.pageSize || 6,
    sort: params.sort || "PERTINENCE",
    recherche: {
      champs: [
        {
          typeChamp: "ARTICLE",
          criteres: [
            {
              typeRecherche: "UN_DES_MOTS",
              valeur: params.query,
              operateur: "ET"
            }
          ],
          operateur: "ET"
        }
      ],
      filtres: filters,
      operateur: "ET",
      pageNumber: params.pageNumber || 1,
      pageSize: params.pageSize || 6,
      sort: params.sort || "PERTINENCE",
      typePagination: "DEFAUT"
    },
    fond: params.fond
  };

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error || data?.message || data?.detail || response.statusText;
    throw new LegifranceError(
      response.status,
      "Requête invalide envoyée à Légifrance. Vérifiez la configuration.",
      detail
    );
  }

  const results =
    (Array.isArray(data?.results) && data.results) ||
    (Array.isArray(data?.resultats) && data.resultats) ||
    (Array.isArray(data?.documents) && data.documents) ||
    [];

  return results.map(normalizeLegifranceResult);
}
