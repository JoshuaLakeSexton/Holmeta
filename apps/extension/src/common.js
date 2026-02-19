(() => {
  const FILTER_BLEND_MODES = ["normal", "multiply", "screen", "overlay", "color"];
  const OVERLAY_COLOR_IDS = ["amber", "deepRed", "warmGray", "custom"];
  const REMINDER_TYPES = ["eye", "movement", "posture", "hydration", "breathwork", "dailyAudit"];
  const CADENCE_MODES = ["interval", "workBlocks", "timeWindows"];
  const CADENCE_PRESET_OPTIONS = [
    { id: "balanced", label: "Balanced" },
    { id: "deepWork", label: "Deep Work" },
    { id: "highStrain", label: "High Strain" },
    { id: "gentle", label: "Gentle" },
    { id: "night", label: "Night" }
  ];

  const FILTER_PRESET_OPTIONS = [
    {
      id: "blueShieldMild",
      label: "Blue Shield (Mild)",
      group: "Mild",
      channels: { r: 1, g: 0.94, b: 0.56 },
      mix: { rg: 0.02, rb: 0.08, gr: 0.01, gb: 0.02, br: 0.01, bg: 0.01 },
      overlay: { color: "amber", blend: "multiply", alpha: 0.12 },
      css: { brightness: 0.98, contrast: 0.98, saturation: 0.96, gamma: 1.02 },
      warmth: 0.25
    },
    {
      id: "blueShieldStrong",
      label: "Blue Shield (Strong)",
      group: "Strong",
      channels: { r: 1, g: 0.86, b: 0.3 },
      mix: { rg: 0.03, rb: 0.14, gr: 0.02, gb: 0.03, br: 0.01, bg: 0.01 },
      overlay: { color: "amber", blend: "multiply", alpha: 0.2 },
      css: { brightness: 0.94, contrast: 0.96, saturation: 0.92, gamma: 1.06 },
      warmth: 0.5
    },
    {
      id: "blueShieldMax",
      label: "Blue Shield (Max)",
      group: "Max",
      channels: { r: 1, g: 0.74, b: 0.08 },
      mix: { rg: 0.06, rb: 0.2, gr: 0.03, gb: 0.02, br: 0.01, bg: 0.01 },
      overlay: { color: "amber", blend: "multiply", alpha: 0.32 },
      css: { brightness: 0.88, contrast: 0.92, saturation: 0.84, gamma: 1.12 },
      warmth: 0.8
    },
    {
      id: "nightWarmMild",
      label: "Night Warm (Mild)",
      group: "Mild",
      channels: { r: 1, g: 0.9, b: 0.62 },
      mix: { rg: 0.01, rb: 0.05, gr: 0.01, gb: 0.02, br: 0, bg: 0.01 },
      overlay: { color: "amber", blend: "multiply", alpha: 0.1 },
      css: { brightness: 0.98, contrast: 0.98, saturation: 0.98, gamma: 1 },
      warmth: 0.2
    },
    {
      id: "nightWarmStrong",
      label: "Night Warm (Strong)",
      group: "Strong",
      channels: { r: 1, g: 0.8, b: 0.3 },
      mix: { rg: 0.02, rb: 0.09, gr: 0.01, gb: 0.02, br: 0.01, bg: 0.01 },
      overlay: { color: "amber", blend: "multiply", alpha: 0.18 },
      css: { brightness: 0.93, contrast: 0.95, saturation: 0.9, gamma: 1.05 },
      warmth: 0.52
    },
    {
      id: "nightWarmMax",
      label: "Night Warm (Max)",
      group: "Max",
      channels: { r: 1, g: 0.66, b: 0.08 },
      mix: { rg: 0.04, rb: 0.18, gr: 0.02, gb: 0.02, br: 0.01, bg: 0.01 },
      overlay: { color: "amber", blend: "multiply", alpha: 0.3 },
      css: { brightness: 0.86, contrast: 0.9, saturation: 0.8, gamma: 1.1 },
      warmth: 0.82
    },
    {
      id: "redNightStrong",
      label: "Red Night (Strong)",
      group: "Strong",
      channels: { r: 1, g: 0.12, b: 0.04 },
      mix: { rg: 0.14, rb: 0.07, gr: 0.02, gb: 0.01, br: 0.01, bg: 0 },
      overlay: { color: "deepRed", blend: "multiply", alpha: 0.48 },
      css: { brightness: 0.78, contrast: 0.86, saturation: 0.62, gamma: 1.15 },
      warmth: 1
    },
    {
      id: "redNightMax",
      label: "Red Night (Max)",
      group: "Max",
      channels: { r: 1, g: 0.04, b: 0.01 },
      mix: { rg: 0.18, rb: 0.1, gr: 0.01, gb: 0.01, br: 0, bg: 0 },
      overlay: { color: "deepRed", blend: "multiply", alpha: 0.66 },
      css: { brightness: 0.62, contrast: 0.8, saturation: 0.4, gamma: 1.2 },
      warmth: 1
    },
    {
      id: "redBlocker",
      label: "Red Blocker",
      group: "Strong",
      channels: { r: 0.34, g: 1, b: 1 },
      mix: { rg: 0, rb: 0, gr: 0.02, gb: 0, br: 0.03, bg: 0.02 },
      overlay: { color: "warmGray", blend: "screen", alpha: 0.08 },
      css: { brightness: 0.96, contrast: 1.02, saturation: 0.96, gamma: 0.96 },
      warmth: 0
    },
    {
      id: "grayscale",
      label: "Grayscale",
      group: "Strong",
      grayscale: true,
      channels: { r: 1, g: 1, b: 1 },
      mix: { rg: 0, rb: 0, gr: 0, gb: 0, br: 0, bg: 0 },
      overlay: { color: "warmGray", blend: "normal", alpha: 0 },
      css: { brightness: 0.95, contrast: 0.95, saturation: 0, gamma: 1 },
      warmth: 0
    },
    {
      id: "contrastGuard",
      label: "Contrast Guard",
      group: "Mild",
      channels: { r: 0.98, g: 0.97, b: 0.9 },
      mix: { rg: 0.01, rb: 0.02, gr: 0.01, gb: 0.01, br: 0, bg: 0.01 },
      overlay: { color: "warmGray", blend: "multiply", alpha: 0.18 },
      css: { brightness: 0.82, contrast: 0.82, saturation: 0.86, gamma: 0.95 },
      warmth: 0.28
    },
    {
      id: "migraineSafe",
      label: "Migraine Safe",
      group: "Max",
      channels: { r: 1, g: 0.88, b: 0.24 },
      mix: { rg: 0.03, rb: 0.1, gr: 0.01, gb: 0.02, br: 0.01, bg: 0.01 },
      overlay: { color: "warmGray", blend: "multiply", alpha: 0.36 },
      css: { brightness: 0.7, contrast: 0.7, saturation: 0.56, gamma: 1.04 },
      warmth: 0.72
    }
  ];

  const FILTER_PRESET_MAP = Object.fromEntries(FILTER_PRESET_OPTIONS.map((preset) => [preset.id, preset]));
  const FREE_FILTER_PRESET_IDS = ["blueShieldMild", "nightWarmMild", "contrastGuard"];

  const LEGACY_PRESET_ALIASES = {
    neutral: "contrastGuard",
    blueBlocker: "blueShieldStrong",
    nightWarm: "nightWarmStrong",
    redBlocker: "redBlocker"
  };

  const OVERLAY_COLOR_PRESETS = {
    amber: { r: 255, g: 140, b: 40 },
    deepRed: { r: 255, g: 30, b: 24 },
    warmGray: { r: 134, g: 120, b: 106 }
  };

  const REMINDER_LABELS = {
    eye: "Eye Recovery",
    movement: "Movement",
    posture: "Posture",
    hydration: "Hydration",
    breathwork: "Breathwork",
    dailyAudit: "Daily Audit"
  };

  const SFX_SOUND_OPTIONS = [
    { key: "hm_hover_01", label: "Hover 01" },
    { key: "hm_hover_02", label: "Hover 02" },
    { key: "hm_click_01", label: "Click 01" },
    { key: "hm_click_02", label: "Click 02" },
    { key: "hm_toggle_on", label: "Toggle On" },
    { key: "hm_toggle_off", label: "Toggle Off" },
    { key: "hm_save", label: "Save" },
    { key: "hm_success", label: "Success" },
    { key: "hm_warn", label: "Warn" },
    { key: "hm_error", label: "Error" },
    { key: "hm_test_ping", label: "Test Ping" },
    { key: "hm_focus_start", label: "Focus Start" },
    { key: "hm_focus_end", label: "Focus End" },
    { key: "hm_eye", label: "Eye Reminder" },
    { key: "hm_move", label: "Movement Reminder" },
    { key: "hm_water", label: "Hydration Reminder" },
    { key: "hm_breath_in", label: "Breath In" },
    { key: "hm_breath_out", label: "Breath Out" }
  ];

  const SFX_SOUND_KEYS = SFX_SOUND_OPTIONS.map((item) => item.key);

  const SFX_EVENT_OPTIONS = [
    { id: "uiHover", label: "UI Hover" },
    { id: "uiClick", label: "UI Click" },
    { id: "uiToggleOn", label: "UI Toggle On" },
    { id: "uiToggleOff", label: "UI Toggle Off" },
    { id: "uiSave", label: "Save Action" },
    { id: "uiSuccess", label: "Success State" },
    { id: "uiWarn", label: "Warn State" },
    { id: "uiError", label: "Error State" },
    { id: "uiTest", label: "Test Ping" },
    { id: "focusStart", label: "Focus Start" },
    { id: "focusEnd", label: "Focus End" },
    { id: "reminderEye", label: "Reminder Eye" },
    { id: "reminderMovement", label: "Reminder Move/Posture" },
    { id: "reminderHydration", label: "Reminder Hydration" },
    { id: "reminderBreathwork", label: "Reminder Breathwork" },
    { id: "reminderDailyAudit", label: "Reminder Daily Audit" }
  ];

  const DEFAULT_SFX_EVENT_MAPPING = {
    uiHover: "hm_hover_01",
    uiClick: "hm_click_01",
    uiToggleOn: "hm_toggle_on",
    uiToggleOff: "hm_toggle_off",
    uiSave: "hm_save",
    uiSuccess: "hm_success",
    uiWarn: "hm_warn",
    uiError: "hm_error",
    uiTest: "hm_test_ping",
    focusStart: "hm_focus_start",
    focusEnd: "hm_focus_end",
    reminderEye: "hm_eye",
    reminderMovement: "hm_move",
    reminderHydration: "hm_water",
    reminderBreathwork: "hm_breath_in",
    reminderDailyAudit: "hm_warn"
  };

  const DELIVERY_DEFAULT = {
    overlay: true,
    notification: true,
    popupOnly: false,
    sound: false,
    soundVolume: 0.25,
    gentle: false
  };

  const DEFAULT_CADENCE = {
    version: 2,
    activeProfile: "balanced",
    global: {
      quietHoursStart: "22:30",
      quietHoursEnd: "07:30",
      suppressDuringFocus: true,
      suppressWhenIdle: true,
      meetingModeManual: false,
      meetingModeAuto: false,
      meetingDomains: ["meet.google.com", "zoom.us", "teams.microsoft.com"],
      panicUntilTs: 0,
      snoozeAllUntilTs: 0
    },
    reminders: {
      eye: {
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMin: 20,
          jitterMin: 0,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "09:00", end: "17:30" }]
        },
        delivery: { ...DELIVERY_DEFAULT },
        snoozeMinutes: [5, 10, 15, 30],
        snoozeCustomMin: 20,
        escalateIfIgnored: true,
        escalateAfterIgnores: 3,
        exerciseDurationSec: 20,
        exerciseSet: "mixed"
      },
      movement: {
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMin: 45,
          jitterMin: 1,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "09:00", end: "17:30" }]
        },
        delivery: { ...DELIVERY_DEFAULT },
        snoozeMinutes: [5, 10, 15, 30],
        snoozeCustomMin: 15,
        escalateIfIgnored: false,
        escalateAfterIgnores: 3,
        suggestionRotation: true,
        promptType: "mixed"
      },
      posture: {
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMin: 40,
          jitterMin: 1,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "09:00", end: "17:30" }]
        },
        delivery: { ...DELIVERY_DEFAULT },
        snoozeMinutes: [5, 10, 15, 30],
        snoozeCustomMin: 15,
        escalateIfIgnored: false,
        escalateAfterIgnores: 3,
        stillnessMinutes: 50,
        slouchSensitivity: 0.45
      },
      hydration: {
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMin: 60,
          jitterMin: 0,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "09:00", end: "17:30" }]
        },
        delivery: { ...DELIVERY_DEFAULT },
        snoozeMinutes: [10, 15, 30],
        snoozeCustomMin: 20,
        escalateIfIgnored: false,
        escalateAfterIgnores: 3,
        dailyGoalGlasses: 8,
        quietHoursOverride: false
      },
      breathwork: {
        enabled: true,
        schedule: {
          mode: "timeWindows",
          intervalMin: 120,
          jitterMin: 0,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [
            { start: "10:30", end: "11:15" },
            { start: "15:30", end: "16:15" }
          ]
        },
        delivery: { ...DELIVERY_DEFAULT, notification: false, gentle: true },
        snoozeMinutes: [10, 15, 30],
        snoozeCustomMin: 20,
        escalateIfIgnored: false,
        escalateAfterIgnores: 3,
        onDemandPresets: ["box", "478", "sigh"]
      },
      dailyAudit: {
        enabled: true,
        schedule: {
          mode: "timeWindows",
          intervalMin: 1440,
          jitterMin: 0,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "17:00", end: "20:00" }]
        },
        delivery: { ...DELIVERY_DEFAULT, notification: false, gentle: true },
        snoozeMinutes: [15, 30],
        snoozeCustomMin: 30,
        escalateIfIgnored: false,
        escalateAfterIgnores: 2,
        nudgeTime: "18:00",
        missedDayFallback: "nextMorning"
      }
    }
  };

  const DEFAULT_SETTINGS = {
    settingsVersion: 2,
    filterPreset: "nightWarmStrong",
    filterIntensity: 0.78,
    filterEnabled: true,
    colorAccurate: false,
    overlayStrength: 0.35,
    filterDimming: 0.2,
    filterContrast: 1,
    filterSaturation: 0.95,
    filterGamma: 1,
    overlayBlendMode: "multiply",
    overlayColorPreset: "amber",
    overlayCustomColor: { r: 255, g: 96, b: 48 },
    preserveLuminance: false,
    applyToMedia: false,
    excludeMedia: true,
    designMode: false,
    wakeTime: "07:00",
    sleepTime: "23:00",
    rampMinutes: 60,
    reminderNotifications: true,
    audioCues: false,
    soundEnabled: false,
    masterVolume: 0.35,
    hoverEnabled: false,
    reminderSoundsEnabled: true,
    perEventMapping: { ...DEFAULT_SFX_EVENT_MAPPING },
    speechCues: false,
    webcamPostureOptIn: false,
    devBypassPremium: false,
    debugPanel: false,
    ui: { showHud: false },
    onboardingCompleted: false,
    apiBaseUrl: "",
    entitlementUrl: "",
    pairingExchangeUrl: "",
    pairingCodeCreateUrl: "",
    checkoutUrl: "",
    dashboardUrl: "",
    extensionToken: "",
    disabledDomains: [],
    siteOverrides: {},
    distractorDomains: ["youtube.com", "x.com", "reddit.com"],
    cadence: DEFAULT_CADENCE
  };

  function emptyReminderMap(initial = 0) {
    const output = {};
    REMINDER_TYPES.forEach((type) => {
      output[type] = initial;
    });
    return output;
  }

  const DEFAULT_RUNTIME = {
    focusSession: null,
    lastActivityTs: Date.now(),
    scheduler: {
      today: "",
      nextByType: {},
      lastTriggeredByType: {},
      lastCompletedByType: {},
      firedByType: emptyReminderMap(0),
      completedByType: emptyReminderMap(0),
      ignoredByType: emptyReminderMap(0),
      suppressedByType: emptyReminderMap(0),
      pendingByType: emptyReminderMap(0),
      snoozedUntilByType: emptyReminderMap(0),
      nextReminderType: null,
      nextReminderAt: 0,
      lastSummaryAt: 0
    }
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min = 0, max = 1) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return min;
    }
    return Math.max(min, Math.min(max, num));
  }

  function blend(from, to, amount) {
    return from + (to - from) * clamp(amount);
  }

  function parseClock(value) {
    const [h = "0", m = "0"] = String(value || "0:0").split(":");
    const hours = Number(h);
    const minutes = Number(m);
    return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
  }

  function todayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function minutesSinceMidnight(date = new Date()) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function inWindow(now, start, end) {
    if (start <= end) {
      return now >= start && now <= end;
    }
    return now >= start || now <= end;
  }

  function circadianBoost(settings, date = new Date()) {
    const wake = parseClock(settings.wakeTime || DEFAULT_SETTINGS.wakeTime);
    const sleep = parseClock(settings.sleepTime || DEFAULT_SETTINGS.sleepTime);
    const now = minutesSinceMidnight(date);
    const ramp = Math.max(10, Number(settings.rampMinutes || DEFAULT_SETTINGS.rampMinutes));

    const windDownStart = (sleep - ramp + 1440) % 1440;
    const wakeRampEnd = (wake + ramp) % 1440;

    if (inWindow(now, windDownStart, sleep)) {
      const elapsed = now >= windDownStart ? now - windDownStart : now + 1440 - windDownStart;
      return clamp(elapsed / ramp);
    }

    if (inWindow(now, wake, wakeRampEnd)) {
      const elapsed = now >= wake ? now - wake : now + 1440 - wake;
      return clamp(1 - elapsed / ramp);
    }

    if (inWindow(now, sleep, wake)) {
      return 1;
    }

    return 0;
  }

  function matrixToString(matrix) {
    return matrix.map((value) => Number(value).toFixed(4)).join(" ");
  }

  function normalizeDomain(domain) {
    return String(domain || "")
      .trim()
      .toLowerCase()
      .replace(/^\*\./, "")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
  }

  function domainMatches(hostname, domain) {
    const safeHost = normalizeDomain(hostname);
    const safeDomain = normalizeDomain(domain);
    if (!safeHost || !safeDomain) {
      return false;
    }
    return safeHost === safeDomain || safeHost.endsWith(`.${safeDomain}`);
  }

  function parseDomainList(raw) {
    return String(raw || "")
      .split(/\n|,/) 
      .map((entry) => normalizeDomain(entry))
      .filter(Boolean)
      .filter((domain, index, all) => all.indexOf(domain) === index);
  }

  function parseHttpUrl(rawUrl) {
    try {
      const value = String(rawUrl || "").trim();
      if (!value) {
        return null;
      }

      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }

      return url;
    } catch (_) {
      return null;
    }
  }

  function normalizeHttpUrl(rawUrl) {
    const parsed = parseHttpUrl(rawUrl);
    return parsed ? parsed.toString() : "";
  }

  function deriveDashboardFromApiBase(apiBaseUrl) {
    const parsed = parseHttpUrl(apiBaseUrl);
    if (!parsed) {
      return null;
    }

    let pathname = parsed.pathname || "/";
    pathname = pathname.replace(/\/+$/, "");

    if (pathname.endsWith("/.netlify/functions")) {
      pathname = pathname.slice(0, -"/.netlify/functions".length);
    }

    parsed.pathname = (String(pathname || "") + "/dashboard").replace(/\/{2,}/g, "/");
    parsed.search = "";
    parsed.hash = "";

    return parsed;
  }

  function resolveDashboardUrl(rawSettings, overrideValue = null) {
    const settings = rawSettings || {};
    const override = String(
      overrideValue !== null && overrideValue !== undefined
        ? overrideValue
        : settings.dashboardUrl || ""
    ).trim();

    if (override) {
      const parsedOverride = parseHttpUrl(override);
      if (!parsedOverride) {
        return {
          ok: false,
          error: "INVALID_URL",
          message: "Dashboard URL override is invalid.",
          source: "override",
          url: ""
        };
      }

      return {
        ok: true,
        source: "override",
        url: parsedOverride.toString()
      };
    }

    const derived = deriveDashboardFromApiBase(settings.apiBaseUrl || "");
    if (!derived) {
      return {
        ok: false,
        error: "INVALID_API_BASE",
        message: "Set a valid API base URL to derive /dashboard.",
        source: "derived",
        url: ""
      };
    }

    return {
      ok: true,
      source: "derived",
      url: derived.toString()
    };
  }

  async function openExternal(rawUrl) {
    const parsed = parseHttpUrl(rawUrl);
    if (!parsed) {
      return {
        ok: false,
        error: "INVALID_URL",
        message: "Invalid URL."
      };
    }

    const url = parsed.toString();

    if (globalThis.chrome?.tabs?.create) {
      try {
        await new Promise((resolve, reject) => {
          globalThis.chrome.tabs.create({ url }, () => {
            const err = globalThis.chrome.runtime?.lastError;
            if (err) {
              reject(new Error(err.message || "tabs.create failed"));
              return;
            }
            resolve();
          });
        });

        return {
          ok: true,
          url,
          method: "chrome.tabs.create"
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "tabs.create failed";
        return {
          ok: false,
          url,
          error: "TAB_OPEN_FAILED",
          message: reason
        };
      }
    }

    if (typeof window !== "undefined" && typeof window.open === "function") {
      const popup = window.open(url, "_blank", "noopener");
      if (popup) {
        return {
          ok: true,
          url,
          method: "window.open"
        };
      }
    }

    return {
      ok: false,
      url,
      error: "TAB_OPEN_UNAVAILABLE",
      message: "Unable to open external tab."
    };
  }

  function formatMinutes(totalMinutes) {
    const min = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(min / 60);
    const minutes = min % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }
    return `${minutes}m`;
  }

  function formatCountdown(msRemaining) {
    const safe = Math.max(0, Number(msRemaining || 0));
    const sec = Math.floor(safe / 1000);
    const min = Math.floor(sec / 60);
    return `${String(min).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  }

  function normalizePresetId(value) {
    const candidate = LEGACY_PRESET_ALIASES[value] || value;
    if (FILTER_PRESET_MAP[candidate]) {
      return candidate;
    }
    return DEFAULT_SETTINGS.filterPreset;
  }

  function getPresetById(presetId) {
    return FILTER_PRESET_MAP[normalizePresetId(presetId)] || FILTER_PRESET_MAP[DEFAULT_SETTINGS.filterPreset];
  }

  function normalizeColorInput(value) {
    return {
      r: Math.round(clamp(value?.r, 0, 255)),
      g: Math.round(clamp(value?.g, 0, 255)),
      b: Math.round(clamp(value?.b, 0, 255))
    };
  }

  function normalizeTime(value, fallback) {
    const safe = String(value || fallback);
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(safe) ? safe : fallback;
  }

  function normalizeWindows(rawWindows, fallback) {
    const source = Array.isArray(rawWindows) ? rawWindows : fallback;
    const windows = source
      .map((windowDef) => ({
        start: normalizeTime(windowDef?.start, "09:00"),
        end: normalizeTime(windowDef?.end, "17:30")
      }))
      .slice(0, 8);

    return windows.length ? windows : fallback;
  }

  function normalizeSchedule(raw, fallback) {
    const source = raw && typeof raw === "object" ? raw : {};
    const mode = CADENCE_MODES.includes(source.mode) ? source.mode : fallback.mode;
    return {
      mode,
      intervalMin: Math.round(clamp(Number(source.intervalMin ?? fallback.intervalMin), 5, 360)),
      jitterMin: Math.round(clamp(Number(source.jitterMin ?? fallback.jitterMin), 0, 3)),
      workMin: Math.round(clamp(Number(source.workMin ?? fallback.workMin), 15, 120)),
      breakMin: Math.round(clamp(Number(source.breakMin ?? fallback.breakMin), 5, 60)),
      anchorTime: normalizeTime(source.anchorTime, fallback.anchorTime),
      windows: normalizeWindows(source.windows, fallback.windows)
    };
  }

  function normalizeDelivery(raw, fallback, rootSettings) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      overlay: Object.prototype.hasOwnProperty.call(source, "overlay") ? Boolean(source.overlay) : Boolean(fallback.overlay),
      notification: Object.prototype.hasOwnProperty.call(source, "notification")
        ? Boolean(source.notification)
        : Boolean(rootSettings.reminderNotifications),
      popupOnly: Object.prototype.hasOwnProperty.call(source, "popupOnly") ? Boolean(source.popupOnly) : Boolean(fallback.popupOnly),
      sound: Object.prototype.hasOwnProperty.call(source, "sound")
        ? Boolean(source.sound)
        : Boolean(rootSettings.audioCues),
      soundVolume: clamp(Number(source.soundVolume ?? fallback.soundVolume), 0, 1),
      gentle: Object.prototype.hasOwnProperty.call(source, "gentle") ? Boolean(source.gentle) : Boolean(fallback.gentle)
    };
  }

  function normalizePerEventMapping(rawMapping) {
    const source = rawMapping && typeof rawMapping === "object" ? rawMapping : {};
    const output = {};

    SFX_EVENT_OPTIONS.forEach((eventDef) => {
      const eventId = eventDef.id;
      const mapped = String(source[eventId] || DEFAULT_SFX_EVENT_MAPPING[eventId] || "").trim();
      output[eventId] = SFX_SOUND_KEYS.includes(mapped) ? mapped : DEFAULT_SFX_EVENT_MAPPING[eventId];
    });

    return output;
  }

  function resolveSfxKeyForEvent(rawSettings, eventId) {
    const settings = normalizeSettings(rawSettings);
    const id = String(eventId || "").trim();
    if (!id) {
      return null;
    }

    const mapped = String(settings.perEventMapping?.[id] || "").trim();
    if (SFX_SOUND_KEYS.includes(mapped)) {
      return mapped;
    }

    return DEFAULT_SFX_EVENT_MAPPING[id] || null;
  }

  function normalizeReminderCommon(reminderId, raw, rootSettings) {
    const defaults = DEFAULT_CADENCE.reminders[reminderId];
    const source = raw && typeof raw === "object" ? raw : {};

    const reminder = {
      ...deepClone(defaults),
      ...source,
      enabled: Object.prototype.hasOwnProperty.call(source, "enabled") ? Boolean(source.enabled) : Boolean(defaults.enabled),
      schedule: normalizeSchedule(source.schedule, defaults.schedule),
      delivery: normalizeDelivery(source.delivery, defaults.delivery, rootSettings),
      snoozeMinutes: Array.isArray(source.snoozeMinutes)
        ? source.snoozeMinutes.map((value) => Math.round(clamp(Number(value), 1, 180))).slice(0, 8)
        : deepClone(defaults.snoozeMinutes),
      snoozeCustomMin: Math.round(clamp(Number(source.snoozeCustomMin ?? defaults.snoozeCustomMin), 1, 180)),
      escalateIfIgnored: Object.prototype.hasOwnProperty.call(source, "escalateIfIgnored")
        ? Boolean(source.escalateIfIgnored)
        : Boolean(defaults.escalateIfIgnored),
      escalateAfterIgnores: Math.round(clamp(Number(source.escalateAfterIgnores ?? defaults.escalateAfterIgnores), 1, 10))
    };

    if (!reminder.snoozeMinutes.length) {
      reminder.snoozeMinutes = deepClone(defaults.snoozeMinutes);
    }

    return reminder;
  }

  function buildCadenceFromLegacy(rawSettings) {
    const source = rawSettings || {};
    const cadence = deepClone(DEFAULT_CADENCE);
    cadence.reminders.eye.schedule.intervalMin = Math.round(clamp(Number(source.eyeBreakIntervalMin || 20), 5, 360));
    cadence.reminders.hydration.schedule.intervalMin = Math.round(clamp(Number(source.hydrationIntervalMin || 60), 5, 360));
    cadence.reminders.posture.stillnessMinutes = Math.round(clamp(Number(source.stillnessThresholdMin || 50), 10, 240));
    cadence.reminders.hydration.dailyGoalGlasses = Math.round(clamp(Number(source.hydrationGoalGlasses || 8), 1, 24));

    const remindersEnabled = Boolean(source.reminderNotifications !== false);
    const audioCues = Boolean(source.audioCues);

    REMINDER_TYPES.forEach((type) => {
      cadence.reminders[type].delivery.notification = remindersEnabled;
      cadence.reminders[type].delivery.sound = audioCues;
    });

    return cadence;
  }

  function normalizeCadence(rawCadence, rootSettings, legacySource) {
    const source = rawCadence && typeof rawCadence === "object" ? rawCadence : null;
    const base = source ? source : buildCadenceFromLegacy(legacySource);

    const normalized = {
      version: 2,
      activeProfile: CADENCE_PRESET_OPTIONS.some((option) => option.id === base.activeProfile)
        ? base.activeProfile
        : DEFAULT_CADENCE.activeProfile,
      global: {
        quietHoursStart: normalizeTime(base.global?.quietHoursStart, DEFAULT_CADENCE.global.quietHoursStart),
        quietHoursEnd: normalizeTime(base.global?.quietHoursEnd, DEFAULT_CADENCE.global.quietHoursEnd),
        suppressDuringFocus: Object.prototype.hasOwnProperty.call(base.global || {}, "suppressDuringFocus")
          ? Boolean(base.global.suppressDuringFocus)
          : DEFAULT_CADENCE.global.suppressDuringFocus,
        suppressWhenIdle: Object.prototype.hasOwnProperty.call(base.global || {}, "suppressWhenIdle")
          ? Boolean(base.global.suppressWhenIdle)
          : DEFAULT_CADENCE.global.suppressWhenIdle,
        meetingModeManual: Object.prototype.hasOwnProperty.call(base.global || {}, "meetingModeManual")
          ? Boolean(base.global.meetingModeManual)
          : DEFAULT_CADENCE.global.meetingModeManual,
        meetingModeAuto: Object.prototype.hasOwnProperty.call(base.global || {}, "meetingModeAuto")
          ? Boolean(base.global.meetingModeAuto)
          : DEFAULT_CADENCE.global.meetingModeAuto,
        meetingDomains: parseDomainList((base.global?.meetingDomains || DEFAULT_CADENCE.global.meetingDomains).join(",")),
        panicUntilTs: Math.max(0, Math.round(Number(base.global?.panicUntilTs || 0))),
        snoozeAllUntilTs: Math.max(0, Math.round(Number(base.global?.snoozeAllUntilTs || 0)))
      },
      reminders: {}
    };

    REMINDER_TYPES.forEach((type) => {
      const reminder = normalizeReminderCommon(type, base.reminders?.[type], rootSettings);

      if (type === "eye") {
        reminder.exerciseDurationSec = Math.round(clamp(Number(base.reminders?.eye?.exerciseDurationSec ?? reminder.exerciseDurationSec), 10, 120));
        reminder.exerciseSet = ["classic", "palming", "blink-reset", "focus-shift", "mixed"].includes(base.reminders?.eye?.exerciseSet)
          ? base.reminders.eye.exerciseSet
          : DEFAULT_CADENCE.reminders.eye.exerciseSet;
      }

      if (type === "movement") {
        reminder.suggestionRotation = Object.prototype.hasOwnProperty.call(base.reminders?.movement || {}, "suggestionRotation")
          ? Boolean(base.reminders.movement.suggestionRotation)
          : DEFAULT_CADENCE.reminders.movement.suggestionRotation;
        reminder.promptType = ["stand", "walk", "mixed"].includes(base.reminders?.movement?.promptType)
          ? base.reminders.movement.promptType
          : DEFAULT_CADENCE.reminders.movement.promptType;
      }

      if (type === "posture") {
        reminder.stillnessMinutes = Math.round(clamp(Number(base.reminders?.posture?.stillnessMinutes ?? reminder.stillnessMinutes), 10, 240));
        reminder.slouchSensitivity = clamp(Number(base.reminders?.posture?.slouchSensitivity ?? reminder.slouchSensitivity), 0.1, 1);
      }

      if (type === "hydration") {
        reminder.dailyGoalGlasses = Math.round(clamp(Number(base.reminders?.hydration?.dailyGoalGlasses ?? reminder.dailyGoalGlasses), 1, 24));
        reminder.quietHoursOverride = Object.prototype.hasOwnProperty.call(base.reminders?.hydration || {}, "quietHoursOverride")
          ? Boolean(base.reminders.hydration.quietHoursOverride)
          : DEFAULT_CADENCE.reminders.hydration.quietHoursOverride;
      }

      if (type === "breathwork") {
        reminder.onDemandPresets = Array.isArray(base.reminders?.breathwork?.onDemandPresets)
          ? base.reminders.breathwork.onDemandPresets.filter((item) => ["box", "478", "sigh"].includes(item)).slice(0, 3)
          : deepClone(DEFAULT_CADENCE.reminders.breathwork.onDemandPresets);

        if (!reminder.onDemandPresets.length) {
          reminder.onDemandPresets = deepClone(DEFAULT_CADENCE.reminders.breathwork.onDemandPresets);
        }
      }

      if (type === "dailyAudit") {
        reminder.nudgeTime = normalizeTime(base.reminders?.dailyAudit?.nudgeTime, DEFAULT_CADENCE.reminders.dailyAudit.nudgeTime);
        reminder.missedDayFallback = ["nextMorning", "nextWorkWindow", "skip"].includes(base.reminders?.dailyAudit?.missedDayFallback)
          ? base.reminders.dailyAudit.missedDayFallback
          : DEFAULT_CADENCE.reminders.dailyAudit.missedDayFallback;
      }

      normalized.reminders[type] = reminder;
    });

    return normalized;
  }

  function normalizeSettings(raw) {
    const rawSource = raw && typeof raw === "object" ? raw : {};
    const merged = {
      ...DEFAULT_SETTINGS,
      ...rawSource
    };

    merged.settingsVersion = 2;
    merged.filterPreset = normalizePresetId(merged.filterPreset);
    merged.filterIntensity = clamp(merged.filterIntensity, 0, 1);
    merged.filterEnabled = Boolean(merged.filterEnabled);
    merged.colorAccurate = Boolean(merged.colorAccurate);
    merged.overlayStrength = clamp(merged.overlayStrength, 0, 1);
    merged.filterDimming = clamp(merged.filterDimming, 0, 1);
    merged.filterContrast = clamp(merged.filterContrast, 0.35, 2.4);
    merged.filterSaturation = clamp(merged.filterSaturation, 0, 2.2);
    merged.filterGamma = clamp(merged.filterGamma, 0.5, 1.8);
    merged.overlayBlendMode = FILTER_BLEND_MODES.includes(merged.overlayBlendMode)
      ? merged.overlayBlendMode
      : DEFAULT_SETTINGS.overlayBlendMode;
    merged.overlayColorPreset = OVERLAY_COLOR_IDS.includes(merged.overlayColorPreset)
      ? merged.overlayColorPreset
      : DEFAULT_SETTINGS.overlayColorPreset;
    merged.overlayCustomColor = normalizeColorInput(merged.overlayCustomColor);
    merged.preserveLuminance = Boolean(merged.preserveLuminance);
    merged.applyToMedia = Boolean(merged.applyToMedia);
    merged.excludeMedia = Boolean(merged.excludeMedia);
    merged.designMode = Boolean(merged.designMode);
    merged.disabledDomains = parseDomainList((merged.disabledDomains || []).join(","));
    merged.distractorDomains = parseDomainList((merged.distractorDomains || []).join(","));
    merged.debugPanel = Boolean(merged.debugPanel);
    const rawUi = merged.ui && typeof merged.ui === "object" ? merged.ui : {};
    merged.ui = {
      showHud: Object.prototype.hasOwnProperty.call(rawUi, "showHud")
        ? Boolean(rawUi.showHud)
        : Boolean(DEFAULT_SETTINGS.ui.showHud)
    };
    merged.onboardingCompleted = Boolean(merged.onboardingCompleted);
    merged.reminderNotifications = Boolean(merged.reminderNotifications);
    merged.audioCues = Boolean(merged.audioCues);

    const hasSoundEnabled = Object.prototype.hasOwnProperty.call(rawSource, "soundEnabled");
    merged.soundEnabled = hasSoundEnabled
      ? Boolean(merged.soundEnabled)
      : Boolean(merged.soundEnabled || merged.audioCues);
    merged.masterVolume = clamp(Number(merged.masterVolume), 0, 1);
    merged.hoverEnabled = Boolean(merged.hoverEnabled);
    merged.reminderSoundsEnabled = Object.prototype.hasOwnProperty.call(rawSource, "reminderSoundsEnabled")
      ? Boolean(merged.reminderSoundsEnabled)
      : Boolean(DEFAULT_SETTINGS.reminderSoundsEnabled);
    merged.perEventMapping = normalizePerEventMapping(merged.perEventMapping);

    merged.speechCues = Boolean(merged.speechCues);
    merged.webcamPostureOptIn = Boolean(merged.webcamPostureOptIn);
    merged.devBypassPremium = Boolean(merged.devBypassPremium);

    merged.apiBaseUrl = String(merged.apiBaseUrl || "").trim();
    merged.entitlementUrl = String(merged.entitlementUrl || "").trim();
    merged.pairingExchangeUrl = String(merged.pairingExchangeUrl || "").trim();
    merged.pairingCodeCreateUrl = String(merged.pairingCodeCreateUrl || "").trim();
    merged.checkoutUrl = String(merged.checkoutUrl || "").trim();
    merged.dashboardUrl = String(merged.dashboardUrl || "").trim();
    merged.extensionToken = String(merged.extensionToken || "").trim();

    const normalizedOverrides = {};
    const rawOverrides = merged.siteOverrides && typeof merged.siteOverrides === "object" ? merged.siteOverrides : {};

    Object.entries(rawOverrides).forEach(([domain, override]) => {
      const safeDomain = normalizeDomain(domain);
      if (!safeDomain || !override || typeof override !== "object") {
        return;
      }
      const next = {};
      if (Object.prototype.hasOwnProperty.call(override, "enabled")) {
        next.enabled = Boolean(override.enabled);
      }
      if (Object.prototype.hasOwnProperty.call(override, "intensity") && override.intensity !== null && override.intensity !== "") {
        next.intensity = clamp(Number(override.intensity), 0, 1);
      }
      if (Object.prototype.hasOwnProperty.call(override, "preset") && override.preset) {
        next.preset = normalizePresetId(override.preset);
      }
      normalizedOverrides[safeDomain] = next;
    });

    merged.siteOverrides = normalizedOverrides;
    merged.cadence = normalizeCadence(merged.cadence, merged, rawSource);

    // Legacy compatibility fields used by older UI paths.
    merged.eyeBreakIntervalMin = merged.cadence.reminders.eye.schedule.intervalMin;
    merged.hydrationIntervalMin = merged.cadence.reminders.hydration.schedule.intervalMin;
    merged.stillnessThresholdMin = merged.cadence.reminders.posture.stillnessMinutes;
    merged.hydrationGoalGlasses = merged.cadence.reminders.hydration.dailyGoalGlasses;

    return merged;
  }

  function normalizeRuntime(rawRuntime) {
    const source = rawRuntime && typeof rawRuntime === "object" ? rawRuntime : {};
    const schedulerSource = source.scheduler && typeof source.scheduler === "object" ? source.scheduler : {};

    const scheduler = {
      ...deepClone(DEFAULT_RUNTIME.scheduler),
      ...schedulerSource,
      firedByType: { ...emptyReminderMap(0), ...(schedulerSource.firedByType || {}) },
      completedByType: { ...emptyReminderMap(0), ...(schedulerSource.completedByType || {}) },
      ignoredByType: { ...emptyReminderMap(0), ...(schedulerSource.ignoredByType || {}) },
      suppressedByType: { ...emptyReminderMap(0), ...(schedulerSource.suppressedByType || {}) },
      pendingByType: { ...emptyReminderMap(0), ...(schedulerSource.pendingByType || {}) },
      snoozedUntilByType: { ...emptyReminderMap(0), ...(schedulerSource.snoozedUntilByType || {}) }
    };

    REMINDER_TYPES.forEach((type) => {
      scheduler.firedByType[type] = Math.max(0, Number(scheduler.firedByType[type] || 0));
      scheduler.completedByType[type] = Math.max(0, Number(scheduler.completedByType[type] || 0));
      scheduler.ignoredByType[type] = Math.max(0, Number(scheduler.ignoredByType[type] || 0));
      scheduler.suppressedByType[type] = Math.max(0, Number(scheduler.suppressedByType[type] || 0));
      scheduler.pendingByType[type] = Math.max(0, Number(scheduler.pendingByType[type] || 0));
      scheduler.snoozedUntilByType[type] = Math.max(0, Number(scheduler.snoozedUntilByType[type] || 0));
    });

    return {
      ...deepClone(DEFAULT_RUNTIME),
      ...source,
      scheduler,
      lastActivityTs: Math.max(0, Number(source.lastActivityTs || Date.now()))
    };
  }

  function getSiteOverride(settings, hostname) {
    const safeHost = normalizeDomain(hostname);
    if (!safeHost) {
      return null;
    }

    const overrides = settings.siteOverrides || {};
    let matched = null;

    Object.entries(overrides).forEach(([domain, value]) => {
      if (!domainMatches(safeHost, domain)) {
        return;
      }
      if (!matched || domain.length > matched.domain.length) {
        matched = {
          domain,
          ...(value || {})
        };
      }
    });

    return matched;
  }

  function applyWarmth(channels, warmthAmount) {
    const warmth = clamp(warmthAmount, 0, 1);
    return {
      r: channels.r,
      g: channels.g * (1 - 0.12 * warmth),
      b: channels.b * (1 - 0.3 * warmth)
    };
  }

  function buildGrayscaleMatrix(intensity) {
    const amt = clamp(intensity, 0, 1);
    const red = 0.2126;
    const green = 0.7152;
    const blue = 0.0722;

    return [
      blend(1, red, amt), blend(0, green, amt), blend(0, blue, amt), 0, 0,
      blend(0, red, amt), blend(1, green, amt), blend(0, blue, amt), 0, 0,
      blend(0, red, amt), blend(0, green, amt), blend(1, blue, amt), 0, 0,
      0, 0, 0, 1, 0
    ];
  }

  function preserveLuminance(matrix, enabled) {
    if (!enabled) {
      return matrix;
    }

    const luma =
      0.2126 * (matrix[0] + matrix[1] + matrix[2]) +
      0.7152 * (matrix[5] + matrix[6] + matrix[7]) +
      0.0722 * (matrix[10] + matrix[11] + matrix[12]);

    if (!luma || !Number.isFinite(luma)) {
      return matrix;
    }

    const factor = clamp(1 / luma, 0.55, 1.8);
    const output = matrix.slice();
    [0, 1, 2, 5, 6, 7, 10, 11, 12].forEach((index) => {
      output[index] = output[index] * factor;
    });
    return output;
  }

  function buildMatrix(preset, intensity, preserveLum) {
    if (preset.grayscale) {
      return preserveLuminance(buildGrayscaleMatrix(intensity), preserveLum);
    }

    const warmed = applyWarmth(preset.channels, preset.warmth * intensity);
    const mix = preset.mix || { rg: 0, rb: 0, gr: 0, gb: 0, br: 0, bg: 0 };

    const matrix = [
      blend(1, warmed.r, intensity), mix.rg * intensity, mix.rb * intensity, 0, 0,
      mix.gr * intensity, blend(1, warmed.g, intensity), mix.gb * intensity, 0, 0,
      mix.br * intensity, mix.bg * intensity, blend(1, warmed.b, intensity), 0, 0,
      0, 0, 0, 1, 0
    ];

    return preserveLuminance(matrix, preserveLum);
  }

  function computeGammaAdjustment(gamma) {
    const safeGamma = clamp(gamma, 0.5, 1.8);
    const brightness = safeGamma > 1
      ? 1 - (safeGamma - 1) * 0.22
      : 1 + (1 - safeGamma) * 0.12;
    const contrast = 1 + (safeGamma - 1) * 0.35;

    return {
      brightness: clamp(brightness, 0.4, 1.2),
      contrast: clamp(contrast, 0.65, 1.35)
    };
  }

  function resolveOverlayColor(settings, preset) {
    const colorPreset = settings.overlayColorPreset === "custom"
      ? "custom"
      : settings.overlayColorPreset || preset.overlay.color || "amber";

    if (colorPreset === "custom") {
      return {
        name: "custom",
        ...settings.overlayCustomColor
      };
    }

    const fallback = OVERLAY_COLOR_PRESETS[preset.overlay.color] || OVERLAY_COLOR_PRESETS.amber;
    const known = OVERLAY_COLOR_PRESETS[colorPreset] || fallback;

    return {
      name: colorPreset,
      ...known
    };
  }

  function computeOverlay(settings, preset, intensity, enabled) {
    const color = resolveOverlayColor(settings, preset);
    const blendMode = FILTER_BLEND_MODES.includes(settings.overlayBlendMode)
      ? settings.overlayBlendMode
      : preset.overlay.blend;

    if (!enabled) {
      return {
        enabled: false,
        alpha: 0,
        blendMode,
        color,
        rgba: `rgba(${color.r}, ${color.g}, ${color.b}, 0.000)`
      };
    }

    const base = (preset.overlay.alpha || 0) * (0.35 + 0.65 * intensity);
    const manual = clamp(settings.overlayStrength, 0, 1) * 0.75;
    const dimPush = clamp(settings.filterDimming, 0, 1) * 0.12;
    const alpha = clamp(base + manual + dimPush, 0, 0.95);

    return {
      enabled: alpha > 0.001,
      alpha,
      blendMode,
      color,
      rgba: `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(3)})`
    };
  }

  function computeCssControls(settings, preset, intensity, circadian) {
    const gamma = computeGammaAdjustment((settings.filterGamma || 1) * (preset.css.gamma || 1));

    const baseBrightness = blend(1, preset.css.brightness, intensity);
    const baseContrast = blend(1, preset.css.contrast, intensity);
    const baseSaturation = blend(1, preset.css.saturation, intensity);

    const dimming = clamp(settings.filterDimming, 0, 1);
    const brightness = clamp(
      baseBrightness * (1 - dimming * 0.92) * gamma.brightness * (1 - circadian * 0.06),
      0.03,
      1.4
    );
    const contrast = clamp(baseContrast * (settings.filterContrast || 1) * gamma.contrast, 0.35, 2.4);
    const saturate = clamp(baseSaturation * (settings.filterSaturation || 1), 0, 2.2);

    return {
      brightness,
      contrast,
      saturate,
      filterString: `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)})`
    };
  }

  function isDomainDisabled(settings, hostname) {
    if (!hostname) return false;
    return (settings.disabledDomains || []).some((domain) => domainMatches(hostname, domain));
  }

  function getReminderConfig(settings, reminderType) {
    return settings.cadence?.reminders?.[reminderType] || DEFAULT_CADENCE.reminders[reminderType];
  }

  function reminderUsesPremiumMode(reminderConfig) {
    return reminderConfig.schedule.mode === "workBlocks" || reminderConfig.schedule.mode === "timeWindows";
  }

  function enforceFreeTierSettings(rawSettings, premium) {
    const settings = normalizeSettings(rawSettings);
    if (premium) {
      return settings;
    }

    REMINDER_TYPES.forEach((type) => {
      const reminder = settings.cadence.reminders[type];
      if (reminderUsesPremiumMode(reminder)) {
        reminder.schedule.mode = "interval";
      }
    });

    if (!FREE_FILTER_PRESET_IDS.includes(settings.filterPreset)) {
      settings.filterPreset = FREE_FILTER_PRESET_IDS[0];
    }

    settings.webcamPostureOptIn = false;
    settings.cadence.global.meetingModeAuto = false;
    return normalizeSettings(settings);
  }

  function computeFilterPayload(rawSettings, date = new Date(), hostname = "") {
    const settings = normalizeSettings(rawSettings);
    const safeHost = normalizeDomain(hostname);
    const override = getSiteOverride(settings, safeHost);

    const siteEnabledFromOverride = override && Object.prototype.hasOwnProperty.call(override, "enabled")
      ? Boolean(override.enabled)
      : true;

    const siteEnabled = siteEnabledFromOverride && !isDomainDisabled(settings, safeHost);

    const presetId = normalizePresetId(override?.preset || settings.filterPreset);
    const preset = getPresetById(presetId);

    const hasOverrideIntensity = Boolean(override && Object.prototype.hasOwnProperty.call(override, "intensity") && override.intensity !== null && override.intensity !== "");
    const baseIntensity = hasOverrideIntensity
      ? clamp(Number(override.intensity), 0, 1)
      : clamp(settings.filterIntensity, 0, 1);

    const circadian = circadianBoost(settings, date);
    const scheduleFloor = preset.group === "Max" ? 0.96 : preset.group === "Strong" ? 0.9 : 0.84;
    const circadianBlend = scheduleFloor + (1 - scheduleFloor) * circadian;
    const effectiveIntensity = clamp(baseIntensity * circadianBlend, 0, 1);

    const panicUntil = Number(settings.cadence?.global?.panicUntilTs || 0);
    const panicActive = panicUntil > date.getTime();

    const pipelineActive = settings.filterEnabled && !settings.colorAccurate && siteEnabled && !panicActive;

    const matrix = pipelineActive
      ? buildMatrix(preset, effectiveIntensity, settings.preserveLuminance)
      : [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0
      ];

    const css = computeCssControls(settings, preset, effectiveIntensity, circadian);
    const overlay = computeOverlay(settings, preset, effectiveIntensity, pipelineActive);

    const media = {
      applyToMedia: Boolean(settings.applyToMedia),
      excludeMedia: Boolean(settings.excludeMedia) && !settings.applyToMedia,
      designMode: Boolean(settings.designMode)
    };

    const reason = panicActive
      ? "PANIC_OFF"
      : !settings.filterEnabled
        ? "FILTERS_OFF"
        : settings.colorAccurate
          ? "COLOR_ACCURATE"
          : !siteEnabled
            ? "SITE_DISABLED"
            : "ACTIVE";

    return {
      active: pipelineActive,
      reason,
      presetId,
      presetLabel: preset.label,
      presetGroup: preset.group,
      intensity: baseIntensity,
      effectiveIntensity,
      circadian,
      matrix,
      matrixString: matrixToString(matrix),
      css,
      overlay,
      media,
      preserveLuminance: Boolean(settings.preserveLuminance),
      site: {
        hostname: safeHost,
        overrideDomain: override?.domain || null,
        overrideEnabled: override && Object.prototype.hasOwnProperty.call(override, "enabled") ? Boolean(override.enabled) : null,
        overrideIntensity: override && Object.prototype.hasOwnProperty.call(override, "intensity") ? override.intensity : null,
        enabled: siteEnabled
      },
      settingsSnapshot: settings,
      debug: {
        mode: preset.label,
        blendMode: overlay.blendMode,
        overlayRgba: overlay.rgba,
        mediaExcluded: media.excludeMedia
      }
    };
  }

  function computeHydrationStreak(hydrationByDate) {
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = todayKey(cursor);
      if (!hydrationByDate[key] || hydrationByDate[key] <= 0) {
        break;
      }
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function setSiteOverride(settings, domain, patch) {
    const normalized = normalizeSettings(settings);
    const safeDomain = normalizeDomain(domain);
    if (!safeDomain) {
      return normalized;
    }

    const current = normalized.siteOverrides[safeDomain] || {};
    const next = {
      ...current,
      ...(patch || {})
    };

    if (Object.prototype.hasOwnProperty.call(next, "intensity") && next.intensity !== null && next.intensity !== "") {
      next.intensity = clamp(next.intensity, 0, 1);
    }

    if (Object.prototype.hasOwnProperty.call(next, "preset") && next.preset) {
      next.preset = normalizePresetId(next.preset);
    }

    const siteOverrides = {
      ...normalized.siteOverrides,
      [safeDomain]: next
    };

    return normalizeSettings({
      ...normalized,
      siteOverrides,
      disabledDomains: (normalized.disabledDomains || []).filter((item) => item !== safeDomain)
    });
  }

  function clearSiteOverride(settings, domain) {
    const normalized = normalizeSettings(settings);
    const safeDomain = normalizeDomain(domain);
    if (!safeDomain) {
      return normalized;
    }

    const siteOverrides = { ...normalized.siteOverrides };
    delete siteOverrides[safeDomain];

    return normalizeSettings({
      ...normalized,
      siteOverrides
    });
  }

  function isWithinTimeWindows(windows, date = new Date()) {
    const safe = Array.isArray(windows) ? windows : [];
    if (!safe.length) {
      return true;
    }

    const now = minutesSinceMidnight(date);
    return safe.some((windowDef) => inWindow(now, parseClock(windowDef.start), parseClock(windowDef.end)));
  }

  function isQuietHours(settings, date = new Date()) {
    const global = settings.cadence?.global || DEFAULT_CADENCE.global;
    return inWindow(minutesSinceMidnight(date), parseClock(global.quietHoursStart), parseClock(global.quietHoursEnd));
  }

  function jitterInterval(intervalMin, jitterMin, seed) {
    const safeInterval = Math.max(1, Math.round(intervalMin));
    const safeJitter = Math.max(0, Math.min(3, Math.round(jitterMin)));
    if (!safeJitter) return safeInterval;

    const noise = Math.sin(seed * 0.001) * 10000;
    const unit = noise - Math.floor(noise);
    const span = safeJitter * 2 + 1;
    const offset = Math.floor(unit * span) - safeJitter;
    return Math.max(1, safeInterval + offset);
  }

  function nextFromInterval(schedule, nowTs, lastTriggeredAt) {
    const minutes = jitterInterval(schedule.intervalMin, schedule.jitterMin, lastTriggeredAt || nowTs);
    const base = lastTriggeredAt > 0 ? Math.max(lastTriggeredAt, nowTs) : nowTs;
    return base + minutes * 60 * 1000;
  }

  function nextFromWorkBlocks(schedule, nowDate) {
    const workMin = Math.max(15, Number(schedule.workMin || 50));
    const breakMin = Math.max(5, Number(schedule.breakMin || 10));
    const cycleMin = workMin + breakMin;

    const anchor = new Date(nowDate);
    const [h = "9", m = "0"] = String(schedule.anchorTime || "09:00").split(":");
    anchor.setHours(Number(h), Number(m), 0, 0);
    while (anchor.getTime() > nowDate.getTime()) {
      anchor.setDate(anchor.getDate() - 1);
    }

    const elapsedMin = Math.floor((nowDate.getTime() - anchor.getTime()) / 60000);
    const cycleOffset = ((elapsedMin % cycleMin) + cycleMin) % cycleMin;

    if (cycleOffset >= workMin) {
      return nowDate.getTime() + 60 * 1000;
    }

    const untilBreak = workMin - cycleOffset;
    return nowDate.getTime() + untilBreak * 60 * 1000;
  }

  function alignToWindowStart(nowDate, startClock) {
    const aligned = new Date(nowDate);
    const [h = "9", m = "0"] = String(startClock || "09:00").split(":");
    aligned.setHours(Number(h), Number(m), 0, 0);
    if (aligned.getTime() <= nowDate.getTime()) {
      aligned.setDate(aligned.getDate() + 1);
    }
    return aligned.getTime();
  }

  function nextFromTimeWindows(schedule, nowDate, lastTriggeredAt) {
    const windows = schedule.windows || [];
    if (!windows.length) {
      return nextFromInterval(schedule, nowDate.getTime(), lastTriggeredAt);
    }

    const nowMin = minutesSinceMidnight(nowDate);
    for (const windowDef of windows) {
      const start = parseClock(windowDef.start);
      const end = parseClock(windowDef.end);
      if (inWindow(nowMin, start, end)) {
        return nextFromInterval(schedule, nowDate.getTime(), lastTriggeredAt);
      }
      if (start > nowMin) {
        return alignToWindowStart(nowDate, windowDef.start);
      }
    }

    return alignToWindowStart(nowDate, windows[0].start);
  }

  function computeNextReminderAt(rawSettings, rawRuntime, reminderType, date = new Date()) {
    const settings = normalizeSettings(rawSettings);
    const runtime = normalizeRuntime(rawRuntime);
    const reminder = getReminderConfig(settings, reminderType);

    if (!reminder?.enabled) {
      return null;
    }

    const nowTs = date.getTime();
    const snoozeUntil = Number(runtime.scheduler?.snoozedUntilByType?.[reminderType] || 0);
    if (snoozeUntil > nowTs) {
      return snoozeUntil;
    }

    const globalSnooze = Number(settings.cadence?.global?.snoozeAllUntilTs || 0);
    if (globalSnooze > nowTs) {
      return globalSnooze;
    }

    const lastTriggeredAt = Number(runtime.scheduler?.lastTriggeredByType?.[reminderType] || 0);
    const schedule = reminder.schedule;

    if (schedule.mode === "workBlocks") {
      return nextFromWorkBlocks(schedule, date);
    }

    if (schedule.mode === "timeWindows") {
      return nextFromTimeWindows(schedule, date, lastTriggeredAt);
    }

    return nextFromInterval(schedule, nowTs, lastTriggeredAt);
  }

  function getNextReminderSnapshot(rawSettings, rawRuntime, date = new Date()) {
    const settings = normalizeSettings(rawSettings);
    const runtime = normalizeRuntime(rawRuntime);

    let nextType = null;
    let nextAt = 0;

    REMINDER_TYPES.forEach((type) => {
      const candidate = computeNextReminderAt(settings, runtime, type, date);
      if (!candidate) {
        return;
      }
      if (!nextAt || candidate < nextAt) {
        nextAt = candidate;
        nextType = type;
      }
    });

    return {
      type: nextType,
      at: nextAt,
      countdown: nextAt ? formatCountdown(nextAt - date.getTime()) : null
    };
  }

  function reminderSuppressedByQuietHours(settings, reminderType, date = new Date()) {
    const reminder = getReminderConfig(settings, reminderType);
    if (reminderType === "hydration" && reminder.quietHoursOverride) {
      return false;
    }
    return isQuietHours(settings, date);
  }

  function isMeetingDomain(settings, hostname) {
    const domain = normalizeDomain(hostname);
    if (!domain) {
      return false;
    }
    return (settings.cadence?.global?.meetingDomains || []).some((candidate) => domainMatches(domain, candidate));
  }

  function applyCadencePreset(rawSettings, presetId) {
    const settings = normalizeSettings(rawSettings);
    const cadence = deepClone(settings.cadence);

    const use = {
      balanced() {
        cadence.reminders.eye.schedule.mode = "interval";
        cadence.reminders.eye.schedule.intervalMin = 20;
        cadence.reminders.movement.schedule.mode = "interval";
        cadence.reminders.movement.schedule.intervalMin = 45;
        cadence.reminders.posture.schedule.mode = "interval";
        cadence.reminders.posture.schedule.intervalMin = 40;
        cadence.reminders.hydration.schedule.mode = "interval";
        cadence.reminders.hydration.schedule.intervalMin = 60;
        cadence.reminders.breathwork.schedule.mode = "timeWindows";
        cadence.reminders.dailyAudit.schedule.mode = "timeWindows";
      },
      deepWork() {
        cadence.reminders.eye.schedule.mode = "workBlocks";
        cadence.reminders.eye.schedule.workMin = 50;
        cadence.reminders.eye.schedule.breakMin = 10;
        cadence.reminders.movement.schedule.mode = "workBlocks";
        cadence.reminders.posture.schedule.mode = "workBlocks";
        cadence.reminders.hydration.schedule.mode = "interval";
        cadence.reminders.hydration.schedule.intervalMin = 90;
        cadence.reminders.breathwork.delivery.gentle = true;
        cadence.global.suppressDuringFocus = true;
      },
      highStrain() {
        cadence.reminders.eye.schedule.mode = "interval";
        cadence.reminders.eye.schedule.intervalMin = 15;
        cadence.reminders.eye.schedule.jitterMin = 1;
        cadence.reminders.eye.delivery.notification = true;
        cadence.reminders.eye.delivery.overlay = true;
        cadence.reminders.movement.schedule.intervalMin = 35;
        cadence.reminders.posture.schedule.intervalMin = 30;
        cadence.reminders.hydration.schedule.intervalMin = 45;
      },
      gentle() {
        REMINDER_TYPES.forEach((type) => {
          cadence.reminders[type].delivery.notification = false;
          cadence.reminders[type].delivery.gentle = true;
          cadence.reminders[type].delivery.overlay = true;
          cadence.reminders[type].delivery.popupOnly = false;
        });
        cadence.reminders.eye.schedule.intervalMin = 30;
        cadence.reminders.hydration.schedule.intervalMin = 90;
      },
      night() {
        cadence.reminders.eye.schedule.intervalMin = 30;
        cadence.reminders.movement.schedule.intervalMin = 60;
        cadence.reminders.hydration.schedule.intervalMin = 90;
        cadence.reminders.breathwork.delivery.gentle = true;
        cadence.reminders.dailyAudit.nudgeTime = "20:30";
      }
    };

    if (use[presetId]) {
      use[presetId]();
      cadence.activeProfile = presetId;
    }

    const next = {
      ...settings,
      cadence
    };

    if (presetId === "night") {
      next.filterPreset = "nightWarmMax";
      next.filterIntensity = 0.9;
    }

    return normalizeSettings(next);
  }

  function buildTimelinePreview(rawSettings, startClock = "09:00", endClock = "18:00", date = new Date()) {
    const settings = normalizeSettings(rawSettings);
    const startMin = parseClock(startClock);
    const endMin = parseClock(endClock);

    const start = new Date(date);
    start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

    const end = new Date(date);
    end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
    if (end.getTime() <= start.getTime()) {
      end.setDate(end.getDate() + 1);
    }

    const runtime = normalizeRuntime({});
    const events = [];

    REMINDER_TYPES.forEach((type) => {
      let cursor = start.getTime();
      let guard = 0;
      runtime.scheduler.lastTriggeredByType[type] = 0;

      while (cursor < end.getTime() && guard < 10) {
        const nextAt = computeNextReminderAt(settings, runtime, type, new Date(cursor));
        if (!nextAt || nextAt > end.getTime()) {
          break;
        }

        runtime.scheduler.lastTriggeredByType[type] = nextAt;
        events.push({
          type,
          at: nextAt,
          label: REMINDER_LABELS[type] || type
        });

        cursor = nextAt + 60 * 1000;
        guard += 1;
      }
    });

    return events.sort((a, b) => a.at - b.at);
  }

  function summarizeReminderStats(rawRuntime, date = new Date()) {
    const runtime = normalizeRuntime(rawRuntime);
    const today = todayKey(date);
    if (runtime.scheduler.today !== today) {
      return {
        scheduled: emptyReminderMap(0),
        completed: emptyReminderMap(0),
        ignored: emptyReminderMap(0),
        suppressed: emptyReminderMap(0),
        totalScheduled: 0,
        totalCompleted: 0
      };
    }

    const summary = {
      scheduled: deepClone(runtime.scheduler.firedByType),
      completed: deepClone(runtime.scheduler.completedByType),
      ignored: deepClone(runtime.scheduler.ignoredByType),
      suppressed: deepClone(runtime.scheduler.suppressedByType),
      totalScheduled: 0,
      totalCompleted: 0
    };

    REMINDER_TYPES.forEach((type) => {
      summary.totalScheduled += Number(summary.scheduled[type] || 0);
      summary.totalCompleted += Number(summary.completed[type] || 0);
    });

    return summary;
  }

  globalThis.HolmetaCommon = {
    DEFAULT_SETTINGS,
    DEFAULT_RUNTIME,
    FILTER_BLEND_MODES,
    FILTER_PRESET_OPTIONS,
    FREE_FILTER_PRESET_IDS,
    OVERLAY_COLOR_PRESETS,
    LEGACY_PRESET_ALIASES,
    REMINDER_TYPES,
    CADENCE_MODES,
    CADENCE_PRESET_OPTIONS,
    REMINDER_LABELS,
    SFX_SOUND_OPTIONS,
    SFX_SOUND_KEYS,
    SFX_EVENT_OPTIONS,
    DEFAULT_SFX_EVENT_MAPPING,
    DELIVERY_DEFAULT,
    clamp,
    blend,
    parseClock,
    todayKey,
    minutesSinceMidnight,
    circadianBoost,
    normalizeDomain,
    domainMatches,
    parseDomainList,
    parseHttpUrl,
    normalizeHttpUrl,
    formatMinutes,
    formatCountdown,
    matrixToString,
    normalizeSettings,
    normalizeRuntime,
    normalizePresetId,
    getPresetById,
    getSiteOverride,
    getReminderConfig,
    computeFilterPayload,
    computeNextReminderAt,
    getNextReminderSnapshot,
    reminderSuppressedByQuietHours,
    isWithinTimeWindows,
    isQuietHours,
    isMeetingDomain,
    applyCadencePreset,
    buildTimelinePreview,
    summarizeReminderStats,
    reminderUsesPremiumMode,
    enforceFreeTierSettings,
    setSiteOverride,
    clearSiteOverride,
    resolveDashboardUrl,
    openExternal,
    resolveSfxKeyForEvent,
    computeHydrationStreak,
    emptyReminderMap
  };
})();
