(() => {
  if (globalThis.HolmetaAppearanceCompatibility) return;

  function resolveCompatibility({ host = "", siteType = "general", pageTone = { tone: "mixed" } } = {}) {
    const safeHost = String(host || "").toLowerCase();

    if (/youtube\.com|vimeo\.com|twitch\.tv|spotify\.com/.test(safeHost) || siteType === "media") {
      return {
        mode: "media-safe",
        clamp: 0.58,
        skipLargeSurfaces: true,
        reason: "media-heavy"
      };
    }

    if (/docs\.google\.com|figma\.com|notion\.so|mail\.google\.com|slack\.com/.test(safeHost)
      || siteType === "dashboard_app") {
      return {
        mode: "app-safe",
        clamp: 0.72,
        skipLargeSurfaces: false,
        reason: "app-shell"
      };
    }

    if (/github\.com|gitlab\.com|stack(over|under)flow\.com|developer\./.test(safeHost)
      || siteType === "docs_code") {
      return {
        mode: "code-safe",
        clamp: 0.75,
        skipLargeSurfaces: false,
        reason: "code-heavy"
      };
    }

    if (pageTone.tone === "dark") {
      return {
        mode: "minimal",
        clamp: 0.65,
        skipLargeSurfaces: false,
        reason: "already-dark"
      };
    }

    return {
      mode: "normal",
      clamp: 0.86,
      skipLargeSurfaces: false,
      reason: "default"
    };
  }

  globalThis.HolmetaAppearanceCompatibility = {
    resolveCompatibility
  };
})();
