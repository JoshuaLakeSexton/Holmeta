(() => {
  if (globalThis.__HOLMETA_APPEARANCE_BOOT__) return;
  globalThis.__HOLMETA_APPEARANCE_BOOT__ = true;

  if (!/^https?:$/i.test(String(globalThis.location?.protocol || ""))) return;

  const STORAGE_KEY = "holmeta.v3.state";
  const ATTR_BOOT = "data-holmeta-appearance-boot";
  const ATTR_BOOT_MODE = "data-holmeta-appearance-boot-mode";

  function normalizeHost(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function parseTimeToMinutes(value, fallback = "00:00") {
    const text = String(value || fallback);
    const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return parseTimeToMinutes(fallback, "00:00");
    return (Number(match[1]) * 60) + Number(match[2]);
  }

  function inRange(start, end, date = new Date()) {
    const s = parseTimeToMinutes(start, "20:00");
    const e = parseTimeToMinutes(end, "06:00");
    const current = (date.getHours() * 60) + date.getMinutes();
    if (s === e) return true;
    if (s < e) return current >= s && current < e;
    return current >= s || current < e;
  }

  function normalizeAppearance(value) {
    const raw = String(value || "adaptive").toLowerCase();
    if (raw === "auto") return "adaptive";
    if (["dark", "light", "adaptive"].includes(raw)) return raw;
    return "adaptive";
  }

  function clearBoot() {
    const root = document.documentElement;
    if (!root) return;
    root.removeAttribute(ATTR_BOOT);
    root.removeAttribute(ATTR_BOOT_MODE);
  }

  function setBoot(mode) {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute(ATTR_BOOT, "1");
    root.setAttribute(ATTR_BOOT_MODE, mode === "light" ? "light" : "dark");
  }

  function resolveMode(profile = {}) {
    const appearance = normalizeAppearance(profile.appearance || profile.mode || "adaptive");
    if (appearance === "dark" || appearance === "light") return appearance;

    const explicitMode = String(profile.mode || "").toLowerCase();
    if (explicitMode === "dark" || explicitMode === "light") return explicitMode;

    const scheduleMode = String(profile.scheduleMode || "system").toLowerCase();
    const schedule = profile.schedule && typeof profile.schedule === "object" ? profile.schedule : {};

    if (scheduleMode === "custom" || scheduleMode === "sunset") {
      const start = String(schedule.start || "20:00");
      const end = String(schedule.end || "06:00");
      return inRange(start, end, new Date()) ? "dark" : "light";
    }

    return globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function getReadingProfile(rawState) {
    const settings = rawState?.settings && typeof rawState.settings === "object" ? rawState.settings : {};
    const reading = settings.darkLightTheme || settings.readingTheme || {};
    const host = normalizeHost(globalThis.location?.hostname || "");

    const excludedMap = reading.excludedSites && typeof reading.excludedSites === "object"
      ? reading.excludedSites
      : {};
    const excludedHosts = Array.isArray(reading.excludedHosts)
      ? reading.excludedHosts.map((entry) => normalizeHost(entry))
      : [];

    const excluded = Boolean(
      (host && excludedMap[host])
      || (host && excludedHosts.includes(host))
    );

    if (excluded) return null;

    const perSite = reading.perSiteOverrides && typeof reading.perSiteOverrides === "object"
      ? reading.perSiteOverrides
      : (reading.siteProfiles && typeof reading.siteProfiles === "object" ? reading.siteProfiles : {});

    const siteOverride = host && perSite[host] && typeof perSite[host] === "object"
      ? perSite[host]
      : null;

    const effective = siteOverride ? { ...reading, ...siteOverride } : { ...reading };
    if (!effective.enabled) return null;

    return effective;
  }

  function applyBootState(rawState) {
    const profile = getReadingProfile(rawState);
    if (!profile) {
      clearBoot();
      return;
    }
    setBoot(resolveMode(profile));
  }

  function readFromLocalStorage() {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readFromChromeStorage() {
    return new Promise((resolve) => {
      const api = globalThis.chrome?.storage?.local;
      if (!api?.get) {
        resolve(null);
        return;
      }
      api.get([STORAGE_KEY], (result) => {
        const err = globalThis.chrome?.runtime?.lastError;
        if (err) {
          resolve(null);
          return;
        }
        resolve(result?.[STORAGE_KEY] || null);
      });
    });
  }

  (async () => {
    const fromChrome = await readFromChromeStorage();
    if (fromChrome) {
      applyBootState(fromChrome);
      return;
    }
    const fromLocal = readFromLocalStorage();
    if (fromLocal) applyBootState(fromLocal);
  })();
})();
