#!/usr/bin/env node
import fs from "node:fs/promises";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const TARGET_IDS = ["YER-11", "YER-38", "YER-40", "YER-41"];

const COMMENT = [
  "Update exécution UI v2 (enterprise minimal) appliquée en local.",
  "",
  "Livré:",
  "- Refonte `/app/rag`: flux question/réponse recentré, zone de saisie stable, panneau recherches récentes.",
  "- Refonte `/app/documents`: production documentaire simplifiée, liste des sorties clarifiée.",
  "- Refonte `/app/settings`: présentation plus compacte et utilitaire.",
  "- Nouveau style system v2 homogène sur ces écrans (densité, bordures, hiérarchie, sobriété).",
  "",
  "Statut:",
  "- Build et lint passent.",
  "- Prêt pour revue produit et itération de polish."
].join("\n");

function parseEnvFile(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const vars = parseEnvFile(await fs.readFile(file, "utf8"));
      for (const [k, v] of Object.entries(vars)) {
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {
      // optional file
    }
  }
}

async function linearRequest(token, query, variables) {
  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API error (${res.status}): ${text.slice(0, 300)}`);
  }
  const payload = await res.json();
  if (payload.errors?.length) {
    throw new Error(`Linear GraphQL error: ${payload.errors[0].message}`);
  }
  return payload.data;
}

async function getIssueId(token, identifier) {
  const match = identifier.match(/^([A-Z]+)-(\d+)$/i);
  if (!match) return null;
  const teamKey = match[1].toUpperCase();
  const number = Number(match[2]);
  const query = `
    query IssueByIdentifier($teamKey: String!, $number: Float!) {
      issues(first: 1, filter: { team: { key: { eq: $teamKey } }, number: { eq: $number } }) {
        nodes { id identifier }
      }
    }
  `;
  const data = await linearRequest(token, query, { teamKey, number });
  return data.issues?.nodes?.[0]?.id || null;
}

async function createComment(token, issueId, body) {
  const mutation = `
    mutation Comment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) { success }
    }
  `;
  const data = await linearRequest(token, mutation, { issueId, body });
  return Boolean(data.commentCreate?.success);
}

async function main() {
  await loadEnv();
  const token = process.env.LINEAR_API_TOKEN || "";
  if (!token) {
    console.error("Missing LINEAR_API_TOKEN in .env.local or environment.");
    return 1;
  }

  console.log("Linear progress log (apply)");
  for (const identifier of TARGET_IDS) {
    const issueId = await getIssueId(token, identifier);
    if (!issueId) {
      console.log(`- ${identifier}: not found`);
      continue;
    }
    const ok = await createComment(token, issueId, COMMENT);
    console.log(`- ${identifier}: ${ok ? "commented" : "comment-failed"}`);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
