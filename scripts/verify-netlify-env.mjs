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
  "STRIPE_PRICE_MONTHLY_A",
  "STRIPE_PRICE_MONTHLY_B",
  "STRIPE_PRICE_YEARLY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "HOLMETA_EMAIL_FROM",
  "PUBLIC_BASE_URL",
  "TRIAL_DAYS"
];

function runNetlifyEnvList() {
  const raw = execFileSync("npx", ["netlify-cli", "env:list", "--json"], {
    cwd: webDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(raw);
}

function toEnvMap(input) {
  if (!input) return {};
  if (!Array.isArray(input)) {
    return input;
  }

  const map = {};
  for (const item of input) {
    const key = String(item?.key || "").trim();
    if (!key) continue;

    const direct = String(item?.value || "").trim();
    if (direct) {
      map[key] = direct;
      continue;
    }

    if (Array.isArray(item?.values) && item.values.length) {
      const first = item.values.find((valueEntry) => String(valueEntry?.value || "").trim());
      map[key] = first?.value || "";
    }
  }

  return map;
}

function main() {
  let envMap;

  try {
    envMap = toEnvMap(runNetlifyEnvList());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to read Netlify env vars for apps/web.");
    console.error(message);
    console.error("Run from apps/web: npx netlify-cli link --id <site-id> and retry.");
    process.exit(1);
  }

  const hasLegacyMonthlyFallback = Boolean(String(envMap?.STRIPE_PRICE_ID_2 || "").trim());
  const missing = requiredKeys.filter((key) => {
    if (key === "STRIPE_PRICE_MONTHLY_A") {
      return !String(envMap?.STRIPE_PRICE_MONTHLY_A || "").trim() && !hasLegacyMonthlyFallback;
    }
    return !String(envMap?.[key] || "").trim();
  });

  if (missing.length) {
    console.error("Missing required Netlify production env vars:");
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exit(1);
  }

  console.log("Netlify env verification passed.");
  for (const key of requiredKeys) {
    if (key === "STRIPE_PRICE_MONTHLY_A" && !String(envMap?.STRIPE_PRICE_MONTHLY_A || "").trim()) {
      console.log(`- STRIPE_PRICE_MONTHLY_A: fallback to STRIPE_PRICE_ID_2`);
    } else {
      console.log(`- ${key}: present`);
    }
  }
}

main();
