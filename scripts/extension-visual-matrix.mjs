#!/usr/bin/env node

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const extensionPath = resolve(process.cwd(), "apps/extension");
const profileDir = "/tmp/holmeta-visual-matrix-profile";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = resolve(process.cwd(), "artifacts", "extension-visual-matrix", timestamp);

const sites = [
  { key: "github", url: "https://github.com/" },
  { key: "stripe", url: "https://dashboard.stripe.com/login" },
  { key: "youtube", url: "https://www.youtube.com/" },
  { key: "nytimes", url: "https://www.nytimes.com/" },
  { key: "ebay", url: "https://www.ebay.com/" }
];

const scenarios = [
  {
    key: "baseline",
    patch: {
      readingTheme: { enabled: false },
      darkLightTheme: { enabled: false },
      lightFilter: { enabled: false },
      adaptiveSiteTheme: { enabled: false }
    }
  },
  {
    key: "appearance_dark",
    patch: {
      readingTheme: { enabled: true, appearance: "dark", scheduleMode: "custom", schedule: { enabled: false, useSunset: false, start: "20:00", end: "06:00" } },
      darkLightTheme: { enabled: true, appearance: "dark", scheduleMode: "custom", schedule: { enabled: false, useSunset: false, start: "20:00", end: "06:00" } },
      lightFilter: { enabled: false },
      adaptiveSiteTheme: { enabled: false }
    }
  },
  {
    key: "appearance_light",
    patch: {
      readingTheme: { enabled: true, appearance: "light", scheduleMode: "custom", schedule: { enabled: false, useSunset: false, start: "20:00", end: "06:00" } },
      darkLightTheme: { enabled: true, appearance: "light", scheduleMode: "custom", schedule: { enabled: false, useSunset: false, start: "20:00", end: "06:00" } },
      lightFilter: { enabled: false },
      adaptiveSiteTheme: { enabled: false }
    }
  },
  {
    key: "light_filter_warm",
    patch: {
      readingTheme: { enabled: false },
      lightFilter: {
        enabled: true,
        mode: "warm",
        intensity: 45,
        schedule: { enabled: false, useSunset: false, start: "20:00", end: "06:00" }
      },
      adaptiveSiteTheme: { enabled: false }
    }
  },
  {
    key: "adaptive_smart_dark",
    patch: {
      readingTheme: { enabled: false },
      lightFilter: { enabled: false },
      adaptiveSiteTheme: {
        enabled: true,
        mode: "smart_dark",
        preset: "balanced",
        strategy: "auto",
        compatibilityMode: "normal",
        intensity: 52
      }
    }
  }
];

function sanitizeError(value) {
  return String(value || "").slice(0, 180);
}

async function runtimeMessage(controllerPage, message) {
  return controllerPage.evaluate((payload) => {
    return new Promise((resolveMessage) => {
      chrome.runtime.sendMessage(payload, (response) => {
        const runtimeErr = chrome.runtime.lastError;
        if (runtimeErr) {
          resolveMessage({
            ok: false,
            error: runtimeErr.message || "runtime_message_failed",
            response: null
          });
          return;
        }
        resolveMessage({
          ok: true,
          error: "",
          response: response || null
        });
      });
    });
  }, message);
}

async function tabMessage(controllerPage, tabId, message, options = {}) {
  return controllerPage.evaluate(({ id, payload, opts }) => {
    return new Promise((resolveMessage) => {
      chrome.tabs.sendMessage(id, payload, opts || {}, (response) => {
        const runtimeErr = chrome.runtime.lastError;
        if (runtimeErr) {
          resolveMessage({
            ok: false,
            error: runtimeErr.message || "tab_message_failed",
            response: null
          });
          return;
        }
        resolveMessage({
          ok: true,
          error: "",
          response: response || null
        });
      });
    });
  }, {
    id: Number(tabId || 0),
    payload: message,
    opts: Number.isInteger(Number(options.frameId)) ? { frameId: Number(options.frameId) } : {}
  });
}

async function getActiveHttpTab(controllerPage) {
  return controllerPage.evaluate(() => {
    return new Promise((resolveTab) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const runtimeErr = chrome.runtime.lastError;
        if (runtimeErr) {
          resolveTab({ ok: false, error: runtimeErr.message || "tabs_query_failed", tabId: 0, url: "" });
          return;
        }
        const tab = (tabs || []).find((candidate) => Number.isInteger(candidate?.id) && /^https?:/i.test(String(candidate?.url || "")));
        if (!tab) {
          resolveTab({ ok: false, error: "no_http_tab", tabId: 0, url: "" });
          return;
        }
        resolveTab({
          ok: true,
          error: "",
          tabId: Number(tab.id || 0),
          url: String(tab.url || "")
        });
      });
    });
  });
}

async function run() {
  mkdirSync(outputDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const report = {
    generatedAt: new Date().toISOString(),
    outputDir,
    extensionId: "",
    scenarios: scenarios.map((scenario) => scenario.key),
    rows: []
  };

  try {
    const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 30_000 });
    report.extensionId = new URL(sw.url()).host;

    const sitePage = await context.newPage();
    const controller = await context.newPage();
    await controller.goto(`chrome-extension://${report.extensionId}/popup.html`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });

    for (const site of sites) {
      await sitePage.goto(site.url, { waitUntil: "domcontentloaded", timeout: 70_000 });
      await sitePage.bringToFront();
      await sitePage.waitForTimeout(1400);

      const siteDir = join(outputDir, site.key);
      mkdirSync(siteDir, { recursive: true });

      const row = {
        site: site.url,
        key: site.key,
        captures: []
      };

      for (const scenario of scenarios) {
        const updateResult = await runtimeMessage(controller, {
          type: "holmeta:update-settings",
          patch: scenario.patch
        });
        const settingsAfterPatch = updateResult.response?.state?.settings || {};
        const applyResult = await runtimeMessage(controller, {
          type: "holmeta:apply-all-tabs",
          ensureLightEnabled: false
        });
        await sitePage.bringToFront();
        await sitePage.waitForTimeout(1100);

        const activeTab = await getActiveHttpTab(controller);
        let diagnostics = null;
        if (activeTab.ok && activeTab.tabId > 0) {
          const diagResult = await tabMessage(
            controller,
            activeTab.tabId,
            { type: "holmeta:get-light-diagnostics" },
            { frameId: 0 }
          );
          diagnostics = diagResult.ok ? (diagResult.response?.diagnostics || null) : { error: diagResult.error || "diagnostics_failed" };
        }

        const file = join(siteDir, `${scenario.key}.png`);
        let screenshotError = "";
        try {
          await sitePage.screenshot({
            path: file,
            fullPage: false,
            timeout: 90_000,
            animations: "disabled"
          });
        } catch (error) {
          try {
            await sitePage.waitForTimeout(800);
            await sitePage.screenshot({
              path: file,
              fullPage: false,
              timeout: 90_000,
              animations: "disabled"
            });
          } catch (retryError) {
            try {
              const cdp = await context.newCDPSession(sitePage);
              const capture = await cdp.send("Page.captureScreenshot", { format: "png" });
              await cdp.detach();
              if (capture?.data) {
                writeFileSync(file, Buffer.from(String(capture.data), "base64"));
              } else {
                screenshotError = sanitizeError(retryError?.message || retryError || error || "screenshot_failed");
              }
            } catch (cdpError) {
              screenshotError = sanitizeError(cdpError?.message || cdpError || retryError || error || "screenshot_failed");
            }
          }
        }

        row.captures.push({
          scenario: scenario.key,
          file,
          updateOk: Boolean(updateResult.ok && updateResult.response?.ok),
          applyOk: Boolean(applyResult.ok && applyResult.response?.ok),
          readingEnabledAfterPatch: Boolean(
            settingsAfterPatch.darkLightTheme?.enabled ?? settingsAfterPatch.readingTheme?.enabled
          ),
          readingAppearanceAfterPatch: String(
            settingsAfterPatch.darkLightTheme?.appearance
              || settingsAfterPatch.readingTheme?.appearance
              || ""
          ),
          diagnostics: diagnostics || null,
          error:
            sanitizeError(updateResult.response?.error || updateResult.error)
            || sanitizeError(applyResult.response?.error || applyResult.error)
            || screenshotError
        });
      }

      report.rows.push(row);
    }
  } finally {
    await context.close();
  }

  const reportFile = join(outputDir, "report.json");
  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputDir, reportFile }, null, 2));
}

run().catch((error) => {
  console.error("[extension-visual-matrix] failed");
  console.error(error?.stack || error);
  process.exit(1);
});
