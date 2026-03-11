#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const LOCALES_DIR = path.join(ROOT, "apps/web/locales");
const BASE_LOCALE = "en";
const SUPPORTED_LOCALES = ["en", "ja", "ko", "zh-cn", "zh-tw"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenLeafPaths(value, prefix = "") {
  if (Array.isArray(value)) {
    return [prefix];
  }

  if (!value || typeof value !== "object") {
    return [prefix];
  }

  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    out.push(...flattenLeafPaths(child, childPath));
  }
  return out;
}

function unresolvedTokenPaths(value, prefix = "", out = []) {
  if (typeof value === "string") {
    if (value.includes("__HOLMETA_TOKEN") || value.includes("__HM_TOK_")) {
      out.push(prefix);
    }
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      unresolvedTokenPaths(item, `${prefix}[${index}]`, out);
    });
    return out;
  }

  if (!value || typeof value !== "object") {
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    unresolvedTokenPaths(child, childPath, out);
  }
  return out;
}

let hasFailure = false;

const localeTrees = {};
for (const locale of SUPPORTED_LOCALES) {
  const localeFile = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(localeFile)) {
    hasFailure = true;
    console.error(`[i18n-check] Missing locale file: ${localeFile}`);
    continue;
  }
  localeTrees[locale] = readJson(localeFile);
}

const baseTree = localeTrees[BASE_LOCALE];
if (!baseTree) {
  console.error(`[i18n-check] Base locale "${BASE_LOCALE}" is missing.`);
  process.exit(1);
}

const baseKeys = new Set(flattenLeafPaths(baseTree).filter(Boolean));

for (const locale of SUPPORTED_LOCALES) {
  const tree = localeTrees[locale];
  if (!tree) continue;

  const keys = new Set(flattenLeafPaths(tree).filter(Boolean));
  const missing = [...baseKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !baseKeys.has(key));
  const unresolved = unresolvedTokenPaths(tree);

  if (missing.length) {
    hasFailure = true;
    console.error(`[i18n-check] ${locale}: missing ${missing.length} keys.`);
    console.error(`  sample: ${missing.slice(0, 12).join(", ")}`);
  }

  if (extra.length) {
    console.warn(`[i18n-check] ${locale}: extra ${extra.length} keys.`);
    console.warn(`  sample: ${extra.slice(0, 12).join(", ")}`);
  }

  if (unresolved.length) {
    hasFailure = true;
    console.error(`[i18n-check] ${locale}: unresolved token artifacts (${unresolved.length}).`);
    console.error(`  sample: ${unresolved.slice(0, 12).join(", ")}`);
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log("[i18n-check] Locale dictionaries are complete and clean.");
