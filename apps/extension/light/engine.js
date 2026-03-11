// HOLMETA Light Filters v2.0 engine
// Browser-only rendering pipeline with multi-strategy compatibility.
// Exposes globalThis.HolmetaLightEngine for content script usage.

(() => {
  if (globalThis.HolmetaLightEngine) return;

  const IDS = {
    STYLE: "holmeta-light-style-v2",
    OVERLAY: "holmeta-light-overlay-v2",
    FOCUS: "holmeta-light-focus-v2"
  };

  const MODES = new Set([
    "warm",
    "amber",
    "candle",
    "paper",
    "cool_focus",
    "red_overlay",
    "red_mono",
    "red_lock",
    "gray_warm",
    "dim",
    "spotlight",
    "grayscale",
    "custom"
  ]);

  const ADAPTIVE_MODES = new Set([
    "smart_dark",
    "smart_light",
    "minimal_dark",
    "minimal_light",
    "code_focus_dark",
    "soft_contrast"
  ]);

  const ADAPTIVE_PRESETS = new Set([
    "balanced",
    "comfort",
    "clarity"
  ]);

  const ADAPTIVE_STRATEGIES = new Set([
    "auto",
    "css_variables",
    "semantic_recolor",
    "minimal_surface",
    "compatibility",
    "app_safe"
  ]);

  const ADAPTIVE_COMPAT = new Set([
    "normal",
    "minimal",
    "app-safe",
    "media-safe",
    "code-safe"
  ]);

  const SPECTRUM_PRESETS = {
    balanced: { r: 255, g: 172, b: 92 },
    amber_590: { r: 255, g: 168, b: 56 },
    red_630: { r: 255, g: 74, b: 58 },
    deep_red_660: { r: 224, g: 24, b: 24 },
    candle_1800k: { r: 255, g: 147, b: 41 },
    neutral_3500k: { r: 255, g: 214, b: 170 },
    daylight_5000k: { r: 232, g: 241, b: 255 },
    melatonin_guard: { r: 255, g: 109, b: 66 }
  };

  const state = {
    diagnostics: {
      active: false,
      strategy: "none",
      mode: "warm",
      host: "",
      excluded: false,
      mediaCount: 0,
      canvasCount: 0,
      iframeCount: 0,
      profileSource: "global",
      readingProfileSource: "global",
      adaptiveProfileSource: "global",
      pageTone: "unknown",
      pageLuminance: 0.5,
      safeFallback: false,
      adaptiveMode: "off",
      adaptivePreset: "off",
      adaptiveStrategy: "none",
      compatibilityMode: "normal",
      siteType: "unknown",
      activeSystems: {
        lightFilter: false,
        darkLightTheme: false,
        adaptiveSiteTheme: false
      },
      clampReason: ""
    },
    spotlightPoint: null,
    enabled: false,
    pageToneCache: {
      href: "",
      ts: 0,
      data: null
    }
  };

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function normalizeHost(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function now() {
    return Date.now();
  }

  function toMins(hhmm) {
    const [h, m] = String(hhmm || "00:00")
      .split(":")
      .map((v) => Number(v || 0));
    return (h * 60) + m;
  }

  function inRange(start, end, date = new Date()) {
    const s = toMins(start);
    const e = toMins(end);
    const cur = (date.getHours() * 60) + date.getMinutes();
    if (s === e) return true;
    if (s < e) return cur >= s && cur < e;
    return cur >= s || cur < e;
  }

  function minutesSinceStart(start, end, date = new Date()) {
    const s = toMins(start);
    const e = toMins(end);
    const cur = (date.getHours() * 60) + date.getMinutes();
    if (s < e) {
      if (cur < s || cur >= e) return -1;
      return cur - s;
    }
    // Overnight range, e.g. 22:00 -> 06:00
    if (cur >= s) return cur - s;
    if (cur < e) return (24 * 60 - s) + cur;
    return -1;
  }

  function createDefaultProfile() {
    return {
      enabled: false,
      mode: "warm",
      readingModeEnabled: true,
      readingMode: "dark",
      darkThemeVariant: "black",
      lightThemeVariant: "white",
      spectrumPreset: "balanced",
      intensity: 45,
      dim: 18,
      contrastSoft: 8,
      brightness: 96,
      saturation: 100,
      blueCut: 65,
      tintRed: 100,
      tintGreen: 62,
      tintBlue: 30,
      reduceWhites: true,
      videoSafe: false,
      spotlightEnabled: false,
      therapyMode: false,
      therapyMinutes: 3,
      therapyCadence: "gentle",
      schedule: {
        enabled: false,
        start: "20:00",
        end: "06:00",
        rampMinutes: 45
      }
    };
  }

  function normalizeProfile(input, fallback) {
    const base = {
      ...createDefaultProfile(),
      ...(fallback || {})
    };
    const raw = input && typeof input === "object" ? input : {};
    const schedule = {
      ...base.schedule,
      ...(raw.schedule && typeof raw.schedule === "object" ? raw.schedule : {})
    };

    const mode = MODES.has(raw.mode) ? raw.mode : base.mode;
    const spectrumPreset = Object.prototype.hasOwnProperty.call(SPECTRUM_PRESETS, raw.spectrumPreset)
      ? raw.spectrumPreset
      : base.spectrumPreset;

    return {
      ...base,
      ...raw,
      mode,
      spectrumPreset,
      enabled: Boolean(raw.enabled ?? base.enabled),
      readingModeEnabled: Boolean(raw.readingModeEnabled ?? raw.readingThemeEnabled ?? base.readingModeEnabled ?? true),
      readingMode: ["dark", "light"].includes(String(raw.readingMode || ""))
        ? String(raw.readingMode)
        : (Boolean(raw.darkReadingMode ?? false) ? "dark" : String(base.readingMode || "dark")),
      darkThemeVariant: ["black", "brown", "gray"].includes(String(raw.darkThemeVariant || ""))
        ? String(raw.darkThemeVariant)
        : String(base.darkThemeVariant || "black"),
      lightThemeVariant: ["white", "warm", "gray"].includes(String(raw.lightThemeVariant || ""))
        ? String(raw.lightThemeVariant)
        : String(base.lightThemeVariant || "white"),
      intensity: Math.round(clamp(raw.intensity ?? base.intensity, 0, 100)),
      dim: Math.round(clamp(raw.dim ?? base.dim, 0, 60)),
      contrastSoft: Math.round(clamp(raw.contrastSoft ?? base.contrastSoft, 0, 30)),
      brightness: Math.round(clamp(raw.brightness ?? base.brightness, 70, 120)),
      saturation: Math.round(clamp(raw.saturation ?? base.saturation, 50, 140)),
      blueCut: Math.round(clamp(raw.blueCut ?? base.blueCut, 0, 100)),
      tintRed: Math.round(clamp(raw.tintRed ?? base.tintRed, 0, 100)),
      tintGreen: Math.round(clamp(raw.tintGreen ?? base.tintGreen, 0, 100)),
      tintBlue: Math.round(clamp(raw.tintBlue ?? base.tintBlue, 0, 100)),
      reduceWhites: Boolean(raw.reduceWhites ?? base.reduceWhites),
      videoSafe: Boolean(raw.videoSafe ?? base.videoSafe),
      spotlightEnabled: Boolean(raw.spotlightEnabled ?? base.spotlightEnabled),
      therapyMode: Boolean(raw.therapyMode ?? base.therapyMode),
      therapyMinutes: Math.round(clamp(raw.therapyMinutes ?? base.therapyMinutes, 1, 10)),
      therapyCadence: ["slow", "medium", "gentle"].includes(raw.therapyCadence)
        ? raw.therapyCadence
        : base.therapyCadence,
      schedule: {
        enabled: Boolean(schedule.enabled),
        start: /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(schedule.start || "")) ? schedule.start : base.schedule.start,
        end: /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(schedule.end || "")) ? schedule.end : base.schedule.end,
        rampMinutes: Math.round(clamp(schedule.rampMinutes ?? base.schedule.rampMinutes, 0, 120))
      }
    };
  }

  function getHost() {
    return normalizeHost(location.hostname || "");
  }

  function countMedia() {
    return {
      mediaCount: document.querySelectorAll("video,audio").length,
      canvasCount: document.querySelectorAll("canvas").length,
      iframeCount: document.querySelectorAll("iframe").length
    };
  }

  function parseRgb(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "transparent") return null;
    const match = raw.match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1].split(",").map((v) => Number(String(v).trim()));
    if (parts.length < 3 || parts.slice(0, 3).some((v) => !Number.isFinite(v))) return null;
    const alpha = Number.isFinite(parts[3]) ? parts[3] : 1;
    if (alpha <= 0.02) return null;
    return {
      r: clamp(parts[0], 0, 255),
      g: clamp(parts[1], 0, 255),
      b: clamp(parts[2], 0, 255),
      a: clamp(alpha, 0, 1)
    };
  }

  function luminance(rgb) {
    const channel = (value) => {
      const s = clamp(value / 255, 0, 1);
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (0.2126 * channel(rgb.r)) + (0.7152 * channel(rgb.g)) + (0.0722 * channel(rgb.b));
  }

  function detectPageTone(force = false) {
    const href = String(location.href || "");
    if (!force && state.pageToneCache.href === href && (now() - state.pageToneCache.ts) < 15000 && state.pageToneCache.data) {
      return state.pageToneCache.data;
    }

    const targets = [
      document.documentElement,
      document.body,
      document.querySelector("main"),
      document.querySelector("#app"),
      document.querySelector("[role='main']"),
      document.querySelector("article"),
      ...Array.from(document.querySelectorAll("section,div")).slice(0, 8)
    ].filter(Boolean);

    const samples = [];
    for (const node of targets) {
      try {
        const style = getComputedStyle(node);
        const rgb = parseRgb(style.backgroundColor);
        if (rgb) samples.push(luminance(rgb));
      } catch {
        // Ignore style sampling failures and continue.
      }
    }

    let avg = 0.58;
    if (samples.length) {
      avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    }

    const tone = avg < 0.34 ? "dark" : avg > 0.62 ? "light" : "mixed";
    const output = {
      tone,
      luminance: Number(avg.toFixed(3))
    };

    state.pageToneCache = {
      href,
      ts: now(),
      data: output
    };
    return output;
  }

  function detectSiteType(host, media = { mediaCount: 0, canvasCount: 0 }) {
    const title = String(document.title || "").toLowerCase();
    const bodyText = String(document.body?.innerText || "").slice(0, 4000).toLowerCase();
    const full = `${host} ${location.pathname || ""} ${title} ${bodyText}`;
    const hasCode = document.querySelectorAll("pre,code,.highlight,.token").length > 5;
    const hasManyInputs = document.querySelectorAll("input,select,textarea,button,[role='button']").length > 20;
    const hasSidebar = Boolean(document.querySelector("aside,.sidebar,[data-testid*='sidebar']"));

    if (/github\.com|gitlab\.com|bitbucket\.org|stack(?:over|under)flow|developer|docs/.test(full) || hasCode) {
      return "docs_code";
    }
    if (/dashboard|admin|workspace|console|jira|notion|linear|figma/.test(full) || (hasManyInputs && hasSidebar)) {
      return "dashboard_app";
    }
    if (/youtube|vimeo|twitch|netflix|primevideo/.test(full) || media.mediaCount >= 2) {
      return "media";
    }
    if (/news|article|blog|press|times|post/.test(full) || document.querySelectorAll("article,time").length > 0) {
      return "article";
    }
    if (/shop|cart|checkout|product|buy now|add to cart|ecommerce|store/.test(full)) {
      return "ecommerce";
    }
    return "general";
  }

  function chooseStrategy(profile, media) {
    const host = getHost();
    const maybeColorCritical = /(figma|photopea|canva|pixlr)/i.test(host);

    if (profile.mode === "spotlight") return "overlay";
    if (profile.videoSafe) return "overlay";
    if (profile.mode === "red_lock") return media.mediaCount > 0 ? "overlay" : "hybrid";
    if (profile.mode === "red_mono") return media.canvasCount > 0 ? "overlay" : "hybrid";
    if (maybeColorCritical) return "overlay";
    if (media.mediaCount > 2 && ["warm", "amber", "candle", "paper", "cool_focus"].includes(profile.mode)) return "overlay";
    return "hybrid";
  }

  function ensureStyle() {
    const styleNodes = document.querySelectorAll(`#${IDS.STYLE}`);
    if (styleNodes.length > 1) {
      styleNodes.forEach((node, index) => {
        if (index > 0) node.remove();
      });
    }
    if (document.getElementById(IDS.STYLE)) return;
    const style = document.createElement("style");
    style.id = IDS.STYLE;
    style.textContent = `
      :root.holmeta-light-active {
        --holmeta-light-filter: none;
        --holmeta-reading-bg: #111111;
        --holmeta-reading-surface: #181818;
        --holmeta-reading-fg: #f3f3f4;
        --holmeta-reading-muted: #d9c5b2;
        --holmeta-reading-link: #ffb300;
        --holmeta-reading-border: rgba(243, 243, 244, 0.24);
        --holmeta-reading-control-bg: #1c1c1c;
      }

      :root.holmeta-reading-dark {
        color-scheme: dark !important;
      }

      :root.holmeta-reading-light {
        color-scheme: light !important;
      }

      :root.holmeta-adaptive-active {
        --holmeta-adaptive-bg: #101113;
        --holmeta-adaptive-surface: #17191d;
        --holmeta-adaptive-fg: #edf0f4;
        --holmeta-adaptive-muted: #c7ced8;
        --holmeta-adaptive-border: rgba(237, 240, 244, 0.24);
        --holmeta-adaptive-link: #ffb300;
        --holmeta-adaptive-overlay: 0.18;
        --holmeta-adaptive-text-boost: 1.02;
      }

      html.holmeta-adaptive-active {
        color-scheme: dark !important;
      }

      html.holmeta-adaptive-light {
        color-scheme: light !important;
      }

      html.holmeta-adaptive-active :where(body, main, article, section, aside, nav, header, footer, dialog, form, table, thead, tbody, tr, th, td, pre, blockquote, fieldset) {
        background-color: var(--holmeta-adaptive-surface) !important;
        border-color: var(--holmeta-adaptive-border) !important;
        color: var(--holmeta-adaptive-fg) !important;
      }

      html.holmeta-adaptive-active :where(body) {
        background-color: var(--holmeta-adaptive-bg) !important;
        color: var(--holmeta-adaptive-fg) !important;
      }

      html.holmeta-adaptive-active :where(p, span, li, dt, dd, label, small, strong, em) {
        color: var(--holmeta-adaptive-fg) !important;
      }

      html.holmeta-adaptive-active :where(a, a:visited) {
        color: var(--holmeta-adaptive-link) !important;
      }

      html.holmeta-adaptive-active :where(input, textarea, select, button, [role='button']) {
        background-color: color-mix(in srgb, var(--holmeta-adaptive-surface) 82%, #000 18%) !important;
        color: var(--holmeta-adaptive-fg) !important;
        border-color: var(--holmeta-adaptive-border) !important;
      }

      html.holmeta-adaptive-active :where(code, pre, kbd, samp) {
        filter: contrast(var(--holmeta-adaptive-text-boost)) !important;
      }

      html.holmeta-light-active {
        filter: var(--holmeta-light-filter) !important;
      }

      html.holmeta-reading-theme :where(img, video, picture, canvas, svg, iframe) {
        filter: none !important;
        mix-blend-mode: normal !important;
      }

      #${IDS.OVERLAY} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        user-select: none;
        z-index: 2147483644;
        opacity: 0;
        background: var(--holmeta-overlay-bg, rgba(0,0,0,1));
        transition: opacity 240ms ease, background-color 240ms ease;
      }

      #${IDS.OVERLAY}.active {
        opacity: var(--holmeta-overlay-opacity, 0.2);
      }

      #${IDS.OVERLAY}.cadence-slow {
        animation: holmetaPulseSlow 2.8s ease-in-out infinite;
      }

      #${IDS.OVERLAY}.cadence-medium {
        animation: holmetaPulseMedium 2s ease-in-out infinite;
      }

      #${IDS.OVERLAY}.cadence-gentle {
        animation: holmetaPulseGentle 3.4s ease-in-out infinite;
      }

      #${IDS.FOCUS} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        user-select: none;
        z-index: 2147483645;
        opacity: 0;
        transition: opacity 220ms ease;
        background: radial-gradient(
          circle at var(--holmeta-focus-x, 50%) var(--holmeta-focus-y, 42%),
          rgba(0,0,0,0) 14%,
          rgba(0,0,0,0) 26%,
          rgba(0,0,0,var(--holmeta-focus-alpha, 0.42)) 64%,
          rgba(0,0,0,calc(var(--holmeta-focus-alpha, 0.42) + 0.08)) 100%
        );
      }

      #${IDS.FOCUS}.active {
        opacity: 1;
      }

      @keyframes holmetaPulseSlow {
        0%,100% { opacity: var(--holmeta-overlay-opacity, 0.2); }
        50% { opacity: calc(var(--holmeta-overlay-opacity, 0.2) + 0.10); }
      }

      @keyframes holmetaPulseMedium {
        0%,100% { opacity: var(--holmeta-overlay-opacity, 0.2); }
        50% { opacity: calc(var(--holmeta-overlay-opacity, 0.2) + 0.14); }
      }

      @keyframes holmetaPulseGentle {
        0%,100% { opacity: var(--holmeta-overlay-opacity, 0.2); }
        50% { opacity: calc(var(--holmeta-overlay-opacity, 0.2) + 0.07); }
      }

      @media (prefers-reduced-motion: reduce) {
        #${IDS.OVERLAY}, #${IDS.FOCUS} {
          animation: none !important;
          transition: none !important;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureLayer(id) {
    const nodes = document.querySelectorAll(`#${id}`);
    if (nodes.length > 1) {
      nodes.forEach((node, index) => {
        if (index > 0) node.remove();
      });
    }
    let node = document.getElementById(id);
    if (node) return node;
    node = document.createElement("div");
    node.id = id;
    document.documentElement.appendChild(node);
    return node;
  }

  function clear() {
    document.documentElement.classList.remove("holmeta-light-active");
    document.documentElement.classList.remove("holmeta-reading-theme");
    document.documentElement.classList.remove("holmeta-reading-dark");
    document.documentElement.classList.remove("holmeta-reading-light");
    document.documentElement.classList.remove("holmeta-adaptive-active");
    document.documentElement.classList.remove("holmeta-adaptive-light");
    document.documentElement.style.removeProperty("--holmeta-light-filter");
    document.documentElement.style.removeProperty("--holmeta-adaptive-bg");
    document.documentElement.style.removeProperty("--holmeta-adaptive-surface");
    document.documentElement.style.removeProperty("--holmeta-adaptive-fg");
    document.documentElement.style.removeProperty("--holmeta-adaptive-muted");
    document.documentElement.style.removeProperty("--holmeta-adaptive-border");
    document.documentElement.style.removeProperty("--holmeta-adaptive-link");
    document.documentElement.style.removeProperty("--holmeta-adaptive-overlay");
    document.documentElement.style.removeProperty("--holmeta-adaptive-text-boost");

    const overlay = document.getElementById(IDS.OVERLAY);
    if (overlay) overlay.remove();

    const focus = document.getElementById(IDS.FOCUS);
    if (focus) focus.remove();

    state.enabled = false;
    state.diagnostics.active = false;
    state.diagnostics.strategy = "none";
    state.diagnostics.mode = "none";
    state.diagnostics.adaptiveMode = "off";
    state.diagnostics.adaptivePreset = "off";
    state.diagnostics.adaptiveStrategy = "none";
    state.diagnostics.compatibilityMode = "normal";
    state.diagnostics.activeSystems = {
      lightFilter: false,
      darkLightTheme: false,
      adaptiveSiteTheme: false
    };
    state.diagnostics.clampReason = "";
  }

  function clearAdaptiveTheme() {
    document.documentElement.classList.remove("holmeta-adaptive-active");
    document.documentElement.classList.remove("holmeta-adaptive-light");
    document.documentElement.style.removeProperty("--holmeta-adaptive-bg");
    document.documentElement.style.removeProperty("--holmeta-adaptive-surface");
    document.documentElement.style.removeProperty("--holmeta-adaptive-fg");
    document.documentElement.style.removeProperty("--holmeta-adaptive-muted");
    document.documentElement.style.removeProperty("--holmeta-adaptive-border");
    document.documentElement.style.removeProperty("--holmeta-adaptive-link");
    document.documentElement.style.removeProperty("--holmeta-adaptive-overlay");
    document.documentElement.style.removeProperty("--holmeta-adaptive-text-boost");
  }

  function computeRampFactor(profile) {
    const schedule = profile.schedule;
    if (!schedule.enabled || schedule.rampMinutes <= 0) return 1;
    if (!inRange(schedule.start, schedule.end, new Date())) return 0;

    const elapsed = minutesSinceStart(schedule.start, schedule.end, new Date());
    if (elapsed < 0) return 0;
    if (elapsed >= schedule.rampMinutes) return 1;
    return clamp(elapsed / schedule.rampMinutes, 0, 1);
  }

  function pickProfile(lightSettings, host) {
    const globalProfile = normalizeProfile(lightSettings, { enabled: Boolean(lightSettings.enabled) });
    const siteMap = lightSettings?.siteProfiles && typeof lightSettings.siteProfiles === "object"
      ? lightSettings.siteProfiles
      : {};

    const direct = siteMap[host];
    if (direct && typeof direct === "object") {
      state.diagnostics.profileSource = "site";
      return normalizeProfile(direct, globalProfile);
    }

    // Built-in smart defaults by site category.
    if (/docs\.google\.com|notion\.so|notion\.site/.test(host)) {
      state.diagnostics.profileSource = "smart-docs";
      return normalizeProfile(
        {
          mode: "paper",
          spectrumPreset: "neutral_3500k",
          intensity: 58,
          dim: 14,
          contrastSoft: 10,
          brightness: 95,
          blueCut: 62,
          saturation: 88
        },
        globalProfile
      );
    }

    if (/github\.com|gitlab\.com|bitbucket\.org/.test(host)) {
      state.diagnostics.profileSource = "smart-code";
      return normalizeProfile(
        {
          mode: "cool_focus",
          spectrumPreset: "neutral_3500k",
          intensity: 36,
          dim: 10,
          contrastSoft: 6,
          brightness: 98,
          blueCut: 42,
          saturation: 102
        },
        globalProfile
      );
    }

    if (/youtube\.com|vimeo\.com|twitch\.tv/.test(host)) {
      state.diagnostics.profileSource = "smart-video";
      return normalizeProfile(
        {
          mode: "amber",
          spectrumPreset: "amber_590",
          intensity: 22,
          dim: 8,
          contrastSoft: 4,
          brightness: 99,
          blueCut: 38,
          saturation: 94,
          videoSafe: true
        },
        globalProfile
      );
    }

    state.diagnostics.profileSource = "global";
    return globalProfile;
  }

  function createDefaultReadingProfile() {
    return {
      enabled: false,
      appearance: "auto", // light | dark | auto
      scheduleMode: "sunset", // sunset | custom
      schedule: {
        enabled: true,
        useSunset: true,
        start: "20:00",
        end: "06:00"
      },
      mode: "dark", // legacy compatibility
      preset: "soft_black", // legacy compatibility
      intensity: 44
    };
  }

  function normalizeReadingProfile(input, fallback) {
    const base = {
      ...createDefaultReadingProfile(),
      ...(fallback || {})
    };
    const raw = input && typeof input === "object" ? input : {};
    const appearanceRaw = String(raw.appearance || raw.mode || base.appearance || "auto").toLowerCase();
    const appearance = ["light", "dark", "auto"].includes(appearanceRaw)
      ? appearanceRaw
      : "auto";
    const scheduleMode = String(raw.scheduleMode || (raw.schedule?.useSunset ? "sunset" : "") || base.scheduleMode || "sunset") === "custom"
      ? "custom"
      : "sunset";
    const scheduleRaw = {
      ...(base.schedule || {}),
      ...(raw.schedule && typeof raw.schedule === "object" ? raw.schedule : {})
    };
    const schedule = {
      enabled: Boolean(raw.schedule?.enabled ?? (appearance === "auto")),
      useSunset: scheduleMode === "sunset",
      start: /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(scheduleRaw.start || "")) ? String(scheduleRaw.start) : "20:00",
      end: /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(scheduleRaw.end || "")) ? String(scheduleRaw.end) : "06:00"
    };
    const mode = appearance === "auto"
      ? (inRange(schedule.start, schedule.end, new Date()) ? "dark" : "light")
      : appearance;
    const preset = [
      "soft_black",
      "dim_slate",
      "gentle_night",
      "soft_paper",
      "neutral_light",
      "warm_page"
    ].includes(String(raw.preset || ""))
      ? String(raw.preset)
      : String(base.preset || "soft_black");
    return {
      ...base,
      ...raw,
      enabled: Boolean(raw.enabled ?? base.enabled),
      appearance,
      scheduleMode,
      schedule,
      mode,
      preset,
      intensity: Math.round(clamp(raw.intensity ?? base.intensity, 0, 100))
    };
  }

  function pickReadingProfile(readingSettings, host) {
    const fallback = createDefaultReadingProfile();
    const settings = readingSettings && typeof readingSettings === "object" ? readingSettings : {};
    const globalProfile = normalizeReadingProfile(settings, fallback);
    const map = settings.perSiteOverrides && typeof settings.perSiteOverrides === "object"
      ? settings.perSiteOverrides
      : {};
    const direct = map[host];
    if (direct && typeof direct === "object") {
      state.diagnostics.readingProfileSource = "site";
      return normalizeReadingProfile(direct, globalProfile);
    }
    state.diagnostics.readingProfileSource = "global";
    return globalProfile;
  }

  function createDefaultAdaptiveProfile() {
    return {
      enabled: false,
      mode: "smart_dark",
      preset: "balanced",
      strategy: "auto",
      compatibilityMode: "normal",
      intensity: 52
    };
  }

  function normalizeAdaptiveProfile(input, fallback) {
    const base = {
      ...createDefaultAdaptiveProfile(),
      ...(fallback || {})
    };
    const raw = input && typeof input === "object" ? input : {};
    const mode = ADAPTIVE_MODES.has(String(raw.mode || "")) ? String(raw.mode) : String(base.mode || "smart_dark");
    const preset = ADAPTIVE_PRESETS.has(String(raw.preset || "")) ? String(raw.preset) : String(base.preset || "balanced");
    const strategy = ADAPTIVE_STRATEGIES.has(String(raw.strategy || ""))
      ? String(raw.strategy)
      : String(base.strategy || "auto");
    const compatibilityMode = ADAPTIVE_COMPAT.has(String(raw.compatibilityMode || ""))
      ? String(raw.compatibilityMode)
      : String(base.compatibilityMode || "normal");
    return {
      ...base,
      ...raw,
      enabled: Boolean(raw.enabled ?? base.enabled),
      mode,
      preset,
      strategy,
      compatibilityMode,
      intensity: Math.round(clamp(raw.intensity ?? base.intensity, 0, 100))
    };
  }

  function pickAdaptiveProfile(adaptiveSettings, host) {
    const fallback = createDefaultAdaptiveProfile();
    const settings = adaptiveSettings && typeof adaptiveSettings === "object" ? adaptiveSettings : {};
    const globalProfile = normalizeAdaptiveProfile(settings, fallback);
    const map = settings.perSiteOverrides && typeof settings.perSiteOverrides === "object"
      ? settings.perSiteOverrides
      : {};
    const direct = map[host];
    if (direct && typeof direct === "object") {
      state.diagnostics.adaptiveProfileSource = "site";
      return normalizeAdaptiveProfile(direct, globalProfile);
    }
    state.diagnostics.adaptiveProfileSource = "global";
    return globalProfile;
  }

  function adaptiveThemeForProfile(profile = {}, pageTone = { tone: "mixed" }, siteType = "general") {
    const mode = String(profile.mode || "smart_dark");
    const tone = pageTone.tone || "mixed";
    const intensity = clamp(profile.intensity, 0, 100) / 100;
    const isDarkTarget = /dark/.test(mode);
    const alreadyDark = tone === "dark";
    const alreadyLight = tone === "light";
    const codeSafe = siteType === "docs_code" || profile.compatibilityMode === "code-safe";
    const mediaSafe = siteType === "media" || profile.compatibilityMode === "media-safe";
    const appSafe = siteType === "dashboard_app" || profile.compatibilityMode === "app-safe";
    const minimal = /minimal/.test(mode) || profile.compatibilityMode === "minimal";

    let bg = "#101113";
    let surface = "#17191d";
    let fg = "#edf0f4";
    let muted = "#c7ced8";
    let border = "rgba(237, 240, 244, 0.24)";
    let link = "#ffb300";
    let overlayOpacity = 0.18 + (intensity * 0.22);
    let textBoost = 1.02;

    if (!isDarkTarget) {
      bg = "#f3f0e8";
      surface = "#fcf9f1";
      fg = "#1e2228";
      muted = "#47505b";
      border = "rgba(30, 34, 40, 0.22)";
      link = "#8a3a14";
      overlayOpacity = 0.06 + (intensity * 0.10);
      textBoost = 1.0;
    }

    if (mode === "code_focus_dark") {
      bg = "#0d1117";
      surface = "#141a24";
      fg = "#e9edf3";
      muted = "#b9c2d0";
      border = "rgba(233, 237, 243, 0.24)";
      link = "#7dc4ff";
      overlayOpacity = 0.12 + (intensity * 0.12);
      textBoost = 1.03;
    } else if (mode === "soft_contrast") {
      bg = "#1a1b1f";
      surface = "#24262c";
      fg = "#f1efe8";
      muted = "#d8cfbc";
      border = "rgba(241, 239, 232, 0.18)";
      link = "#ffb352";
      overlayOpacity = 0.10 + (intensity * 0.08);
      textBoost = 1.01;
    } else if (mode === "minimal_light") {
      bg = "#f5f3ef";
      surface = "#fbf9f4";
      fg = "#242a33";
      muted = "#55606c";
      overlayOpacity = 0.04 + (intensity * 0.06);
    } else if (mode === "minimal_dark") {
      bg = "#141518";
      surface = "#1c1f24";
      fg = "#edf0f4";
      muted = "#c4ccd6";
      overlayOpacity = 0.11 + (intensity * 0.10);
    }

    if (profile.preset === "comfort") {
      overlayOpacity += 0.04;
      muted = isDarkTarget ? "#d9c9b6" : muted;
      link = isDarkTarget ? "#ffc15e" : link;
    } else if (profile.preset === "clarity") {
      textBoost += 0.02;
      overlayOpacity -= 0.02;
      border = isDarkTarget ? "rgba(237, 240, 244, 0.30)" : "rgba(30, 34, 40, 0.26)";
    }

    if (alreadyDark && isDarkTarget) {
      overlayOpacity *= 0.55;
    }
    if (alreadyLight && !isDarkTarget) {
      overlayOpacity *= 0.65;
    }
    if (minimal || appSafe) {
      overlayOpacity *= 0.72;
    }
    if (mediaSafe) {
      overlayOpacity *= 0.64;
    }
    if (codeSafe) {
      textBoost = Math.max(textBoost, 1.03);
    }

    return {
      mode,
      bg,
      surface,
      fg,
      muted,
      border,
      link,
      textBoost: Number(textBoost.toFixed(3)),
      overlayOpacity: clamp(overlayOpacity, 0.02, 0.42),
      strategy: profile.strategy || "auto",
      compatibilityMode: profile.compatibilityMode || "normal"
    };
  }

  function profileToStyle(profile, strategy, rampFactor) {
    const i = clamp(profile.intensity, 0, 100) / 100;
    const d = clamp(profile.dim, 0, 60) / 100;
    const c = clamp(profile.contrastSoft, 0, 30) / 100;
    const b = clamp(profile.brightness, 70, 120) / 100;
    const sat = clamp(profile.saturation, 50, 140) / 100;
    const blueCut = clamp(profile.blueCut, 0, 100) / 100;

    const preset = SPECTRUM_PRESETS[profile.spectrumPreset] || SPECTRUM_PRESETS.balanced;
    const redScale = 0.3 + (clamp(profile.tintRed, 0, 100) / 100) * 0.9;
    const greenScale = 0.3 + (clamp(profile.tintGreen, 0, 100) / 100) * 0.9;
    const blueScale = 0.3 + (clamp(profile.tintBlue, 0, 100) / 100) * 0.9;
    let tintR = Math.round(clamp(preset.r * redScale, 0, 255));
    let tintG = Math.round(clamp(preset.g * greenScale, 0, 255));
    let tintB = Math.round(clamp(preset.b * blueScale, 0, 255));

    let overlayBg = `rgba(${tintR}, ${tintG}, ${tintB}, 1)`;
    let overlayOpacity = 0.05 + (i * 0.34) + (d * 0.28) + (blueCut * 0.1);
    let filter = `brightness(${(b - (i * 0.06)).toFixed(3)}) contrast(${(1 - (c * 0.22)).toFixed(3)}) saturate(${sat.toFixed(3)})`;

    switch (profile.mode) {
      case "amber":
        tintR = Math.round(clamp(tintR + 14, 0, 255));
        tintG = Math.round(clamp(tintG + 8, 0, 255));
        tintB = Math.round(clamp(tintB - 22, 0, 255));
        overlayBg = `rgba(${tintR}, ${tintG}, ${tintB}, 1)`;
        overlayOpacity = 0.07 + (i * 0.40) + (d * 0.22) + (blueCut * 0.12);
        filter = `brightness(${(b - (i * 0.08)).toFixed(3)}) contrast(${(1 - (c * 0.18)).toFixed(3)}) saturate(${(sat * 0.95).toFixed(3)}) sepia(${(0.18 + (blueCut * 0.22)).toFixed(3)})`;
        break;
      case "candle":
        tintR = Math.round(clamp(tintR + 24, 0, 255));
        tintG = Math.round(clamp(tintG - 6, 0, 255));
        tintB = Math.round(clamp(tintB - 32, 0, 255));
        overlayBg = `rgba(${tintR}, ${tintG}, ${tintB}, 1)`;
        overlayOpacity = 0.10 + (i * 0.46) + (d * 0.22) + (blueCut * 0.14);
        filter = `brightness(${(b - (i * 0.12)).toFixed(3)}) contrast(${(1 - (c * 0.16)).toFixed(3)}) saturate(${(sat * 0.88).toFixed(3)}) sepia(${(0.3 + (blueCut * 0.3)).toFixed(3)})`;
        break;
      case "paper":
        tintR = Math.round(clamp(tintR + 5, 0, 255));
        tintG = Math.round(clamp(tintG + 3, 0, 255));
        tintB = Math.round(clamp(tintB - 12, 0, 255));
        overlayBg = `rgba(${tintR}, ${tintG}, ${tintB}, 1)`;
        overlayOpacity = 0.04 + (i * 0.20) + (d * 0.22) + (blueCut * 0.05);
        filter = `brightness(${(b - (i * 0.03)).toFixed(3)}) contrast(${(1 - (c * 0.10)).toFixed(3)}) saturate(${(sat * 0.82).toFixed(3)}) sepia(${(0.22 + (blueCut * 0.18)).toFixed(3)})`;
        break;
      case "cool_focus":
        tintR = Math.round(clamp(tintR - 35, 0, 255));
        tintG = Math.round(clamp(tintG + 10, 0, 255));
        tintB = Math.round(clamp(tintB + 18, 0, 255));
        overlayBg = `rgba(${tintR}, ${tintG}, ${tintB}, 1)`;
        overlayOpacity = 0.03 + (i * 0.16) + (d * 0.2);
        filter = `brightness(${(b - (i * 0.03)).toFixed(3)}) contrast(${(1 - (c * 0.14)).toFixed(3)}) saturate(${(sat * 1.03).toFixed(3)})`;
        break;
      case "red_overlay":
        overlayBg = `rgba(${Math.max(210, tintR)}, ${Math.round(clamp(tintG * 0.45, 0, 110))}, ${Math.round(clamp(tintB * 0.35, 0, 90))}, 1)`;
        overlayOpacity = 0.10 + (i * 0.56) + (d * 0.16) + (blueCut * 0.14);
        filter = `brightness(${(b - (i * 0.12)).toFixed(3)}) contrast(${(1 - (c * 0.20)).toFixed(3)}) saturate(${(Math.max(0.25, sat - (i * 0.24))).toFixed(3)})`;
        break;
      case "red_mono":
        overlayBg = `rgba(${Math.max(220, tintR)}, ${Math.round(clamp(tintG * 0.2, 0, 62))}, ${Math.round(clamp(tintB * 0.14, 0, 48))}, 1)`;
        overlayOpacity = 0.14 + (i * 0.54) + (d * 0.12) + (blueCut * 0.12);
        filter = `grayscale(1) sepia(1) hue-rotate(-48deg) saturate(${(1.8 + i + (blueCut * 0.3)).toFixed(3)}) brightness(${(b - (i * 0.18)).toFixed(3)}) contrast(${(1 - (c * 0.22)).toFixed(3)})`;
        break;
      case "red_lock":
        overlayBg = `rgba(${Math.max(205, tintR)}, ${Math.round(clamp(tintG * 0.12, 0, 44))}, ${Math.round(clamp(tintB * 0.08, 0, 28))}, 1)`;
        overlayOpacity = 0.18 + (i * 0.62) + (d * 0.10) + (blueCut * 0.18);
        filter = `grayscale(1) contrast(${(1.08 - (c * 0.26)).toFixed(3)}) brightness(${(b - (i * 0.22)).toFixed(3)}) sepia(1) hue-rotate(-56deg) saturate(${(2.4 + i + (blueCut * 0.2)).toFixed(3)})`;
        break;
      case "gray_warm":
        overlayBg = `rgba(${Math.round(clamp(tintR, 0, 255))}, ${Math.round(clamp(tintG, 0, 210))}, ${Math.round(clamp(tintB, 0, 140))}, 1)`;
        overlayOpacity = 0.06 + (i * 0.30) + (d * 0.26) + (blueCut * 0.08);
        filter = `grayscale(0.92) sepia(0.55) brightness(${(b - (i * 0.10)).toFixed(3)}) contrast(${(1 - (c * 0.20)).toFixed(3)}) saturate(${(sat * 0.82).toFixed(3)})`;
        break;
      case "grayscale":
        overlayBg = "rgba(0, 0, 0, 1)";
        overlayOpacity = 0.03 + (i * 0.24) + (d * 0.18);
        filter = `grayscale(1) brightness(${(b - (i * 0.08)).toFixed(3)}) contrast(${(1 - (c * 0.18)).toFixed(3)}) saturate(0.2)`;
        break;
      case "custom":
        overlayBg = `rgba(${Math.round(clamp(tintR, 0, 255))}, ${Math.round(clamp(tintG, 0, 255))}, ${Math.round(clamp(tintB, 0, 255))}, 1)`;
        overlayOpacity = 0.02 + (i * 0.44) + (d * 0.22);
        filter = `brightness(${(b - (i * 0.08)).toFixed(3)}) contrast(${(1 - (c * 0.20)).toFixed(3)}) saturate(${(sat * 0.9).toFixed(3)})`;
        break;
      case "dim":
        overlayBg = "rgba(0, 0, 0, 1)";
        overlayOpacity = 0.06 + (i * 0.66) + (d * 0.30);
        filter = `brightness(${(b - (i * 0.28)).toFixed(3)}) contrast(${(1 - (c * 0.12)).toFixed(3)}) saturate(${(sat * 0.9).toFixed(3)})`;
        break;
      case "spotlight":
        overlayBg = "rgba(0, 0, 0, 1)";
        overlayOpacity = 0.10 + (i * 0.44) + (d * 0.22);
        filter = `brightness(${(b - (i * 0.06)).toFixed(3)}) contrast(${(1 - (c * 0.16)).toFixed(3)}) saturate(${sat.toFixed(3)})`;
        break;
      default:
        // warm
        filter = `brightness(${(b - (i * 0.06)).toFixed(3)}) contrast(${(1 - (c * 0.22)).toFixed(3)}) saturate(${sat.toFixed(3)})`;
        break;
    }

    if (profile.reduceWhites) {
      filter += ` sepia(${(0.07 + (blueCut * 0.22)).toFixed(3)})`;
    }

    const factor = clamp(rampFactor, 0, 1);
    overlayOpacity *= factor;

    if (strategy === "overlay") {
      filter = "none";
    }

    return {
      overlayBg,
      overlayOpacity: clamp(overlayOpacity, 0, 0.72),
      filter
    };
  }

  function getSpotlightPoint() {
    if (state.spotlightPoint) return state.spotlightPoint;

    const el = document.activeElement;
    if (el && typeof el.getBoundingClientRect === "function") {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const x = clamp(((rect.left + rect.width / 2) / Math.max(window.innerWidth, 1)) * 100, 5, 95);
        const y = clamp(((rect.top + rect.height / 2) / Math.max(window.innerHeight, 1)) * 100, 5, 95);
        return { x, y };
      }
    }

    return { x: 50, y: 42 };
  }

  function readingThemeForProfile(profile = {}, pageTone = { tone: "mixed", luminance: 0.5 }) {
    const appearance = ["light", "dark", "auto"].includes(String(profile.appearance || ""))
      ? String(profile.appearance)
      : (profile.mode === "light" ? "light" : "dark");
    const schedule = profile.schedule && typeof profile.schedule === "object"
      ? profile.schedule
      : { start: "20:00", end: "06:00", enabled: appearance === "auto" };
    const mode = appearance === "auto"
      ? (inRange(String(schedule.start || "20:00"), String(schedule.end || "06:00"), new Date()) ? "dark" : "light")
      : (appearance === "light" ? "light" : "dark");
    const tone = pageTone.tone || "mixed";
    const alreadyDark = tone === "dark";
    const intensityFactor = clamp(profile.intensity ?? 44, 0, 100) / 100;

    if (mode === "dark") {
      return {
        mode,
        appearance,
        variant: "appearance_dark",
        overlayBg: "rgba(10, 12, 15, 1)",
        overlayOpacity: clamp((alreadyDark ? 0.05 : 0.17) + (intensityFactor * 0.08), 0.03, 0.30),
        maxOverlayOpacity: alreadyDark ? 0.18 : 0.34,
        filter: alreadyDark ? "brightness(0.995) contrast(1.01)" : "brightness(0.985) contrast(1.04)"
      };
    }

    return {
      mode,
      appearance,
      variant: "appearance_light",
      overlayBg: "rgba(247, 243, 232, 1)",
      overlayOpacity: clamp((alreadyDark ? 0.03 : 0.06) + (intensityFactor * 0.06), 0.02, 0.14),
      maxOverlayOpacity: alreadyDark ? 0.10 : 0.20,
      filter: alreadyDark ? "brightness(1.01) contrast(1.0)" : "brightness(1.005) contrast(1.0)"
    };
  }

  function joinFilters(...filters) {
    return filters
      .map((value) => String(value || "").trim())
      .filter((value) => value && value !== "none")
      .join(" ")
      .trim() || "none";
  }

  function supplementalReadingAdjustment(profile = {}, pageTone = { tone: "mixed" }) {
    const mode = String(profile.mode || "warm");
    const intensityFactor = clamp(profile.intensity, 0, 100) / 100;
    const dimFactor = clamp(profile.dim, 0, 60) / 100;
    const tone = pageTone.tone || "mixed";
    const darkPage = tone === "dark";

    if (mode === "red_overlay" || mode === "red_mono" || mode === "red_lock") {
      return {
        overlayFactor: darkPage ? 0.12 : 0.22,
        overlayBg: mode === "red_lock" ? "rgba(186, 28, 22, 1)" : "rgba(194, 46, 34, 1)",
        filter: `saturate(${(0.90 - (intensityFactor * 0.08)).toFixed(3)})`
      };
    }

    if (mode === "gray_warm") {
      return {
        overlayFactor: darkPage ? 0.08 : 0.16,
        filter: `grayscale(${(0.16 + (intensityFactor * 0.16)).toFixed(3)}) sepia(${(0.10 + (intensityFactor * 0.12)).toFixed(3)})`
      };
    }

    if (mode === "dim") {
      return {
        overlayFactor: darkPage ? 0.08 : 0.16,
        filter: `brightness(${(0.99 - (dimFactor * 0.08)).toFixed(3)})`
      };
    }

    if (mode === "spotlight") {
      return {
        overlayFactor: darkPage ? 0.04 : 0.1,
        filter: "none"
      };
    }

    const warmBias = mode === "cool_focus" ? 0.06 : 0.12;
    return {
      overlayFactor: darkPage ? 0.06 : 0.14,
      filter: `sepia(${(warmBias + (intensityFactor * 0.12)).toFixed(3)}) saturate(${(0.97 - (intensityFactor * 0.05)).toFixed(3)})`
    };
  }

  function resolveEffectiveVisualProfile(input = {}) {
    const {
      pageTone = { tone: "mixed", luminance: 0.5 },
      siteType = "general",
      lightEnabled = false,
      readingEnabled = false,
      adaptiveEnabled = false,
      lightProfile = {},
      adaptiveProfile = {}
    } = input;

    const pageIsDark = pageTone.tone === "dark";
    const mediaHeavy = siteType === "media";
    const dashboardLike = siteType === "dashboard_app";
    const docsLike = siteType === "docs_code";
    const combined = Boolean(lightEnabled) + Boolean(readingEnabled) + Boolean(adaptiveEnabled);

    let clampOverlayMax = 0.72;
    let clampReason = "";
    let readingWeight = 1;
    let adaptiveWeight = 1;

    if (adaptiveEnabled && readingEnabled) {
      // Adaptive Site Theme takes priority over simple Appearance when both are enabled.
      readingWeight = 0;
      clampOverlayMax = Math.min(clampOverlayMax, 0.30);
      clampReason = "adaptive-priority";
    }

    if (adaptiveEnabled && lightEnabled) {
      clampOverlayMax = Math.min(clampOverlayMax, 0.38);
      if (!clampReason) clampReason = "adaptive+light";
    }

    if (combined >= 3) {
      clampOverlayMax = Math.min(clampOverlayMax, 0.30);
      clampReason = "triple-stack";
    }

    if (pageIsDark) {
      clampOverlayMax = Math.min(clampOverlayMax, 0.26);
      if (!clampReason) clampReason = "already-dark";
    }

    if (dashboardLike) {
      clampOverlayMax = Math.min(clampOverlayMax, 0.24);
      adaptiveWeight = 0.86;
      if (!clampReason) clampReason = "dashboard-safe";
    }

    if (mediaHeavy) {
      clampOverlayMax = Math.min(clampOverlayMax, 0.22);
      adaptiveWeight = Math.min(adaptiveWeight, 0.8);
      if (lightEnabled && !lightProfile.videoSafe) {
        lightProfile.videoSafe = true;
      }
      if (!clampReason) clampReason = "media-safe";
    }

    if (docsLike && adaptiveEnabled && String(adaptiveProfile.mode || "").includes("code")) {
      adaptiveWeight = Math.max(adaptiveWeight, 0.95);
      clampOverlayMax = Math.min(clampOverlayMax, 0.32);
      if (!clampReason) clampReason = "code-safe";
    }

    return {
      lightEnabled: Boolean(lightEnabled),
      readingEnabled: Boolean(readingEnabled),
      adaptiveEnabled: Boolean(adaptiveEnabled),
      clampOverlayMax,
      readingWeight,
      adaptiveWeight,
      clampReason,
      compatibilityMode: adaptiveProfile.compatibilityMode || "normal"
    };
  }

  function applyAdaptiveTheme(theme, enabled) {
    if (!enabled || !theme) {
      clearAdaptiveTheme();
      return;
    }

    const root = document.documentElement;
    root.classList.add("holmeta-adaptive-active");
    root.classList.toggle("holmeta-adaptive-light", /light/.test(String(theme.mode || "")));
    root.style.setProperty("--holmeta-adaptive-bg", theme.bg);
    root.style.setProperty("--holmeta-adaptive-surface", theme.surface);
    root.style.setProperty("--holmeta-adaptive-fg", theme.fg);
    root.style.setProperty("--holmeta-adaptive-muted", theme.muted);
    root.style.setProperty("--holmeta-adaptive-border", theme.border);
    root.style.setProperty("--holmeta-adaptive-link", theme.link);
    root.style.setProperty("--holmeta-adaptive-overlay", String(theme.overlayOpacity));
    root.style.setProperty("--holmeta-adaptive-text-boost", String(theme.textBoost));
  }

  function apply(payload = {}) {
    const settings = payload.settings || {};
    const legacyLight = settings.light || {};
    const lightSettings = settings.lightFilter || legacyLight || {};
    const readingSettings = settings.darkLightTheme || settings.readingTheme || {
      enabled: Boolean(legacyLight.readingModeEnabled ?? false),
      appearance: ["light", "dark"].includes(String(legacyLight.readingMode || ""))
        ? String(legacyLight.readingMode)
        : "auto",
      scheduleMode: legacyLight.schedule?.useSunset ? "sunset" : "custom",
      schedule: {
        enabled: Boolean(legacyLight.readingModeEnabled ?? false),
        useSunset: Boolean(legacyLight.schedule?.useSunset ?? true),
        start: String(legacyLight.schedule?.start || "20:00"),
        end: String(legacyLight.schedule?.end || "06:00")
      },
      mode: legacyLight.readingMode === "light" ? "light" : "dark",
      preset: legacyLight.readingMode === "light"
        ? (legacyLight.lightThemeVariant === "gray" ? "soft_paper" : legacyLight.lightThemeVariant === "warm" ? "warm_page" : "neutral_light")
        : (legacyLight.darkThemeVariant === "gray" ? "dim_slate" : legacyLight.darkThemeVariant === "brown" ? "gentle_night" : "soft_black"),
      intensity: Number(legacyLight.intensity || 44),
      perSiteOverrides: legacyLight.siteProfiles || {},
      excludedSites: Array.isArray(legacyLight.excludedHosts)
        ? Object.fromEntries(legacyLight.excludedHosts.map((host) => [normalizeHost(host), true]))
        : {}
    };
    const adaptiveSettings = settings.adaptiveSiteTheme || {};
    const effective = payload.effective || {};
    const debugEnabled = Boolean(payload.meta?.debug);

    const host = getHost();
    const filterExcluded = Boolean(lightSettings.excludedSites?.[host] || (Array.isArray(lightSettings.excludedHosts) && lightSettings.excludedHosts.map(normalizeHost).includes(host)));
    const readingExcluded = Boolean(readingSettings.excludedSites?.[host] || (Array.isArray(readingSettings.excludedHosts) && readingSettings.excludedHosts.map(normalizeHost).includes(host)));
    const adaptiveExcluded = Boolean(adaptiveSettings.excludedSites?.[host] || (Array.isArray(adaptiveSettings.excludedHosts) && adaptiveSettings.excludedHosts.map(normalizeHost).includes(host)));
    const excluded = filterExcluded && readingExcluded && adaptiveExcluded;

    const media = countMedia();
    state.diagnostics.host = host;
    state.diagnostics.mediaCount = media.mediaCount;
    state.diagnostics.canvasCount = media.canvasCount;
    state.diagnostics.iframeCount = media.iframeCount;
    state.diagnostics.excluded = excluded;

    const baseEnabled = Boolean(lightSettings.enabled);
    const scheduleActive = !lightSettings.schedule?.enabled || inRange(lightSettings.schedule.start || "20:00", lightSettings.schedule.end || "06:00");
    const runtimeEnabled = typeof effective.lightActive === "boolean" ? effective.lightActive : scheduleActive;
    const pageTone = detectPageTone();
    const siteType = detectSiteType(host, media);
    const profile = pickProfile(lightSettings, host);
    const readingProfile = pickReadingProfile(readingSettings, host);
    const adaptiveProfile = pickAdaptiveProfile(adaptiveSettings, host);
    if (profile.mode === "spotlight") profile.spotlightEnabled = true;

    const filterEnabled = Boolean(baseEnabled && runtimeEnabled && !filterExcluded);
    const readingThemeEnabled = Boolean(readingProfile.enabled && !readingExcluded);
    const adaptiveEnabled = Boolean(adaptiveProfile.enabled && !adaptiveExcluded);

    if ((!filterEnabled && !readingThemeEnabled && !adaptiveEnabled) || excluded) {
      clear();
      return { ...state.diagnostics };
    }

    ensureStyle();
    const overlay = ensureLayer(IDS.OVERLAY);
    const focus = ensureLayer(IDS.FOCUS);

    const rampFactor = filterEnabled ? computeRampFactor(profile) : 1;
    const strategy = filterEnabled ? chooseStrategy(profile, media) : "overlay";
    const style = filterEnabled
      ? profileToStyle(profile, strategy, rampFactor)
      : { overlayBg: "rgba(0,0,0,1)", overlayOpacity: 0, filter: "none" };
    const readingTheme = readingThemeEnabled
      ? readingThemeForProfile(readingProfile, pageTone)
      : { mode: "off", variant: "off", overlayBg: style.overlayBg, overlayOpacity: 0, maxOverlayOpacity: 0.62, filter: "none" };
    const adaptiveTheme = adaptiveEnabled
      ? adaptiveThemeForProfile(adaptiveProfile, pageTone, siteType)
      : null;
    const resolved = resolveEffectiveVisualProfile({
      pageTone,
      siteType,
      lightEnabled: filterEnabled,
      readingEnabled: readingThemeEnabled,
      adaptiveEnabled,
      lightProfile: profile,
      readingProfile,
      adaptiveProfile
    });

    let overlayBg = style.overlayBg;
    let overlayOpacity = filterEnabled ? style.overlayOpacity : 0;
    let pageFilter = filterEnabled ? style.filter : "none";
    let safeFallback = false;
    let clampReason = "";

    if (readingThemeEnabled) {
      overlayBg = readingTheme.overlayBg || overlayBg;
      overlayOpacity = (readingTheme.overlayOpacity || 0) * resolved.readingWeight;
      pageFilter = readingTheme.filter || "none";

      if (filterEnabled) {
        const supplemental = supplementalReadingAdjustment(profile, pageTone);
        overlayOpacity = clamp(
          overlayOpacity + ((style.overlayOpacity || 0) * (supplemental.overlayFactor || 0) * resolved.readingWeight),
          0,
          readingTheme.maxOverlayOpacity || 0.52
        );
        if (supplemental.overlayBg && /^red_/.test(String(profile.mode || ""))) {
          overlayBg = supplemental.overlayBg;
        }
        pageFilter = joinFilters(pageFilter, supplemental.filter);
      }
    }

    if (adaptiveEnabled && adaptiveTheme) {
      applyAdaptiveTheme(adaptiveTheme, true);
      if (readingThemeEnabled) {
        overlayOpacity = clamp(overlayOpacity * 0.72, 0, resolved.clampOverlayMax);
      }
      if (filterEnabled) {
        overlayOpacity = clamp(
          overlayOpacity + ((style.overlayOpacity || 0) * 0.24 * resolved.adaptiveWeight),
          0,
          resolved.clampOverlayMax
        );
      }
      if (!pageFilter || pageFilter === "none") {
        pageFilter = "brightness(0.996) contrast(1.01)";
      }
    } else {
      clearAdaptiveTheme();
    }

    if (pageTone.tone === "dark" && overlayOpacity > 0.28) {
      overlayOpacity = 0.28;
      safeFallback = true;
      clampReason = "already-dark";
    }
    if (pageTone.tone === "light" && readingThemeEnabled && readingProfile.mode === "light" && overlayOpacity > 0.20) {
      overlayOpacity = 0.20;
      safeFallback = true;
      clampReason = "light-reading-cap";
    }
    if (overlayOpacity > resolved.clampOverlayMax) {
      overlayOpacity = resolved.clampOverlayMax;
      safeFallback = true;
      clampReason = resolved.clampReason || clampReason || "resolver-clamp";
    }

    document.documentElement.classList.toggle("holmeta-light-active", filterEnabled || readingThemeEnabled || adaptiveEnabled);
    document.documentElement.classList.toggle("holmeta-reading-theme", readingThemeEnabled);
    document.documentElement.classList.toggle("holmeta-reading-dark", readingThemeEnabled && readingTheme.mode === "dark");
    document.documentElement.classList.toggle("holmeta-reading-light", readingThemeEnabled && readingTheme.mode === "light");
    document.documentElement.style.setProperty("--holmeta-light-filter", pageFilter);

    overlay.style.setProperty("--holmeta-overlay-bg", overlayBg);
    overlay.style.setProperty("--holmeta-overlay-opacity", String(overlayOpacity));
    if (overlayOpacity > 0) {
      overlay.classList.add("active");
    } else {
      overlay.classList.remove("active");
    }

    overlay.classList.remove("cadence-slow", "cadence-medium", "cadence-gentle");

    const therapyActive = filterEnabled && Boolean(profile.therapyMode);
    if (therapyActive) {
      const cadenceClass = profile.therapyCadence === "slow"
        ? "cadence-slow"
        : profile.therapyCadence === "medium"
          ? "cadence-medium"
          : "cadence-gentle";
      overlay.classList.add(cadenceClass);
    }

    const useSpotlight = (filterEnabled && Boolean(profile.spotlightEnabled)) || Boolean(effective.deepWorkActive);
    if (useSpotlight) {
      const point = getSpotlightPoint();
      focus.style.setProperty("--holmeta-focus-x", `${point.x}%`);
      focus.style.setProperty("--holmeta-focus-y", `${point.y}%`);
      focus.style.setProperty("--holmeta-focus-alpha", profile.mode === "spotlight" ? "0.52" : "0.34");
      focus.classList.add("active");
    } else {
      focus.classList.remove("active");
    }

    state.enabled = true;
    state.diagnostics.active = filterEnabled || readingThemeEnabled || adaptiveEnabled;
    state.diagnostics.mode = adaptiveEnabled
      ? adaptiveProfile.mode
      : (readingThemeEnabled
      ? `${readingTheme.mode}_reading`
      : (filterEnabled ? profile.mode : "none"));
    state.diagnostics.strategy = adaptiveEnabled
      ? (adaptiveTheme?.strategy || adaptiveProfile.strategy || "auto")
      : strategy;
    state.diagnostics.readingMode = readingTheme.mode;
    state.diagnostics.readingVariant = readingTheme.variant;
    state.diagnostics.pageTone = pageTone.tone;
    state.diagnostics.pageLuminance = pageTone.luminance;
    state.diagnostics.safeFallback = safeFallback;
    state.diagnostics.clampReason = clampReason || resolved.clampReason || "";
    state.diagnostics.siteType = siteType;
    state.diagnostics.adaptiveMode = adaptiveEnabled ? adaptiveProfile.mode : "off";
    state.diagnostics.adaptivePreset = adaptiveEnabled ? adaptiveProfile.preset : "off";
    state.diagnostics.adaptiveStrategy = adaptiveEnabled
      ? (adaptiveTheme?.strategy || adaptiveProfile.strategy || "auto")
      : "none";
    state.diagnostics.compatibilityMode = adaptiveEnabled
      ? (adaptiveTheme?.compatibilityMode || adaptiveProfile.compatibilityMode || "normal")
      : "normal";
    state.diagnostics.activeSystems = {
      lightFilter: filterEnabled,
      darkLightTheme: readingThemeEnabled,
      adaptiveSiteTheme: adaptiveEnabled
    };
    if (debugEnabled) {
      console.info("[Holmeta light]", {
        mode: state.diagnostics.mode,
        strategy: state.diagnostics.strategy,
        adaptiveMode: state.diagnostics.adaptiveMode,
        adaptivePreset: state.diagnostics.adaptivePreset,
        compatibilityMode: state.diagnostics.compatibilityMode,
        pageTone: pageTone.tone,
        pageLuminance: pageTone.luminance,
        siteType,
        overlayOpacity: Number(overlayOpacity.toFixed(3)),
        filter: pageFilter,
        excluded,
        clampReason: state.diagnostics.clampReason
      });
    }

    return { ...state.diagnostics };
  }

  function setSpotlightPoint(payload = {}) {
    const x = clamp(payload.x, 0, 100);
    const y = clamp(payload.y, 0, 100);
    state.spotlightPoint = { x, y };
  }

  function resetSpotlightPoint() {
    state.spotlightPoint = null;
  }

  function getDiagnostics() {
    return { ...state.diagnostics, enabled: state.enabled, timestamp: now() };
  }

  globalThis.HolmetaLightEngine = {
    createDefaultProfile,
    normalizeProfile,
    createDefaultAdaptiveProfile,
    normalizeAdaptiveProfile,
    apply,
    clear,
    getDiagnostics,
    setSpotlightPoint,
    resetSpotlightPoint,
    normalizeHost,
    inRange
  };
})();
