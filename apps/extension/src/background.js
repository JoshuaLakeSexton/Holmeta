importScripts("common.js");

const HC = globalThis.HolmetaCommon;

const STORAGE = {
  settings: "holmeta.settings",
  runtime: "holmeta.runtime",
  hydration: "holmeta.hydration",
  calm: "holmeta.calm",
  dailyLogs: "holmeta.dailyLogs",
  entitlement: "holmeta.entitlement",
  audit: "holmeta.audit"
};

const ALARMS = {
  eyeBreak: "holmeta-eye-break",
  hydration: "holmeta-hydration",
  circadian: "holmeta-circadian",
  stillness: "holmeta-stillness",
  focusTick: "holmeta-focus-tick",
  entitlement: "holmeta-entitlement"
};

const FOCUS_RULE_IDS = Array.from({ length: 120 }, (_, i) => 9000 + i);
const NOTIFICATION_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+Xw8N3wAAAABJRU5ErkJggg==";

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(payload) {
  return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}

function storageRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
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

function safeSendTab(tabId, message) {
  try {
    chrome.tabs.sendMessage(tabId, message, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {
    // no-op
  }
}

async function getSettings() {
  const data = await storageGet(STORAGE.settings);
  return {
    ...HC.DEFAULT_SETTINGS,
    ...(data[STORAGE.settings] || {})
  };
}

async function setSettings(patch) {
  const current = await getSettings();
  const next = {
    ...current,
    ...(patch || {})
  };
  await storageSet({ [STORAGE.settings]: next });
  return next;
}

async function getRuntime() {
  const data = await storageGet(STORAGE.runtime);
  return {
    ...HC.DEFAULT_RUNTIME,
    ...(data[STORAGE.runtime] || {})
  };
}

async function setRuntime(patch) {
  const current = await getRuntime();
  const next = {
    ...current,
    ...(patch || {})
  };
  await storageSet({ [STORAGE.runtime]: next });
  return next;
}

async function getEntitlement() {
  const data = await storageGet(STORAGE.entitlement);
  return {
    active: false,
    plan: null,
    renewsAt: null,
    checkedAt: null,
    ...(data[STORAGE.entitlement] || {})
  };
}

async function setEntitlement(entitlement) {
  const payload = {
    active: Boolean(entitlement.active),
    plan: entitlement.plan || null,
    renewsAt: entitlement.renewsAt || null,
    checkedAt: new Date().toISOString()
  };
  await storageSet({ [STORAGE.entitlement]: payload });
  return payload;
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
    payload: HC.computeFilterPayload(settings, new Date())
  });

  safeSendTab(tabId, {
    type: "holmeta-focus-hud",
    focusSession: runtime.focusSession
  });
}

async function broadcastFilter(settings) {
  const payload = HC.computeFilterPayload(settings, new Date());
  await broadcastToTabs({
    type: "holmeta-apply-filter",
    payload
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

async function triggerEyeBreak(settings) {
  await setRuntime({ lastEyeBreakTs: Date.now() });
  await broadcastToTabs({
    type: "holmeta-eye-break",
    payload: {
      title: "20-20-20 EYE RECOVERY",
      guidance: [
        "LOOK AT A FAR OBJECT FOR 20 SECONDS",
        "BLINK SLOWLY FOR 10 SECONDS",
        "PALM EYES FOR 15 SECONDS"
      ]
    }
  });
  notify(settings, `eye-${Date.now()}`, "holmeta: Eye Recovery", "Look 20 feet away for 20 seconds.");
}

async function triggerHydrationReminder(settings) {
  await setRuntime({ lastHydrationReminderTs: Date.now() });
  await broadcastToTabs({
    type: "holmeta-hydration",
    payload: {
      title: "HYDRATION CHECK",
      message: "LOG WATER INTAKE. ELECTROLYTES IF YOU SWEAT OR USE CAFFEINE."
    }
  });
  notify(settings, `hyd-${Date.now()}`, "holmeta: Hydration", "Hydration protocol. Log one glass.");
}

async function checkStillness(settings) {
  const runtime = await getRuntime();
  const now = Date.now();
  const inactiveMs = now - Number(runtime.lastActivityTs || now);
  const nudgeCooldownMs = 20 * 60 * 1000;
  const thresholdMs = Math.max(15, Number(settings.stillnessThresholdMin || 50)) * 60 * 1000;

  if (inactiveMs < thresholdMs) {
    return;
  }

  if (now - Number(runtime.lastStillnessNudgeTs || 0) < nudgeCooldownMs) {
    return;
  }

  const idleState = await idleQueryState(60);
  if (idleState === "locked") {
    return;
  }

  await setRuntime({ lastStillnessNudgeTs: now });
  await broadcastToTabs({
    type: "holmeta-stillness",
    payload: {
      minutesInactive: Math.round(inactiveMs / 60000),
      stretches: [
        "SHOULDER ROLLS x8",
        "CHEST OPENERS x6",
        "STAND + WALK 60 SECONDS"
      ]
    }
  });
  notify(settings, `still-${now}`, "holmeta: Movement Nudge", "Stand and stretch for one minute.");
}

async function scheduleAlarms(settings) {
  const names = Object.values(ALARMS);
  await Promise.all(names.map((name) => alarmsClear(name)));

  chrome.alarms.create(ALARMS.eyeBreak, {
    periodInMinutes: Math.max(10, Number(settings.eyeBreakIntervalMin || 20))
  });

  chrome.alarms.create(ALARMS.hydration, {
    periodInMinutes: Math.max(15, Number(settings.hydrationIntervalMin || 60))
  });

  chrome.alarms.create(ALARMS.circadian, {
    periodInMinutes: 5
  });

  chrome.alarms.create(ALARMS.stillness, {
    periodInMinutes: 10
  });

  chrome.alarms.create(ALARMS.entitlement, {
    periodInMinutes: 6 * 60
  });
}

function isPremium(settings, entitlement) {
  return Boolean(settings.devBypassPremium || entitlement.active);
}

async function refreshEntitlement(settings, force = false) {
  if (settings.devBypassPremium) {
    return setEntitlement({
      active: true,
      plan: "dev-bypass",
      renewsAt: null
    });
  }

  const existing = await getEntitlement();
  if (!force && existing.checkedAt) {
    const elapsed = Date.now() - new Date(existing.checkedAt).getTime();
    if (elapsed < 15 * 60 * 1000) {
      return existing;
    }
  }

  if (!settings.entitlementUrl) {
    return setEntitlement({
      active: false,
      plan: null,
      renewsAt: null
    });
  }

  try {
    const response = await fetch(settings.entitlementUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Entitlement request failed: ${response.status}`);
    }

    const json = await response.json();
    return setEntitlement({
      active: Boolean(json.active),
      plan: json.plan || null,
      renewsAt: json.renewsAt || null
    });
  } catch (_) {
    return existing;
  }
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
  await setRuntime({ focusSession: null });
  await broadcastFocusState();

  if (reason === "completed") {
    const settings = await getSettings();
    notify(settings, `focus-done-${Date.now()}`, "holmeta: Focus Complete", "Session complete. Take 2 minutes to reset.");
  }
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

  await setRuntime({
    focusSession: {
      startedAt,
      endsAt,
      durationMin,
      domains,
      premium
    }
  });

  chrome.alarms.create(ALARMS.focusTick, {
    periodInMinutes: 1
  });

  await broadcastFocusState();

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
    goal: settings.hydrationGoalGlasses,
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

async function bootstrap() {
  const settings = await getSettings();
  await scheduleAlarms(settings);
  await refreshEntitlement(settings, true);
  await broadcastFilter(settings);
  await broadcastFocusState();
}

chrome.runtime.onInstalled.addListener(() => {
  bootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  bootstrap();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const settings = await getSettings();

  if (alarm.name === ALARMS.eyeBreak) {
    await triggerEyeBreak(settings);
    return;
  }

  if (alarm.name === ALARMS.hydration) {
    await triggerHydrationReminder(settings);
    return;
  }

  if (alarm.name === ALARMS.circadian) {
    await broadcastFilter(settings);
    return;
  }

  if (alarm.name === ALARMS.stillness) {
    await checkStillness(settings);
    return;
  }

  if (alarm.name === ALARMS.focusTick) {
    await tickFocusSession();
    return;
  }

  if (alarm.name === ALARMS.entitlement) {
    await refreshEntitlement(settings, false);
  }
});

chrome.tabs.onActivated.addListener(async (info) => {
  if (info.tabId) {
    await sendStateToTab(info.tabId);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab?.url && isHttpUrl(tab.url)) {
    await sendStateToTab(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return;
  }

  (async () => {
    if (message.type === "holmeta-request-state") {
      const [settings, runtime, entitlement, hydration, calm] = await Promise.all([
        getSettings(),
        getRuntime(),
        getEntitlement(),
        getHydration(),
        getCalm()
      ]);

      sendResponse({
        settings,
        runtime,
        entitlement,
        hydrationToday: hydration[HC.todayKey()] || 0,
        calmToday: calm[HC.todayKey()] || 0,
        filterPayload: HC.computeFilterPayload(settings, new Date())
      });
      return;
    }

    if (message.type === "holmeta-activity-ping") {
      await setRuntime({ lastActivityTs: Number(message.ts || Date.now()) });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-update-settings") {
      const next = await setSettings(message.patch || {});
      await scheduleAlarms(next);
      await broadcastFilter(next);
      if (Object.prototype.hasOwnProperty.call(message.patch || {}, "entitlementUrl") || Object.prototype.hasOwnProperty.call(message.patch || {}, "devBypassPremium")) {
        await refreshEntitlement(next, true);
      }
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-toggle-domain-filter") {
      const settings = await getSettings();
      const domain = HC.normalizeDomain(message.domain);
      const existing = settings.disabledDomains || [];
      let disabledDomains = existing;

      if (!domain) {
        sendResponse({ ok: false });
        return;
      }

      if (message.enabled === false) {
        disabledDomains = existing.filter((item) => item !== domain);
      } else {
        disabledDomains = existing.includes(domain) ? existing : [...existing, domain];
      }

      const next = await setSettings({ disabledDomains });
      await broadcastFilter(next);
      sendResponse({ ok: true, disabledDomains: next.disabledDomains });
      return;
    }

    if (message.type === "holmeta-trigger-eye-break") {
      const settings = await getSettings();
      await triggerEyeBreak(settings);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-snooze-eye-break") {
      const minutes = Math.max(1, Number(message.minutes || 5));
      chrome.alarms.create(ALARMS.eyeBreak, {
        delayInMinutes: minutes
      });
      sendResponse({ ok: true });
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
