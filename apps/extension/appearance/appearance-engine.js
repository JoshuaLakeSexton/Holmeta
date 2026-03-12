(() => {
  if (globalThis.HolmetaAppearanceEngine) return;

  const stateRef = globalThis.HolmetaAppearanceState;
  const detector = globalThis.HolmetaAppearanceThemeDetector;
  const remapper = globalThis.HolmetaAppearanceTokenRemapper;
  const normalizer = globalThis.HolmetaAppearanceNormalizer;
  const dynamicProcessorLib = globalThis.HolmetaAppearanceDynamicProcessor;
  const compat = globalThis.HolmetaAppearanceCompatibility;
  const mediaGuard = globalThis.HolmetaAppearanceMediaGuard;
  const siteRules = globalThis.HolmetaAppearanceSiteRules;
  const siteClassifier = globalThis.HolmetaAppearanceSiteClassifier;

  if (!stateRef || !detector || !remapper || !normalizer || !dynamicProcessorLib || !compat || !mediaGuard || !siteRules || !siteClassifier) {
    console.error("[Holmeta appearance] dependency_missing");
    return;
  }

  const IDS = stateRef.IDS;

  const state = {
    enabled: false,
    mode: "off",
    compatibilityMode: "normal",
    diagnostics: {
      active: false,
      mode: "off",
      host: "",
      pageTone: "mixed",
      luminance: 0.5,
      siteType: "general",
      siteClass: "general",
      compatibilityMode: "normal",
      components: 0,
      wrappers: 0,
      media: 0,
      reason: "idle"
    },
    dynamic: null,
    debug: false
  };

  function getHost() {
    return String(location.hostname || "")
      .toLowerCase()
      .replace(/^www\./, "")
      .trim();
  }

  function siteKeyFromHost(host) {
    const safeHost = String(host || "").toLowerCase();
    if (!safeHost) return "";
    if (safeHost === "x.com" || safeHost.endsWith(".x.com") || safeHost === "twitter.com" || safeHost.endsWith(".twitter.com")) return "x";
    if (safeHost === "youtube.com" || safeHost.endsWith(".youtube.com")) return "youtube";
    if (safeHost === "github.com" || safeHost.endsWith(".github.com")) return "github";
    if (safeHost === "notion.so" || safeHost.endsWith(".notion.so")) return "notion";
    if (safeHost === "figma.com" || safeHost.endsWith(".figma.com")) return "figma";
    return "generic";
  }

  function ensureStyle() {
    const nodes = document.querySelectorAll(`#${IDS.STYLE}`);
    if (nodes.length > 1) {
      nodes.forEach((node, index) => {
        if (index > 0) node.remove();
      });
    }

    let node = document.getElementById(IDS.STYLE);
    if (!node) {
      node = document.createElement("style");
      node.id = IDS.STYLE;
      document.documentElement.appendChild(node);
    }

    const css = remapper.cssText();
    if (node.textContent !== css) {
      node.textContent = css;
    }
  }

  function applyDynamic(root = document.documentElement) {
    const host = getHost();
    const result = normalizer.normalizeRoot(root, {
      maxComponents: state.compatibilityMode === "media-safe" ? 900 : 2800,
      host
    });
    state.diagnostics.components = result.components;
    state.diagnostics.wrappers = result.wrappers;
    state.diagnostics.media = result.media;
  }

  function ensureDynamic() {
    if (state.dynamic) return;
    state.dynamic = dynamicProcessorLib.createProcessor((roots) => {
      for (const root of roots) {
        applyDynamic(root instanceof Element ? root : document.documentElement);
      }
    }, {
      debounceMs: 170
    });
  }

  function resolveMode(profile) {
    const appearance = String(profile.appearance || profile.mode || "off").toLowerCase();
    if (appearance === "light") return "light";
    if (appearance === "dark") return "dark";
    if (appearance === "auto") {
      const schedule = profile.schedule && typeof profile.schedule === "object"
        ? profile.schedule
        : null;
      const scheduleMode = String(profile.scheduleMode || "system").toLowerCase();
      if (scheduleMode === "system") {
        return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
      }
      if (schedule && schedule.enabled) {
        const now = new Date();
        const toMins = (value) => {
          const [h, m] = String(value || "00:00").split(":").map((v) => Number(v || 0));
          return (h * 60) + m;
        };
        const start = toMins(schedule.start || "20:00");
        const end = toMins(schedule.end || "06:00");
        const current = (now.getHours() * 60) + now.getMinutes();
        const inRange = start < end
          ? (current >= start && current < end)
          : (current >= start || current < end);
        return inRange ? "dark" : "light";
      }
      return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
    }
    return "off";
  }

  function apply(profile = {}, options = {}) {
    const root = document.documentElement;
    const resolved = siteRules.resolveProfile(profile, getHost());
    if (resolved.excluded) {
      clear();
      state.diagnostics.reason = "site-excluded";
      return { ...state.diagnostics };
    }

    const effectiveProfile = resolved.profile || {};
    const enabled = Boolean(effectiveProfile.enabled);
    if (!enabled) {
      clear();
      return { ...state.diagnostics };
    }

    ensureStyle();

    const host = getHost();
    const media = mediaGuard.countMedia(document);
    const pageTone = detector.detectTone();
    const siteType = detector.detectSiteType(host, media);
    const classification = siteClassifier.classify({
      host,
      siteType,
      pageTone
    });
    const siteClass = classification.siteClass || "general";
    const compatibility = compat.resolveCompatibility({
      host,
      siteType,
      media,
      pageTone
    });

    const mode = resolveMode(effectiveProfile);
    if (mode === "off") {
      clear();
      return { ...state.diagnostics };
    }

    const requestedIntensity = Number(effectiveProfile.intensity ?? 46);
    let intensity = requestedIntensity;
    if (compatibility.mode === "minimal") intensity = Math.min(intensity, 42);
    if (compatibility.mode === "app-safe") intensity = Math.min(intensity, 54);
    if (compatibility.mode === "media-safe") intensity = Math.min(intensity, 36);
    if (mode === "dark" && pageTone.tone === "dark") intensity = Math.min(intensity, 38);
    if (mode === "light" && pageTone.tone === "light") intensity = Math.min(intensity, 40);

    const tokens = stateRef.toTokens({
      mode,
      darkVariant: stateRef.normalizeDarkVariant(effectiveProfile.darkVariant || effectiveProfile.darkThemeVariant || "coal"),
      lightVariant: stateRef.normalizeLightVariant(effectiveProfile.lightVariant || effectiveProfile.lightThemeVariant || "white"),
      intensity,
      siteClass,
      pageTone: pageTone.tone,
      compatibilityMode: compatibility.mode
    });

    const siteKey = siteKeyFromHost(host);
    remapper.applyRootTokens(root, tokens, compatibility.mode, siteKey, siteClass);

    state.mode = mode;
    state.enabled = true;
    state.compatibilityMode = compatibility.mode;
    state.diagnostics = {
      active: true,
      mode,
      host,
      pageTone: pageTone.tone,
      luminance: pageTone.luminance,
      siteType,
      siteClass,
      compatibilityMode: compatibility.mode,
      components: 0,
      wrappers: 0,
      media: 0,
      reason: resolved.usingSiteOverride ? "site-override" : (compatibility.reason || "applied")
    };

    applyDynamic(root);
    ensureDynamic();
    state.dynamic.start(root);

    if (state.debug || options.debug) {
      console.info("[Holmeta appearance]", {
        mode,
        host,
        pageTone,
        siteType,
        compatibility,
        diagnostics: state.diagnostics
      });
    }

    return { ...state.diagnostics };
  }

  function clear() {
    const root = document.documentElement;
    if (state.dynamic) {
      state.dynamic.stop();
    }

    normalizer.clearRoot(root);
    remapper.clearRootTokens(root);

    state.enabled = false;
    state.mode = "off";
    state.compatibilityMode = "normal";
    state.diagnostics = {
      active: false,
      mode: "off",
      host: getHost(),
      pageTone: "mixed",
      luminance: 0.5,
      siteType: "general",
      siteClass: "general",
      compatibilityMode: "normal",
      components: 0,
      wrappers: 0,
      media: 0,
      reason: "cleared"
    };

    return { ...state.diagnostics };
  }

  function triggerRefresh() {
    if (!state.dynamic) return;
    state.dynamic.trigger(document.documentElement);
  }

  function setDebug(value) {
    state.debug = Boolean(value);
  }

  function getDiagnostics() {
    return { ...state.diagnostics };
  }

  globalThis.HolmetaAppearanceEngine = {
    apply,
    clear,
    triggerRefresh,
    setDebug,
    getDiagnostics
  };
})();
