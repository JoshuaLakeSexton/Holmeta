#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const manifestPath = path.join(root, "manifest.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureFile(relativePath) {
  const full = path.join(root, relativePath);
  try {
    await access(full);
    return;
  } catch {
    // During source-level tests, manifest may point to build paths under /assets while source lives under /src/assets.
    const sourceFallback = path.join(root, "src", relativePath);
    await access(sourceFallback);
  }
}

async function main() {
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  assert(manifest.manifest_version === 3, "Manifest must use MV3");
  assert(typeof manifest.background?.service_worker === "string", "Missing background.service_worker");
  assert(Array.isArray(manifest.permissions), "Missing permissions array");

  const requiredPermissions = ["storage", "alarms", "notifications", "tabs", "declarativeNetRequest"];
  for (const permission of requiredPermissions) {
    assert(manifest.permissions.includes(permission), `Missing permission: ${permission}`);
  }

  assert(Array.isArray(manifest.host_permissions), "Missing host_permissions");
  assert(manifest.host_permissions.includes("<all_urls>"), "Expected <all_urls> in host_permissions");

  const scripts = manifest.content_scripts?.[0];
  assert(scripts, "Missing content_scripts entry");
  assert(Array.isArray(scripts.matches), "Missing content_scripts.matches");
  assert(
    scripts.matches.includes("http://*/*") && scripts.matches.includes("https://*/*"),
    "Content script matches must include only http/https targets"
  );
  assert(Array.isArray(scripts.css) && scripts.css.length > 0, "Content scripts must include CSS files");

  await ensureFile(manifest.background.service_worker);
  await ensureFile(manifest.options_page);
  await ensureFile(manifest.action.default_popup);

  for (const cssPath of scripts.css) {
    await ensureFile(cssPath);
  }

  const iconValues = Object.values(manifest.icons || {});
  assert(iconValues.length >= 4, "Manifest icons (16/32/48/128) are required");
  for (const iconPath of iconValues) {
    await ensureFile(String(iconPath));
  }

  console.log("Extension manifest tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
