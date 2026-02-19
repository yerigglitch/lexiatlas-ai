export type ProviderErrorInfo = {
  provider?: string;
  status?: number;
  code?: string | null;
  type?: string | null;
  message?: string | null;
  raw?: string | null;
};

export class ProviderError extends Error {
  info: ProviderErrorInfo;

  constructor(info: ProviderErrorInfo) {
    super(info.message || "Provider error");
    this.name = "ProviderError";
    this.info = info;
  }
}

export function toProviderErrorInfo(err: unknown): ProviderErrorInfo {
  if (err instanceof ProviderError) return err.info;
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: String(err) };
}

export function mapProviderError(
  err: unknown,
  provider: string
): { status: number; userMessage: string } {
  const info = toProviderErrorInfo(err);
  const status = info.status || 502;
  const code = (info.code || "").toString();
  const type = (info.type || "").toString();
  const message = (info.message || "").toString();

  const normalized = `${code} ${type} ${message}`.toLowerCase();

  if (status === 401 || normalized.includes("invalid api key") || normalized.includes("unauthorized") || normalized.includes("authentication")) {
    return {
      status: 401,
      userMessage: `Clé API invalide ou non autorisée pour ${provider}. Vérifiez la clé ou l'OAuth.`
    };
  }

  if (normalized.includes("insufficient_quota") || normalized.includes("quota") || normalized.includes("billing_hard_limit")) {
    return {
      status: 402,
      userMessage:
        `Quota insuffisant pour ${provider}. Vérifiez votre plan et la facturation (ou le projet associé à la clé).`
    };
  }

  if (normalized.includes("rate_limit")) {
    return {
      status: 429,
      userMessage:
        `Trop de requêtes vers ${provider}. Réessayez dans quelques instants.`
    };
  }

  if (normalized.includes("model") && normalized.includes("not found")) {
    return {
      status: 400,
      userMessage:
        `Modèle introuvable chez ${provider}. Vérifiez le nom du modèle.`
    };
  }

  if (normalized.includes("context") && normalized.includes("length")) {
    return {
      status: 400,
      userMessage:
        `Le contexte est trop long pour ${provider}. Réduisez la taille du document ou la question.`
    };
  }

  if (normalized.includes("invalid_request")) {
    return {
      status: 400,
      userMessage:
        `Requête invalide envoyée à ${provider}. Vérifiez les paramètres (modèles, base URL, etc.).` +
        (message ? ` Détail: ${message}` : "")
    };
  }

  return {
    status,
    userMessage: `Erreur ${provider}. ${message || "Veuillez réessayer."}`
  };
}
