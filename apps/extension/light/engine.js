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
    "spotlight"
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
      profileSource: "global"
    },
    spotlightPoint: null,
    enabled: false
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
    if (document.getElementById(IDS.STYLE)) return;
    const style = document.createElement("style");
    style.id = IDS.STYLE;
    style.textContent = `
      :root.holmeta-light-active {
        --holmeta-light-filter: none;
      }

      html.holmeta-light-active {
        filter: var(--holmeta-light-filter) !important;
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
    let node = document.getElementById(id);
    if (node) return node;
    node = document.createElement("div");
    node.id = id;
    document.documentElement.appendChild(node);
    return node;
  }

  function clear() {
    document.documentElement.classList.remove("holmeta-light-active");
    document.documentElement.style.removeProperty("--holmeta-light-filter");

    const overlay = document.getElementById(IDS.OVERLAY);
    if (overlay) overlay.remove();

    const focus = document.getElementById(IDS.FOCUS);
    if (focus) focus.remove();

    state.enabled = false;
    state.diagnostics.active = false;
    state.diagnostics.strategy = "none";
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
      overlayOpacity: clamp(overlayOpacity, 0, 0.92),
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

  function apply(payload = {}) {
    const settings = payload.settings || {};
    const lightSettings = settings.light || {};
    const effective = payload.effective || {};

    const host = getHost();
    const excludedHosts = Array.isArray(lightSettings.excludedHosts) ? lightSettings.excludedHosts.map(normalizeHost) : [];
    const excluded = excludedHosts.includes(host);

    const media = countMedia();
    state.diagnostics.host = host;
    state.diagnostics.mediaCount = media.mediaCount;
    state.diagnostics.canvasCount = media.canvasCount;
    state.diagnostics.iframeCount = media.iframeCount;
    state.diagnostics.excluded = excluded;

    const baseEnabled = Boolean(lightSettings.enabled);
    const scheduleActive = !lightSettings.schedule?.enabled || inRange(lightSettings.schedule.start || "20:00", lightSettings.schedule.end || "06:00");
    const runtimeEnabled = typeof effective.lightActive === "boolean" ? effective.lightActive : scheduleActive;

    if (!baseEnabled || !runtimeEnabled || excluded) {
      clear();
      return { ...state.diagnostics };
    }

    ensureStyle();
    const overlay = ensureLayer(IDS.OVERLAY);
    const focus = ensureLayer(IDS.FOCUS);

    const profile = pickProfile(lightSettings, host);
    if (profile.mode === "spotlight") profile.spotlightEnabled = true;

    const rampFactor = computeRampFactor(profile);
    const strategy = chooseStrategy(profile, media);
    const style = profileToStyle(profile, strategy, rampFactor);

    document.documentElement.classList.add("holmeta-light-active");
    document.documentElement.style.setProperty("--holmeta-light-filter", style.filter);

    overlay.style.setProperty("--holmeta-overlay-bg", style.overlayBg);
    overlay.style.setProperty("--holmeta-overlay-opacity", String(style.overlayOpacity));
    overlay.classList.add("active");

    overlay.classList.remove("cadence-slow", "cadence-medium", "cadence-gentle");

    const therapyActive = Boolean(profile.therapyMode);
    if (therapyActive) {
      const cadenceClass = profile.therapyCadence === "slow"
        ? "cadence-slow"
        : profile.therapyCadence === "medium"
          ? "cadence-medium"
          : "cadence-gentle";
      overlay.classList.add(cadenceClass);
    }

    const useSpotlight = Boolean(profile.spotlightEnabled) || Boolean(effective.deepWorkActive);
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
    state.diagnostics.active = true;
    state.diagnostics.mode = profile.mode;
    state.diagnostics.strategy = strategy;

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
    apply,
    clear,
    getDiagnostics,
    setSpotlightPoint,
    resetSpotlightPoint,
    normalizeHost,
    inRange
  };
})();
