#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const extensionRoot = join(repoRoot, "apps", "extension");
const manifestPath = join(extensionRoot, "manifest.json");

function fail(message) {
  console.error(`[extension:validate] ${message}`);
  process.exit(1);
}

function runSyntaxCheck(filePath) {
  execSync(`node --check "${filePath}"`, { stdio: "pipe" });
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`Unable to parse manifest.json: ${error instanceof Error ? error.message : String(error)}`);
}

if (manifest?.manifest_version !== 3) {
  fail("manifest_version must be 3.");
}

const requiredFiles = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.js",
  "options.js",
  "appearance/appearance-state.js",
  "appearance/theme-detector.js",
  "appearance/media-guard.js",
  "appearance/ui-surface-classifier.js",
  "appearance/component-normalizer.js",
  "appearance/dynamic-node-processor.js",
  "appearance/site-compatibility.js",
  "appearance/token-remapper.js",
  "appearance/appearance-engine.js",
  "light/engine.js"
];

for (const relativePath of requiredFiles) {
  const absolutePath = join(extensionRoot, relativePath);
  try {
    const stat = statSync(absolutePath);
    if (!stat.isFile()) {
      fail(`Required file is not a file: ${relativePath}`);
    }
  } catch {
    fail(`Missing required extension file: ${relativePath}`);
  }
}

const commandEntries = Object.entries(manifest.commands || {});
const shortcutCount = commandEntries.filter(([, config]) => config && config.suggested_key).length;
if (shortcutCount > 4) {
  fail(`Chrome allows up to 4 command shortcuts. Found ${shortcutCount}.`);
}

const jsFilesToCheck = [
  "background.js",
  "content.js",
  "popup.js",
  "options.js",
  "offscreen.js",
  "blocked.js",
  "appearance/appearance-state.js",
  "appearance/theme-detector.js",
  "appearance/media-guard.js",
  "appearance/ui-surface-classifier.js",
  "appearance/component-normalizer.js",
  "appearance/dynamic-node-processor.js",
  "appearance/site-compatibility.js",
  "appearance/token-remapper.js",
  "appearance/appearance-engine.js",
  "light/engine.js"
];

for (const relativePath of jsFilesToCheck) {
  const absolutePath = join(extensionRoot, relativePath);
  try {
    runSyntaxCheck(absolutePath);
  } catch (error) {
    fail(`Syntax check failed for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log("[extension:validate] manifest and syntax checks passed.");
