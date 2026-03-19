(() => {
  if (globalThis.HolmetaAppearanceEngine) return;
  if (!/^https?:$/i.test(String(globalThis.location?.protocol || ""))) return;

  const storage = globalThis.HolmetaStorage;
  const overlays = globalThis.HolmetaComfortOverlays;
  const mediaProtection = globalThis.HolmetaMediaProtection;

  if (!storage || !overlays || !mediaProtection) {
    console.error("[Holmeta comfort] missing bootstrap dependency");
    return;
  }

  const STYLE_ID = "holmeta-comfort-style";
  const ATTR_ACTIVE = "data-hm-comfort";
  const ATTR_FOCUS = "data-hm-comfort-focus";
  const ATTR_READER = "data-hm-comfort-reader";
  const BASE_CSS = `
html[data-hm-comfort='1'] {
  color-scheme: light dark;
}

#holmeta-comfort-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147482900;
  isolation: isolate;
}

#holmeta-comfort-root .hm-comfort-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

#holmeta-comfort-dimmer { background: #090909; mix-blend-mode: multiply; }
#holmeta-comfort-warm {
  background:
    radial-gradient(140% 90% at 50% -10%, rgba(255, 201, 120, 0.35) 0%, rgba(255, 162, 96, 0.06) 62%, transparent 100%),
    linear-gradient(180deg, rgba(255, 178, 94, 0.2) 0%, rgba(255, 140, 90, 0.16) 100%);
  mix-blend-mode: soft-light;
}
#holmeta-comfort-white { background: #f1e4cc; mix-blend-mode: multiply; }
#holmeta-comfort-soft { background: #c7c0b6; mix-blend-mode: soft-light; }
#holmeta-comfort-focus {
  background: radial-gradient(circle at 50% 42%, rgba(0, 0, 0, 0) 0 36%, rgba(0, 0, 0, 0.3) 100%);
  mix-blend-mode: multiply;
}
html[data-hm-comfort='1'][data-hm-comfort-focus='medium'] #holmeta-comfort-focus {
  background: radial-gradient(circle at 50% 42%, rgba(0, 0, 0, 0) 0 33%, rgba(0, 0, 0, 0.38) 100%);
}
html[data-hm-comfort='1'] [data-hm-comfort-media='1'] {
  transition: filter 140ms ease;
}
`;

  const state = {
    active: false,
    applying: false,
    pending: false,
    runtimeStarted: false,
    observer: null,
    refreshTimer: null,
    historyPatched: false,
    debug: false,
    host: "",
    lastProfile: null,
    lastOptions: null,
    diagnostics: {
      active: false,
      host: "",
      reason: "idle",
      brightnessDimmer: 0,
      warmLightFilter: 0,
      whiteIntensity: 0,
      contrastSoftening: "off",
      focusFade: "off",
      preserveImages: true,
      preserveVideos: true,
      readerSurfaceMode: false,
      readerApplied: false,
      protectedMediaCount: 0
    }
  };

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function normalizeTier(value, fallback = "off") {
    const raw = String(value || fallback).trim().toLowerCase();
    if (raw === "low" || raw === "medium" || raw === "off") return raw;
    return fallback;
  }

  function hostFromLocation() {
    return storage.hostFromUrl(location.href);
  }

  function hasComfortShape(raw = {}) {
    return [
      "brightnessDimmer",
      "warmLightFilter",
      "reduceWhiteIntensity",
      "whiteIntensity",
      "contrastSoftening",
      "focusFade",
      "preserveVideos",
      "readerSurfaceMode"
    ].some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  }

  function legacyPreset(raw = {}) {
    const appearance = String(raw.appearance || raw.mode || "adaptive").toLowerCase();
    if (appearance === "dark") {
      return {
        brightnessDimmer: 30,
        warmLightFilter: 28,
        reduceWhiteIntensity: true,
        whiteIntensity: 44,
        contrastSoftening: raw.higherContrast ? "off" : "low",
        focusFade: "off"
      };
    }
    if (appearance === "light") {
      return {
        brightnessDimmer: 12,
        warmLightFilter: 12,
        reduceWhiteIntensity: true,
        whiteIntensity: 24,
        contrastSoftening: "low",
        focusFade: "off"
      };
    }
    return {
      brightnessDimmer: 20,
      warmLightFilter: 18,
      reduceWhiteIntensity: true,
      whiteIntensity: 32,
      contrastSoftening: raw.softerSurfaces ? "medium" : "low",
      focusFade: "off"
    };
  }

  function normalizeProfile(rawProfile = {}) {
    const raw = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
    const preset = hasComfortShape(raw)
      ? {}
      : legacyPreset(raw);

    return {
      enabled: Boolean(raw.enabled),
      brightnessDimmer: Math.round(clamp(raw.brightnessDimmer ?? raw.dim ?? preset.brightnessDimmer ?? 20, 0, 60)),
      warmLightFilter: Math.round(clamp(raw.warmLightFilter ?? raw.warmth ?? raw.intensity ?? preset.warmLightFilter ?? 18, 0, 70)),
      reduceWhiteIntensity: Boolean(raw.reduceWhiteIntensity ?? raw.reduceWhites ?? preset.reduceWhiteIntensity ?? true),
      whiteIntensity: Math.round(clamp(raw.whiteIntensity ?? raw.whiteSoftening ?? raw.blueCut ?? preset.whiteIntensity ?? 30, 0, 70)),
      contrastSoftening: normalizeTier(raw.contrastSoftening ?? (raw.higherContrast ? "off" : (raw.softerSurfaces ? "medium" : undefined)) ?? preset.contrastSoftening ?? "low", "low"),
      focusFade: normalizeTier(raw.focusFade ?? (raw.spotlightEnabled ? "medium" : undefined) ?? preset.focusFade ?? "off", "off"),
      preserveImages: Boolean(raw.preserveImages ?? true),
      preserveVideos: Boolean(raw.preserveVideos ?? raw.videoSafe ?? true),
      readerSurfaceMode: Boolean(raw.readerSurfaceMode ?? false),
      excludedSites: raw.excludedSites && typeof raw.excludedSites === "object" ? { ...raw.excludedSites } : {},
      perSiteOverrides: raw.perSiteOverrides && typeof raw.perSiteOverrides === "object" ? { ...raw.perSiteOverrides } : {}
    };
  }

  function buildEffectiveProfile(rawProfile, host) {
    const base = normalizeProfile(rawProfile);
    const siteMap = rawProfile?.perSiteOverrides && typeof rawProfile.perSiteOverrides === "object"
      ? rawProfile.perSiteOverrides
      : (rawProfile?.siteProfiles && typeof rawProfile.siteProfiles === "object" ? rawProfile.siteProfiles : {});
    const overrideRaw = host && siteMap[host] && typeof siteMap[host] === "object"
      ? siteMap[host]
      : null;
    if (!overrideRaw) return base;

    const merged = normalizeProfile({
      ...rawProfile,
      ...overrideRaw,
      enabled: overrideRaw.enabled ?? base.enabled
    });

    return {
      ...base,
      ...merged,
      excludedSites: base.excludedSites,
      perSiteOverrides: base.perSiteOverrides
    };
  }

  function siteExcluded(profile, host) {
    if (!host) return false;
    const map = profile?.excludedSites && typeof profile.excludedSites === "object"
      ? profile.excludedSites
      : {};
    return Boolean(map[host]);
  }

  function ensureStyleTag() {
    let style = document.getElementById(STYLE_ID);
    if (style) return style;
    style = document.createElement("style");
    style.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  function removeStyleTag() {
    document.getElementById(STYLE_ID)?.remove?.();
  }

  function getVisibleTextSample(maxChars = 2800) {
    const root = document.querySelector("main, article, [role='main']") || document.body;
    if (!root) return "";
    const text = String(root.innerText || root.textContent || "").replace(/\s+/g, " ").trim();
    return text.slice(0, maxChars);
  }

  function detectReaderLikePage() {
    const article = document.querySelector("article");
    const paragraphs = document.querySelectorAll("article p, main p, [role='main'] p").length;
    const headingCount = document.querySelectorAll("h1, h2, h3").length;
    const forms = document.querySelectorAll("input, select, textarea").length;
    const sample = getVisibleTextSample();
    const longText = sample.length > 1200;
    const hasEditorHints = Boolean(document.querySelector("[contenteditable='true'], .monaco-editor, .CodeMirror, [class*='editor' i]"));

    if (hasEditorHints || forms > 30) return false;
    if (article && paragraphs >= 6) return true;
    if (paragraphs >= 12 && headingCount >= 2 && longText) return true;
    return false;
  }

  function buildRuntimeCss(profile, readerApplied) {
    const compensation = mediaProtection.compensationCss(profile);

    const readerCss = readerApplied
      ? `
html[data-hm-comfort='1'][data-hm-comfort-reader='1'] :where(article, main article, [role='main'] article, .post, .entry-content, .prose) {
  background: rgba(247, 239, 224, 0.42) !important;
  border-color: rgba(157, 130, 95, 0.24) !important;
}

html[data-hm-comfort='1'][data-hm-comfort-reader='1'] :where(article p, article li, main p, [role='main'] p, .prose p, .prose li) {
  line-height: 1.72 !important;
}
`
      : "";

    return `${compensation}\n${readerCss}`;
  }

  function applyRootAttributes(profile, readerApplied) {
    const root = document.documentElement;
    root.setAttribute(ATTR_ACTIVE, "1");
    root.setAttribute(ATTR_FOCUS, profile.focusFade);
    if (readerApplied) root.setAttribute(ATTR_READER, "1");
    else root.removeAttribute(ATTR_READER);
  }

  function clearRootAttributes() {
    const root = document.documentElement;
    root.removeAttribute(ATTR_ACTIVE);
    root.removeAttribute(ATTR_FOCUS);
    root.removeAttribute(ATTR_READER);
  }

  function scheduleRefresh(reason = "mutation") {
    if (!state.active || !state.lastProfile) return;
    if (state.refreshTimer) clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      apply(state.lastProfile, { ...(state.lastOptions || {}), reason });
    }, 180);
  }

  function patchHistory() {
    if (state.historyPatched || !globalThis.history) return;
    state.historyPatched = true;

    const trigger = () => scheduleRefresh("route-change");
    for (const key of ["pushState", "replaceState"]) {
      const original = history[key];
      if (typeof original !== "function") continue;
      history[key] = function patchedHistory(...args) {
        const out = original.apply(this, args);
        trigger();
        return out;
      };
    }

    globalThis.addEventListener("popstate", trigger);
    globalThis.addEventListener("hashchange", trigger);
  }

  function startRuntime() {
    if (state.runtimeStarted) return;
    state.runtimeStarted = true;

    patchHistory();

    state.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          if (mutation.addedNodes?.length || mutation.removedNodes?.length) {
            scheduleRefresh("mutation");
            return;
          }
          continue;
        }

        if (mutation.type === "attributes") {
          scheduleRefresh("mutation");
          return;
        }
      }
    });

    state.observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-color-mode", "hidden", "aria-hidden"]
    });
  }

  function stopRuntime() {
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
    state.observer?.disconnect?.();
    state.observer = null;
    state.runtimeStarted = false;
  }

  function apply(profile = {}, options = {}) {
    const host = hostFromLocation();
    const effective = buildEffectiveProfile(profile, host);

    state.lastProfile = profile;
    state.lastOptions = options;

    if (!effective.enabled) {
      clear("disabled");
      return { ...state.diagnostics };
    }

    if (siteExcluded(profile, host)) {
      clear("site-excluded");
      return { ...state.diagnostics };
    }

    if (state.applying) {
      state.pending = true;
      return { ...state.diagnostics };
    }

    state.applying = true;

    try {
      const readerApplied = Boolean(effective.readerSurfaceMode && detectReaderLikePage());

      applyRootAttributes(effective, readerApplied);

      const layer = overlays.update(effective);
      const mediaStats = mediaProtection.applyMarks(document, effective);
      const cssText = buildRuntimeCss(effective, readerApplied);
      ensureStyleTag().textContent = `${BASE_CSS}\n${cssText}`;

      startRuntime();

      state.host = host;
      state.active = true;
      state.diagnostics = {
        active: true,
        host,
        reason: String(options.reason || "applied"),
        brightnessDimmer: effective.brightnessDimmer,
        warmLightFilter: effective.warmLightFilter,
        whiteIntensity: effective.reduceWhiteIntensity ? effective.whiteIntensity : 0,
        contrastSoftening: effective.contrastSoftening,
        focusFade: effective.focusFade,
        preserveImages: effective.preserveImages,
        preserveVideos: effective.preserveVideos,
        readerSurfaceMode: effective.readerSurfaceMode,
        readerApplied,
        protectedMediaCount: Number(mediaStats?.total || 0),
        layer
      };

      if (state.debug || options.debug) {
        console.info("[Holmeta comfort] applied", {
          host,
          effective,
          diagnostics: state.diagnostics
        });
      }

      return { ...state.diagnostics };
    } catch (error) {
      clear("apply-failed");
      state.diagnostics.error = String(error?.message || error);
      return { ...state.diagnostics };
    } finally {
      state.applying = false;
      if (state.pending) {
        state.pending = false;
        setTimeout(() => {
          if (state.lastProfile) apply(state.lastProfile, { ...(state.lastOptions || {}), reason: "queued-refresh" });
        }, 0);
      }
    }
  }

  function clear(reason = "cleared") {
    stopRuntime();
    overlays.clear();
    mediaProtection.clear(document);
    removeStyleTag();
    clearRootAttributes();

    state.active = false;
    state.diagnostics = {
      active: false,
      host: hostFromLocation(),
      reason,
      brightnessDimmer: 0,
      warmLightFilter: 0,
      whiteIntensity: 0,
      contrastSoftening: "off",
      focusFade: "off",
      preserveImages: true,
      preserveVideos: true,
      readerSurfaceMode: false,
      readerApplied: false,
      protectedMediaCount: 0
    };

    return { ...state.diagnostics };
  }

  function triggerRefresh() {
    if (!state.lastProfile) return;
    apply(state.lastProfile, { ...(state.lastOptions || {}), reason: "manual-refresh" });
  }

  function setDebug(value) {
    state.debug = Boolean(value);
  }

  function getDiagnostics() {
    return { ...state.diagnostics };
  }

  async function bootstrapFromStorage() {
    try {
      const settings = await storage.readSettings();
      if (!settings || typeof settings !== "object") return;
      const merged = storage.mergeReadingProfile(settings, location.href);
      if (!merged || merged.excluded || !merged.profile?.enabled) return;
      apply(merged.profile, { reason: "bootstrap" });
    } catch {
      // Keep boot silent.
    }
  }

  bootstrapFromStorage();

  globalThis.HolmetaAppearanceEngine = {
    apply,
    clear,
    triggerRefresh,
    setDebug,
    getDiagnostics
  };
})();
