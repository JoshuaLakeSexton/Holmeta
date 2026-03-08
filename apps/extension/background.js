// HOLMETA v3.0 service worker (Manifest V3)
// - Local-only storage
// - DNR-based blocking
// - Alarm-driven reminders/timers
// - Safe migration + versioning
// - Premium placeholders stored locally (future server validation hook documented)

const STORAGE_KEY = "holmeta.v3.state";
const LEGACY_KEYS = ["holmeta.v2.state", "holmeta.settings", "holmeta.v3"];
const VERSION = "3.0.0";
const SCHEMA_VERSION = 3;
const LOG_LIMIT = 500;
const DOMAIN_LIMIT = 600;
const SITE_INSIGHT_CACHE_LIMIT = 320;
const SITE_INSIGHT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SITE_INSIGHT_THROTTLE_MS = 10 * 1000;

const ALARMS = {
  HEALTH: "holmeta-v3-health-alert",
  DEEPWORK: "holmeta-v3-deepwork-transition",
  HEARTBEAT: "holmeta-v3-heartbeat"
};

const DNR_IDS = {
  BASE: 8000,
  NUCLEAR_CATCH_ALL: 8999
};

let memoryState = null;

function now() {
  return Date.now();
}

function toDayKey(ts = now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeHost(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  const cleaned = raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
  if (!cleaned || cleaned.includes(" ")) return "";
  return cleaned;
}

function normalizeDomainList(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(normalizeHost).filter(Boolean))].slice(0, DOMAIN_LIMIT);
}

function normalizeTime(value, fallback) {
  const v = String(value || "").trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v) ? v : fallback;
}

function hhmmToMinutes(value) {
  const [h, m] = String(value || "00:00").split(":").map((n) => Number(n || 0));
  return h * 60 + m;
}

function inTimeRange(start, end, date = new Date()) {
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  const cur = date.getHours() * 60 + date.getMinutes();
  if (s === e) return true;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e;
}

function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      version: VERSION,
      installedAt: now(),
      lastSeenAt: now(),
      onboarded: false,
      debug: false,
      sessionCount: 0,
      lastRatePromptAt: 0,
      ratePromptDismissedUntil: 0,
      lastMigrationFrom: null
    },
    license: {
      premium: false,
      key: "",
      lastValidatedAt: 0
    },
    settings: {
      light: {
        enabled: false,
        mode: "warm", // warm | red_overlay | red_mono | red_lock | gray_warm | dim | spotlight
        intensity: 45,
        dim: 18,
        contrastSoft: 8,
        brightness: 96,
        reduceWhites: true,
        videoSafe: false,
        spotlightEnabled: false,
        therapyMode: false,
        therapyMinutes: 3,
        therapyCadence: "gentle", // slow | medium | gentle
        schedule: {
          enabled: false,
          start: "20:00",
          end: "06:00",
          useSunset: false,
          rampMinutes: 45,
          quickPreset: "custom" // custom | evening | workday | late_night
        },
        excludedHosts: [],
        siteProfiles: {}
      },
      blocker: {
        enabled: false,
        nuclear: false,
        activationMode: "always", // always | deep_work | schedule
        blockedDomains: [],
        allowDomains: ["docs.google.com", "notion.so", "github.com"],
        schedule: {
          enabled: false,
          start: "09:00",
          end: "17:30",
          days: [1, 2, 3, 4, 5]
        },
        pausedUntil: 0,
        passwordHash: ""
      },
      alerts: {
        enabled: false,
        frequencyMin: 45,
        soundEnabled: true,
        snoozeUntil: 0,
        types: {
          eye: true,
          posture: true,
          burnout: true
        }
      },
      siteInsight: {
        enabled: true,
        showOnEverySite: true,
        durationMs: 8000,
        autoMinimize: true,
        minimizedPill: true,
        selectedProfile: "regular", // regular | dev | design | uxr
        enabledProfiles: {
          regular: true,
          dev: true,
          design: true,
          uxr: true
        },
        perSiteDisabled: {},
        showAlgorithmLabel: true,
        showPurposeSummary: true
      },
      deepWork: {
        active: false,
        phase: "focus",
        focusMin: 25,
        breakMin: 5,
        startedAt: 0,
        nextTransitionAt: 0,
        autoBlocker: true,
        autoLight: true
      },
      advanced: {
        biofeedback: false,
        morphing: false,
        taskWeaver: false,
        dashboardPredictions: false,
        collaborativeSync: false
      }
    },
    stats: {
      daily: {},
      focusSessions: [],
      alertsFired: 0,
      blockEvents: 0,
      lightUsageMinutes: 0,
      blockerUsageMinutes: 0
    },
    runtime: {
      dynamicRuleIds: [],
      lastAlertCursor: 0,
      lastHeartbeatAt: 0
    },
    cache: {
      siteInsight: {}
    },
    logs: []
  };
}

function shouldDebug(state) {
  return Boolean(state?.meta?.debug);
}

function log(state, level, event, data = {}) {
  const entry = {
    ts: now(),
    level,
    event,
    data
  };
  state.logs.push(entry);
  if (state.logs.length > LOG_LIMIT) {
    state.logs = state.logs.slice(-LOG_LIMIT);
  }
  if (shouldDebug(state) || level === "error") {
    const prefix = `[Holmeta:${level}]`;
    if (level === "error") console.error(prefix, event, data);
    else console.info(prefix, event, data);
  }
}

function ensureDailyStats(state, key = toDayKey()) {
  if (!state.stats.daily[key]) {
    state.stats.daily[key] = {
      focusMinutes: 0,
      alerts: 0,
      blocks: 0,
      lightMinutes: 0,
      blockerMinutes: 0
    };
  }
  return state.stats.daily[key];
}

function incrementDaily(state, field, amount) {
  const daily = ensureDailyStats(state);
  daily[field] = Math.max(0, Number(daily[field] || 0) + Number(amount || 0));
}

function normalizeState(input) {
  const base = createDefaultState();
  const raw = input && typeof input === "object" ? input : {};

  const merged = {
    ...base,
    ...raw,
    meta: { ...base.meta, ...(raw.meta || {}) },
    license: { ...base.license, ...(raw.license || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    stats: { ...base.stats, ...(raw.stats || {}) },
    runtime: { ...base.runtime, ...(raw.runtime || {}) },
    cache: { ...base.cache, ...(raw.cache || {}) }
  };

  merged.schemaVersion = SCHEMA_VERSION;
  merged.meta.version = VERSION;
  merged.meta.lastSeenAt = now();
  merged.meta.sessionCount = Math.max(0, Number(merged.meta.sessionCount || 0));
  merged.meta.lastRatePromptAt = Math.max(0, Number(merged.meta.lastRatePromptAt || 0));
  merged.meta.ratePromptDismissedUntil = Math.max(0, Number(merged.meta.ratePromptDismissedUntil || 0));

  merged.license.premium = Boolean(merged.license.premium);
  merged.license.key = String(merged.license.key || "").slice(0, 120);
  merged.license.lastValidatedAt = Math.max(0, Number(merged.license.lastValidatedAt || 0));

  merged.settings.light = {
    ...base.settings.light,
    ...(merged.settings.light || {}),
    schedule: {
      ...base.settings.light.schedule,
      ...(merged.settings.light?.schedule || {})
    }
  };
  if (merged.settings.light.mode === "red") {
    merged.settings.light.mode = "red_overlay";
  }
  merged.settings.light.mode = ["warm", "red_overlay", "red_mono", "red_lock", "gray_warm", "dim", "spotlight"].includes(merged.settings.light.mode)
    ? merged.settings.light.mode
    : "warm";
  merged.settings.light.intensity = Math.round(clamp(merged.settings.light.intensity, 0, 100));
  merged.settings.light.dim = Math.round(clamp(merged.settings.light.dim, 0, 60));
  merged.settings.light.contrastSoft = Math.round(clamp(merged.settings.light.contrastSoft, 0, 30));
  merged.settings.light.brightness = Math.round(clamp(merged.settings.light.brightness, 70, 120));
  merged.settings.light.reduceWhites = Boolean(merged.settings.light.reduceWhites);
  merged.settings.light.videoSafe = Boolean(merged.settings.light.videoSafe);
  merged.settings.light.spotlightEnabled = Boolean(merged.settings.light.spotlightEnabled);
  merged.settings.light.therapyMode = Boolean(merged.settings.light.therapyMode);
  merged.settings.light.therapyMinutes = Math.round(clamp(merged.settings.light.therapyMinutes, 1, 20));
  merged.settings.light.therapyCadence = ["slow", "medium", "gentle"].includes(merged.settings.light.therapyCadence)
    ? merged.settings.light.therapyCadence
    : "gentle";
  merged.settings.light.schedule.enabled = Boolean(merged.settings.light.schedule.enabled);
  merged.settings.light.schedule.start = normalizeTime(merged.settings.light.schedule.start, "20:00");
  merged.settings.light.schedule.end = normalizeTime(merged.settings.light.schedule.end, "06:00");
  merged.settings.light.schedule.useSunset = Boolean(merged.settings.light.schedule.useSunset);
  merged.settings.light.schedule.rampMinutes = Math.round(clamp(merged.settings.light.schedule.rampMinutes, 0, 120));
  merged.settings.light.schedule.quickPreset = ["custom", "evening", "workday", "late_night"].includes(merged.settings.light.schedule.quickPreset)
    ? merged.settings.light.schedule.quickPreset
    : "custom";
  merged.settings.light.excludedHosts = normalizeDomainList(merged.settings.light.excludedHosts);
  merged.settings.light.siteProfiles = merged.settings.light.siteProfiles && typeof merged.settings.light.siteProfiles === "object"
    ? Object.fromEntries(
        Object.entries(merged.settings.light.siteProfiles)
          .map(([host, profile]) => [normalizeHost(host), profile])
          .filter(([host]) => Boolean(host))
      )
    : {};

  merged.settings.blocker = {
    ...base.settings.blocker,
    ...(merged.settings.blocker || {}),
    schedule: {
      ...base.settings.blocker.schedule,
      ...(merged.settings.blocker?.schedule || {})
    }
  };
  merged.settings.blocker.enabled = Boolean(merged.settings.blocker.enabled);
  merged.settings.blocker.nuclear = Boolean(merged.settings.blocker.nuclear);
  merged.settings.blocker.activationMode = ["always", "deep_work", "schedule"].includes(merged.settings.blocker.activationMode)
    ? merged.settings.blocker.activationMode
    : "always";
  merged.settings.blocker.blockedDomains = normalizeDomainList(merged.settings.blocker.blockedDomains);
  merged.settings.blocker.allowDomains = normalizeDomainList(merged.settings.blocker.allowDomains);
  merged.settings.blocker.schedule.enabled = Boolean(merged.settings.blocker.schedule.enabled);
  merged.settings.blocker.schedule.start = normalizeTime(merged.settings.blocker.schedule.start, "09:00");
  merged.settings.blocker.schedule.end = normalizeTime(merged.settings.blocker.schedule.end, "17:30");
  merged.settings.blocker.schedule.days = Array.isArray(merged.settings.blocker.schedule.days)
    ? merged.settings.blocker.schedule.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : [1, 2, 3, 4, 5];
  merged.settings.blocker.pausedUntil = Math.max(0, Number(merged.settings.blocker.pausedUntil || 0));

  merged.settings.alerts = {
    ...base.settings.alerts,
    ...(merged.settings.alerts || {}),
    types: {
      ...base.settings.alerts.types,
      ...(merged.settings.alerts?.types || {})
    }
  };
  merged.settings.alerts.enabled = Boolean(merged.settings.alerts.enabled);
  merged.settings.alerts.frequencyMin = Math.round(clamp(merged.settings.alerts.frequencyMin, 20, 180));
  merged.settings.alerts.soundEnabled = Boolean(merged.settings.alerts.soundEnabled);
  merged.settings.alerts.snoozeUntil = Math.max(0, Number(merged.settings.alerts.snoozeUntil || 0));
  merged.settings.alerts.types.eye = Boolean(merged.settings.alerts.types.eye);
  merged.settings.alerts.types.posture = Boolean(merged.settings.alerts.types.posture);
  merged.settings.alerts.types.burnout = Boolean(merged.settings.alerts.types.burnout);

  merged.settings.siteInsight = {
    ...base.settings.siteInsight,
    ...(merged.settings.siteInsight || {}),
    enabledProfiles: {
      ...base.settings.siteInsight.enabledProfiles,
      ...(merged.settings.siteInsight?.enabledProfiles || {})
    }
  };
  merged.settings.siteInsight.enabled = Boolean(merged.settings.siteInsight.enabled);
  merged.settings.siteInsight.showOnEverySite = Boolean(merged.settings.siteInsight.showOnEverySite);
  merged.settings.siteInsight.durationMs = Math.round(clamp(merged.settings.siteInsight.durationMs, 6000, 10000));
  merged.settings.siteInsight.autoMinimize = Boolean(merged.settings.siteInsight.autoMinimize);
  merged.settings.siteInsight.minimizedPill = Boolean(merged.settings.siteInsight.minimizedPill);
  merged.settings.siteInsight.selectedProfile = ["regular", "dev", "design", "uxr"].includes(merged.settings.siteInsight.selectedProfile)
    ? merged.settings.siteInsight.selectedProfile
    : "regular";
  merged.settings.siteInsight.showAlgorithmLabel = Boolean(merged.settings.siteInsight.showAlgorithmLabel);
  merged.settings.siteInsight.showPurposeSummary = Boolean(merged.settings.siteInsight.showPurposeSummary);
  merged.settings.siteInsight.enabledProfiles = {
    regular: Boolean(merged.settings.siteInsight.enabledProfiles.regular),
    dev: Boolean(merged.settings.siteInsight.enabledProfiles.dev),
    design: Boolean(merged.settings.siteInsight.enabledProfiles.design),
    uxr: Boolean(merged.settings.siteInsight.enabledProfiles.uxr)
  };
  merged.settings.siteInsight.perSiteDisabled = merged.settings.siteInsight.perSiteDisabled && typeof merged.settings.siteInsight.perSiteDisabled === "object"
    ? Object.fromEntries(
        Object.entries(merged.settings.siteInsight.perSiteDisabled)
          .map(([host, value]) => [normalizeHost(host), Boolean(value)])
          .filter(([host, value]) => Boolean(host) && value)
      )
    : {};
  if (!merged.settings.siteInsight.enabledProfiles[merged.settings.siteInsight.selectedProfile]) {
    const fallback = ["regular", "dev", "design", "uxr"].find((key) => merged.settings.siteInsight.enabledProfiles[key]) || "regular";
    merged.settings.siteInsight.selectedProfile = fallback;
  }

  merged.settings.deepWork = {
    ...base.settings.deepWork,
    ...(merged.settings.deepWork || {})
  };
  merged.settings.deepWork.active = Boolean(merged.settings.deepWork.active);
  merged.settings.deepWork.phase = merged.settings.deepWork.phase === "break" ? "break" : "focus";
  merged.settings.deepWork.focusMin = Math.round(clamp(merged.settings.deepWork.focusMin, 10, 180));
  merged.settings.deepWork.breakMin = Math.round(clamp(merged.settings.deepWork.breakMin, 3, 45));
  merged.settings.deepWork.startedAt = Math.max(0, Number(merged.settings.deepWork.startedAt || 0));
  merged.settings.deepWork.nextTransitionAt = Math.max(0, Number(merged.settings.deepWork.nextTransitionAt || 0));
  merged.settings.deepWork.autoBlocker = Boolean(merged.settings.deepWork.autoBlocker);
  merged.settings.deepWork.autoLight = Boolean(merged.settings.deepWork.autoLight);

  merged.settings.advanced = {
    ...base.settings.advanced,
    ...(merged.settings.advanced || {})
  };

  // Premium gate enforcement in logic (not just UI)
  if (!merged.license.premium) {
    merged.settings.advanced.biofeedback = false;
    merged.settings.advanced.morphing = false;
    merged.settings.advanced.taskWeaver = false;
    merged.settings.advanced.dashboardPredictions = false;
    merged.settings.advanced.collaborativeSync = false;
  } else {
    merged.settings.advanced.biofeedback = Boolean(merged.settings.advanced.biofeedback);
    merged.settings.advanced.morphing = Boolean(merged.settings.advanced.morphing);
    merged.settings.advanced.taskWeaver = Boolean(merged.settings.advanced.taskWeaver);
    merged.settings.advanced.dashboardPredictions = Boolean(merged.settings.advanced.dashboardPredictions);
    merged.settings.advanced.collaborativeSync = Boolean(merged.settings.advanced.collaborativeSync);
  }

  merged.stats.daily = merged.stats.daily && typeof merged.stats.daily === "object" ? merged.stats.daily : {};
  merged.stats.focusSessions = Array.isArray(merged.stats.focusSessions) ? merged.stats.focusSessions.slice(-500) : [];
  merged.stats.alertsFired = Math.max(0, Number(merged.stats.alertsFired || 0));
  merged.stats.blockEvents = Math.max(0, Number(merged.stats.blockEvents || 0));
  merged.stats.lightUsageMinutes = Math.max(0, Number(merged.stats.lightUsageMinutes || 0));
  merged.stats.blockerUsageMinutes = Math.max(0, Number(merged.stats.blockerUsageMinutes || 0));

  merged.runtime.dynamicRuleIds = Array.isArray(merged.runtime.dynamicRuleIds)
    ? merged.runtime.dynamicRuleIds.map(Number).filter((n) => Number.isInteger(n))
    : [];
  merged.runtime.lastAlertCursor = Math.max(0, Number(merged.runtime.lastAlertCursor || 0));
  merged.runtime.lastHeartbeatAt = Math.max(0, Number(merged.runtime.lastHeartbeatAt || 0));

  const rawInsightCache = merged.cache?.siteInsight && typeof merged.cache.siteInsight === "object" ? merged.cache.siteInsight : {};
  const cacheRows = Object.entries(rawInsightCache)
    .map(([host, value]) => [normalizeHost(host), value])
    .filter(([host]) => Boolean(host))
    .map(([host, value]) => ({
      host,
      computedAt: Math.max(0, Number(value?.computedAt || 0)),
      summaryData: value?.summaryData && typeof value.summaryData === "object" ? value.summaryData : null
    }))
    .filter((entry) => entry.summaryData && entry.computedAt > 0 && now() - entry.computedAt < SITE_INSIGHT_CACHE_TTL_MS)
    .sort((a, b) => b.computedAt - a.computedAt)
    .slice(0, SITE_INSIGHT_CACHE_LIMIT);
  merged.cache.siteInsight = Object.fromEntries(cacheRows.map((entry) => [entry.host, { computedAt: entry.computedAt, summaryData: entry.summaryData }]));

  if (!Array.isArray(merged.logs)) merged.logs = [];
  merged.logs = merged.logs.slice(-LOG_LIMIT);

  return merged;
}

function mergeDeep(target, source) {
  if (!source || typeof source !== "object") return target;
  const out = Array.isArray(target) ? [...target] : { ...(target || {}) };
  Object.keys(source).forEach((key) => {
    const src = source[key];
    if (Array.isArray(src)) out[key] = [...src];
    else if (src && typeof src === "object") out[key] = mergeDeep(out[key], src);
    else out[key] = src;
  });
  return out;
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(payload) {
  return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}

function tabsQuery(query) {
  return new Promise((resolve) => chrome.tabs.query(query, resolve));
}

function tabsCreate(opts) {
  return new Promise((resolve) => chrome.tabs.create(opts, resolve));
}

function sendTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (res) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "send_failed" });
        return;
      }
      resolve({ ok: true, res });
    });
  });
}

function updateDynamicRules(payload) {
  return new Promise((resolve) => {
    chrome.declarativeNetRequest.updateDynamicRules(payload, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "dnr_failed" });
        return;
      }
      resolve({ ok: true });
    });
  });
}

function alarmCreate(name, info) {
  chrome.alarms.create(name, info);
}

function alarmClear(name) {
  return new Promise((resolve) => chrome.alarms.clear(name, () => resolve()));
}

function notificationCreate(id, options) {
  return new Promise((resolve) => chrome.notifications.create(id, options, () => resolve()));
}

function hashText(input) {
  const text = String(input || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function shouldShowRatePrompt(state) {
  const ageMs = now() - Number(state.meta.installedAt || now());
  const isOldEnough = ageMs >= 7 * 24 * 60 * 60 * 1000;
  const enoughSessions = Number(state.meta.sessionCount || 0) >= 10;
  const dismissed = Number(state.meta.ratePromptDismissedUntil || 0) > now();
  return !dismissed && (isOldEnough || enoughSessions);
}

function getSiteInsightCacheEntry(state, host) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return null;
  const entry = state.cache?.siteInsight?.[normalizedHost];
  if (!entry) return null;
  const computedAt = Math.max(0, Number(entry.computedAt || 0));
  if (!computedAt || now() - computedAt > SITE_INSIGHT_CACHE_TTL_MS) {
    delete state.cache.siteInsight[normalizedHost];
    return null;
  }
  return {
    computedAt,
    summaryData: entry.summaryData || null
  };
}

function upsertSiteInsightCache(state, host, summaryData) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost || !summaryData || typeof summaryData !== "object") return;
  state.cache.siteInsight[normalizedHost] = {
    computedAt: now(),
    summaryData
  };
  const rows = Object.entries(state.cache.siteInsight || {})
    .map(([cacheHost, value]) => ({ host: cacheHost, computedAt: Math.max(0, Number(value?.computedAt || 0)), summaryData: value?.summaryData }))
    .sort((a, b) => b.computedAt - a.computedAt)
    .slice(0, SITE_INSIGHT_CACHE_LIMIT);
  state.cache.siteInsight = Object.fromEntries(rows.map((row) => [row.host, { computedAt: row.computedAt, summaryData: row.summaryData }]));
}

function isLightActiveNow(state) {
  const light = state.settings.light;
  if (!light.enabled) return false;
  if (!light.schedule.enabled) return true;
  return inTimeRange(light.schedule.start, light.schedule.end, new Date());
}

function isBlockerActiveNow(state) {
  const blocker = state.settings.blocker;
  if (!blocker.enabled) return false;
  if (Number(blocker.pausedUntil || 0) > now()) return false;
  if (blocker.activationMode === "deep_work") return Boolean(state.settings.deepWork.active);
  if (blocker.activationMode === "schedule") {
    if (!blocker.schedule.enabled) return false;
    const day = new Date().getDay();
    if (!blocker.schedule.days.includes(day)) return false;
    return inTimeRange(blocker.schedule.start, blocker.schedule.end, new Date());
  }
  return true;
}

function effectivePayload(state) {
  return {
    settings: state.settings,
    license: {
      premium: Boolean(state.license.premium)
    },
    effective: {
      lightActive: isLightActiveNow(state),
      blockerActive: isBlockerActiveNow(state),
      deepWorkActive: Boolean(state.settings.deepWork.active)
    }
  };
}

function publicState(state) {
  return {
    meta: {
      version: state.meta.version,
      onboarded: Boolean(state.meta.onboarded),
      debug: Boolean(state.meta.debug),
      sessionCount: Number(state.meta.sessionCount || 0),
      showRatePrompt: shouldShowRatePrompt(state)
    },
    license: {
      premium: Boolean(state.license.premium),
      lastValidatedAt: Number(state.license.lastValidatedAt || 0)
    },
    settings: state.settings,
    stats: state.stats,
    runtime: {
      blockerActive: isBlockerActiveNow(state),
      lightActive: isLightActiveNow(state)
    }
  };
}

async function loadState() {
  if (memoryState) return memoryState;

  const all = await storageGet(null);
  let raw = all[STORAGE_KEY];

  if (!raw || typeof raw !== "object") {
    const migrated = migrateLegacy(all);
    raw = migrated;
  }

  memoryState = normalizeState(raw);
  await storageSet({ [STORAGE_KEY]: memoryState });
  return memoryState;
}

async function saveState(state) {
  memoryState = normalizeState(state);
  await storageSet({ [STORAGE_KEY]: memoryState });
  return memoryState;
}

function migrateLegacy(all) {
  const next = createDefaultState();

  const legacyV2 = all["holmeta.v2.state"];
  const legacySettings = all["holmeta.settings"];

  if (legacyV2 && typeof legacyV2 === "object") {
    const legacy = normalizeState({
      ...next,
      settings: {
        ...next.settings,
        light: {
          ...next.settings.light,
          ...(legacyV2.settings?.light || {})
        },
        blocker: {
          ...next.settings.blocker,
          ...(legacyV2.settings?.blocker || {})
        },
        alerts: {
          ...next.settings.alerts,
          ...(legacyV2.settings?.alerts || {})
        },
        deepWork: {
          ...next.settings.deepWork,
          ...(legacyV2.settings?.deepWork || {})
        },
        advanced: {
          ...next.settings.advanced,
          morphing: Boolean(legacyV2.settings?.morphing?.enabled)
        }
      },
      stats: legacyV2.stats || next.stats
    });
    legacy.meta.lastMigrationFrom = "v2";
    return legacy;
  }

  if (legacySettings && typeof legacySettings === "object") {
    next.settings.light.enabled = Boolean(legacySettings.filterEnabled);
    next.settings.light.intensity = Math.round(clamp(Number(legacySettings.filterIntensity || 0.45) * 100, 0, 100));
    next.settings.blocker.enabled = Boolean(legacySettings.blockerEnabled);
    next.settings.blocker.blockedDomains = normalizeDomainList(legacySettings.distractorDomains || []);
    next.settings.alerts.enabled = Boolean(legacySettings.remindersEnabled || legacySettings.alertsEnabled);
    next.settings.alerts.frequencyMin = Math.round(clamp(Number(legacySettings.breakIntervalMin || 45), 20, 180));
    next.meta.lastMigrationFrom = "legacy_settings";
  }

  return next;
}

function getReminderType(state) {
  const enabled = state.settings.alerts.types;
  const types = [];
  if (enabled.eye) types.push("eye");
  if (enabled.posture) types.push("posture");
  if (enabled.burnout) types.push("burnout");
  if (!types.length) return null;
  const idx = Number(state.runtime.lastAlertCursor || 0) % types.length;
  state.runtime.lastAlertCursor = idx + 1;
  return types[idx];
}

function reminderCopy(kind) {
  if (kind === "posture") {
    return {
      title: "Posture protocol",
      body: "Chin tuck. Shoulders down. Relax jaw for 20 seconds."
    };
  }
  if (kind === "burnout") {
    return {
      title: "Nervous system reset",
      body: "Step away for one minute. Breathe slowly."
    };
  }
  return {
    title: "20-20-20",
    body: "Look 20 feet away for 20 seconds."
  };
}

async function pingActiveTab(type, payload) {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const tab = tabs.find((t) => Number.isInteger(t.id) && /^https?:/i.test(String(t.url || "")));
  if (!tab) return;
  await sendTab(tab.id, { type, payload });
}

async function fireAlert(kind = "eye", test = false) {
  const state = await loadState();
  if (!test) {
    if (!state.settings.alerts.enabled) return state;
    if (Number(state.settings.alerts.snoozeUntil || 0) > now()) return state;
  }

  const type = test ? "eye" : kind;
  const copy = reminderCopy(type);
  const id = `holmeta-alert-${now()}`;

  await notificationCreate(id, {
    type: "basic",
    iconUrl: "assets/icons/icon128.png",
    title: `HOLMETA: ${copy.title}`,
    message: copy.body,
    priority: 1,
    buttons: [
      { title: "Snooze 10m" },
      { title: "Open Dashboard" }
    ]
  });

  await pingActiveTab("holmeta:toast", {
    title: copy.title,
    body: copy.body
  });

  if (state.settings.alerts.soundEnabled) {
    await pingActiveTab("holmeta:sound", { kind: type, volume: 0.28 });
  }

  state.stats.alertsFired += 1;
  incrementDaily(state, "alerts", 1);
  log(state, "info", "alert_fired", { type, test });
  await saveState(state);
  return state;
}

function buildBlockRules(state) {
  if (!isBlockerActiveNow(state)) return [];
  const blocker = state.settings.blocker;
  const rules = [];
  let id = DNR_IDS.BASE;

  if (blocker.nuclear) {
    for (const host of blocker.allowDomains) {
      rules.push({
        id: id++,
        priority: 2,
        action: { type: "allow" },
        condition: {
          urlFilter: `||${host}^`,
          resourceTypes: ["main_frame"]
        }
      });
    }

    rules.push({
      id: DNR_IDS.NUCLEAR_CATCH_ALL,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/blocked.html" }
      },
      condition: {
        regexFilter: "^https?://",
        resourceTypes: ["main_frame"]
      }
    });

    return rules;
  }

  for (const host of blocker.blockedDomains) {
    rules.push({
      id: id++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/blocked.html" }
      },
      condition: {
        urlFilter: `||${host}^`,
        resourceTypes: ["main_frame"]
      }
    });
  }

  return rules;
}

async function applyDnrRules(state) {
  const removeRuleIds = [...(state.runtime.dynamicRuleIds || [])];
  const addRules = buildBlockRules(state);

  const result = await updateDynamicRules({
    removeRuleIds,
    addRules
  });

  if (!result.ok) {
    log(state, "error", "dnr_update_failed", { error: result.error });
    return result;
  }

  state.runtime.dynamicRuleIds = addRules.map((r) => r.id);
  await saveState(state);
  return { ok: true };
}

async function broadcastState(state) {
  const payload = effectivePayload(state);
  const tabs = await tabsQuery({});
  for (const tab of tabs) {
    if (!Number.isInteger(tab.id)) continue;
    if (!/^https?:/i.test(String(tab.url || ""))) continue;
    // Expected to fail on restricted/internal pages.
    // eslint-disable-next-line no-await-in-loop
    await sendTab(tab.id, { type: "holmeta:apply-state", payload });
  }
}

async function scheduleRuntimeAlarms(state) {
  await Promise.all([
    alarmClear(ALARMS.HEALTH),
    alarmClear(ALARMS.DEEPWORK),
    alarmClear(ALARMS.HEARTBEAT)
  ]);

  if (state.settings.alerts.enabled) {
    alarmCreate(ALARMS.HEALTH, { periodInMinutes: state.settings.alerts.frequencyMin });
  }

  if (state.settings.deepWork.active && state.settings.deepWork.nextTransitionAt) {
    alarmCreate(ALARMS.DEEPWORK, { when: state.settings.deepWork.nextTransitionAt });
  }

  const needsHeartbeat =
    state.settings.light.enabled ||
    state.settings.blocker.enabled ||
    state.settings.deepWork.active ||
    state.settings.alerts.enabled;

  if (needsHeartbeat) {
    alarmCreate(ALARMS.HEARTBEAT, { periodInMinutes: 5 });
  }
}

async function initializeRuntime(reason = "startup") {
  const state = await loadState();
  log(state, "info", "initialize", { reason });
  await scheduleRuntimeAlarms(state);
  await applyDnrRules(state);
  await broadcastState(state);
  await saveState(state);
}

async function runCommand(command) {
  const state = await loadState();
  const light = state.settings.light;

  if (command === "toggle_light_filters" || command === "toggle-light-filter") {
    light.enabled = !light.enabled;
  } else if (command === "toggle_redlight" || command === "toggle-red-mode") {
    light.enabled = true;
    light.mode = light.mode === "red_overlay" ? "warm" : "red_overlay";
  } else if (command === "increase_intensity" || command === "increase-intensity") {
    light.intensity = Math.round(clamp(light.intensity + 5, 0, 100));
  } else if (command === "decrease_intensity" || command === "decrease-intensity") {
    light.intensity = Math.round(clamp(light.intensity - 5, 0, 100));
  } else if (command === "toggle_spotlight" || command === "toggle-spotlight") {
    light.enabled = true;
    light.mode = "spotlight";
    light.spotlightEnabled = !light.spotlightEnabled;
  } else {
    return { ok: false, error: "unknown_command" };
  }

  log(state, "info", "command_run", { command });
  await saveState(state);
  await applyDnrRules(state);
  await broadcastState(state);
  await scheduleRuntimeAlarms(state);
  return { ok: true, state: publicState(state) };
}

async function startDeepWork(focusMin, breakMin) {
  const state = await loadState();
  const focus = Math.round(clamp(focusMin, 10, 180));
  const brk = Math.round(clamp(breakMin, 3, 45));

  state.settings.deepWork.focusMin = focus;
  state.settings.deepWork.breakMin = brk;
  state.settings.deepWork.active = true;
  state.settings.deepWork.phase = "focus";
  state.settings.deepWork.startedAt = now();
  state.settings.deepWork.nextTransitionAt = now() + focus * 60 * 1000;

  if (state.settings.deepWork.autoLight) {
    state.settings.light.enabled = true;
    if (state.settings.light.mode === "dim") state.settings.light.mode = "warm";
  }

  await saveState(state);
  await scheduleRuntimeAlarms(state);
  if (state.settings.deepWork.autoBlocker) {
    await applyDnrRules(state);
  }
  await broadcastState(state);

  log(state, "info", "deep_work_started", { focus, break: brk });
  await notificationCreate(`holmeta-dw-start-${now()}`, {
    type: "basic",
    iconUrl: "assets/icons/icon128.png",
    title: "HOLMETA Deep Work",
    message: `Focus protocol engaged: ${focus}/${brk}`
  });

  return state;
}

async function stopDeepWork(reason = "manual") {
  const state = await loadState();
  const deep = state.settings.deepWork;

  if (deep.active && deep.phase === "focus") {
    const minutes = Math.max(0, Math.round((now() - Number(deep.startedAt || now())) / 60000));
    if (minutes > 0) {
      state.stats.focusSessions.push({ startedAt: deep.startedAt, endedAt: now(), minutes });
      state.stats.focusSessions = state.stats.focusSessions.slice(-400);
      incrementDaily(state, "focusMinutes", minutes);
      state.meta.sessionCount += 1;
    }
  }

  state.settings.deepWork.active = false;
  state.settings.deepWork.phase = "focus";
  state.settings.deepWork.startedAt = 0;
  state.settings.deepWork.nextTransitionAt = 0;

  log(state, "info", "deep_work_stopped", { reason });
  await saveState(state);
  await scheduleRuntimeAlarms(state);
  await applyDnrRules(state);
  await broadcastState(state);

  if (reason !== "silent") {
    await notificationCreate(`holmeta-dw-stop-${now()}`, {
      type: "basic",
      iconUrl: "assets/icons/icon128.png",
      title: "HOLMETA Deep Work",
      message: "Protocol stopped"
    });
  }

  return state;
}

async function transitionDeepWork() {
  const state = await loadState();
  const deep = state.settings.deepWork;
  if (!deep.active) return;

  if (deep.phase === "focus") {
    const minutes = Math.max(0, Math.round((now() - Number(deep.startedAt || now())) / 60000));
    if (minutes > 0) {
      state.stats.focusSessions.push({ startedAt: deep.startedAt, endedAt: now(), minutes });
      state.stats.focusSessions = state.stats.focusSessions.slice(-400);
      incrementDaily(state, "focusMinutes", minutes);
      state.meta.sessionCount += 1;
    }
    deep.phase = "break";
    deep.startedAt = now();
    deep.nextTransitionAt = now() + deep.breakMin * 60 * 1000;
    await notificationCreate(`holmeta-dw-break-${now()}`, {
      type: "basic",
      iconUrl: "assets/icons/icon128.png",
      title: "Break Protocol",
      message: `${deep.breakMin} minute recovery window`
    });
  } else {
    deep.phase = "focus";
    deep.startedAt = now();
    deep.nextTransitionAt = now() + deep.focusMin * 60 * 1000;
    await notificationCreate(`holmeta-dw-focus-${now()}`, {
      type: "basic",
      iconUrl: "assets/icons/icon128.png",
      title: "Focus Protocol",
      message: `${deep.focusMin} minute focus window`
    });
  }

  await saveState(state);
  await scheduleRuntimeAlarms(state);
  await applyDnrRules(state);
  await broadcastState(state);
}

async function heartbeatTick() {
  const state = await loadState();
  state.runtime.lastHeartbeatAt = now();

  if (isLightActiveNow(state)) {
    state.stats.lightUsageMinutes += 5;
    incrementDaily(state, "lightMinutes", 5);
  }

  if (isBlockerActiveNow(state)) {
    state.stats.blockerUsageMinutes += 5;
    incrementDaily(state, "blockerMinutes", 5);
  }

  await saveState(state);
  await applyDnrRules(state);
  await broadcastState(state);
}

async function maybeShowSiteInsight(tabId, urlLike, state) {
  const host = normalizeHost(urlLike);
  if (!host) return;
  const config = state.settings.siteInsight || createDefaultState().settings.siteInsight;
  if (!config.enabled || !config.showOnEverySite) return;
  if (config.perSiteDisabled?.[host]) return;

  const cached = getSiteInsightCacheEntry(state, host);
  await sendTab(tabId, {
    type: "holmeta:show-site-insight",
    payload: {
      host,
      url: String(urlLike || ""),
      settings: config,
      throttleMs: SITE_INSIGHT_THROTTLE_MS,
      cachedSummary: cached?.summaryData || null,
      cachedAt: Number(cached?.computedAt || 0)
    }
  });
}

function generateTaskWeaverSuggestions(tabs) {
  const list = Array.isArray(tabs) ? tabs : [];
  const useful = list.filter((t) => /^https?:/i.test(String(t.url || "")));
  if (!useful.length) return [];

  const domainCount = new Map();
  useful.forEach((tab) => {
    const host = normalizeHost(tab.url);
    domainCount.set(host, (domainCount.get(host) || 0) + 1);
  });

  const simulations = [];
  for (let i = 0; i < 20; i += 1) {
    const pick = useful[Math.floor(Math.random() * useful.length)];
    const host = normalizeHost(pick.url);
    const weight = (domainCount.get(host) || 1) + Math.random() * 2;
    simulations.push({
      title: pick.title || host,
      reason: `Focus potential +${Math.round(weight * 8)}% (${host})`,
      url: pick.url,
      weight
    });
  }

  simulations.sort((a, b) => b.weight - a.weight);
  const unique = [];
  const seen = new Set();
  for (const item of simulations) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    unique.push(item);
    if (unique.length >= 5) break;
  }

  return unique;
}

async function activateLicense(keyRaw) {
  const key = String(keyRaw || "").trim();
  const state = await loadState();

  // Placeholder local validation for freemium mode.
  // Future integration point: fetch signed license status from holmeta backend.
  const valid = /^((HM)|(HOLMETA))[-_][A-Z0-9-]{6,}$/i.test(key);
  if (!valid) {
    state.license.premium = false;
    state.license.key = "";
    state.license.lastValidatedAt = now();
    await saveState(state);
    return { ok: false, error: "invalid_license", state: publicState(state) };
  }

  state.license.premium = true;
  state.license.key = key;
  state.license.lastValidatedAt = now();
  await saveState(state);
  log(state, "info", "license_activated", { hash: hashText(key) });

  return { ok: true, state: publicState(state) };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const state = await loadState();
  log(state, "info", "on_installed", { reason: details.reason, previousVersion: details.previousVersion || null });

  if (details.reason === "install") {
    state.meta.onboarded = false;
    await saveState(state);
    chrome.runtime.openOptionsPage();
  }

  if (details.reason === "update") {
    state.meta.lastMigrationFrom = details.previousVersion || null;
    await saveState(state);
  }

  await initializeRuntime(details.reason);
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeRuntime("startup");
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm?.name) return;
  if (alarm.name === ALARMS.HEALTH) {
    const state = await loadState();
    const kind = getReminderType(state) || "eye";
    await fireAlert(kind, false);
    return;
  }

  if (alarm.name === ALARMS.DEEPWORK) {
    await transitionDeepWork();
    return;
  }

  if (alarm.name === ALARMS.HEARTBEAT) {
    await heartbeatTick();
  }
});

chrome.notifications.onButtonClicked.addListener(async (_notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    const state = await loadState();
    state.settings.alerts.snoozeUntil = now() + 10 * 60 * 1000;
    await saveState(state);
    log(state, "info", "alerts_snoozed", { minutes: 10 });
    return;
  }

  if (buttonIndex === 1) {
    chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  await runCommand(command);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!/^https?:/i.test(String(tab?.url || ""))) return;
  const state = await loadState();
  await sendTab(tabId, { type: "holmeta:apply-state", payload: effectivePayload(state) });
  await maybeShowSiteInsight(tabId, tab?.url, state);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const state = await loadState();
    const type = String(message?.type || "");

    if (type === "holmeta:get-state") {
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:get-site-insight-config") {
      const host = normalizeHost(message.host || sender?.tab?.url || "");
      sendResponse({
        ok: true,
        settings: state.settings.siteInsight,
        host,
        disabledOnHost: Boolean(host && state.settings.siteInsight?.perSiteDisabled?.[host]),
        cached: host ? getSiteInsightCacheEntry(state, host) : null
      });
      return;
    }

    if (type === "holmeta:get-light-diagnostics") {
      const tabId = Number(sender?.tab?.id || message.tabId || 0);
      if (!Number.isInteger(tabId) || tabId <= 0) {
        sendResponse({ ok: false, error: "invalid_tab" });
        return;
      }
      const result = await sendTab(tabId, { type: "holmeta:get-light-diagnostics" });
      if (!result.ok) {
        sendResponse({ ok: false, error: result.error || "diagnostics_failed" });
        return;
      }
      sendResponse({ ok: true, diagnostics: result.res?.diagnostics || null });
      return;
    }

    if (type === "holmeta:set-spotlight-point") {
      const tabs = await tabsQuery({ active: true, currentWindow: true });
      const tab = tabs.find((t) => Number.isInteger(t.id) && /^https?:/i.test(String(t.url || "")));
      if (!tab) {
        sendResponse({ ok: false, error: "no_active_tab" });
        return;
      }
      await sendTab(tab.id, { type: "holmeta:set-spotlight-point", point: message.point || {} });
      sendResponse({ ok: true });
      return;
    }

    if (type === "holmeta:clear-spotlight-point") {
      const tabs = await tabsQuery({ active: true, currentWindow: true });
      const tab = tabs.find((t) => Number.isInteger(t.id) && /^https?:/i.test(String(t.url || "")));
      if (!tab) {
        sendResponse({ ok: false, error: "no_active_tab" });
        return;
      }
      await sendTab(tab.id, { type: "holmeta:clear-spotlight-point" });
      sendResponse({ ok: true });
      return;
    }

    if (type === "holmeta:update-settings") {
      const patch = message.patch && typeof message.patch === "object" ? message.patch : {};
      state.settings = normalizeState({ settings: mergeDeep(state.settings, patch), license: state.license }).settings;
      await saveState(state);
      await scheduleRuntimeAlarms(state);
      await applyDnrRules(state);
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:disable-site-insight-host") {
      const host = normalizeHost(message.host || sender?.tab?.url || "");
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      state.settings.siteInsight.perSiteDisabled[host] = true;
      await saveState(state);
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:enable-site-insight-host") {
      const host = normalizeHost(message.host || sender?.tab?.url || "");
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      delete state.settings.siteInsight.perSiteDisabled[host];
      await saveState(state);
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:site-insight-cache-set") {
      const host = normalizeHost(message.host || "");
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      upsertSiteInsightCache(state, host, message.summaryData || null);
      await saveState(state);
      sendResponse({ ok: true });
      return;
    }

    if (type === "holmeta:clear-site-insight-cache") {
      state.cache.siteInsight = {};
      await saveState(state);
      sendResponse({ ok: true });
      return;
    }

    if (type === "holmeta:open-options") {
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return;
    }

    if (type === "holmeta:exclude-site") {
      const host = normalizeHost(message.host);
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      const set = new Set(state.settings.light.excludedHosts || []);
      set.add(host);
      state.settings.light.excludedHosts = [...set];
      await saveState(state);
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:save-site-profile") {
      const host = normalizeHost(message.host);
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      state.settings.light.siteProfiles[host] = {
        enabled: true,
        mode: state.settings.light.mode,
        intensity: state.settings.light.intensity,
        dim: state.settings.light.dim,
        contrastSoft: state.settings.light.contrastSoft,
        brightness: state.settings.light.brightness,
        reduceWhites: state.settings.light.reduceWhites,
        videoSafe: state.settings.light.videoSafe,
        spotlightEnabled: state.settings.light.spotlightEnabled,
        therapyMode: state.settings.light.therapyMode,
        therapyMinutes: state.settings.light.therapyMinutes,
        therapyCadence: state.settings.light.therapyCadence
      };
      await saveState(state);
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:add-blocked-domain") {
      const host = normalizeHost(message.host || sender?.tab?.url || "");
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      const set = new Set(state.settings.blocker.blockedDomains);
      set.add(host);
      state.settings.blocker.blockedDomains = [...set];
      await saveState(state);
      await applyDnrRules(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:pause-blocker") {
      const minutes = Math.round(clamp(message.minutes || 10, 1, 180));
      state.settings.blocker.pausedUntil = now() + minutes * 60 * 1000;
      await saveState(state);
      await applyDnrRules(state);
      sendResponse({ ok: true, pausedUntil: state.settings.blocker.pausedUntil });
      return;
    }

    if (type === "holmeta:get-blocked-context") {
      sendResponse({
        ok: true,
        blockerActive: isBlockerActiveNow(state),
        pausedUntil: Number(state.settings.blocker.pausedUntil || 0)
      });
      return;
    }

    if (type === "holmeta:blocked-hit") {
      state.stats.blockEvents += 1;
      incrementDaily(state, "blocks", 1);
      await saveState(state);
      sendResponse({ ok: true });
      return;
    }

    if (type === "holmeta:start-deep-work") {
      const updated = await startDeepWork(message.focusMin, message.breakMin);
      sendResponse({ ok: true, state: publicState(updated) });
      return;
    }

    if (type === "holmeta:stop-deep-work") {
      const updated = await stopDeepWork("manual");
      sendResponse({ ok: true, state: publicState(updated) });
      return;
    }

    if (type === "holmeta:test-alert") {
      await fireAlert("eye", true);
      sendResponse({ ok: true });
      return;
    }

    if (type === "holmeta:snooze-alerts") {
      const minutes = Math.round(clamp(message.minutes || 10, 1, 240));
      state.settings.alerts.snoozeUntil = now() + minutes * 60 * 1000;
      await saveState(state);
      sendResponse({ ok: true, snoozeUntil: state.settings.alerts.snoozeUntil });
      return;
    }

    if (type === "holmeta:task-weaver") {
      if (!state.license.premium || !state.settings.advanced.taskWeaver) {
        sendResponse({ ok: false, error: "premium_required" });
        return;
      }
      const tabs = await tabsQuery({ currentWindow: true });
      const results = generateTaskWeaverSuggestions(tabs);
      log(state, "info", "task_weaver_run", { resultCount: results.length });
      await saveState(state);
      sendResponse({ ok: true, results });
      return;
    }

    if (type === "holmeta:run-command") {
      const result = await runCommand(String(message.command || ""));
      sendResponse(result);
      return;
    }

    if (type === "holmeta:set-onboarded") {
      state.meta.onboarded = true;
      await saveState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:dismiss-rate-prompt") {
      state.meta.lastRatePromptAt = now();
      state.meta.ratePromptDismissedUntil = now() + 14 * 24 * 60 * 60 * 1000;
      await saveState(state);
      sendResponse({ ok: true });
      return;
    }

    if (type === "holmeta:set-debug") {
      state.meta.debug = Boolean(message.value);
      await saveState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:activate-license") {
      const result = await activateLicense(message.key || "");
      sendResponse(result);
      return;
    }

    if (type === "holmeta:clear-license") {
      state.license.premium = false;
      state.license.key = "";
      state.license.lastValidatedAt = now();
      await saveState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:export-settings") {
      sendResponse({ ok: true, data: state });
      return;
    }

    if (type === "holmeta:export-logs") {
      sendResponse({ ok: true, logs: state.logs || [] });
      return;
    }

    if (type === "holmeta:import-settings") {
      if (!message.data || typeof message.data !== "object") {
        sendResponse({ ok: false, error: "invalid_import" });
        return;
      }
      const imported = normalizeState(message.data);
      imported.meta.lastMigrationFrom = "import";
      await saveState(imported);
      await scheduleRuntimeAlarms(imported);
      await applyDnrRules(imported);
      await broadcastState(imported);
      sendResponse({ ok: true, state: publicState(imported) });
      return;
    }

    if (type === "holmeta:reset-all") {
      const fresh = createDefaultState();
      await saveState(fresh);
      await scheduleRuntimeAlarms(fresh);
      await applyDnrRules(fresh);
      await broadcastState(fresh);
      sendResponse({ ok: true, state: publicState(fresh) });
      return;
    }

    sendResponse({ ok: false, error: "unknown_message" });
  })().catch(async (error) => {
    const s = await loadState().catch(() => createDefaultState());
    log(s, "error", "message_handler_error", { error: String(error?.message || error) });
    await saveState(s);
    sendResponse({ ok: false, error: String(error?.message || "internal_error") });
  });

  return true;
});

initializeRuntime("boot").catch((error) => {
  console.error("[Holmeta:error] init_failed", error);
});

// Unit-test-friendly exports (safe no-op in runtime consumers)
globalThis.__HOLMETA_BG_TEST__ = {
  normalizeHost,
  normalizeDomainList,
  inTimeRange,
  createDefaultState,
  normalizeState,
  generateTaskWeaverSuggestions
};
