(() => {
  if (globalThis.HolmetaStorage) return;

  const STORAGE_KEY = "holmeta.v3.state";

  function safeParse(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function readFromLocalStorage() {
    try {
      return safeParse(globalThis.localStorage?.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function readState() {
    return new Promise((resolve) => {
      const api = globalThis.chrome?.storage?.local;
      if (!api?.get) {
        resolve(readFromLocalStorage());
        return;
      }
      api.get([STORAGE_KEY], (result) => {
        const err = globalThis.chrome?.runtime?.lastError;
        if (err) {
          resolve(readFromLocalStorage());
          return;
        }
        const state = result?.[STORAGE_KEY];
        resolve(state && typeof state === "object" ? state : readFromLocalStorage());
      });
    });
  }

  function readSettings() {
    return readState().then((state) => (state?.settings && typeof state.settings === "object" ? state.settings : {}));
  }

  function hostFromUrl(input) {
    try {
      const url = new URL(String(input || location.href));
      if (!/^https?:$/i.test(url.protocol)) return "";
      return String(url.hostname || "").replace(/^www\./i, "").toLowerCase();
    } catch {
      return String(input || "")
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/\/.*$/, "")
        .trim()
        .toLowerCase();
    }
  }

  function mergeReadingProfile(settings = {}, host = "") {
    const reading = settings.darkLightTheme || settings.readingTheme || {};
    const safeHost = hostFromUrl(host || location.href);
    const perSite = reading.perSiteOverrides && typeof reading.perSiteOverrides === "object"
      ? reading.perSiteOverrides
      : (reading.siteProfiles && typeof reading.siteProfiles === "object" ? reading.siteProfiles : {});
    const siteOverride = safeHost && perSite[safeHost] && typeof perSite[safeHost] === "object"
      ? perSite[safeHost]
      : null;
    return {
      host: safeHost,
      profile: siteOverride ? { ...reading, ...siteOverride } : { ...reading },
      excluded: Boolean(
        (safeHost && reading.excludedSites?.[safeHost])
        || (Array.isArray(reading.excludedHosts) && reading.excludedHosts.map(hostFromUrl).includes(safeHost))
      )
    };
  }

  globalThis.HolmetaStorage = {
    STORAGE_KEY,
    readState,
    readSettings,
    hostFromUrl,
    mergeReadingProfile,
    mergeComfortProfile: mergeReadingProfile
  };
})();
