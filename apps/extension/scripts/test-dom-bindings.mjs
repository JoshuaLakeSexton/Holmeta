#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

function unique(values) {
  return [...new Set(values)];
}

function idsFromHtml(html) {
  const out = [];
  const regex = /\sid="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html))) {
    out.push(match[1]);
  }
  return unique(out);
}

function assertCriticalIds(label, htmlIds, criticalIds) {
  const missing = criticalIds.filter((id) => !htmlIds.includes(id));
  if (missing.length) {
    throw new Error(`${label}: missing critical element id(s): ${missing.join(", ")}`);
  }
}

async function main() {
  const popupHtml = await readFile(path.join(root, "src/popup.html"), "utf8");
  const optionsHtml = await readFile(path.join(root, "src/options.html"), "utf8");

  const popupHtmlIds = idsFromHtml(popupHtml);
  const optionsHtmlIds = idsFromHtml(optionsHtml);

  // Critical controls that must exist for launch.
  assertCriticalIds("popup", popupHtmlIds, [
    "saveCurrentTab",
    "saveNoteInput",
    "searchInput",
    "workboardList",
    "licenseKeyInput",
    "activateLicense",
    "saveSession",
    "copyLinkPack",
    "workflowList",
    "snippetList"
  ]);

  assertCriticalIds("options", optionsHtmlIds, [
    "licenseKeyInput",
    "activateLicense",
    "clearLicense",
    "refreshEntitlement",
    "openDashboard",
    "testDashboardUrl",
    "testLicenseValidation"
  ]);

  console.log("Extension DOM binding tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
