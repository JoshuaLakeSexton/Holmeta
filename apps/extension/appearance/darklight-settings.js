(() => {
  if (globalThis.HolmetaDarklightSettings) return;

  const KEY = "hm.darklight.settings.v1";

  function normalizeHost(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function readLocalStorage() {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeLocalStorage(value) {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(value || {}));
      return true;
    } catch {
      return false;
    }
  }

  function readChromeStorage(area = "local") {
    return new Promise((resolve) => {
      const api = globalThis.chrome?.storage?.[area];
      if (!api?.get) {
        resolve(null);
        return;
      }
      api.get([KEY], (result) => {
        const err = globalThis.chrome?.runtime?.lastError;
        if (err) {
          resolve(null);
          return;
        }
        const value = result?.[KEY];
        resolve(value && typeof value === "object" ? value : {});
      });
    });
  }

  function writeChromeStorage(value, area = "local") {
    return new Promise((resolve) => {
      const api = globalThis.chrome?.storage?.[area];
      if (!api?.set) {
        resolve(false);
        return;
      }
      api.set({ [KEY]: value || {} }, () => {
        const err = globalThis.chrome?.runtime?.lastError;
        resolve(!err);
      });
    });
  }

  async function getSettings() {
    const syncData = await readChromeStorage("sync");
    if (syncData) return syncData;
    const localData = await readChromeStorage("local");
    if (localData) return localData;
    return readLocalStorage();
  }

  async function setSettings(value) {
    const safe = value && typeof value === "object" ? value : {};
    const syncOk = await writeChromeStorage(safe, "sync");
    const localOk = await writeChromeStorage(safe, "local");
    if (!syncOk && !localOk) {
      writeLocalStorage(safe);
    }
  }

  async function patchSettings(patch = {}) {
    const current = await getSettings();
    const next = {
      ...current,
      ...(patch && typeof patch === "object" ? patch : {})
    };
    await setSettings(next);
    return next;
  }

  async function getWidgetState(host = "") {
    const safeHost = normalizeHost(host) || normalizeHost(globalThis.location?.hostname || "");
    const settings = await getSettings();
    const widget = settings.widget && typeof settings.widget === "object" ? settings.widget : {};
    const positionByHost = widget.positionByHost && typeof widget.positionByHost === "object" ? widget.positionByHost : {};
    const visibleByHost = widget.visibleByHost && typeof widget.visibleByHost === "object" ? widget.visibleByHost : {};
    return {
      host: safeHost,
      visible: visibleByHost[safeHost] === true,
      position: positionByHost[safeHost] && typeof positionByHost[safeHost] === "object"
        ? positionByHost[safeHost]
        : { x: 18, y: 18 }
    };
  }

  async function setWidgetState(host = "", patch = {}) {
    const safeHost = normalizeHost(host) || normalizeHost(globalThis.location?.hostname || "");
    const settings = await getSettings();
    const widget = settings.widget && typeof settings.widget === "object" ? settings.widget : {};
    const positionByHost = { ...(widget.positionByHost || {}) };
    const visibleByHost = { ...(widget.visibleByHost || {}) };

    if (patch && typeof patch === "object") {
      if (Object.prototype.hasOwnProperty.call(patch, "visible")) {
        visibleByHost[safeHost] = Boolean(patch.visible);
      }
      if (patch.position && typeof patch.position === "object") {
        const x = Number(patch.position.x);
        const y = Number(patch.position.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          positionByHost[safeHost] = { x, y };
        }
      }
    }

    const next = {
      ...settings,
      widget: {
        ...widget,
        visibleByHost,
        positionByHost
      }
    };

    await setSettings(next);
    return getWidgetState(safeHost);
  }

  globalThis.HolmetaDarklightSettings = {
    KEY,
    normalizeHost,
    getSettings,
    setSettings,
    patchSettings,
    getWidgetState,
    setWidgetState
  };
})();
