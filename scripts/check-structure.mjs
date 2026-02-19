#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (existsSync("src/pages/api")) {
  fail("Legacy pages/api routes detected. Only src/app/api/* is allowed.");
}

let trackedDsStore = "";
try {
  trackedDsStore = execSync("git ls-files | grep '.DS_Store' || true", {
    stdio: ["ignore", "pipe", "ignore"]
  })
    .toString()
    .trim();
} catch {
  trackedDsStore = "";
}
if (trackedDsStore) {
  fail(`Tracked .DS_Store files detected:\n${trackedDsStore}`);
}

const envExample = readFileSync(".env.example", "utf-8");
const requiredFlags = [
  "FEATURE_DOCFLOW",
  "FEATURE_EMAIL_V2",
  "FEATURE_APP_LITE",
  "FEATURE_RSS",
  "FEATURE_OAUTH_ADVANCED"
];

for (const flag of requiredFlags) {
  if (!envExample.includes(`${flag}=`)) {
    fail(`Missing feature flag declaration in .env.example: ${flag}`);
  }
}

console.log("✅ Structure checks passed.");
