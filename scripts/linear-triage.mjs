#!/usr/bin/env node
import fs from "node:fs/promises";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const DEFAULT_IDS = ["YER-1", "YER-2", "YER-3", "YER-4", "YER-5"];

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
            id
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

function pickTerminalState(states) {
  const canceled = states.find((s) => String(s.type).toLowerCase() === "canceled");
  if (canceled) return canceled;
  return states.find((s) => String(s.type).toLowerCase() === "completed") || null;
}

async function updateIssueState(token, issueId, stateId) {
  const mutation = `
    mutation UpdateIssueState($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
      }
    }
  `;
  const data = await linearRequest(token, mutation, { id: issueId, stateId });
  return Boolean(data.issueUpdate?.success);
}

async function main() {
  await loadLocalEnv();
  const token = process.env.LINEAR_API_TOKEN || "";
  if (!token) {
    console.error("Missing LINEAR_API_TOKEN in .env.local or environment.");
    return 1;
  }

  const apply = process.argv.includes("--apply");
  const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
  const ids = idsArg
    ? idsArg
        .slice("--ids=".length)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : DEFAULT_IDS;

  console.log(`Linear triage (${apply ? "apply" : "dry-run"})`);
  console.log(`Target issues: ${ids.join(", ")}`);

  for (const identifier of ids) {
    const issue = await getIssueByIdentifier(token, identifier);
    if (!issue) {
      console.log(`- ${identifier}: not found`);
      continue;
    }

    const currentType = String(issue.state?.type || "").toLowerCase();
    if (currentType === "completed" || currentType === "canceled") {
      console.log(`- ${identifier}: already terminal (${issue.state.name})`);
      continue;
    }

    const states = issue.team?.states?.nodes || [];
    const terminal = pickTerminalState(states);
    if (!terminal) {
      console.log(`- ${identifier}: no completed/canceled state found for team ${issue.team?.key}`);
      continue;
    }

    if (!apply) {
      console.log(
        `- ${identifier}: ${issue.state?.name || "unknown"} -> ${terminal.name} (dry-run)`
      );
      continue;
    }

    const ok = await updateIssueState(token, issue.id, terminal.id);
    console.log(
      `- ${identifier}: ${issue.state?.name || "unknown"} -> ${terminal.name} (${ok ? "updated" : "failed"})`
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
