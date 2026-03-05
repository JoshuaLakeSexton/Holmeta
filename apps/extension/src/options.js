(() => {
  const HC = globalThis.HolmetaCommon;
  const HS = globalThis.HolmetaPopupStorage || null;

  const FALLBACK_DRAFT_KEY = "holmeta.options.drafts.v1";

  const DEFAULT_DRAFTS = {
    licenseKey: "",
    apiBaseUrl: "",
    validateLicenseUrl: "",
    checkoutUrl: "",
    dashboardUrl: "",
    lightIntensity: 78
  };

  const state = {
    settings: HC.normalizeSettings(HC.DEFAULT_SETTINGS),
    entitlement: {
      active: false,
      status: "inactive",
      plan: "free",
      stale: false
    },
    drafts: { ...DEFAULT_DRAFTS }
  };

  const editingIds = new Set();
  let persistTimer = null;
  let hydrated = false;

  const $ = (id) => document.getElementById(id);

  function send(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({ ok: false, error: err.message || "RUNTIME_ERROR" });
          return;
        }
        resolve(response || { ok: false, error: "EMPTY_RESPONSE" });
      });
    });
  }

  function normalizeDrafts(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      // Preserve in-progress typing/paste exactly as entered.
      licenseKey: String(source.licenseKey || source.licenseKeyDraft || ""),
      apiBaseUrl: String(source.apiBaseUrl || "").trim(),
      validateLicenseUrl: String(source.validateLicenseUrl || "").trim(),
      checkoutUrl: String(source.checkoutUrl || "").trim(),
      dashboardUrl: String(source.dashboardUrl || "").trim(),
      lightIntensity: Math.max(0, Math.min(100, Math.round(Number(source.lightIntensity || 78))))
    };
  }

  async function readDrafts() {
    if (HS?.readUiState) {
      const uiState = await HS.readUiState();
      return normalizeDrafts(uiState || {});
    }
    return new Promise((resolve) => {
      chrome.storage.local.get([FALLBACK_DRAFT_KEY], (data) => {
        if (chrome.runtime?.lastError) {
          resolve({ ...DEFAULT_DRAFTS });
          return;
        }
        resolve(normalizeDrafts(data?.[FALLBACK_DRAFT_KEY] || {}));
      });
    });
  }

  async function writeDrafts(nextDrafts) {
    const normalized = normalizeDrafts(nextDrafts || {});
    if (HS?.patchUiState) {
      await HS.patchUiState({
        licenseKeyDraft: normalized.licenseKey,
        apiBaseUrl: normalized.apiBaseUrl,
        validateLicenseUrl: normalized.validateLicenseUrl,
        checkoutUrl: normalized.checkoutUrl,
        dashboardUrl: normalized.dashboardUrl,
        lightIntensity: normalized.lightIntensity
      });
      return;
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ [FALLBACK_DRAFT_KEY]: normalized }, () => resolve());
    });
  }

  function queueDraftPersist() {
    if (!hydrated) {
      return;
    }
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      writeDrafts(state.drafts);
    }, 350);
  }

  async function flushDraftPersist() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    await writeDrafts(state.drafts);
  }

  function setStatus(text, tone = "info") {
    const line = $("statusLine");
    if (!line) {
      return;
    }
    line.textContent = text;
    line.className = tone === "error"
      ? "status-chip status-locked"
      : tone === "success"
        ? "status-chip status-active"
        : "status-chip status-idle";
  }

  function setAccountStatus(text, tone = "info") {
    const node = $("accountStatus");
    if (!node) {
      return;
    }
    node.textContent = text;
    node.style.color = tone === "error" ? "var(--c-accent)" : tone === "success" ? "var(--c-warn)" : "var(--c-muted)";
  }

  function setControlValueIfIdle(id, value) {
    const node = $(id);
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) {
      return;
    }
    if (document.activeElement === node || editingIds.has(id)) {
      return;
    }
    const safe = String(value ?? "");
    if (node.value !== safe) {
      node.value = safe;
    }
  }

  function getWellnessSettings() {
    const source = state.settings?.wellness && typeof state.settings.wellness === "object"
      ? state.settings.wellness
      : {};
    return {
      breaksEnabled: Boolean(source.breaksEnabled),
      breaksIntervalMin: Math.max(15, Math.min(180, Math.round(Number(source.breaksIntervalMin || 50)))),
      eyeEnabled: Boolean(source.eyeEnabled),
      eyeIntervalMin: Math.max(10, Math.min(120, Math.round(Number(source.eyeIntervalMin || 20))))
    };
  }

  function isPremiumActive() {
    return Boolean(state.settings?.devBypassPremium || state.entitlement?.active);
  }

  function renderPremiumState() {
    const premiumNode = $("premiumStatus");
    if (!premiumNode) {
      return;
    }
    const premiumActive = isPremiumActive();
    premiumNode.className = premiumActive ? "status-chip status-active" : "status-chip status-locked";
    premiumNode.textContent = premiumActive ? "PREMIUM: ACTIVE" : "PREMIUM: LOCKED";
    document.querySelectorAll("[data-premium]").forEach((node) => {
      node.disabled = !premiumActive;
      if (!premiumActive) {
        node.title = "Premium required";
      } else {
        node.removeAttribute("title");
      }
    });
  }

  function render() {
    renderPremiumState();
    setControlValueIfIdle("apiBaseUrl", state.drafts.apiBaseUrl || state.settings.apiBaseUrl || "");
    setControlValueIfIdle("validateLicenseUrl", state.drafts.validateLicenseUrl || state.settings.validateLicenseUrl || "");
    setControlValueIfIdle("checkoutUrl", state.drafts.checkoutUrl || state.settings.checkoutUrl || "");
    setControlValueIfIdle("dashboardUrl", state.drafts.dashboardUrl || state.settings.dashboardUrl || "");

    const filterEnabled = $("filterEnabled");
    if (filterEnabled instanceof HTMLInputElement) {
      filterEnabled.checked = Boolean(state.settings.filterEnabled);
    }

    const preset = $("filterPreset");
    if (preset instanceof HTMLSelectElement) {
      preset.value = String(state.settings.filterPreset || HC.DEFAULT_SETTINGS.filterPreset);
    }

    const intensity = $("filterIntensity");
    const intensityValue = $("filterIntensityValue");
    const intPercent = Math.max(0, Math.min(100, Math.round(Number(state.settings.filterIntensity || 0) * 100)));
    if (intensity instanceof HTMLInputElement && !editingIds.has("filterIntensity")) {
      intensity.value = String(intPercent);
    }
    if (intensityValue) {
      intensityValue.textContent = `${intPercent}%`;
    }

    const wellness = getWellnessSettings();
    const breaksEnabled = $("breaksEnabled");
    const eyeEnabled = $("eyeEnabled");
    const breakInterval = $("breakIntervalMin");
    const eyeInterval = $("eyeIntervalMin");
    if (breaksEnabled instanceof HTMLInputElement) {
      breaksEnabled.checked = wellness.breaksEnabled;
    }
    if (eyeEnabled instanceof HTMLInputElement) {
      eyeEnabled.checked = wellness.eyeEnabled;
    }
    if (breakInterval instanceof HTMLSelectElement) {
      breakInterval.value = String(wellness.breaksIntervalMin);
    }
    if (eyeInterval instanceof HTMLSelectElement) {
      eyeInterval.value = String(wellness.eyeIntervalMin);
    }
  }

  async function refreshState() {
    const response = await send({ type: "holmeta-request-state", domain: "" });
    if (!response?.ok) {
      setStatus(`STATUS: LOAD FAILED (${String(response?.error || "UNKNOWN")})`, "error");
      return;
    }
    if (response.settings) {
      state.settings = HC.normalizeSettings(response.settings);
    }
    if (response.entitlement) {
      state.entitlement = response.entitlement;
    }
    render();
    setStatus("STATUS: READY", "info");
  }

  async function patchSettings(patch) {
    const response = await send({ type: "holmeta-update-settings", patch });
    if (!response?.ok) {
      setStatus(`STATUS: SAVE FAILED (${String(response?.error || "UNKNOWN")})`, "error");
      return { ok: false };
    }
    if (response.settings) {
      state.settings = HC.normalizeSettings(response.settings);
    }
    if (response.entitlement) {
      state.entitlement = response.entitlement;
    }
    render();
    setStatus("STATUS: SAVED", "success");
    return { ok: true };
  }

  async function openDashboard() {
    const draftDashboard = String($("dashboardUrl")?.value || "").trim();
    const resolved = HC.resolveDashboardUrl(state.settings, draftDashboard || null);
    if (!resolved.ok) {
      setAccountStatus("DASHBOARD URL INVALID", "error");
      setStatus("STATUS: DASHBOARD URL INVALID", "error");
      return;
    }
    const opened = await HC.openExternal(resolved.url);
    if (!opened.ok) {
      setAccountStatus(`DASHBOARD OPEN FAILED (${opened.message || opened.error || "UNKNOWN"})`, "error");
      setStatus("STATUS: DASHBOARD OPEN FAILED", "error");
      return;
    }
    setAccountStatus("DASHBOARD OPENED", "success");
  }

  function bindEvents() {
    document.addEventListener("focusin", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return;
      }
      if (target.id) {
        editingIds.add(target.id);
      }
    });

    document.addEventListener("focusout", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return;
      }
      if (target.id) {
        editingIds.delete(target.id);
      }
      queueDraftPersist();
    });

    window.addEventListener("beforeunload", () => {
      flushDraftPersist();
    });

    const preset = $("filterPreset");
    if (preset instanceof HTMLSelectElement) {
      preset.innerHTML = HC.FILTER_PRESET_OPTIONS
        .map((entry) => `<option value="${entry.id}">${entry.label}</option>`)
        .join("");
    }

    ["licenseKeyInput", "apiBaseUrl", "validateLicenseUrl", "checkoutUrl", "dashboardUrl"].forEach((id) => {
      $(id)?.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        const value = String(target.value || "");
        if (id === "licenseKeyInput") {
          state.drafts.licenseKey = value;
        } else if (id === "apiBaseUrl") {
          state.drafts.apiBaseUrl = value;
        } else if (id === "validateLicenseUrl") {
          state.drafts.validateLicenseUrl = value;
        } else if (id === "checkoutUrl") {
          state.drafts.checkoutUrl = value;
        } else if (id === "dashboardUrl") {
          state.drafts.dashboardUrl = value;
        }
        queueDraftPersist();
      });
    });

    $("filterIntensity")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const value = Math.max(0, Math.min(100, Math.round(Number(target.value || 0))));
      state.drafts.lightIntensity = value;
      const label = $("filterIntensityValue");
      if (label) {
        label.textContent = `${value}%`;
      }
      queueDraftPersist();
    });

    $("activateLicense")?.addEventListener("click", async () => {
      const license = String($("licenseKeyInput")?.value || "").trim().toUpperCase();
      if (!license) {
        setAccountStatus("ENTER LICENSE KEY", "error");
        return;
      }
      const response = await send({ type: "holmeta-activate-license", licenseKey: license });
      if (!response?.ok) {
        setAccountStatus(`ACTIVATION FAILED (${response?.error || "INVALID"})`, "error");
        return;
      }
      state.drafts.licenseKey = license;
      await flushDraftPersist();
      await refreshState();
      setAccountStatus("LICENSE ACTIVE", "success");
    });

    $("clearLicense")?.addEventListener("click", async () => {
      await send({ type: "holmeta-clear-license" });
      state.drafts.licenseKey = "";
      const input = $("licenseKeyInput");
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
      await flushDraftPersist();
      await refreshState();
      setAccountStatus("LICENSE CLEARED", "success");
    });

    $("refreshEntitlement")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-refresh-entitlement" });
      if (!response?.ok) {
        setAccountStatus("ENTITLEMENT REFRESH FAILED", "error");
        return;
      }
      await refreshState();
      setAccountStatus("ENTITLEMENT REFRESHED", "success");
    });

    $("openDashboard")?.addEventListener("click", openDashboard);
    $("testDashboardUrl")?.addEventListener("click", openDashboard);

    $("testLicenseValidation")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-test-entitlement-fetch" });
      if (!response?.ok) {
        setAccountStatus("VALIDATION FAILED", "error");
        return;
      }
      setAccountStatus(`VALIDATION ${response.status || 200}`, "success");
      await refreshState();
    });

    $("saveEndpoints")?.addEventListener("click", async () => {
      const patch = {
        apiBaseUrl: String($("apiBaseUrl")?.value || "").trim(),
        validateLicenseUrl: String($("validateLicenseUrl")?.value || "").trim(),
        checkoutUrl: String($("checkoutUrl")?.value || "").trim(),
        dashboardUrl: String($("dashboardUrl")?.value || "").trim()
      };
      state.drafts = {
        ...state.drafts,
        ...patch
      };
      await flushDraftPersist();
      await patchSettings(patch);
    });

    $("openCheckout")?.addEventListener("click", async () => {
      const url = String($("checkoutUrl")?.value || state.settings.checkoutUrl || "").trim();
      if (!url) {
        setStatus("STATUS: CHECKOUT URL INVALID", "error");
        return;
      }
      const opened = await HC.openExternal(url);
      if (!opened.ok) {
        setStatus("STATUS: CHECKOUT OPEN FAILED", "error");
        return;
      }
      setStatus("STATUS: CHECKOUT OPENED", "success");
    });

    $("applyFilterDefaults")?.addEventListener("click", async () => {
      const filterEnabled = Boolean($("filterEnabled")?.checked);
      const presetId = String($("filterPreset")?.value || HC.DEFAULT_SETTINGS.filterPreset);
      const intensity = Math.max(0, Math.min(100, Math.round(Number($("filterIntensity")?.value || 0))));
      await patchSettings({
        filterEnabled,
        filterPreset: presetId,
        filterIntensity: intensity / 100
      });
    });

    $("reapplyFilterNow")?.addEventListener("click", async () => {
      await send({ type: "holmeta-reapply-filter" });
      setStatus("STATUS: FILTER REAPPLIED", "success");
    });

    $("saveWellness")?.addEventListener("click", async () => {
      const patch = {
        wellness: {
          ...getWellnessSettings(),
          breaksEnabled: Boolean($("breaksEnabled")?.checked),
          breaksIntervalMin: Number($("breakIntervalMin")?.value || 50),
          eyeEnabled: Boolean($("eyeEnabled")?.checked),
          eyeIntervalMin: Number($("eyeIntervalMin")?.value || 20)
        }
      };
      await patchSettings(patch);
    });

    $("snoozeWellness15")?.addEventListener("click", async () => {
      await send({ type: "holmeta-snooze-wellness", minutes: 15 });
      setStatus("STATUS: WELLNESS SNOOZED 15M", "success");
    });

    $("exportState")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-core-export-state" });
      if (!response?.ok || !response?.core) {
        setStatus("STATUS: EXPORT FAILED", "error");
        return;
      }
      $("stateBlob").value = JSON.stringify(response.core, null, 2);
      setStatus("STATUS: EXPORT READY", "success");
    });

    $("importState")?.addEventListener("click", async () => {
      const raw = String($("stateBlob")?.value || "").trim();
      if (!raw) {
        setStatus("STATUS: PASTE STATE JSON", "error");
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        setStatus("STATUS: INVALID JSON", "error");
        return;
      }
      const response = await send({ type: "holmeta-core-import-state", payload: parsed });
      if (!response?.ok) {
        setStatus(`STATUS: IMPORT FAILED (${response?.error || "UNKNOWN"})`, "error");
        return;
      }
      setStatus("STATUS: IMPORT COMPLETE", "success");
      await refreshState();
    });

    $("resetState")?.addEventListener("click", async () => {
      const confirmed = window.confirm("Reset saved items, sessions, reminders, and resume queue?");
      if (!confirmed) {
        return;
      }
      const response = await send({ type: "holmeta-core-reset-state" });
      if (!response?.ok) {
        setStatus("STATUS: RESET FAILED", "error");
        return;
      }
      setStatus("STATUS: RESET COMPLETE", "success");
      await refreshState();
    });
  }

  async function bootstrap() {
    state.drafts = await readDrafts();
    hydrated = true;
    bindEvents();
    // Set once on startup; avoid render-loop writes into the license field.
    setControlValueIfIdle("licenseKeyInput", state.drafts.licenseKey || state.settings.licenseKey || "");
    await refreshState();
  }

  bootstrap();
})();
