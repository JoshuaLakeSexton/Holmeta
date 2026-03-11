#!/usr/bin/env node

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const extensionPath = resolve(process.cwd(), "apps/extension");
const profileDir = "/tmp/holmeta-extension-smoke-profile";
const sites = [
  "https://github.com/",
  "https://dashboard.stripe.com/login",
  "https://www.youtube.com/",
  "https://www.nytimes.com/",
  "https://www.amazon.com/"
];

function truncate(value, max = 140) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function isMissingReceiverError(text) {
  const value = String(text || "").toLowerCase();
  return value.includes("receiving end does not exist")
    || value.includes("could not establish connection");
}

async function getServiceWorker(context) {
  const existing = context.serviceWorkers()[0];
  if (existing) return existing;
  return context.waitForEvent("serviceworker", { timeout: 30_000 });
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

async function injectContentScripts(controllerPage, tabId) {
  return controllerPage.evaluate(({ id }) => {
    return new Promise((resolveInject) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: id },
          files: ["light/engine.js", "content.js"]
        },
        () => {
          const runtimeErr = chrome.runtime.lastError;
          if (runtimeErr) {
            resolveInject({ ok: false, error: runtimeErr.message || "inject_failed" });
            return;
          }
          resolveInject({ ok: true, error: "" });
        }
      );
    });
  }, { id: Number(tabId || 0) });
}

async function ensureTabReceiver(controllerPage, tabId) {
  if (!Number.isInteger(Number(tabId)) || Number(tabId) <= 0) {
    return { ok: false, error: "invalid_tab" };
  }
  const ping = await tabMessage(controllerPage, tabId, { type: "holmeta:ping" }, { frameId: 0 });
  if (ping.ok && ping.response?.ok) return { ok: true };
  if (ping.ok && ping.response?.ok === false && !isMissingReceiverError(ping.response?.error)) {
    return { ok: true };
  }
  if (!isMissingReceiverError(ping.error || ping.response?.error)) {
    return { ok: false, error: ping.error || ping.response?.error || "receiver_unavailable" };
  }

  const injected = await injectContentScripts(controllerPage, tabId);
  if (!injected.ok) return injected;

  const verify = await tabMessage(controllerPage, tabId, { type: "holmeta:ping" }, { frameId: 0 });
  if (!verify.ok || !verify.response?.ok) {
    return {
      ok: false,
      error: verify.error || verify.response?.error || "receiver_not_ready"
    };
  }
  return { ok: true };
}

async function getActiveTab(controllerPage) {
  return controllerPage.evaluate(() => {
    return new Promise((resolveTab) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const runtimeErr = chrome.runtime.lastError;
        if (runtimeErr) {
          resolveTab({ ok: false, error: runtimeErr.message || "tabs_query_failed", tabId: 0, url: "" });
          return;
        }
        const tab = (tabs || []).find((candidate) => Number.isInteger(candidate?.id));
        if (!tab) {
          resolveTab({ ok: false, error: "no_active_tab", tabId: 0, url: "" });
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
  if (!existsSync(extensionPath)) {
    throw new Error(`Extension path not found: ${extensionPath}`);
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    extensionId: "",
    checks: {
      popupTyping: { ok: false, details: "" },
      screenshotStart: [],
      lightDiagnostics: [],
      colorPickStart: [],
      healthAlertSoundPath: { ok: false, details: "" }
    }
  };

  try {
    const serviceWorker = await getServiceWorker(context);
    summary.extensionId = new URL(serviceWorker.url()).host;

    const tab = await context.newPage();
    await tab.goto("https://github.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await tab.bringToFront();

    // Configure runtime state for diagnostics.
    const controller = await context.newPage();
    await controller.goto(`chrome-extension://${summary.extensionId}/popup.html`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await runtimeMessage(controller, {
      type: "holmeta:update-settings",
      patch: {
        readingTheme: { enabled: true, mode: "dark", preset: "soft_black", intensity: 44 },
        lightFilter: { enabled: true, mode: "warm", intensity: 45 },
        screenshotTool: { enabled: true },
        alerts: { enabled: true, soundEnabled: true, notificationEnabled: true, toastEnabled: true }
      }
    });

    // Popup typing + persisted settings smoke.
    await controller.fill("#eyeHexInput", "#A1B2C3");
    const typed = await controller.inputValue("#eyeHexInput");
    await controller.fill("#lightIntensity", "52");
    await controller.dispatchEvent("#lightIntensity", "input");
    await controller.waitForTimeout(650);
    await controller.reload({ waitUntil: "domcontentloaded" });
    const persisted = await controller.inputValue("#lightIntensity");
    summary.checks.popupTyping = {
      ok: typed === "#A1B2C3" && persisted !== "45",
      details: `typed=${typed} persistedLightIntensity=${persisted}`
    };

    for (const url of sites) {
      try {
        if (tab.url() !== url) {
          await tab.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        }
      } catch (error) {
        summary.checks.screenshotStart.push({
          site: url,
          ok: false,
          error: `navigation_failed:${truncate(error?.message || error)}`
        });
        continue;
      }

      await tab.bringToFront();
      await tab.waitForTimeout(1200);
      const activeTab = await getActiveTab(controller);

      const startResult = await runtimeMessage(controller, { type: "holmeta:screenshot-start" });
      const startedTabId = Number(startResult.response?.tabId || 0);
      summary.checks.screenshotStart.push({
        site: url,
        ok: Boolean(startResult.ok && startResult.response?.ok),
        error: truncate(startResult.response?.error || startResult.error || "")
      });

      const diagnosticTabId = startedTabId > 0 ? startedTabId : Number(activeTab.tabId || 0);
      if (!activeTab.ok || diagnosticTabId <= 0 || !/^https?:/i.test(activeTab.url || "")) {
        summary.checks.lightDiagnostics.push({
          site: url,
          ok: false,
          overlayCount: -1,
          strategy: "unknown",
          note: `active_tab_error:${truncate(activeTab.error || "unknown")}`
        });
      } else {
        const receiverReady = await ensureTabReceiver(controller, diagnosticTabId);
        if (!receiverReady.ok) {
          summary.checks.lightDiagnostics.push({
            site: url,
            ok: false,
            overlayCount: -1,
            strategy: "unknown",
            note: truncate(receiverReady.error || "receiver_unavailable")
          });
          await runtimeMessage(controller, { type: "holmeta:screenshot-stop" });
          await runtimeMessage(controller, { type: "holmeta:stop-color-pick" });
          continue;
        }

        let diagnosticsResult = await tabMessage(controller, diagnosticTabId, {
          type: "holmeta:get-light-diagnostics"
        }, { frameId: 0 });
        if (
          !diagnosticsResult.ok
          && isMissingReceiverError(diagnosticsResult.error || diagnosticsResult.response?.error)
        ) {
          const retryReady = await ensureTabReceiver(controller, diagnosticTabId);
          if (retryReady.ok) {
            diagnosticsResult = await tabMessage(controller, diagnosticTabId, {
              type: "holmeta:get-light-diagnostics"
            }, { frameId: 0 });
          }
        }
        summary.checks.lightDiagnostics.push({
          site: url,
          ok: Boolean(diagnosticsResult.ok && diagnosticsResult.response?.ok),
          overlayCount: Number(diagnosticsResult.response?.diagnostics?.overlayCount ?? -1),
          strategy: String(diagnosticsResult.response?.diagnostics?.strategy || "unknown"),
          note: truncate(diagnosticsResult.response?.error || diagnosticsResult.error || "")
        });
      }

      await runtimeMessage(controller, { type: "holmeta:screenshot-stop" });

      const colorPickResult = await runtimeMessage(controller, { type: "holmeta:start-color-pick" });
      summary.checks.colorPickStart.push({
        site: url,
        ok: Boolean(colorPickResult.ok && colorPickResult.response?.ok),
        error: truncate(colorPickResult.response?.error || colorPickResult.error || "")
      });
      await runtimeMessage(controller, { type: "holmeta:stop-color-pick" });
    }

    const alertResult = await runtimeMessage(controller, { type: "holmeta:test-alert", kind: "eye" });
    const delivered = alertResult.response?.delivery || {};
    summary.checks.healthAlertSoundPath = {
      ok: Boolean(alertResult.ok && alertResult.response?.ok && delivered.sound),
      details: `notification=${Boolean(delivered.notification)} toast=${Boolean(delivered.toast)} sound=${Boolean(delivered.sound)} channel=${String(delivered.soundChannel || "none")} error=${truncate(delivered.soundError || "")}`
    };

    const failed = [];
    if (!summary.checks.popupTyping.ok) failed.push("popupTyping");
    for (const item of summary.checks.screenshotStart) {
      if (!item.ok) failed.push(`screenshotStart:${item.site}`);
    }
    if (!summary.checks.healthAlertSoundPath.ok) failed.push("healthAlertSoundPath");

    console.log(JSON.stringify(summary, null, 2));
    if (failed.length) {
      throw new Error(`Runtime smoke failures: ${failed.join(", ")}`);
    }
  } finally {
    await context.close();
  }
}

run().catch((error) => {
  console.error("[extension-runtime-smoke] failed");
  console.error(error?.stack || error);
  process.exit(1);
});
