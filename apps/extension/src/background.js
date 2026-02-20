importScripts("common.js");

const HC = globalThis.HolmetaCommon;

const STORAGE = {
  settings: "holmeta.settings",
  runtime: "holmeta.runtime",
  hydration: "holmeta.hydration",
  calm: "holmeta.calm",
  dailyLogs: "holmeta.dailyLogs",
  entitlement: "holmeta.entitlement",
  audit: "holmeta.audit",
  auth: "holmeta.auth"
};

const ALARMS = {
  circadian: "holmeta-circadian",
  focusTick: "holmeta-focus-tick",
  entitlement: "holmeta-entitlement",
  summary: "holmeta-daily-summary"
};

const REMINDER_ALARM_PREFIX = "holmeta-reminder-";

const FOCUS_RULE_IDS = Array.from({ length: 120 }, (_, i) => 9000 + i);
const NOTIFICATION_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+Xw8N3wAAAABJRU5ErkJggg==";
const SIDE_PANEL_PATH = "src/sidepanel.html";
const SIDE_PANEL_ENABLED = true;
const PREMIUM_FEATURES = {
  lightFilters: true,
  everythingElse: true,
  advancedCadence: true,
  workBlocks: true,
  timeWindows: true,
  multiProfiles: true,
  settingsSync: true,
  meetingAutoSuppression: true,
  advancedAnalytics: true,
  postureWebcam: true
};
const TRIAL_FEATURES = {
  lightFilters: true,
  everythingElse: false,
  advancedCadence: false,
  workBlocks: false,
  timeWindows: false,
  multiProfiles: false,
  settingsSync: false,
  meetingAutoSuppression: false,
  advancedAnalytics: false,
  postureWebcam: false
};
const FREE_FEATURES = {
  lightFilters: false,
  everythingElse: false,
  advancedCadence: false,
  workBlocks: false,
  timeWindows: false,
  multiProfiles: false,
  settingsSync: false,
  meetingAutoSuppression: false,
  advancedAnalytics: false,
  postureWebcam: false
};
const ENTITLEMENT_GRACE_MS = 72 * 60 * 60 * 1000;

function reminderAlarmName(reminderType) {
  return REMINDER_ALARM_PREFIX + reminderType;
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    if (!isValidTabId(tabId) || !chrome.tabs?.sendMessage) {
      resolve({ ok: false, error: "INVALID_TAB_OR_API" });
      return;
    }

    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({
            ok: false,
            error: err.message || "sendMessage failed"
          });
          return;
        }

        resolve({
          ok: true,
          response: response || null
        });
      });
    } catch (error) {
      resolve({
        ok: false,
        error: error?.message || "sendMessage threw"
      });
    }
  });
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(payload) {
  return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}

function alarmsClear(name) {
  return new Promise((resolve) => chrome.alarms.clear(name, () => resolve()));
}

function tabsQuery(queryInfo = {}) {
  return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
}

function notificationsCreate(id, options) {
  return new Promise((resolve) => chrome.notifications.create(id, options, () => resolve()));
}

function idleQueryState(threshold) {
  return new Promise((resolve) => chrome.idle.queryState(threshold, resolve));
}

function dnrUpdate(payload) {
  return new Promise((resolve, reject) => {
    if (!chrome.declarativeNetRequest?.updateDynamicRules) {
      resolve();
      return;
    }

    chrome.declarativeNetRequest.updateDynamicRules(payload, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function tabsRemove(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      resolve();
    });
  });
}

function isSidePanelSupported() {
  return Boolean(SIDE_PANEL_ENABLED && chrome.sidePanel && typeof chrome.sidePanel.setOptions === "function");
}

function isValidTabId(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidWindowId(value) {
  return Number.isInteger(value) && value >= 0;
}

async function sidePanelSetBehavior(options) {
  if (!isSidePanelSupported() || typeof chrome.sidePanel.setPanelBehavior !== "function") {
    return { ok: false, error: "UNSUPPORTED" };
  }

  try {
    await chrome.sidePanel.setPanelBehavior(options);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "setPanelBehavior failed"
    };
  }
}

async function sidePanelSetOptions(options) {
  if (!isSidePanelSupported()) {
    return { ok: false, error: "UNSUPPORTED" };
  }

  try {
    await chrome.sidePanel.setOptions(options);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "setOptions failed"
    };
  }
}

async function sidePanelOpen(options) {
  if (!isSidePanelSupported() || typeof chrome.sidePanel.open !== "function") {
    return { ok: false, error: "UNSUPPORTED" };
  }

  try {
    await chrome.sidePanel.open(options);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "open failed"
    };
  }
}

async function sidePanelClose(options) {
  if (!isSidePanelSupported() || typeof chrome.sidePanel.close !== "function") {
    return { ok: false, error: "UNSUPPORTED" };
  }

  try {
    await chrome.sidePanel.close(options);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "close failed"
    };
  }
}

async function getActiveTabContext() {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const tab = tabs.find((entry) => isValidTabId(entry?.id));
  if (!tab) {
    return { tabId: null, windowId: null };
  }

  return {
    tabId: tab.id,
    windowId: isValidWindowId(tab.windowId) ? tab.windowId : null
  };
}

async function resolvePanelContext(payload = {}, sender = {}) {
  const payloadTabId = Number(payload?.tabId);
  const payloadWindowId = Number(payload?.windowId);

  if (isValidTabId(payloadTabId)) {
    return {
      tabId: payloadTabId,
      windowId: isValidWindowId(payloadWindowId) ? payloadWindowId : null
    };
  }

  if (isValidTabId(sender?.tab?.id)) {
    return {
      tabId: sender.tab.id,
      windowId: isValidWindowId(sender.tab.windowId) ? sender.tab.windowId : null
    };
  }

  return getActiveTabContext();
}

async function disableSidePanelForTab(tabId) {
  if (!isValidTabId(tabId) || !isSidePanelSupported()) {
    return { ok: false, error: "UNSUPPORTED_OR_INVALID_TAB" };
  }

  return sidePanelSetOptions({
    tabId,
    path: SIDE_PANEL_PATH,
    enabled: false
  });
}

async function closeSidePanelAcrossKnownWindows() {
  if (!isSidePanelSupported() || typeof chrome.sidePanel?.close !== "function") {
    return { ok: false, error: "UNSUPPORTED" };
  }

  const tabs = await tabsQuery({});
  const windowIds = Array.from(
    new Set(
      tabs
        .map((tab) => Number(tab?.windowId))
        .filter((windowId) => isValidWindowId(windowId))
    )
  );

  await Promise.all(
    windowIds.map((windowId) =>
      sidePanelClose({ windowId })
    )
  );

  return {
    ok: true,
    windowsClosed: windowIds.length
  };
}

async function configureSidePanelDefaults(reason = "startup") {
  if (!isSidePanelSupported()) {
    return { ok: false, error: "UNSUPPORTED", reason };
  }

  await sidePanelSetBehavior({ openPanelOnActionClick: false });
  await closeSidePanelAcrossKnownWindows();

  const tabs = await tabsQuery({});
  const validTabs = tabs.filter((tab) => isValidTabId(tab?.id));
  await Promise.all(
    validTabs.map((tab) =>
      sidePanelSetOptions({
        tabId: tab.id,
        path: SIDE_PANEL_PATH,
        enabled: false
      })
    )
  );

  return {
    ok: true,
    reason,
    tabsDisabled: validTabs.length
  };
}

async function openSidePanelForContext(payload = {}, sender = {}) {
  if (!isSidePanelSupported()) {
    return { ok: false, error: "SIDE_PANEL_UNSUPPORTED" };
  }

  await sidePanelSetBehavior({ openPanelOnActionClick: false });
  const context = await resolvePanelContext(payload, sender);

  if (!isValidTabId(context.tabId)) {
    return { ok: false, error: "NO_TAB_CONTEXT" };
  }

  const setResult = await sidePanelSetOptions({
    tabId: context.tabId,
    path: SIDE_PANEL_PATH,
    enabled: true
  });

  if (!setResult.ok) {
    return {
      ok: false,
      error: setResult.error || "SET_OPTIONS_FAILED",
      tabId: context.tabId
    };
  }

  let opened = false;
  let openError = null;

  if (typeof chrome.sidePanel?.open === "function") {
    const openResult = await sidePanelOpen({ tabId: context.tabId });
    opened = Boolean(openResult.ok);
    if (!openResult.ok) {
      openError = openResult.error || "OPEN_FAILED";
    }
  }

  return {
    ok: true,
    tabId: context.tabId,
    windowId: context.windowId,
    opened,
    openError
  };
}

async function closeSidePanelForContext(payload = {}, sender = {}) {
  if (!isSidePanelSupported()) {
    return { ok: false, error: "SIDE_PANEL_UNSUPPORTED" };
  }

  const context = await resolvePanelContext(payload, sender);
  let closeResult = { ok: false, error: "UNSUPPORTED" };

  if (typeof chrome.sidePanel?.close === "function") {
    const closePayload = {};
    if (isValidTabId(context.tabId)) {
      closePayload.tabId = context.tabId;
    } else if (isValidWindowId(context.windowId)) {
      closePayload.windowId = context.windowId;
    }

    if (Object.keys(closePayload).length) {
      closeResult = await sidePanelClose(closePayload);
    }
  }

  if (isValidTabId(context.tabId)) {
    await sidePanelSetOptions({
      tabId: context.tabId,
      path: SIDE_PANEL_PATH,
      enabled: false
    });
  }

  return {
    ok: true,
    tabId: isValidTabId(context.tabId) ? context.tabId : null,
    windowId: isValidWindowId(context.windowId) ? context.windowId : null,
    closedWithApi: Boolean(closeResult.ok)
  };
}

function safeSendTab(tabId, message) {
  try {
    chrome.tabs.sendMessage(tabId, message, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {
    // no-op
  }
}

async function sendSfxToActiveTab(settings, eventId, options = {}) {
  if (!settings?.soundEnabled) {
    return { ok: false, reason: "SOUND_DISABLED" };
  }

  if (options.channel === "reminder" && !settings?.reminderSoundsEnabled) {
    return { ok: false, reason: "REMINDER_SOUND_DISABLED" };
  }

  const key = options.key || HC.resolveSfxKeyForEvent(settings, eventId);
  if (!key || !HC.SFX_SOUND_KEYS.includes(key)) {
    return { ok: false, reason: "INVALID_SFX_KEY" };
  }

  const tabs = await tabsQuery({ active: true, lastFocusedWindow: true });
  const activeTab = tabs.find((tab) => tab.id && isHttpUrl(tab.url)) || tabs.find((tab) => tab.id && isHttpUrl(tab.pendingUrl));
  if (!activeTab?.id) {
    return { ok: false, reason: "NO_ACTIVE_HTTP_TAB" };
  }

  const volume = HC.clamp(Number(options.volume ?? settings.masterVolume ?? 0.35), 0, 1);
  if (volume <= 0) {
    return { ok: false, reason: "ZERO_VOLUME" };
  }

  safeSendTab(activeTab.id, {
    type: "SFX_PLAY",
    key,
    volume,
    channel: options.channel || "ui",
    eventId: eventId || null
  });

  return {
    ok: true,
    tabId: activeTab.id,
    key,
    volume
  };
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return "";
  }
}

function toDateOrNow(ts) {
  const num = Number(ts || 0);
  if (!num || num <= 0) return new Date();
  return new Date(num);
}

function parseIsoTimestamp(value) {
  if (!value) {
    return 0;
  }
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : 0;
}

function normalizeEntitlementStatus(rawStatus, activeHint = false) {
  const status = String(rawStatus || "").trim().toLowerCase();
  if (status) {
    return status;
  }
  return activeHint ? "active" : "inactive";
}

function entitlementStatusIsActive(status) {
  return status === "trialing" || status === "active";
}

function computeEntitlementActive(status, trialEndsAt, activeHint = false) {
  const normalizedStatus = normalizeEntitlementStatus(status, activeHint);
  let active = entitlementStatusIsActive(normalizedStatus);

  if (normalizedStatus === "trialing") {
    const trialTs = parseIsoTimestamp(trialEndsAt);
    if (trialTs && trialTs <= Date.now()) {
      active = false;
    }
  }

  return active;
}

function defaultFeaturesForStatus(status) {
  if (status === "active") {
    return { ...PREMIUM_FEATURES };
  }

  if (status === "trialing") {
    return { ...TRIAL_FEATURES };
  }

  return { ...FREE_FEATURES };
}

function normalizeFeatures(features, status = "inactive", activeHint = false) {
  const normalizedStatus = normalizeEntitlementStatus(status, activeHint);
  return {
    ...defaultFeaturesForStatus(normalizedStatus),
    ...(features || {})
  };
}

function entitlementAccess(settings, entitlement) {
  if (settings?.devBypassPremium) {
    return {
      status: "active",
      entitled: true,
      lightFilters: true,
      everythingElse: true,
      trialing: false,
      active: true,
      locked: false
    };
  }

  const status = normalizeEntitlementStatus(entitlement?.status, entitlement?.active);
  const active = status === "active";
  const trialing = status === "trialing" && computeEntitlementActive(status, entitlement?.trialEndsAt, entitlement?.active);
  const lightFilters = active || trialing;
  const everythingElse = active;

  return {
    status,
    entitled: lightFilters,
    lightFilters,
    everythingElse,
    trialing,
    active,
    locked: !lightFilters
  };
}

async function getSettings() {
  const data = await storageGet(STORAGE.settings);
  return HC.normalizeSettings(data[STORAGE.settings] || {});
}

async function writeSettings(nextSettings) {
  const next = HC.normalizeSettings(nextSettings || {});
  await storageSet({ [STORAGE.settings]: next });
  return next;
}

async function setSettings(patch, options = {}) {
  const current = await getSettings();
  const merged = HC.normalizeSettings({
    ...current,
    ...(patch || {})
  });

  const entitlement = options.entitlement || (await getEntitlement());
  const premium = isPremium(merged, entitlement);
  const next = premium ? merged : HC.enforceFreeTierSettings(merged, false);

  await storageSet({ [STORAGE.settings]: next });
  return next;
}

async function getRuntime() {
  const data = await storageGet(STORAGE.runtime);
  return HC.normalizeRuntime(data[STORAGE.runtime] || {});
}

async function writeRuntime(nextRuntime) {
  const runtime = HC.normalizeRuntime(nextRuntime || {});
  await storageSet({ [STORAGE.runtime]: runtime });
  return runtime;
}

function ensureToday(runtime, date = new Date()) {
  const safe = HC.normalizeRuntime(runtime);
  const key = HC.todayKey(date);
  if (safe.scheduler.today === key) {
    return safe;
  }

  safe.scheduler.today = key;
  safe.scheduler.firedByType = HC.emptyReminderMap(0);
  safe.scheduler.completedByType = HC.emptyReminderMap(0);
  safe.scheduler.ignoredByType = HC.emptyReminderMap(0);
  safe.scheduler.suppressedByType = HC.emptyReminderMap(0);
  safe.scheduler.pendingByType = HC.emptyReminderMap(0);
  safe.scheduler.nextByType = {};
  safe.scheduler.nextReminderType = null;
  safe.scheduler.nextReminderAt = 0;
  return safe;
}

async function getEntitlement() {
  const data = await storageGet(STORAGE.entitlement);
  const stored = data[STORAGE.entitlement] || {};
  const status = normalizeEntitlementStatus(stored.status, stored.active);
  const trialEndsAt = stored.trialEndsAt || null;
  const active = computeEntitlementActive(status, trialEndsAt, stored.active);

  return {
    active,
    status,
    plan: stored.plan || (active ? "2" : "free"),
    renewsAt: stored.renewsAt || null,
    trialEndsAt,
    checkedAt: stored.checkedAt || null,
    stale: Boolean(stored.stale),
    graceUntil: stored.graceUntil || null,
    lastActiveAt: stored.lastActiveAt || null,
    features: normalizeFeatures(stored.features || (active ? PREMIUM_FEATURES : FREE_FEATURES))
  };
}

async function setEntitlement(entitlement, options = {}) {
  const current = options.current || (await getEntitlement());
  const status = normalizeEntitlementStatus(entitlement.status, entitlement.active);
  const trialEndsAt = entitlement.trialEndsAt || null;
  const active = computeEntitlementActive(status, trialEndsAt, entitlement.active);
  const nowIso = new Date().toISOString();

  const payload = {
    active,
    status,
    plan: entitlement.plan || (active ? "2" : "free"),
    renewsAt: entitlement.renewsAt || null,
    trialEndsAt,
    checkedAt: options.preserveCheckedAt ? current.checkedAt || null : nowIso,
    stale: Boolean(entitlement.stale),
    graceUntil: entitlement.graceUntil || null,
    lastActiveAt: active ? nowIso : current.lastActiveAt || null,
    features: normalizeFeatures(entitlement.features || (active ? PREMIUM_FEATURES : FREE_FEATURES))
  };

  await storageSet({ [STORAGE.entitlement]: payload });
  return payload;
}

async function getAuth() {

  const data = await storageGet(STORAGE.auth);
  return {
    extensionToken: "",
    tokenId: null,
    userId: null,
    pairedAt: null,
    ...(data[STORAGE.auth] || {})
  };
}

async function setAuth(authPatch) {
  const current = await getAuth();
  const next = {
    ...current,
    ...(authPatch || {})
  };
  await storageSet({ [STORAGE.auth]: next });
  return next;
}

async function clearAuth() {
  await storageSet({
    [STORAGE.auth]: {
      extensionToken: "",
      tokenId: null,
      userId: null,
      pairedAt: null
    }
  });
}

async function getHydration() {
  const data = await storageGet(STORAGE.hydration);
  return data[STORAGE.hydration] || {};
}

async function getCalm() {
  const data = await storageGet(STORAGE.calm);
  return data[STORAGE.calm] || {};
}

async function getDailyLogs() {
  const data = await storageGet(STORAGE.dailyLogs);
  return data[STORAGE.dailyLogs] || [];
}

async function broadcastToTabs(message) {
  const tabs = await tabsQuery({});
  tabs.forEach((tab) => {
    if (!tab.id || !isHttpUrl(tab.url)) {
      return;
    }
    safeSendTab(tab.id, message);
  });
}

async function sendStateToTab(tabId) {
  const settings = await getSettings();
  const runtime = await getRuntime();

  safeSendTab(tabId, {
    type: "holmeta-apply-filter",
    payload: {
      settings,
      generatedAt: Date.now()
    }
  });

  safeSendTab(tabId, {
    type: "holmeta-focus-hud",
    focusSession: runtime.focusSession
  });
}

async function broadcastFilter(settings) {
  await broadcastToTabs({
    type: "holmeta-apply-filter",
    payload: {
      settings: HC.normalizeSettings(settings),
      generatedAt: Date.now()
    }
  });
}

function notify(settings, id, title, message) {
  if (!settings.reminderNotifications) {
    return;
  }

  notificationsCreate(id, {
    type: "basic",
    iconUrl: NOTIFICATION_ICON,
    title,
    message,
    priority: 1
  });
}

function hasMeetingSuppression(settings) {
  return Boolean(settings.cadence?.global?.meetingModeManual || settings.cadence?.global?.meetingModeAuto);
}

async function evaluateMeetingMode(settings) {
  const global = settings.cadence?.global || {};
  if (global.meetingModeManual) {
    return {
      active: true,
      source: "manual",
      hostname: null
    };
  }

  if (!global.meetingModeAuto) {
    return {
      active: false,
      source: "off",
      hostname: null
    };
  }

  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.url) {
    return {
      active: false,
      source: "auto",
      hostname: null
    };
  }

  const hostname = hostnameFromUrl(tab.url);
  const active = HC.isMeetingDomain(settings, hostname);
  return {
    active,
    source: "auto",
    hostname: hostname || null
  };
}

async function updateActionBadge(settings, runtime) {
  const safeRuntime = HC.normalizeRuntime(runtime);
  const next = HC.getNextReminderSnapshot(settings, safeRuntime);

  if (safeRuntime.focusSession) {
    chrome.action.setBadgeText({ text: "FOC" });
    chrome.action.setBadgeBackgroundColor({ color: "#00AA4A" });
    return;
  }

  if (hasMeetingSuppression(settings)) {
    const meeting = await evaluateMeetingMode(settings);
    if (meeting.active) {
      chrome.action.setBadgeText({ text: "MTG" });
      chrome.action.setBadgeBackgroundColor({ color: "#FFB000" });
      return;
    }
  }

  if (!next.at) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  const remainingMin = Math.max(0, Math.ceil((next.at - Date.now()) / 60000));
  const badgeText = remainingMin > 99 ? "99+" : `${remainingMin}m`;
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: "#2B2F3A" });
}

function resolveFunctionUrl(settings, explicit, name) {
  const chosen = String(explicit || "").trim();
  if (chosen) {
    return chosen;
  }

  const base = String(settings.apiBaseUrl || "").trim().replace(/\/$/, "");
  if (!base) {
    return "";
  }

  if (base.endsWith("/.netlify/functions")) {
    return `${base}/${name}`;
  }

  return `${base}/.netlify/functions/${name}`;
}

function entitlementUrl(settings) {
  return resolveFunctionUrl(settings, settings.entitlementUrl, "entitlement");
}

function pairingExchangeUrl(settings) {
  return resolveFunctionUrl(settings, settings.pairingExchangeUrl, "exchange-pairing-code");
}

async function fetchEntitlementFromApi(url, token) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers
  });

  const rawBody = await response.text();
  let json = null;
  if (rawBody) {
    try {
      json = JSON.parse(rawBody);
    } catch (_) {
      json = null;
    }
  }

  return { response, json, rawBody };
}

async function refreshEntitlement(settings, force = false) {
  if (settings.devBypassPremium) {
    return setEntitlement({
      active: true,
      status: "active",
      plan: "dev-bypass",
      renewsAt: null,
      trialEndsAt: null,
      stale: false,
      graceUntil: null,
      features: { ...PREMIUM_FEATURES }
    });
  }

  const existing = await getEntitlement();
  if (!force && existing.checkedAt) {
    const elapsed = Date.now() - parseIsoTimestamp(existing.checkedAt);
    if (elapsed < 15 * 60 * 1000) {
      return existing;
    }
  }

  const url = entitlementUrl(settings);
  const auth = await getAuth();
  const token = String(auth.extensionToken || settings.extensionToken || "").trim();

  if (!url || !token) {
    return setEntitlement({
      active: false,
      status: "inactive",
      plan: "free",
      renewsAt: null,
      trialEndsAt: null,
      stale: false,
      graceUntil: null,
      features: { ...FREE_FEATURES }
    }, { current: existing });
  }

  try {
    const { response, json } = await fetchEntitlementFromApi(url, token);
    if (!response.ok) {
      throw new Error("Entitlement request failed: " + response.status);
    }

    const safe = json && typeof json === "object" ? json : {};
    return setEntitlement({
      active: Boolean(safe.active),
      status: safe.status || (safe.active ? "active" : "inactive"),
      plan: safe.plan || (safe.active ? "2" : "free"),
      renewsAt: safe.renewsAt || null,
      trialEndsAt: safe.trialEndsAt || null,
      stale: false,
      graceUntil: null,
      features: normalizeFeatures(safe.features)
    }, { current: existing });
  } catch (_) {
    const checkedTs = parseIsoTimestamp(existing.checkedAt);
    const graceUntilTs = checkedTs ? checkedTs + ENTITLEMENT_GRACE_MS : 0;

    if (existing.active && graceUntilTs > Date.now()) {
      const payload = {
        ...existing,
        stale: true,
        graceUntil: new Date(graceUntilTs).toISOString(),
        features: normalizeFeatures(existing.features || PREMIUM_FEATURES)
      };
      await storageSet({ [STORAGE.entitlement]: payload });
      return payload;
    }

    return setEntitlement({
      active: false,
      status: "inactive",
      plan: existing.plan || "free",
      renewsAt: existing.renewsAt || null,
      trialEndsAt: existing.trialEndsAt || null,
      stale: false,
      graceUntil: null,
      features: { ...FREE_FEATURES }
    }, { current: existing });
  }
}

async function testEntitlementFetch(settings) {

  const url = entitlementUrl(settings);
  if (!url) {
    return {
      ok: false,
      error: "ENTITLEMENT URL NOT CONFIGURED",
      status: 0
    };
  }

  const auth = await getAuth();
  const token = String(auth.extensionToken || settings.extensionToken || "").trim();

  try {
    const { response, json, rawBody } = await fetchEntitlementFromApi(url, token);
    const safeBody = json && typeof json === "object" ? json : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        url,
        error: safeBody?.error || `HTTP ${response.status}`,
        body: safeBody || rawBody.slice(0, 400)
      };
    }

    const entitlement = await setEntitlement({
      active: Boolean(safeBody?.active),
      status: safeBody?.status || (safeBody?.active ? "active" : "inactive"),
      plan: safeBody?.plan || (safeBody?.active ? "2" : "free"),
      renewsAt: safeBody?.renewsAt || null,
      trialEndsAt: safeBody?.trialEndsAt || null,
      stale: false,
      graceUntil: null,
      features: normalizeFeatures(safeBody?.features)
    });

    return {
      ok: true,
      status: response.status,
      url,
      entitlement,
      body: safeBody || rawBody.slice(0, 400)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ENTITLEMENT FETCH FAILED";
    const corsLikely = /failed to fetch|networkerror|cors|load failed/i.test(message);
    return {
      ok: false,
      status: 0,
      url,
      error: corsLikely ? "ENTITLEMENT FETCH FAILED (CORS)" : message,
      corsLikely
    };
  }
}

async function exchangePairingCode(settings, code) {
  const url = pairingExchangeUrl(settings);
  if (!url) {
    return {
      ok: false,
      error: "Pairing exchange endpoint is not configured"
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    });

    const json = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error: json.error || `HTTP ${response.status}`
      };
    }

    const token = String(json.token || "").trim();
    if (!token) {
      return {
        ok: false,
        error: "No token received"
      };
    }

    await setAuth({
      extensionToken: token,
      tokenId: json.tokenId || null,
      userId: json.userId || null,
      pairedAt: new Date().toISOString()
    });

    const nextSettings = await setSettings({
      extensionToken: token
    });

    const entitlement = await refreshEntitlement(nextSettings, true);

    return {
      ok: true,
      entitlement
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Pairing exchange failed"
    };
  }
}

function isPremium(settings, entitlement) {
  return Boolean(settings.devBypassPremium || entitlement.active);
}

function reminderMessageText(reminderType, config) {
  if (reminderType === "eye") {
    return {
      title: "20-20-20 EYE RECOVERY",
      body: `Look far for ${config.exerciseDurationSec || 20} seconds.`
    };
  }

  if (reminderType === "movement") {
    return {
      title: "MOVEMENT RESET",
      body: config.promptType === "walk" ? "Walk for 1-2 minutes." : "Stand and stretch for 60 seconds."
    };
  }

  if (reminderType === "posture") {
    return {
      title: "POSTURE CHECK",
      body: "Reset chin, shoulders, and wrist angle."
    };
  }

  if (reminderType === "hydration") {
    return {
      title: "HYDRATION CHECK",
      body: "Log one glass of water."
    };
  }

  if (reminderType === "breathwork") {
    return {
      title: "BREATHWORK RESET",
      body: "Run a 1-2 minute calming protocol."
    };
  }

  return {
    title: "DAILY HEALTH AUDIT",
    body: "Log energy, mood, and sleep quality."
  };
}

function eyeExerciseGuidance(config) {
  const set = config.exerciseSet || "mixed";
  if (set === "classic") {
    return [
      "LOOK 20 FEET AWAY",
      "HOLD FOR 20 SECONDS",
      "BLINK SOFTLY"
    ];
  }

  if (set === "palming") {
    return [
      "RUB HANDS FOR HEAT",
      "COVER CLOSED EYES",
      "BREATHE FOR 20 SECONDS"
    ];
  }

  if (set === "blink-reset") {
    return [
      "SLOW BLINKS x10",
      "FOCUS FAR x20 SEC",
      "RELAX JAW + SHOULDERS"
    ];
  }

  if (set === "focus-shift") {
    return [
      "FOCUS NEAR 3 SEC",
      "FOCUS FAR 3 SEC",
      "REPEAT x6"
    ];
  }

  return [
    "LOOK FAR 20 SECONDS",
    "SLOW BLINKS x10",
    "PALM EYES 15 SECONDS"
  ];
}

function movementSuggestions(config) {
  const type = config.promptType || "mixed";
  if (type === "stand") {
    return ["STAND 60 SEC", "SHOULDER ROLLS x8", "CHEST OPENERS x6"];
  }

  if (type === "walk") {
    return ["WALK 2 MIN", "ANKLE PUMPS x12", "LOOK FAR FROM SCREEN"];
  }

  return ["STAND 60 SEC", "WALK 90 SEC", "SHOULDER + CHEST RESET"];
}

function reminderSfxEventId(reminderType) {
  if (reminderType === "eye") {
    return "reminderEye";
  }

  if (reminderType === "movement" || reminderType === "posture") {
    return "reminderMovement";
  }

  if (reminderType === "hydration") {
    return "reminderHydration";
  }

  if (reminderType === "breathwork") {
    return "reminderBreathwork";
  }

  return "reminderDailyAudit";
}

function buildReminderPayload(reminderType, settings, runtime) {
  const config = HC.getReminderConfig(settings, reminderType);
  const summary = HC.summarizeReminderStats(runtime);
  const ignored = Number(runtime.scheduler.ignoredByType[reminderType] || 0);
  const escalated = Boolean(config.escalateIfIgnored && ignored >= Number(config.escalateAfterIgnores || 3));

  const copy = reminderMessageText(reminderType, config);
  const payload = {
    reminderType,
    title: copy.title,
    message: copy.body,
    delivery: config.delivery,
    snoozeMinutes: config.snoozeMinutes,
    defaultSnoozeMin: config.snoozeMinutes?.[0] || 5,
    escalated,
    ignoredCount: ignored,
    completedToday: Number(summary.completed[reminderType] || 0),
    firedToday: Number(summary.scheduled[reminderType] || 0)
  };

  if (reminderType === "eye") {
    payload.exerciseDurationSec = Number(config.exerciseDurationSec || 20);
    payload.guidance = eyeExerciseGuidance(config);
  }

  if (reminderType === "movement") {
    payload.stretches = movementSuggestions(config);
  }

  if (reminderType === "posture") {
    payload.stretches = [
      "STACK HEAD OVER SHOULDERS",
      "RESET MONITOR HEIGHT",
      "UNCLENCH SHOULDERS"
    ];
  }

  if (reminderType === "breathwork") {
    payload.presets = config.onDemandPresets || ["box", "478", "sigh"];
  }

  if (reminderType === "dailyAudit") {
    payload.message = "Log energy, mood, and sleep quality for trend tracking.";
  }

  return payload;
}

async function sendMessageToActiveHttpTab(message) {
  const attemptedTabIds = new Set();
  const candidates = [];

  const activeTabs = await tabsQuery({ active: true, lastFocusedWindow: true });
  const activeTab = activeTabs.find((tab) => tab.id && (isHttpUrl(tab.url) || isHttpUrl(tab.pendingUrl)));

  if (activeTab?.id) {
    attemptedTabIds.add(activeTab.id);
    candidates.push(activeTab);
  }

  if (isValidWindowId(activeTab?.windowId)) {
    const siblingTabs = await tabsQuery({ windowId: activeTab.windowId });
    siblingTabs.forEach((tab) => {
      if (!tab?.id || attemptedTabIds.has(tab.id)) {
        return;
      }

      if (!isHttpUrl(tab.url) && !isHttpUrl(tab.pendingUrl)) {
        return;
      }

      attemptedTabIds.add(tab.id);
      candidates.push(tab);
    });
  }

  let lastError = "NO_HTTP_TAB";
  for (const tab of candidates) {
    const sent = await sendTabMessage(tab.id, message);
    if (sent.ok) {
      return { delivered: true, tabId: tab.id, error: null };
    }
    lastError = sent.error || "SEND_FAILED";
  }

  return {
    delivered: false,
    tabId: null,
    error: lastError
  };
}

async function pushReminder(reminderType, payload, settings) {
  const delivery = await sendMessageToActiveHttpTab({
    type: "holmeta-reminder",
    reminderType,
    payload
  });

  if (!delivery.delivered) {
    console.warn("[holmeta] reminder popup delivery failed", {
      reminderType,
      reason: delivery.error || "UNKNOWN"
    });
  }

  return delivery;
}

async function pushSummaryCard(runtime) {

  const summary = HC.summarizeReminderStats(runtime);
  await broadcastToTabs({
    type: "holmeta-summary-card",
    payload: {
      totalCompleted: summary.totalCompleted,
      totalScheduled: summary.totalScheduled,
      completed: summary.completed,
      scheduled: summary.scheduled
    }
  });
}

async function isReminderSuppressed(settings, runtime, reminderType, date = new Date()) {
  const config = HC.getReminderConfig(settings, reminderType);
  const nowTs = date.getTime();

  if (Number(settings.cadence.global.panicUntilTs || 0) > nowTs) {
    return { suppressed: true, reason: "PANIC_OFF" };
  }

  if (Number(settings.cadence.global.snoozeAllUntilTs || 0) > nowTs) {
    return { suppressed: true, reason: "SNOOZE_ALL" };
  }

  if (Number(runtime.scheduler.snoozedUntilByType[reminderType] || 0) > nowTs) {
    return { suppressed: true, reason: "SNOOZE_TYPE" };
  }

  if (HC.reminderSuppressedByQuietHours(settings, reminderType, date)) {
    return { suppressed: true, reason: "QUIET_HOURS" };
  }

  if (settings.cadence.global.suppressDuringFocus && runtime.focusSession) {
    return { suppressed: true, reason: "FOCUS" };
  }

  if (reminderType === "posture") {
    const inactivityMs = nowTs - Number(runtime.lastActivityTs || nowTs);
    const thresholdMs = Math.max(10, Number(config.stillnessMinutes || 50)) * 60 * 1000;
    if (inactivityMs < thresholdMs) {
      return { suppressed: true, reason: "NOT_STILL_ENOUGH" };
    }
  }

  if (settings.cadence.global.suppressWhenIdle) {
    const idleState = await idleQueryState(60);
    if (idleState === "idle" || idleState === "locked") {
      return { suppressed: true, reason: idleState.toUpperCase() };
    }
  }

  if (settings.cadence.global.meetingModeManual || settings.cadence.global.meetingModeAuto) {
    const meeting = await evaluateMeetingMode(settings);
    if (meeting.active) {
      return {
        suppressed: true,
        reason: "MEETING",
        subtle: true,
        meeting
      };
    }
  }

  return { suppressed: false, reason: "ACTIVE" };
}

function recomputeRuntimeNext(runtime) {
  let nextType = null;
  let nextAt = 0;

  HC.REMINDER_TYPES.forEach((type) => {
    const candidate = Number(runtime.scheduler.nextByType[type] || 0);
    if (!candidate) {
      return;
    }
    if (!nextAt || candidate < nextAt) {
      nextAt = candidate;
      nextType = type;
    }
  });

  runtime.scheduler.nextReminderType = nextType;
  runtime.scheduler.nextReminderAt = nextAt;
  return runtime;
}

async function clearReminderAlarms() {
  await Promise.all(HC.REMINDER_TYPES.map((type) => alarmsClear(reminderAlarmName(type))));
}

function ensureReminderDefaults(runtime) {
  HC.REMINDER_TYPES.forEach((type) => {
    runtime.scheduler.nextByType[type] = Number(runtime.scheduler.nextByType[type] || 0);
    runtime.scheduler.lastTriggeredByType[type] = Number(runtime.scheduler.lastTriggeredByType[type] || 0);
    runtime.scheduler.lastCompletedByType[type] = Number(runtime.scheduler.lastCompletedByType[type] || 0);
    runtime.scheduler.snoozedUntilByType[type] = Number(runtime.scheduler.snoozedUntilByType[type] || 0);
    runtime.scheduler.pendingByType[type] = Number(runtime.scheduler.pendingByType[type] || 0);
  });
  return runtime;
}

function nextClockAt(clock, nowDate = new Date()) {
  const target = new Date(nowDate);
  const [h = "9", m = "0"] = String(clock || "09:00").split(":");
  target.setHours(Number(h), Number(m), 0, 0);
  if (target.getTime() <= nowDate.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

async function dailyAuditFallbackNextAt(settings, nowDate = new Date()) {
  const config = settings.cadence?.reminders?.dailyAudit;
  if (!config) {
    return null;
  }

  const fallback = config.missedDayFallback || "nextMorning";
  if (fallback === "skip") {
    return null;
  }

  const logs = await getDailyLogs();
  const today = HC.todayKey(nowDate);
  const yesterdayDate = new Date(nowDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = HC.todayKey(yesterdayDate);

  const hasToday = logs.some((entry) => entry.date === today);
  const hasYesterday = logs.some((entry) => entry.date === yesterday);

  if (hasToday || hasYesterday) {
    return null;
  }

  if (fallback === "nextWorkWindow") {
    const start = config.schedule?.windows?.[0]?.start || config.nudgeTime || "09:00";
    const candidate = nextClockAt(start, nowDate);
    if (candidate > nowDate.getTime()) {
      return candidate;
    }
  }

  const morning = new Date(nowDate);
  morning.setHours(9, 0, 0, 0);
  if (morning.getTime() <= nowDate.getTime()) {
    return nowDate.getTime() + 5 * 60 * 1000;
  }

  return morning.getTime();
}

async function scheduleCadence(settings, rawRuntime, reason = "schedule") {
  const now = new Date();
  const runtime = ensureReminderDefaults(ensureToday(rawRuntime, now));

  await clearReminderAlarms();

  for (const type of HC.REMINDER_TYPES) {
    let nextAt = HC.computeNextReminderAt(settings, runtime, type, now);

    if (type === "dailyAudit") {
      const dailyAuditConfig = settings.cadence?.reminders?.dailyAudit;
      if (dailyAuditConfig?.schedule?.mode === "interval") {
        nextAt = nextClockAt(dailyAuditConfig.nudgeTime || "18:00", now);
      }

      const fallbackAt = await dailyAuditFallbackNextAt(settings, now);
      if (fallbackAt && (!nextAt || fallbackAt < nextAt)) {
        nextAt = fallbackAt;
      }
    }

    runtime.scheduler.nextByType[type] = nextAt || 0;

    if (nextAt) {
      chrome.alarms.create(reminderAlarmName(type), {
        when: Math.max(Date.now() + 1200, Number(nextAt))
      });
    }
  }

  recomputeRuntimeNext(runtime);
  runtime.scheduler.lastScheduleReason = reason;
  const saved = await writeRuntime(runtime);
  await updateActionBadge(settings, saved);
  return saved;
}

function summaryAlarmTime(settings, date = new Date()) {
  const nudgeTime = settings.cadence?.reminders?.dailyAudit?.nudgeTime || "18:00";
  const [h = "18", m = "0"] = String(nudgeTime).split(":");
  const summary = new Date(date);
  summary.setHours(Number(h), Number(m), 0, 0);
  summary.setMinutes(summary.getMinutes() + 90);

  if (summary.getTime() <= date.getTime()) {
    summary.setDate(summary.getDate() + 1);
  }

  return summary.getTime();
}

async function scheduleInfrastructureAlarms(settings) {
  await Promise.all([
    alarmsClear(ALARMS.circadian),
    alarmsClear(ALARMS.entitlement),
    alarmsClear(ALARMS.summary)
  ]);

  chrome.alarms.create(ALARMS.circadian, {
    periodInMinutes: 5
  });

  chrome.alarms.create(ALARMS.entitlement, {
    periodInMinutes: 120
  });

  chrome.alarms.create(ALARMS.summary, {
    when: summaryAlarmTime(settings)
  });
}

async function updateRuntimeCounter(reminderType, field, amount = 1) {
  const runtime = await getRuntime();
  const next = ensureToday(runtime);
  next.scheduler[field][reminderType] = Math.max(0, Number(next.scheduler[field][reminderType] || 0) + Number(amount));
  await writeRuntime(next);
  return next;
}

async function triggerReminder(reminderType, options = {}) {
  const [settings, runtimeRaw] = await Promise.all([getSettings(), getRuntime()]);
  const now = new Date();
  const runtime = ensureReminderDefaults(ensureToday(runtimeRaw, now));

  const config = HC.getReminderConfig(settings, reminderType);
  if (!config?.enabled && !options.force) {
    await scheduleCadence(settings, runtime, `${reminderType}-disabled`);
    return { ok: true, skipped: true };
  }

  const suppression = options.force
    ? { suppressed: false, reason: "FORCED" }
    : await isReminderSuppressed(settings, runtime, reminderType, now);

  runtime.scheduler.lastTriggeredByType[reminderType] = now.getTime();

  if (suppression.suppressed) {
    runtime.scheduler.suppressedByType[reminderType] = Math.max(0, Number(runtime.scheduler.suppressedByType[reminderType] || 0) + 1);
    runtime.scheduler.pendingByType[reminderType] = Math.max(0, Number(runtime.scheduler.pendingByType[reminderType] || 0));

    await scheduleCadence(settings, runtime, `${reminderType}-suppressed-${suppression.reason}`);
    return { ok: true, suppressed: true, reason: suppression.reason };
  }

  const pending = Number(runtime.scheduler.pendingByType[reminderType] || 0);
  if (pending > 0) {
    runtime.scheduler.ignoredByType[reminderType] = Math.max(0, Number(runtime.scheduler.ignoredByType[reminderType] || 0) + 1);
  }

  runtime.scheduler.pendingByType[reminderType] = Math.max(0, pending + 1);
  runtime.scheduler.firedByType[reminderType] = Math.max(0, Number(runtime.scheduler.firedByType[reminderType] || 0) + 1);

  const payload = buildReminderPayload(reminderType, settings, runtime);
  const delivery = await pushReminder(reminderType, payload, settings);

  if (payload.delivery?.sound) {
    const reminderVolume = HC.clamp(
      Number(settings.masterVolume ?? 0.35) * HC.clamp(Number(payload.delivery?.soundVolume ?? 1), 0, 1),
      0,
      1
    );

    await sendSfxToActiveTab(settings, reminderSfxEventId(reminderType), {
      channel: "reminder",
      volume: reminderVolume
    });
  }

  if (payload.delivery?.notification && !payload.delivery?.gentle) {
    notify(settings, reminderType + "-" + Date.now(), "holmeta: " + payload.title, payload.message);
  } else if (options.force && !delivery.delivered) {
    notify(
      settings,
      reminderType + "-test-fallback-" + Date.now(),
      "holmeta: " + payload.title,
      payload.message + " Open a normal web tab to view in-page reminder overlays."
    );
  }

  await scheduleCadence(settings, runtime, `${reminderType}-triggered`);

  return {
    ok: true,
    reminderType,
    payload,
    delivery
  };
}

async function applyReminderAction(message) {
  const reminderType = message.reminderType;
  if (!HC.REMINDER_TYPES.includes(reminderType)) {
    return { ok: false, error: "Invalid reminder type" };
  }

  const [settings, runtimeRaw] = await Promise.all([getSettings(), getRuntime()]);
  const runtime = ensureToday(runtimeRaw);
  const action = message.action || "dismiss";
  const nowTs = Date.now();

  if (action === "complete") {
    runtime.scheduler.pendingByType[reminderType] = Math.max(0, Number(runtime.scheduler.pendingByType[reminderType] || 0) - 1);
    runtime.scheduler.completedByType[reminderType] = Math.max(0, Number(runtime.scheduler.completedByType[reminderType] || 0) + 1);
    runtime.scheduler.lastCompletedByType[reminderType] = nowTs;
  }

  if (action === "dismiss" || action === "ignored") {
    runtime.scheduler.pendingByType[reminderType] = Math.max(0, Number(runtime.scheduler.pendingByType[reminderType] || 0) - 1);
    runtime.scheduler.ignoredByType[reminderType] = Math.max(0, Number(runtime.scheduler.ignoredByType[reminderType] || 0) + 1);
  }

  if (action === "snooze") {
    const config = HC.getReminderConfig(settings, reminderType);
    const minutes = Math.max(1, Number(message.minutes || config.defaultSnoozeMin || config.snoozeMinutes?.[0] || 5));
    runtime.scheduler.pendingByType[reminderType] = Math.max(0, Number(runtime.scheduler.pendingByType[reminderType] || 0) - 1);
    runtime.scheduler.snoozedUntilByType[reminderType] = nowTs + minutes * 60 * 1000;
  }

  await scheduleCadence(settings, runtime, `${reminderType}-${action}`);
  return { ok: true };
}

async function snoozeAllReminders(minutes = 15) {
  const settings = await getSettings();
  const next = HC.normalizeSettings({
    ...settings,
    cadence: {
      ...settings.cadence,
      global: {
        ...settings.cadence.global,
        snoozeAllUntilTs: Date.now() + Math.max(1, Number(minutes || 15)) * 60 * 1000
      }
    }
  });

  await writeSettings(next);
  const runtime = await getRuntime();
  await scheduleCadence(next, runtime, "snooze-all");
  return next;
}

async function setMeetingModeManual(enabled) {
  const settings = await getSettings();
  const next = HC.normalizeSettings({
    ...settings,
    cadence: {
      ...settings.cadence,
      global: {
        ...settings.cadence.global,
        meetingModeManual: Boolean(enabled)
      }
    }
  });

  await writeSettings(next);
  const runtime = await getRuntime();
  await updateActionBadge(next, runtime);
  return next;
}

async function panicOff(minutes = 30) {
  const settings = await getSettings();
  const untilTs = Date.now() + Math.max(1, Number(minutes || 30)) * 60 * 1000;
  const next = HC.normalizeSettings({
    ...settings,
    filterEnabled: false,
    colorAccurate: false,
    cadence: {
      ...settings.cadence,
      global: {
        ...settings.cadence.global,
        panicUntilTs: untilTs,
        snoozeAllUntilTs: untilTs
      }
    }
  });

  await writeSettings(next);
  await broadcastFilter(next);
  const runtime = await getRuntime();
  await scheduleCadence(next, runtime, "panic-off");
  return next;
}

async function setFocusRules(domains) {
  const normalized = domains
    .map((domain) => HC.normalizeDomain(domain))
    .filter(Boolean)
    .slice(0, FOCUS_RULE_IDS.length);

  const addRules = normalized.map((domain, index) => ({
    id: FOCUS_RULE_IDS[index],
    priority: 1,
    action: {
      type: "block"
    },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame"]
    }
  }));

  await dnrUpdate({
    removeRuleIds: FOCUS_RULE_IDS,
    addRules
  });
}

async function clearFocusRules() {
  await dnrUpdate({
    removeRuleIds: FOCUS_RULE_IDS,
    addRules: []
  });
}

async function closeDistractingTabs(domains) {
  const tabs = await tabsQuery({});
  const normalized = domains.map((domain) => HC.normalizeDomain(domain));

  const closeTargets = tabs.filter((tab) => {
    if (!tab.id || !isHttpUrl(tab.url)) {
      return false;
    }
    const host = hostnameFromUrl(tab.url);
    return normalized.some((domain) => HC.domainMatches(host, domain));
  });

  await Promise.all(closeTargets.map((tab) => tabsRemove(tab.id)));
}

async function broadcastFocusState() {
  const runtime = await getRuntime();
  await broadcastToTabs({
    type: "holmeta-focus-hud",
    focusSession: runtime.focusSession
  });
}

async function stopFocusSession(reason = "manual") {
  await clearFocusRules();
  await alarmsClear(ALARMS.focusTick);
  const runtime = await getRuntime();
  runtime.focusSession = null;
  await writeRuntime(runtime);
  await broadcastFocusState();

  const settings = await getSettings();

  if (reason === "completed") {
    notify(settings, `focus-done-${Date.now()}`, "holmeta: Focus Complete", "Session complete. Take 2 minutes to reset.");
  }

  await sendSfxToActiveTab(settings, "focusEnd", {
    channel: "focus"
  });

  await updateActionBadge(settings, runtime);
}

async function startFocusSession(payload = {}) {
  const settings = await getSettings();
  const entitlement = await getEntitlement();
  const premium = isPremium(settings, entitlement);

  const requestedDuration = Number(payload.durationMin || 25);
  const allowedDurations = [25, 50, 90];
  const durationMin = allowedDurations.includes(requestedDuration) ? requestedDuration : 25;

  const requestedDomains = Array.isArray(payload.domains) && payload.domains.length
    ? payload.domains
    : settings.distractorDomains;

  const domains = premium
    ? requestedDomains
    : requestedDomains.slice(0, 3);

  await setFocusRules(domains);
  if (payload.closeExistingTabs !== false) {
    await closeDistractingTabs(domains);
  }

  const startedAt = Date.now();
  const endsAt = startedAt + durationMin * 60 * 1000;

  const runtime = await getRuntime();
  runtime.focusSession = {
    startedAt,
    endsAt,
    durationMin,
    domains,
    premium
  };
  await writeRuntime(runtime);

  chrome.alarms.create(ALARMS.focusTick, {
    periodInMinutes: 1
  });

  await broadcastFocusState();
  await sendSfxToActiveTab(settings, "focusStart", {
    channel: "focus"
  });
  await updateActionBadge(settings, runtime);

  return {
    startedAt,
    endsAt,
    durationMin,
    domains,
    premium
  };
}

async function tickFocusSession() {
  const runtime = await getRuntime();
  const focus = runtime.focusSession;

  if (!focus) {
    await alarmsClear(ALARMS.focusTick);
    return;
  }

  if (Date.now() >= Number(focus.endsAt)) {
    await stopFocusSession("completed");
    return;
  }

  await broadcastFocusState();
}

async function incrementHydration(amount = 1) {
  const hydration = await getHydration();
  const day = HC.todayKey();
  hydration[day] = Math.max(0, Number(hydration[day] || 0) + Number(amount));
  await storageSet({ [STORAGE.hydration]: hydration });

  const settings = await getSettings();
  return {
    day,
    glasses: hydration[day],
    goal: settings.cadence.reminders.hydration.dailyGoalGlasses,
    streak: HC.computeHydrationStreak(hydration)
  };
}

async function addCalmMinutes(minutes = 1) {
  const calm = await getCalm();
  const day = HC.todayKey();
  calm[day] = Math.max(0, Number(calm[day] || 0) + Number(minutes));
  await storageSet({ [STORAGE.calm]: calm });
  return {
    day,
    calmMinutes: calm[day]
  };
}

async function saveDailyLog(payload) {
  const day = payload.date || HC.todayKey();
  const logs = await getDailyLogs();
  const filtered = logs.filter((entry) => entry.date !== day);

  filtered.push({
    date: day,
    energy: Number(payload.energy || 0),
    mood: Number(payload.mood || 0),
    sleepQuality: Number(payload.sleepQuality || 0)
  });

  filtered.sort((a, b) => a.date.localeCompare(b.date));
  await storageSet({ [STORAGE.dailyLogs]: filtered });

  return filtered;
}

async function getTrendsData() {
  const [dailyLogs, hydration, calm] = await Promise.all([
    getDailyLogs(),
    getHydration(),
    getCalm()
  ]);

  return {
    dailyLogs,
    hydration,
    calm
  };
}

async function setSiteOverrideForDomain(domain, patch) {
  const settings = await getSettings();
  const nextSettings = HC.setSiteOverride(settings, domain, patch || {});
  return writeSettings(nextSettings);
}

async function clearSiteOverrideForDomain(domain) {
  const settings = await getSettings();
  const nextSettings = HC.clearSiteOverride(settings, domain);
  return writeSettings(nextSettings);
}

async function setFilterEnabled(enabled) {
  return setSettings({
    filterEnabled: Boolean(enabled),
    colorAccurate: false
  });
}

async function toggleColorAccurate() {
  const settings = await getSettings();
  return setSettings({
    colorAccurate: !settings.colorAccurate,
    filterEnabled: true
  });
}

async function adjustGlobalIntensity(delta) {
  const settings = await getSettings();
  const nextIntensity = HC.clamp(Number(settings.filterIntensity || 0) + Number(delta || 0), 0, 1);
  return setSettings({
    filterIntensity: nextIntensity,
    filterEnabled: true,
    colorAccurate: false
  });
}

async function clearReminderSnooze(runtime, reminderType) {
  runtime.scheduler.snoozedUntilByType[reminderType] = 0;
  return runtime;
}

configureSidePanelDefaults("service-worker-load").catch(() => {});

async function runBootstrap() {
  const settings = await getSettings();
  await scheduleInfrastructureAlarms(settings);
  await refreshEntitlement(settings, true);
  await configureSidePanelDefaults("bootstrap");
  const runtime = await getRuntime();
  await scheduleCadence(settings, runtime, "bootstrap");
  await broadcastFilter(settings);
  await broadcastFocusState();
}

chrome.runtime.onInstalled.addListener(() => {
  runBootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  runBootstrap();
});

chrome.commands?.onCommand?.addListener(async (command) => {
  try {
    if (command === "toggle-filters") {
      const settings = await getSettings();
      const next = await setFilterEnabled(!settings.filterEnabled);
      await broadcastFilter(next);
      return;
    }

    if (command === "toggle-color-accurate") {
      const next = await toggleColorAccurate();
      await broadcastFilter(next);
      return;
    }

    if (command === "increase-intensity") {
      const next = await adjustGlobalIntensity(0.05);
      await broadcastFilter(next);
      return;
    }

    if (command === "decrease-intensity") {
      const next = await adjustGlobalIntensity(-0.05);
      await broadcastFilter(next);
    }
  } catch (_) {
    // no-op
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const settings = await getSettings();

  if (alarm.name.startsWith(REMINDER_ALARM_PREFIX)) {
    const reminderType = alarm.name.replace(REMINDER_ALARM_PREFIX, "");
    if (HC.REMINDER_TYPES.includes(reminderType)) {
      await triggerReminder(reminderType);
    }
    return;
  }

  if (alarm.name === ALARMS.circadian) {
    await broadcastFilter(settings);
    return;
  }

  if (alarm.name === ALARMS.focusTick) {
    await tickFocusSession();
    return;
  }

  if (alarm.name === ALARMS.entitlement) {
    await refreshEntitlement(settings, false);
    return;
  }

  if (alarm.name === ALARMS.summary) {
    const runtime = await getRuntime();
    await pushSummaryCard(runtime);
    runtime.scheduler.lastSummaryAt = Date.now();
    await writeRuntime(runtime);
    await scheduleInfrastructureAlarms(settings);
  }
});

chrome.tabs.onActivated.addListener(async (info) => {
  if (info.tabId) {
    await disableSidePanelForTab(info.tabId);
    await sendStateToTab(info.tabId);
    const settings = await getSettings();
    const runtime = await getRuntime();
    await updateActionBadge(settings, runtime);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }

  await disableSidePanelForTab(tabId);

  if (tab?.url && isHttpUrl(tab.url)) {
    await sendStateToTab(tabId);
    const settings = await getSettings();
    const runtime = await getRuntime();
    await updateActionBadge(settings, runtime);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!isValidTabId(tab?.id)) {
    return;
  }

  await disableSidePanelForTab(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return;
  }

  (async () => {
    if (message.type === "HOLMETA_PANEL_OPEN") {
      const result = await openSidePanelForContext(message, sender || {});
      sendResponse(result);
      return;
    }

    if (message.type === "HOLMETA_PANEL_CLOSE") {
      const result = await closeSidePanelForContext(message, sender || {});
      sendResponse(result);
      return;
    }

    if (message.type === "holmeta-request-state") {
      const domain = HC.normalizeDomain(message.domain || "");
      const [settings, runtime, entitlement, hydration, calm, auth] = await Promise.all([
        getSettings(),
        getRuntime(),
        getEntitlement(),
        getHydration(),
        getCalm(),
        getAuth()
      ]);

      const nextReminder = HC.getNextReminderSnapshot(settings, runtime);
      sendResponse({
        settings,
        runtime,
        entitlement,
        auth: {
          paired: Boolean(auth.extensionToken),
          pairedAt: auth.pairedAt || null
        },
        hydrationToday: hydration[HC.todayKey()] || 0,
        calmToday: calm[HC.todayKey()] || 0,
        filterPayload: HC.computeFilterPayload(settings, new Date(), domain),
        siteOverride: domain ? HC.getSiteOverride(settings, domain) : null,
        filterPresets: HC.FILTER_PRESET_OPTIONS,
        reminderSummary: HC.summarizeReminderStats(runtime),
        nextReminder
      });
      return;
    }

    if (message.type === "holmeta-get-filter-debug") {
      const settings = await getSettings();
      const domain = HC.normalizeDomain(message.domain || "");
      const filterPayload = HC.computeFilterPayload(settings, new Date(), domain);
      sendResponse({
        ok: true,
        filterPayload,
        settings
      });
      return;
    }

    if (message.type === "holmeta-get-cadence-preview") {
      const settings = await getSettings();
      const timeline = HC.buildTimelinePreview(settings, message.start || "09:00", message.end || "18:00");
      sendResponse({ ok: true, timeline });
      return;
    }

    if (message.type === "holmeta-activity-ping") {
      const runtime = await getRuntime();
      runtime.lastActivityTs = Number(message.ts || Date.now());
      await writeRuntime(runtime);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-update-settings") {
      const entitlement = await getEntitlement();
      const next = await setSettings(message.patch || {}, { entitlement });
      await scheduleInfrastructureAlarms(next);
      const runtime = await getRuntime();
      await scheduleCadence(next, runtime, "update-settings");
      await broadcastFilter(next);

      if (
        Object.prototype.hasOwnProperty.call(message.patch || {}, "entitlementUrl") ||
        Object.prototype.hasOwnProperty.call(message.patch || {}, "apiBaseUrl") ||
        Object.prototype.hasOwnProperty.call(message.patch || {}, "extensionToken") ||
        Object.prototype.hasOwnProperty.call(message.patch || {}, "devBypassPremium")
      ) {
        await refreshEntitlement(next, true);
      }

      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-apply-cadence-preset") {
      const settings = await getSettings();
      const entitlement = await getEntitlement();
      const presetApplied = HC.applyCadencePreset(settings, message.presetId);
      const next = isPremium(presetApplied, entitlement)
        ? presetApplied
        : HC.enforceFreeTierSettings(presetApplied, false);
      await writeSettings(next);
      const runtime = await getRuntime();
      await scheduleCadence(next, runtime, "preset");
      await broadcastFilter(next);
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-reapply-filter") {
      const settings = await getSettings();
      await broadcastFilter(settings);
      if (sender?.tab?.id) {
        await sendStateToTab(sender.tab.id);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-set-filter-enabled") {
      const next = await setFilterEnabled(message.enabled);
      await broadcastFilter(next);
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-toggle-color-accurate") {
      const next = await toggleColorAccurate();
      await broadcastFilter(next);
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-adjust-intensity") {
      const next = await adjustGlobalIntensity(message.delta || 0);
      await broadcastFilter(next);
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-set-site-override") {
      const domain = HC.normalizeDomain(message.domain);
      if (!domain) {
        sendResponse({ ok: false, error: "Missing domain" });
        return;
      }
      const next = await setSiteOverrideForDomain(domain, message.override || {});
      await broadcastFilter(next);
      sendResponse({ ok: true, settings: next, siteOverride: HC.getSiteOverride(next, domain) });
      return;
    }

    if (message.type === "holmeta-clear-site-override") {
      const domain = HC.normalizeDomain(message.domain);
      if (!domain) {
        sendResponse({ ok: false, error: "Missing domain" });
        return;
      }
      const next = await clearSiteOverrideForDomain(domain);
      await broadcastFilter(next);
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-toggle-domain-filter") {
      const domain = HC.normalizeDomain(message.domain);
      if (!domain) {
        sendResponse({ ok: false });
        return;
      }

      const shouldDisable = Boolean(message.enabled);
      const next = await setSiteOverrideForDomain(domain, {
        enabled: !shouldDisable
      });

      await broadcastFilter(next);
      sendResponse({
        ok: true,
        disabledDomains: next.disabledDomains,
        siteOverride: HC.getSiteOverride(next, domain)
      });
      return;
    }

    if (message.type === "holmeta-trigger-eye-break") {
      const response = await triggerReminder("eye", { force: true, source: "legacy-eye" });
      sendResponse(response);
      return;
    }

    if (message.type === "holmeta-test-reminder") {
      const reminderType = HC.REMINDER_TYPES.includes(message.reminderType) ? message.reminderType : "eye";
      const response = await triggerReminder(reminderType, { force: true, source: "test" });
      sendResponse(response);
      return;
    }

    if (message.type === "holmeta-snooze-eye-break") {
      const runtime = await getRuntime();
      runtime.scheduler.snoozedUntilByType.eye = Date.now() + Math.max(1, Number(message.minutes || 5)) * 60 * 1000;
      const settings = await getSettings();
      await scheduleCadence(settings, runtime, "legacy-eye-snooze");
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-reminder-action") {
      const response = await applyReminderAction(message);
      sendResponse(response);
      return;
    }

    if (message.type === "holmeta-snooze-all") {
      const next = await snoozeAllReminders(Number(message.minutes || 15));
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-panic-off") {
      const next = await panicOff(Number(message.minutes || 30));
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-toggle-meeting-mode") {
      const settings = await setMeetingModeManual(Boolean(message.enabled));
      sendResponse({ ok: true, settings });
      return;
    }

    if (message.type === "holmeta-log-hydration") {
      const result = await incrementHydration(Number(message.amount || 1));
      sendResponse({ ok: true, ...result });
      return;
    }

    if (message.type === "holmeta-add-calm-minutes") {
      const result = await addCalmMinutes(Number(message.minutes || 1));
      sendResponse({ ok: true, ...result });
      return;
    }

    if (message.type === "holmeta-save-daily-log") {
      const logs = await saveDailyLog(message.payload || {});
      sendResponse({ ok: true, logs });
      return;
    }

    if (message.type === "holmeta-get-trends") {
      const trends = await getTrendsData();
      sendResponse({ ok: true, ...trends });
      return;
    }

    if (message.type === "holmeta-save-audit") {
      await storageSet({ [STORAGE.audit]: message.payload || {} });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-get-audit") {
      const data = await storageGet(STORAGE.audit);
      sendResponse({ ok: true, audit: data[STORAGE.audit] || null });
      return;
    }

    if (message.type === "holmeta-start-focus") {
      const focusSession = await startFocusSession(message.payload || {});
      sendResponse({ ok: true, focusSession });
      return;
    }

    if (message.type === "holmeta-stop-focus" || message.type === "holmeta-panic-focus") {
      await stopFocusSession("manual");
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-refresh-entitlement") {
      const settings = await getSettings();
      const entitlement = await refreshEntitlement(settings, true);
      sendResponse({ ok: true, entitlement });
      return;
    }

    if (message.type === "holmeta-test-entitlement-fetch") {
      const settings = await getSettings();
      const result = await testEntitlementFetch(settings);
      sendResponse(result);
      return;
    }

    if (message.type === "holmeta-exchange-pairing-code") {
      const settings = await getSettings();
      const result = await exchangePairingCode(settings, String(message.code || "").trim().toUpperCase());
      sendResponse(result);
      return;
    }

    if (message.type === "holmeta-clear-extension-token") {
      await clearAuth();
      const next = await setSettings({ extensionToken: "" });
      const entitlement = await refreshEntitlement(next, true);
      sendResponse({ ok: true, entitlement });
      return;
    }

    if (message.type === "holmeta-check-premium") {
      const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
      sendResponse({
        ok: true,
        premium: isPremium(settings, entitlement),
        entitlement
      });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })();

  return true;
});
