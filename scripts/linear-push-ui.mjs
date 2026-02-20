#!/usr/bin/env node
import fs from "node:fs/promises";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const UI_ISSUES = [
  { id: "YER-11", priority: 1 },
  { id: "YER-38", priority: 2 },
  { id: "YER-40", priority: 2 },
  { id: "YER-41", priority: 2 }
];

const MILESTONE_COMMENT = [
  "Milestone UI mis sous pression.",
  "",
  "Contexte:",
  "- Le rendu actuel n'est pas au niveau attendu en fluidité et cohérence.",
  "- Priorité produit immédiate sur UX de base, lisibilité, et vitesse d'usage.",
  "",
  "Attendu maintenant:",
  "1. Stabiliser layout/navigation et interactions principales.",
  "2. Uniformiser hiérarchie visuelle et composants.",
  "3. Réduire friction sur RAG, Documents, Settings.",
  "4. Vérifier responsive + accessibilité clavier.",
  "",
  "Ce ticket est considéré bloquant pour la phase de perception qualité."
].join("\n");

const SUBTASK_COMMENT = [
  "Accélération UI demandée.",
  "Merci de prioriser ce ticket dans le flux actif avec livrables visibles en local."
].join("\n");

function parseEnvFile(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
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

async function loadLocalEnv() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    try {
      const content = await fs.readFile(file, "utf8");
      const vars = parseEnvFile(content);
      for (const [k, v] of Object.entries(vars)) {
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {
      // Optional env file.
    }
  }
}

async function linearRequest(token, query, variables) {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Linear API error (${response.status}): ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`Linear GraphQL error: ${payload.errors[0].message}`);
  }
  return payload.data;
}

async function getIssueByIdentifier(token, identifier) {
  const match = identifier.match(/^([A-Z]+)-(\d+)$/i);
  if (!match) return null;
  const teamKey = match[1].toUpperCase();
  const number = Number(match[2]);

  const query = `
    query IssueByIdentifier($teamKey: String!, $number: Float!) {
      issues(first: 1, filter: { team: { key: { eq: $teamKey } }, number: { eq: $number } }) {
        nodes {
          id
          identifier
          title
          state {
            id
            name
            type
          }
          team {
            key
            states {
              nodes {
                id
                name
                type
              }
            }
          }
        }
      }
    }
  `;
  const data = await linearRequest(token, query, { teamKey, number });
  return data.issues?.nodes?.[0] || null;
}

function pickActiveState(states) {
  const started = states.find((s) => String(s.type).toLowerCase() === "started");
  if (started) return started;
  return states.find((s) => String(s.type).toLowerCase() === "unstarted") || null;
}

async function updateIssue(token, issueId, input) {
  const mutation = `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
      }
    }
  `;
  const data = await linearRequest(token, mutation, { id: issueId, input });
  return Boolean(data.issueUpdate?.success);
}

async function createComment(token, issueId, body) {
  const mutation = `
    mutation CreateComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
      }
    }
  `;
  const data = await linearRequest(token, mutation, { issueId, body });
  return Boolean(data.commentCreate?.success);
}

async function main() {
  await loadLocalEnv();
  const token = process.env.LINEAR_API_TOKEN || "";
  if (!token) {
    console.error("Missing LINEAR_API_TOKEN in .env.local or environment.");
    return 1;
  }

  const apply = process.argv.includes("--apply");
  console.log(`UI pressure pass (${apply ? "apply" : "dry-run"})`);

  for (const target of UI_ISSUES) {
    const issue = await getIssueByIdentifier(token, target.id);
    if (!issue) {
      console.log(`- ${target.id}: not found`);
      continue;
    }

    const states = issue.team?.states?.nodes || [];
    const activeState = pickActiveState(states);
    const input = {
      priority: target.priority,
      ...(activeState ? { stateId: activeState.id } : {})
    };

    if (!apply) {
      console.log(
        `- ${target.id}: priority -> ${target.priority}${activeState ? `, state -> ${activeState.name}` : ""} (dry-run)`
      );
      continue;
    }

    const updated = await updateIssue(token, issue.id, input);
    const commentBody = target.id === "YER-11" ? MILESTONE_COMMENT : SUBTASK_COMMENT;
    const commented = await createComment(token, issue.id, commentBody);
    console.log(
      `- ${target.id}: ${updated ? "updated" : "update-failed"} / ${commented ? "commented" : "comment-failed"}`
    );
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
