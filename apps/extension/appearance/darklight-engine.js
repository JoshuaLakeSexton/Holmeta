(() => {
  if (globalThis.HolmetaDarklightEngine) return;

  const settingsStore = globalThis.HolmetaDarklightSettings;

  function normalizeHost(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function sendRuntime(message) {
    return new Promise((resolve) => {
      const api = globalThis.chrome?.runtime;
      if (!api?.sendMessage) {
        resolve({ ok: false, error: "runtime_unavailable" });
        return;
      }
      api.sendMessage(message, (response) => {
        const err = globalThis.chrome?.runtime?.lastError;
        if (err) {
          resolve({ ok: false, error: String(err.message || "runtime_error") });
          return;
        }
        resolve(response || { ok: false, error: "empty_response" });
      });
    });
  }

  function deepMerge(base = {}, patch = {}) {
    const out = { ...(base || {}) };
    for (const [key, value] of Object.entries(patch || {})) {
      if (Array.isArray(value)) {
        out[key] = [...value];
      } else if (value && typeof value === "object") {
        out[key] = deepMerge(out[key] || {}, value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function getReadingSettings(rawSettings = {}) {
    return rawSettings.darkLightTheme || rawSettings.readingTheme || {};
  }

  function hostStateFromSettings(settings = {}, host = "") {
    const safeHost = normalizeHost(host) || normalizeHost(globalThis.location?.hostname || "");
    const reading = getReadingSettings(settings);
    const perSite = reading.perSiteOverrides && typeof reading.perSiteOverrides === "object"
      ? reading.perSiteOverrides
      : {};
    const excluded = reading.excludedSites && typeof reading.excludedSites === "object"
      ? reading.excludedSites
      : {};
    const siteOverride = safeHost ? perSite[safeHost] : null;

    return {
      host: safeHost,
      excluded: Boolean(safeHost && excluded[safeHost]),
      usingOverride: Boolean(siteOverride),
      reading,
      siteOverride: siteOverride || null,
      effective: siteOverride ? deepMerge(reading, siteOverride) : { ...reading }
    };
  }

  async function getRuntimeState() {
    const response = await sendRuntime({ type: "holmeta:get-state" });
    if (!response?.ok || !response.state) {
      return { ok: false, error: response?.error || "state_unavailable" };
    }
    const host = normalizeHost(globalThis.location?.hostname || "");
    const hostState = hostStateFromSettings(response.state.settings || {}, host);
    const mode = String(hostState.effective.appearance || hostState.effective.mode || "auto");
    const widget = await settingsStore?.getWidgetState?.(host) || {
      host,
      visible: false,
      position: { x: 18, y: 18 }
    };
    return {
      ok: true,
      host,
      mode,
      enabled: Boolean(hostState.effective.enabled),
      darkVariant: String(hostState.effective.darkVariant || hostState.effective.darkThemeVariant || "coal"),
      lightVariant: String(hostState.effective.lightVariant || hostState.effective.lightThemeVariant || "white"),
      excluded: hostState.excluded,
      usingOverride: hostState.usingOverride,
      widget,
      settings: response.state.settings || {},
      runtime: response.state.runtime || {},
      diagnostics: globalThis.HolmetaLightEngine?.getDiagnostics?.() || null
    };
  }

  async function patchReadingSettings(mutator) {
    const state = await getRuntimeState();
    if (!state.ok) return state;

    const host = state.host;
    const reading = getReadingSettings(state.settings);
    const patchSeed = {
      darkLightTheme: deepMerge({}, reading)
    };

    const result = await Promise.resolve(mutator(patchSeed.darkLightTheme, host, state));
    if (result === false) return { ok: false, error: "mutation_rejected" };

    const patch = {
      darkLightTheme: patchSeed.darkLightTheme
    };

    const response = await sendRuntime({ type: "holmeta:update-settings", patch });
    if (!response?.ok) {
      return { ok: false, error: response?.error || "update_failed" };
    }

    return getRuntimeState();
  }

  async function applyAction(action, payload = {}) {
    const key = String(action || "").trim();
    if (!key) return { ok: false, error: "missing_action" };

    if (key === "getState") {
      return getRuntimeState();
    }

    if (key === "showWidget" || key === "hideWidget") {
      const host = normalizeHost(globalThis.location?.hostname || "");
      await settingsStore?.setWidgetState?.(host, { visible: key === "showWidget" });
      globalThis.HolmetaDarklightSwitch?.setVisible?.(key === "showWidget");
      return getRuntimeState();
    }

    if (key === "resetSite") {
      return patchReadingSettings((reading, host) => {
        const perSite = { ...(reading.perSiteOverrides || {}) };
        const excluded = { ...(reading.excludedSites || {}) };
        delete perSite[host];
        delete excluded[host];
        reading.perSiteOverrides = perSite;
        reading.excludedSites = excluded;
      });
    }

    if (key === "setDark" || key === "setLight" || key === "setAuto") {
      const appearance = key === "setDark" ? "dark" : key === "setLight" ? "light" : "auto";
      return patchReadingSettings((reading) => {
        reading.enabled = true;
        reading.appearance = appearance;
      });
    }

    if (key === "toggle") {
      return patchReadingSettings((reading) => {
        const nextEnabled = !Boolean(reading.enabled);
        reading.enabled = nextEnabled;
        if (nextEnabled && !["dark", "light", "auto"].includes(String(reading.appearance || ""))) {
          reading.appearance = "auto";
        }
      });
    }

    if (key === "excludeSite") {
      const enabled = payload.enabled !== false;
      return patchReadingSettings((reading, host) => {
        const excluded = { ...(reading.excludedSites || {}) };
        if (enabled) excluded[host] = true;
        else delete excluded[host];
        reading.excludedSites = excluded;
      });
    }

    return { ok: false, error: "unknown_action" };
  }

  async function handleAction(message = {}) {
    const action = String(message.action || "");
    const result = await applyAction(action, message.payload || {});
    if (globalThis.HolmetaDarklightSwitch?.refreshState) {
      globalThis.HolmetaDarklightSwitch.refreshState();
    }
    return result;
  }

  async function init() {
    if (globalThis.HolmetaDarklightSwitch?.init) {
      await globalThis.HolmetaDarklightSwitch.init();
    }
  }

  globalThis.HolmetaDarklightEngine = {
    init,
    getState: getRuntimeState,
    handleAction,
    applyAction
  };
})();
