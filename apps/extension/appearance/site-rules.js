(() => {
  if (globalThis.HolmetaAppearanceSiteRules) return;

  function normalizeHost(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function hostFromLocation() {
    return normalizeHost(location.hostname || "");
  }

  function normalizeMap(value) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([host, row]) => [normalizeHost(host), row])
        .filter(([host, row]) => Boolean(host) && row && typeof row === "object")
    );
  }

  function normalizeExcluded(value) {
    if (Array.isArray(value)) {
      return Object.fromEntries(
        value
          .map((host) => normalizeHost(host))
          .filter(Boolean)
          .map((host) => [host, true])
      );
    }
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([host, enabled]) => [normalizeHost(host), Boolean(enabled)])
        .filter(([host, enabled]) => Boolean(host) && enabled)
    );
  }

  function mergeDefined(base = {}, patch = {}) {
    const out = { ...base };
    for (const [key, value] of Object.entries(patch || {})) {
      if (typeof value !== "undefined") out[key] = value;
    }
    return out;
  }

  function resolveProfile(settings = {}, host = "") {
    const safeHost = normalizeHost(host) || hostFromLocation();
    const perSiteOverrides = normalizeMap(settings.perSiteOverrides || settings.siteProfiles);
    const excludedSites = normalizeExcluded(settings.excludedSites || settings.excludedHosts);
    const excluded = Boolean(safeHost && excludedSites[safeHost]);
    const siteOverride = safeHost ? perSiteOverrides[safeHost] : null;
    const profile = siteOverride ? mergeDefined(settings, siteOverride) : { ...settings };

    return {
      host: safeHost,
      excluded,
      usingSiteOverride: Boolean(siteOverride),
      profile
    };
  }

  globalThis.HolmetaAppearanceSiteRules = {
    normalizeHost,
    resolveProfile
  };
})();
