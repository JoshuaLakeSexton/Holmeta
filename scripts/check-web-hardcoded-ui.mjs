#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

const TARGET_DIRS = [
  path.join(ROOT, "apps/web/app"),
  path.join(ROOT, "apps/web/components")
];

const findings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function shouldIgnoreLine(line) {
  if (!line) return true;
  if (line.includes("i18n-ignore")) return true;
  if (line.includes("HOLMETA")) return true;
  if (line.includes("reach@holmeta.com")) return true;
  if (/cs_(live|test)_/i.test(line)) return true;
  if (/HOLMETA-XXXX/i.test(line)) return true;
  return false;
}

function inspectFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n");

  lines.forEach((line, idx) => {
    if (shouldIgnoreLine(line)) return;

    const textNode = />\s*[A-Za-z][^<{]*\s*</.test(line);
    const hardcodedAttr = /\b(?:aria-label|placeholder|title|alt)\s*=\s*"[^"]*[A-Za-z][^"]*"/.test(line);

    if (!textNode && !hardcodedAttr) return;
    if (line.includes("{t(")) return;

    findings.push({
      file: filePath,
      line: idx + 1,
      text: line.trim()
    });
  });
}

for (const dir of TARGET_DIRS) {
  for (const filePath of walk(dir)) {
    inspectFile(filePath);
  }
}

if (findings.length) {
  console.error("[i18n-ui-check] Hardcoded visible UI strings found:");
  for (const finding of findings.slice(0, 200)) {
    console.error(`- ${finding.file}:${finding.line}`);
    console.error(`  ${finding.text}`);
  }
  console.error(`[i18n-ui-check] Total findings: ${findings.length}`);
  process.exit(1);
}

console.log("[i18n-ui-check] No hardcoded visible UI strings found in app/components.");
