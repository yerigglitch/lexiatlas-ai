#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const LINEAR_API_URL = "https://api.linear.app/graphql";

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

function toPriorityLabel(priority) {
  switch (priority) {
    case 1:
      return "urgent";
    case 2:
      return "high";
    case 3:
      return "medium";
    case 4:
      return "low";
    default:
      return "none";
  }
}

function includeIssue(issue, config) {
  if (config.teamKey) {
    const key = issue.team?.key || "";
    if (key.toLowerCase() !== config.teamKey.toLowerCase()) return false;
  }
  if (config.projectId) {
    if ((issue.project?.id || "") !== config.projectId) return false;
  }
  if (config.assigneeEmail) {
    const email = issue.assignee?.email || "";
    if (email.toLowerCase() !== config.assigneeEmail.toLowerCase()) return false;
  }
  if (!config.includeCompleted) {
    const stateType = String(issue.state?.type || "").toLowerCase();
    if (stateType === "completed" || stateType === "canceled") return false;
  }
  if (config.states.length > 0) {
    const stateName = String(issue.state?.name || "").toLowerCase();
    if (!config.states.includes(stateName)) return false;
  }
  return true;
}

function renderMarkdown(issues, config) {
  const now = new Date();
  const grouped = new Map();
  for (const issue of issues) {
    const stateName = issue.state?.name || "No state";
    if (!grouped.has(stateName)) grouped.set(stateName, []);
    grouped.get(stateName).push(issue);
  }

  const lines = [];
  lines.push("# Linear Tasks");
  lines.push("");
  lines.push(`Last sync: ${now.toISOString()}`);
  lines.push(`Total issues: ${issues.length}`);
  lines.push("");
  lines.push("## Filters");
  lines.push(`- Team: ${config.teamKey || "all"}`);
  lines.push(`- Assignee: ${config.assigneeEmail || "all"}`);
  lines.push(`- Project ID: ${config.projectId || "all"}`);
  lines.push(`- Include completed: ${config.includeCompleted ? "yes" : "no"}`);
  lines.push(
    `- States: ${config.states.length ? config.states.join(", ") : "all active states"}`
  );
  lines.push("");

  if (issues.length === 0) {
    lines.push("_No issues match current filters._");
    lines.push("");
    return lines.join("\n");
  }

  const sortedStates = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  for (const stateName of sortedStates) {
    lines.push(`## ${stateName}`);
    lines.push("");
    const stateIssues = grouped
      .get(stateName)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    for (const issue of stateIssues) {
      const assignee = issue.assignee?.name || "unassigned";
      const teamKey = issue.team?.key || "";
      const projectName = issue.project?.name || "no project";
      const priority = toPriorityLabel(issue.priority);
      const updatedAt = new Date(issue.updatedAt).toISOString().slice(0, 10);
      lines.push(
        `- [${issue.identifier}](${issue.url}) ${issue.title}  `
      );
      lines.push(
        `  team: \`${teamKey}\` | assignee: \`${assignee}\` | project: \`${projectName}\` | priority: \`${priority}\` | updated: \`${updatedAt}\``
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function fetchIssues(token) {
  const issues = [];
  let after = null;

  const query = `
    query Issues($first: Int!, $after: String) {
      issues(first: $first, after: $after, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          priority
          updatedAt
          url
          state {
            name
            type
          }
          team {
            key
            name
          }
          assignee {
            name
            email
          }
          project {
            id
            name
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  while (true) {
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({
        query,
        variables: { first: 100, after }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear API error (${response.status}): ${text.slice(0, 300)}`);
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(`Linear GraphQL error: ${payload.errors[0].message}`);
    }

    const connection = payload.data?.issues;
    const nodes = connection?.nodes || [];
    issues.push(...nodes);

    if (!connection?.pageInfo?.hasNextPage) break;
    after = connection.pageInfo.endCursor;
  }

  return issues;
}

async function main() {
  await loadLocalEnv();

  const token = process.env.LINEAR_API_TOKEN || "";
  if (!token) {
    console.error("Missing LINEAR_API_TOKEN in .env.local or environment.");
    return 1;
  }

  const outputPath = process.env.LINEAR_SYNC_OUTPUT || "tasks/linear.md";
  const config = {
    teamKey: process.env.LINEAR_TEAM_KEY || "",
    assigneeEmail: process.env.LINEAR_ASSIGNEE_EMAIL || "",
    projectId: process.env.LINEAR_PROJECT_ID || "",
    includeCompleted: String(process.env.LINEAR_INCLUDE_COMPLETED || "false") === "true",
    states: String(process.env.LINEAR_STATES || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  };

  const issues = await fetchIssues(token);
  const filtered = issues.filter((issue) => includeIssue(issue, config));
  const markdown = renderMarkdown(filtered, config);

  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");

  console.log(`Synced ${filtered.length} issues to ${outputPath}`);
  return 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
