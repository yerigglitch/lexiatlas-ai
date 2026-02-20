#!/usr/bin/env node
import fs from "node:fs/promises";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const EPICS = ["YER-10", "YER-11", "YER-12", "YER-13"];
const CANCEL_PHASES = ["YER-6", "YER-7", "YER-8", "YER-9"];

const EPIC_COMMENT = {
  "YER-10": [
    "Epic actif: Orchestration RAG.",
    "Scope: ingestion, retrieval, qualité citations, robustness pipeline."
  ].join("\n"),
  "YER-11": [
    "Epic actif: Frontend SaaS.",
    "Scope: fluidité UI, cohérence visuelle, UX d'usage quotidien."
  ].join("\n"),
  "YER-12": [
    "Epic actif: Tests, sécurité, déploiement.",
    "Scope: E2E, hardening sécurité, readiness production."
  ].join("\n"),
  "YER-13": [
    "Epic actif: Post-MVP.",
    "Scope: améliorations non bloquantes, scalabilité, feedback loops."
  ].join("\n")
};

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
  for (const file of [".env.local", ".env"]) {
    try {
      const vars = parseEnvFile(await fs.readFile(file, "utf8"));
      for (const [k, v] of Object.entries(vars)) {
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {
      // Optional file.
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

async function getIssue(token, identifier) {
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

function pickState(states, type) {
  return states.find((s) => String(s.type || "").toLowerCase() === type) || null;
}

async function issueUpdate(token, id, input) {
  const mutation = `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
      }
    }
  `;
  const data = await linearRequest(token, mutation, { id, input });
  return Boolean(data.issueUpdate?.success);
}

async function commentCreate(token, issueId, body) {
  const mutation = `
    mutation Comment($issueId: String!, $body: String!) {
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
  console.log(`Phase cleanup (${apply ? "apply" : "dry-run"})`);

  for (const id of CANCEL_PHASES) {
    const issue = await getIssue(token, id);
    if (!issue) {
      console.log(`- ${id}: not found`);
      continue;
    }
    const states = issue.team?.states?.nodes || [];
    const currentType = String(issue.state?.type || "").toLowerCase();
    if (currentType === "completed" || currentType === "canceled") {
      console.log(`- ${id}: already terminal (${issue.state.name})`);
      continue;
    }
    const canceled = pickState(states, "canceled") || pickState(states, "completed");
    if (!canceled) {
      console.log(`- ${id}: no terminal state found`);
      continue;
    }
    if (!apply) {
      console.log(`- ${id}: ${issue.state?.name || "unknown"} -> ${canceled.name} (dry-run)`);
      continue;
    }
    const ok = await issueUpdate(token, issue.id, { stateId: canceled.id, priority: 0 });
    console.log(`- ${id}: ${ok ? "canceled" : "update-failed"}`);
  }

  for (const id of EPICS) {
    const issue = await getIssue(token, id);
    if (!issue) {
      console.log(`- ${id}: not found`);
      continue;
    }
    const states = issue.team?.states?.nodes || [];
    const started = pickState(states, "started");
    const unstarted = pickState(states, "unstarted");

    let input = { priority: 2 };
    if (id === "YER-11" && started) {
      input = { ...input, stateId: started.id };
    } else if (id !== "YER-11" && unstarted) {
      input = { ...input, stateId: unstarted.id };
    }

    if (!apply) {
      console.log(`- ${id}: epic recadré (dry-run)`);
      continue;
    }

    const updated = await issueUpdate(token, issue.id, input);
    const commented = await commentCreate(
      token,
      issue.id,
      EPIC_COMMENT[id] ||
        "Epic recadré après nettoyage du backlog. Les tickets actifs doivent s'aligner sur ce scope."
    );
    console.log(`- ${id}: ${updated ? "updated" : "update-failed"} / ${commented ? "commented" : "comment-failed"}`);
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
