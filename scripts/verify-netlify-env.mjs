#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const webDir = path.join(repoRoot, "apps/web");

const requiredKeys = [
  "DATABASE_URL",
  "APP_JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID_2",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "HOLMETA_EMAIL_FROM"
];

function runNetlifyEnvList() {
  const raw = execFileSync("npx", ["netlify-cli", "env:list", "--json"], {
    cwd: webDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(raw);
}

function main() {
  let envMap;

  try {
    envMap = runNetlifyEnvList();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to read Netlify env vars for apps/web.");
    console.error(message);
    console.error("Run from apps/web: npx netlify-cli link --id <site-id> and retry.");
    process.exit(1);
  }

  const missing = requiredKeys.filter((key) => !String(envMap?.[key] || "").trim());

  if (missing.length) {
    console.error("Missing required Netlify production env vars:");
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exit(1);
  }

  console.log("Netlify env verification passed.");
  for (const key of requiredKeys) {
    console.log(`- ${key}: present`);
  }
}

main();
