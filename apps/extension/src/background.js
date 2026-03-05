importScripts("common.js");

const HC = globalThis.HolmetaCommon;

const STORAGE = {
  settings: "holmeta.settings",
  entitlement: "holmeta.entitlement",
  core: "holmeta.core.v1"
};

const ALARMS = {
  entitlement: "holmeta-entitlement",
  reminderPrefix: "holmeta-core-reminder-",
  wellnessBreak: "holmeta-wellness-break",
  wellnessEye: "holmeta-wellness-eye"
};

const NOTIFICATIONS = {
  reminderPrefix: "holmeta-core-reminder-notification-"
};

const CORE_SCHEMA_VERSION = 1;
const CORE_MAX_ITEMS = 1200;
const CORE_MAX_SESSIONS = 120;
const CORE_RESUME_LIMIT = 7;
const ENTITLEMENT_GRACE_MS = 72 * 60 * 60 * 1000;
const NOTIFICATION_ICON = "src/assets/icons/icon48.png";

const DOMAIN_TAG_HINTS = [
  { test: /(^|\.)github\.com$/, tags: ["Dev"] },
  { test: /(^|\.)gitlab\.com$/, tags: ["Dev"] },
  { test: /(^|\.)figma\.com$/, tags: ["Design"] },
  { test: /(^|\.)dribbble\.com$/, tags: ["Design"] },
  { test: /(^|\.)docs\.google\.com$/, tags: ["Docs"] },
  { test: /(^|\.)notion\.so$/, tags: ["Docs"] },
  { test: /(^|\.)linear\.app$/, tags: ["Planning"] },
  { test: /(^|\.)jira\./, tags: ["Planning"] }
];

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(payload) {
  return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}

function alarmsClear(name) {
  return new Promise((resolve) => chrome.alarms.clear(name, () => resolve()));
}

function alarmsGetAll() {
  return new Promise((resolve) => chrome.alarms.getAll((alarms) => resolve(Array.isArray(alarms) ? alarms : [])));
}

function tabsQuery(queryInfo = {}) {
  return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
}

function tabsSendMessage(tabId, payload) {
  return new Promise((resolve) => {
    if (!Number.isInteger(tabId) || tabId < 0 || !chrome.tabs?.sendMessage) {
      resolve({ ok: false, error: "INVALID_TAB" });
      return;
    }
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "SEND_MESSAGE_FAILED" });
        return;
      }
      resolve({ ok: true, response: response || null });
    });
  });
}

function notify(id, options) {
  return new Promise((resolve) => chrome.notifications.create(id, options, () => resolve()));
}

function notificationClear(id) {
  return new Promise((resolve) => chrome.notifications.clear(id, () => resolve()));
}

function isHttpUrl(rawUrl) {
  const safe = String(rawUrl || "").trim();
  if (!safe) {
    return false;
  }
  try {
    const parsed = new URL(safe);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function normalizeHttpUrl(rawUrl) {
  const safe = String(rawUrl || "").trim();
  if (!safe) {
    return "";
  }
  try {
    const parsed = new URL(safe);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch (_) {
    return "";
  }
}

function normalizeDomain(rawDomainOrUrl) {
  const safe = String(rawDomainOrUrl || "").trim();
  if (!safe) {
    return "";
  }

  if (isHttpUrl(safe)) {
    try {
      return HC.normalizeDomain(new URL(safe).hostname.replace(/^www\./, ""));
    } catch (_) {
      return "";
    }
  }

  return HC.normalizeDomain(safe.replace(/^www\./, ""));
}

function hostnameFromUrl(rawUrl) {
  const safe = normalizeHttpUrl(rawUrl);
  if (!safe) {
    return "";
  }
  try {
    return normalizeDomain(new URL(safe).hostname);
  } catch (_) {
    return "";
  }
}

function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createInstallId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `inst-${Date.now()}-${Math.random().toString(16).slice(2, 12)}`;
}

function normalizeTags(rawTags) {
  if (!Array.isArray(rawTags)) {
    return [];
  }
  const cleaned = rawTags
    .map((tag) => String(tag || "").trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 12);
  return [...new Set(cleaned)];
}

function parseTagCsv(value) {
  return normalizeTags(
    String(value || "")
      .split(",")
      .map((part) => part.trim())
  );
}

function suggestedTagsForDomain(domain) {
  const safe = String(domain || "").trim().toLowerCase();
  if (!safe) {
    return [];
  }
  const matched = DOMAIN_TAG_HINTS.find((hint) => hint.test.test(safe));
  return matched ? [...matched.tags] : [];
}

function normalizeEntitlementStatus(rawStatus, activeHint = false) {
  const safe = String(rawStatus || "").trim().toLowerCase();
  if (["active", "trialing", "past_due", "canceled", "inactive", "invalid"].includes(safe)) {
    return safe;
  }
  return activeHint ? "active" : "inactive";
}

function entitlementActiveForStatus(status) {
  return status === "active" || status === "trialing";
}

function normalizeEntitlement(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const status = normalizeEntitlementStatus(source.status, source.active);
  const active = Boolean(source.active ?? entitlementActiveForStatus(status));
  return {
    active,
    status,
    plan: String(source.plan || (active ? "paid" : "free")),
    renewsAt: source.renewsAt || null,
    trialEndsAt: source.trialEndsAt || null,
    checkedAt: source.checkedAt || null,
    stale: Boolean(source.stale),
    graceUntil: source.graceUntil || null,
    lastActiveAt: source.lastActiveAt || null,
    error: source.error ? String(source.error) : ""
  };
}

function normalizeWellness(settings) {
  const source = settings?.wellness && typeof settings.wellness === "object"
    ? settings.wellness
    : {};
  return {
    breaksEnabled: Boolean(source.breaksEnabled),
    breaksIntervalMin: Math.max(15, Math.min(180, Math.round(Number(source.breaksIntervalMin || 50)))),
    eyeEnabled: Boolean(source.eyeEnabled),
    eyeIntervalMin: Math.max(10, Math.min(120, Math.round(Number(source.eyeIntervalMin || 20)))),
    snoozeUntilTs: Math.max(0, Number(source.snoozeUntilTs || 0))
  };
}

async function getSettings() {
  const data = await storageGet(STORAGE.settings);
  return HC.normalizeSettings(data[STORAGE.settings] || {});
}

async function writeSettings(nextSettings) {
  const normalized = HC.normalizeSettings(nextSettings || {});
  await storageSet({ [STORAGE.settings]: normalized });
  return normalized;
}

async function updateSettings(patch) {
  const current = await getSettings();
  const next = HC.normalizeSettings({
    ...current,
    ...(patch || {})
  });
  await storageSet({ [STORAGE.settings]: next });
  return next;
}

async function getEntitlement() {
  const data = await storageGet(STORAGE.entitlement);
  return normalizeEntitlement(data[STORAGE.entitlement] || {});
}

async function writeEntitlement(nextEntitlement) {
  const normalized = normalizeEntitlement(nextEntitlement || {});
  await storageSet({ [STORAGE.entitlement]: normalized });
  return normalized;
}

function effectiveSettingsForTier(settings, entitlement) {
  const premiumActive = Boolean(settings?.devBypassPremium || entitlement?.active);
  const normalized = HC.normalizeSettings(settings || {});
  if (!premiumActive) {
    normalized.filterEnabled = false;
    normalized.wellness = {
      ...normalizeWellness(normalized),
      breaksEnabled: false,
      eyeEnabled: false
    };
  } else {
    normalized.wellness = normalizeWellness(normalized);
  }
  return normalized;
}

function computeFilterPayloadForUrl(settings, entitlement, rawUrlOrHost) {
  const effective = effectiveSettingsForTier(settings, entitlement);
  const host = hostnameFromUrl(rawUrlOrHost) || normalizeDomain(rawUrlOrHost);
  return HC.computeFilterPayload(effective, new Date(), host);
}

async function applyFilterToTab(tab, settingsInput = null, entitlementInput = null) {
  const safeUrl = normalizeHttpUrl(tab?.url || "");
  if (!safeUrl || !Number.isInteger(tab?.id)) {
    return { ok: false, error: "INVALID_TAB" };
  }
  const settings = settingsInput || (await getSettings());
  const entitlement = entitlementInput || (await getEntitlement());
  const payload = computeFilterPayloadForUrl(settings, entitlement, safeUrl);
  return tabsSendMessage(tab.id, {
    type: "holmeta-apply-filter",
    payload
  });
}

async function applyFiltersToActiveTabs(settingsInput = null, entitlementInput = null) {
  const [settings, entitlement, tabs] = await Promise.all([
    settingsInput ? Promise.resolve(settingsInput) : getSettings(),
    entitlementInput ? Promise.resolve(entitlementInput) : getEntitlement(),
    tabsQuery({ active: true, currentWindow: true })
  ]);

  const activeTabs = Array.isArray(tabs) ? tabs.filter((tab) => normalizeHttpUrl(tab?.url || "")) : [];
  const results = [];
  for (const tab of activeTabs) {
    results.push(await applyFilterToTab(tab, settings, entitlement));
  }
  return {
    ok: true,
    count: results.filter((entry) => entry.ok).length
  };
}

async function sendReminderToActiveTab(payload) {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const tab = Array.isArray(tabs) ? tabs.find((entry) => normalizeHttpUrl(entry?.url || "")) : null;
  if (!tab || !Number.isInteger(tab.id)) {
    return { ok: false, error: "NO_ACTIVE_HTTP_TAB" };
  }
  return tabsSendMessage(tab.id, {
    type: "holmeta-reminder",
    payload
  });
}

async function scheduleWellnessAlarms(settingsInput = null, entitlementInput = null) {
  const [settings, entitlement] = await Promise.all([
    settingsInput ? Promise.resolve(settingsInput) : getSettings(),
    entitlementInput ? Promise.resolve(entitlementInput) : getEntitlement()
  ]);
  const premiumActive = Boolean(settings?.devBypassPremium || entitlement?.active);
  const wellness = normalizeWellness(settings);

  await Promise.all([alarmsClear(ALARMS.wellnessBreak), alarmsClear(ALARMS.wellnessEye)]);

  if (!premiumActive) {
    return;
  }
  if (wellness.snoozeUntilTs > Date.now()) {
    return;
  }
  if (wellness.breaksEnabled) {
    chrome.alarms.create(ALARMS.wellnessBreak, {
      periodInMinutes: wellness.breaksIntervalMin
    });
  }
  if (wellness.eyeEnabled) {
    chrome.alarms.create(ALARMS.wellnessEye, {
      periodInMinutes: wellness.eyeIntervalMin
    });
  }
}

function coreReminderAlarmName(reminderId) {
  return `${ALARMS.reminderPrefix}${String(reminderId || "")}`;
}

function parseReminderIdFromAlarmName(alarmName) {
  const safe = String(alarmName || "");
  if (!safe.startsWith(ALARMS.reminderPrefix)) {
    return "";
  }
  return safe.slice(ALARMS.reminderPrefix.length);
}

function coreReminderNotificationId(reminderId) {
  return `${NOTIFICATIONS.reminderPrefix}${String(reminderId || "")}`;
}

function parseReminderIdFromNotification(notificationId) {
  const safe = String(notificationId || "");
  if (!safe.startsWith(NOTIFICATIONS.reminderPrefix)) {
    return "";
  }
  return safe.slice(NOTIFICATIONS.reminderPrefix.length);
}

function normalizeSavedItem(rawItem, nowTs = Date.now()) {
  const source = rawItem && typeof rawItem === "object" ? rawItem : {};
  const url = normalizeHttpUrl(source.url || "");
  const domain = normalizeDomain(source.domain || url);
  const title = String(source.title || url || "Untitled").trim().slice(0, 300) || "Untitled";
  return {
    id: String(source.id || createId("itm")),
    url,
    title,
    domain,
    createdAt: Number(source.createdAt || nowTs),
    note: String(source.note || "").slice(0, 2000),
    tags: normalizeTags(source.tags || []),
    pinned: Boolean(source.pinned),
    favicon: String(source.favicon || "").trim()
  };
}

function normalizeReminder(rawReminder, nowTs = Date.now()) {
  const source = rawReminder && typeof rawReminder === "object" ? rawReminder : {};
  return {
    id: String(source.id || createId("rem")),
    itemId: String(source.itemId || ""),
    type: source.type === "next_visit" ? "next_visit" : "time",
    when: Number(source.when || 0),
    match: {
      domain: String(source?.match?.domain || "").trim().toLowerCase(),
      url: normalizeHttpUrl(source?.match?.url || "")
    },
    createdAt: Number(source.createdAt || nowTs),
    firedAt: Number(source.firedAt || 0)
  };
}

function normalizeSession(rawSession, nowTs = Date.now()) {
  const source = rawSession && typeof rawSession === "object" ? rawSession : {};
  const tabs = Array.isArray(source.tabs)
    ? source.tabs
        .map((tab) => ({
          title: String(tab?.title || tab?.url || "Untitled").trim().slice(0, 300) || "Untitled",
          url: normalizeHttpUrl(tab?.url || "")
        }))
        .filter((tab) => tab.url)
    : [];

  return {
    id: String(source.id || createId("ses")),
    name: String(source.name || "Session").trim().slice(0, 120) || "Session",
    createdAt: Number(source.createdAt || nowTs),
    tabs: tabs.slice(0, 300)
  };
}

function normalizeCoreState(rawCore) {
  const source = rawCore && typeof rawCore === "object" ? rawCore : {};
  const nowTs = Date.now();
  const items = Array.isArray(source.items)
    ? source.items.map((item) => normalizeSavedItem(item, nowTs)).filter((item) => item.url)
    : [];
  const reminders = Array.isArray(source.reminders)
    ? source.reminders.map((reminder) => normalizeReminder(reminder, nowTs)).filter((reminder) => reminder.itemId)
    : [];
  const sessions = Array.isArray(source.sessions)
    ? source.sessions.map((session) => normalizeSession(session, nowTs)).filter((session) => session.tabs.length)
    : [];
  const resumeQueue = Array.isArray(source.resumeQueue)
    ? source.resumeQueue.map((id) => String(id || "")).filter(Boolean)
    : [];

  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    premium: {
      licenseKey: String(source?.premium?.licenseKey || "").trim().toUpperCase(),
      status: String(source?.premium?.status || "invalid"),
      planKey: String(source?.premium?.planKey || ""),
      statusText: String(source?.premium?.statusText || ""),
      lastValidatedAt: Number(source?.premium?.lastValidatedAt || 0),
      nextCheckAt: Number(source?.premium?.nextCheckAt || 0)
    },
    items: items.slice(0, CORE_MAX_ITEMS).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)),
    reminders,
    sessions: sessions.slice(0, CORE_MAX_SESSIONS).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)),
    resumeQueue: [...new Set(resumeQueue)].slice(0, CORE_RESUME_LIMIT)
  };
}

async function getCoreState() {
  const data = await storageGet(STORAGE.core);
  const normalized = normalizeCoreState(data[STORAGE.core] || {});
  if (!data[STORAGE.core] || Number(data[STORAGE.core]?.schemaVersion || 0) !== CORE_SCHEMA_VERSION) {
    await storageSet({ [STORAGE.core]: normalized });
  }
  return normalized;
}

async function writeCoreState(nextCore) {
  const normalized = normalizeCoreState(nextCore || {});
  await storageSet({ [STORAGE.core]: normalized });
  return normalized;
}

function premiumSnapshot(settings, entitlement) {
  const premiumActive = Boolean(settings?.devBypassPremium || entitlement?.active);
  return {
    status: String(entitlement?.status || (premiumActive ? "active" : "inactive")),
    premiumActive,
    freeActive: true,
    trialing: String(entitlement?.status || "") === "trialing",
    lockReason: premiumActive ? "" : "UNLOCK_PREMIUM",
    plan: entitlement?.plan || "free",
    renewsAt: entitlement?.renewsAt || null,
    trialEndsAt: entitlement?.trialEndsAt || null
  };
}

async function syncCorePremiumSnapshot(settings, entitlement) {
  const core = await getCoreState();
  const snap = premiumSnapshot(settings, entitlement);
  core.premium = {
    licenseKey: String(settings.licenseKey || "").trim().toUpperCase(),
    status: snap.premiumActive ? "valid" : "invalid",
    planKey: String(snap.plan || "free"),
    statusText: snap.premiumActive ? "PREMIUM ACTIVE" : "FREE MODE",
    lastValidatedAt: Date.now(),
    nextCheckAt: Date.now() + 24 * 60 * 60 * 1000
  };
  return writeCoreState(core);
}

async function rescheduleCoreReminders(coreState) {
  const alarms = await alarmsGetAll();
  await Promise.all(
    alarms
      .filter((alarm) => String(alarm.name || "").startsWith(ALARMS.reminderPrefix))
      .map((alarm) => alarmsClear(alarm.name))
  );

  const nowTs = Date.now();
  coreState.reminders.forEach((reminder) => {
    if (reminder.type !== "time" || reminder.firedAt || !Number(reminder.when) || Number(reminder.when) <= nowTs) {
      return;
    }
    chrome.alarms.create(coreReminderAlarmName(reminder.id), {
      when: Number(reminder.when)
    });
  });
}

async function refreshEntitlement(settingsInput = null, force = false) {
  const settings = settingsInput || (await getSettings());
  const previous = await getEntitlement();
  const validateUrl = String(settings.validateLicenseUrl || "").trim();
  const licenseKey = String(settings.licenseKey || "").trim().toUpperCase();

  if (!licenseKey) {
    const payload = {
      active: false,
      status: "inactive",
      plan: "free",
      renewsAt: null,
      trialEndsAt: null,
      checkedAt: new Date().toISOString(),
      stale: false,
      graceUntil: null,
      lastActiveAt: previous.lastActiveAt || null,
      error: "LICENSE_REQUIRED"
    };
    const entitlement = await writeEntitlement(payload);
    await syncCorePremiumSnapshot(settings, entitlement);
    return entitlement;
  }

  if (!validateUrl || !isHttpUrl(validateUrl)) {
    const payload = {
      active: false,
      status: "inactive",
      plan: "free",
      renewsAt: null,
      trialEndsAt: null,
      checkedAt: new Date().toISOString(),
      stale: false,
      graceUntil: null,
      lastActiveAt: previous.lastActiveAt || null,
      error: "INVALID_VALIDATE_LICENSE_URL"
    };
    const entitlement = await writeEntitlement(payload);
    await syncCorePremiumSnapshot(settings, entitlement);
    return entitlement;
  }

  const shouldFetch = force || !previous.checkedAt || Date.now() - Date.parse(previous.checkedAt) > 60 * 1000;
  if (!shouldFetch) {
    return previous;
  }

  const installId = String(settings.installId || "").trim();
  const body = {
    licenseKey,
    installId: installId || undefined
  };

  try {
    const response = await fetch(validateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    const status = normalizeEntitlementStatus(payload.status, payload.valid || payload.entitled || payload.active);
    const active = Boolean(payload.valid || payload.entitled || payload.active || entitlementActiveForStatus(status));
    const next = {
      active,
      status: active ? status : "inactive",
      plan: String(payload.planKey || payload.plan || (active ? "paid" : "free")),
      renewsAt: payload.current_period_end || payload.renewsAt || null,
      trialEndsAt: payload.trial_end || payload.trialEndsAt || null,
      checkedAt: new Date().toISOString(),
      stale: false,
      graceUntil: null,
      lastActiveAt: active ? new Date().toISOString() : previous.lastActiveAt || null,
      error: active ? "" : String(payload.error || (!response.ok ? "LICENSE_INVALID" : ""))
    };
    const entitlement = await writeEntitlement(next);
    await syncCorePremiumSnapshot(settings, entitlement);
    return entitlement;
  } catch (_) {
    const nowTs = Date.now();
    const lastActiveTs = previous.lastActiveAt ? Date.parse(previous.lastActiveAt) : 0;
    if (previous.active && lastActiveTs && nowTs - lastActiveTs <= ENTITLEMENT_GRACE_MS) {
      const graceUntil = new Date(lastActiveTs + ENTITLEMENT_GRACE_MS).toISOString();
      const entitlement = await writeEntitlement({
        ...previous,
        stale: true,
        graceUntil,
        checkedAt: new Date().toISOString(),
        error: "OFFLINE_GRACE"
      });
      await syncCorePremiumSnapshot(settings, entitlement);
      return entitlement;
    }

    const entitlement = await writeEntitlement({
      ...previous,
      active: false,
      status: "inactive",
      stale: false,
      graceUntil: null,
      checkedAt: new Date().toISOString(),
      error: "ENTITLEMENT_FETCH_FAILED"
    });
    await syncCorePremiumSnapshot(settings, entitlement);
    return entitlement;
  }
}

async function coreSaveCurrentTab(payload = {}) {
  const [settings, entitlement, core, tabs] = await Promise.all([
    getSettings(),
    getEntitlement(),
    getCoreState(),
    tabsQuery({ active: true, currentWindow: true })
  ]);

  const activeTab = tabs.find((tab) => Number.isInteger(tab?.id) && isHttpUrl(tab?.url));
  if (!activeTab?.url) {
    return { ok: false, error: "NO_ACTIVE_HTTP_TAB" };
  }

  const snapshot = premiumSnapshot(settings, entitlement);
  const url = normalizeHttpUrl(activeTab.url);
  const nowTs = Date.now();
  const note = String(payload.note || "").slice(0, 2000);
  const requestedTags = normalizeTags(payload.tags || []);
  const tags = snapshot.premiumActive
    ? (requestedTags.length ? requestedTags : suggestedTagsForDomain(normalizeDomain(url)))
    : [];

  const existing = core.items.find((item) => item.url === url);
  let savedItem = null;

  if (existing) {
    existing.title = String(activeTab.title || existing.title || url).trim().slice(0, 300);
    existing.domain = normalizeDomain(url);
    existing.note = note;
    existing.createdAt = nowTs;
    existing.favicon = String(activeTab.favIconUrl || existing.favicon || "").trim();
    if (snapshot.premiumActive) {
      existing.tags = tags;
    }
    savedItem = existing;
  } else {
    savedItem = normalizeSavedItem({
      id: createId("itm"),
      url,
      title: String(activeTab.title || url).trim(),
      domain: normalizeDomain(url),
      createdAt: nowTs,
      note,
      tags,
      pinned: false,
      favicon: String(activeTab.favIconUrl || "").trim()
    }, nowTs);
    core.items.unshift(savedItem);
  }

  core.items = core.items.slice(0, CORE_MAX_ITEMS).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const saved = await writeCoreState(core);
  return { ok: true, savedItem, core: saved, premium: snapshot };
}

async function coreUndoSave(itemId) {
  const core = await getCoreState();
  const id = String(itemId || "").trim();
  const before = core.items.length;
  core.items = core.items.filter((item) => item.id !== id);
  if (core.items.length === before) {
    return { ok: false, error: "ITEM_NOT_FOUND" };
  }
  core.reminders = core.reminders.filter((reminder) => reminder.itemId !== id);
  core.resumeQueue = core.resumeQueue.filter((entry) => entry !== id);
  const saved = await writeCoreState(core);
  await rescheduleCoreReminders(saved);
  return { ok: true, core: saved };
}

async function coreOpenItem(itemId) {
  const core = await getCoreState();
  const item = core.items.find((entry) => entry.id === String(itemId || ""));
  if (!item?.url) {
    return { ok: false, error: "ITEM_NOT_FOUND" };
  }
  chrome.tabs.create({ url: item.url });
  return { ok: true, item };
}

async function coreUpdateItem(payload = {}) {
  const [settings, entitlement, core] = await Promise.all([getSettings(), getEntitlement(), getCoreState()]);
  const snapshot = premiumSnapshot(settings, entitlement);
  const itemId = String(payload.itemId || "").trim();
  const item = core.items.find((entry) => entry.id === itemId);
  if (!item) {
    return { ok: false, error: "ITEM_NOT_FOUND" };
  }

  if (Object.prototype.hasOwnProperty.call(payload, "note")) {
    item.note = String(payload.note || "").slice(0, 2000);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "pinned")) {
    item.pinned = Boolean(payload.pinned);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "tags") && snapshot.premiumActive) {
    item.tags = normalizeTags(payload.tags || []);
  }

  const saved = await writeCoreState(core);
  return { ok: true, core: saved, item, premium: snapshot };
}

async function coreRemoveItem(itemId) {
  const core = await getCoreState();
  const id = String(itemId || "").trim();
  const before = core.items.length;
  core.items = core.items.filter((item) => item.id !== id);
  if (core.items.length === before) {
    return { ok: false, error: "ITEM_NOT_FOUND" };
  }
  core.reminders = core.reminders.filter((entry) => entry.itemId !== id);
  core.resumeQueue = core.resumeQueue.filter((entry) => entry !== id);
  const saved = await writeCoreState(core);
  await rescheduleCoreReminders(saved);
  return { ok: true, core: saved };
}

function reminderMatchesUrl(reminder, url) {
  if (!reminder || reminder.type !== "next_visit" || reminder.firedAt) {
    return false;
  }
  const safeUrl = normalizeHttpUrl(url);
  if (!safeUrl) {
    return false;
  }

  const targetDomain = normalizeDomain(safeUrl);
  const matchDomain = String(reminder.match?.domain || "").trim().toLowerCase();
  const matchUrl = normalizeHttpUrl(reminder.match?.url || "");

  if (matchUrl) {
    return safeUrl === matchUrl;
  }
  if (matchDomain) {
    return targetDomain === matchDomain;
  }
  return false;
}

async function coreSetReminder(payload = {}) {
  const [settings, entitlement, core] = await Promise.all([getSettings(), getEntitlement(), getCoreState()]);
  const snapshot = premiumSnapshot(settings, entitlement);
  if (!snapshot.premiumActive) {
    return { ok: false, error: "PREMIUM_REQUIRED", premium: snapshot };
  }

  const itemId = String(payload.itemId || "").trim();
  const item = core.items.find((entry) => entry.id === itemId);
  if (!item) {
    return { ok: false, error: "ITEM_NOT_FOUND" };
  }

  const reminderType = payload.type === "next_visit" ? "next_visit" : "time";
  const reminder = normalizeReminder({
    id: createId("rem"),
    itemId,
    type: reminderType,
    when: reminderType === "time" ? Number(payload.when || 0) : 0,
    match: reminderType === "next_visit"
      ? {
          domain: payload.match?.domain ? normalizeDomain(payload.match.domain) : item.domain,
          url: payload.match?.url ? normalizeHttpUrl(payload.match.url) : ""
        }
      : {}
  });

  if (reminder.type === "time" && (!Number(reminder.when) || reminder.when <= Date.now())) {
    return { ok: false, error: "INVALID_REMINDER_TIME" };
  }

  core.reminders = core.reminders.filter((entry) => entry.itemId !== itemId);
  core.reminders.unshift(reminder);
  const saved = await writeCoreState(core);
  await rescheduleCoreReminders(saved);
  return { ok: true, core: saved, reminder, premium: snapshot };
}

async function coreClearReminder(reminderId) {
  const core = await getCoreState();
  const id = String(reminderId || "").trim();
  const before = core.reminders.length;
  core.reminders = core.reminders.filter((entry) => entry.id !== id);
  if (core.reminders.length === before) {
    return { ok: false, error: "REMINDER_NOT_FOUND" };
  }
  const saved = await writeCoreState(core);
  await alarmsClear(coreReminderAlarmName(id));
  await notificationClear(coreReminderNotificationId(id));
  return { ok: true, core: saved };
}

async function triggerCoreReminder(reminderId, reason = "time") {
  const core = await getCoreState();
  const reminder = core.reminders.find((entry) => entry.id === String(reminderId || ""));
  if (!reminder || reminder.firedAt) {
    return { ok: false, error: "REMINDER_NOT_FOUND" };
  }

  const item = core.items.find((entry) => entry.id === reminder.itemId);
  if (!item) {
    return { ok: false, error: "ITEM_NOT_FOUND" };
  }

  await sendReminderToActiveTab({
    reminderType: "followUp",
    title: "FOLLOW UP",
    message: reason === "next_visit"
      ? `You returned to ${item.domain || "this site"}.`
      : `Return to: ${item.title}`,
    defaultSnoozeMin: 10,
    delivery: {
      overlay: true,
      notification: false,
      popupOnly: false,
      sound: false,
      gentle: true
    }
  });

  await notify(coreReminderNotificationId(reminder.id), {
    type: "basic",
    iconUrl: NOTIFICATION_ICON,
    title: "holmeta reminder",
    message: reason === "next_visit"
      ? `You asked to follow up when returning: ${item.domain || item.url}`
      : `Follow up: ${item.title}`
  });

  reminder.firedAt = Date.now();
  const saved = await writeCoreState(core);
  await alarmsClear(coreReminderAlarmName(reminder.id));
  return { ok: true, core: saved, reminder };
}

async function handleCoreNextVisit(url) {
  const safeUrl = normalizeHttpUrl(url);
  if (!safeUrl) {
    return;
  }

  const core = await getCoreState();
  const hits = core.reminders.filter((reminder) => reminderMatchesUrl(reminder, safeUrl));
  for (const reminder of hits) {
    await triggerCoreReminder(reminder.id, "next_visit");
  }
}

async function coreSaveSession(payload = {}) {
  const [settings, entitlement, core, tabs] = await Promise.all([
    getSettings(),
    getEntitlement(),
    getCoreState(),
    tabsQuery({ currentWindow: true })
  ]);
  const snapshot = premiumSnapshot(settings, entitlement);
  if (!snapshot.premiumActive) {
    return { ok: false, error: "PREMIUM_REQUIRED", premium: snapshot };
  }

  const cleanTabs = tabs
    .map((tab) => ({
      title: String(tab?.title || tab?.url || "Untitled").trim().slice(0, 300) || "Untitled",
      url: normalizeHttpUrl(tab?.url || "")
    }))
    .filter((tab) => tab.url);

  if (!cleanTabs.length) {
    return { ok: false, error: "NO_TABS_IN_WINDOW" };
  }

  const defaultName = `Session — ${new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  const session = normalizeSession({
    id: createId("ses"),
    name: String(payload.name || defaultName),
    createdAt: Date.now(),
    tabs: cleanTabs
  });

  core.sessions.unshift(session);
  core.sessions = core.sessions.slice(0, CORE_MAX_SESSIONS);
  const saved = await writeCoreState(core);
  return { ok: true, core: saved, session, premium: snapshot };
}

async function coreOpenSession(sessionId) {
  const core = await getCoreState();
  const session = core.sessions.find((entry) => entry.id === String(sessionId || ""));
  if (!session) {
    return { ok: false, error: "SESSION_NOT_FOUND" };
  }

  for (const tab of session.tabs) {
    if (!tab.url) {
      continue;
    }
    chrome.tabs.create({ url: tab.url });
  }

  return { ok: true, session };
}

async function coreDeleteSession(sessionId) {
  const core = await getCoreState();
  const before = core.sessions.length;
  core.sessions = core.sessions.filter((entry) => entry.id !== String(sessionId || ""));
  if (core.sessions.length === before) {
    return { ok: false, error: "SESSION_NOT_FOUND" };
  }
  const saved = await writeCoreState(core);
  return { ok: true, core: saved };
}

async function coreResumeAction(payload = {}) {
  const [settings, entitlement, core] = await Promise.all([getSettings(), getEntitlement(), getCoreState()]);
  const snapshot = premiumSnapshot(settings, entitlement);
  if (!snapshot.premiumActive) {
    return { ok: false, error: "PREMIUM_REQUIRED", premium: snapshot };
  }

  const action = String(payload.action || "add").trim();
  const itemId = String(payload.itemId || "").trim();

  if (action === "clear") {
    core.resumeQueue = [];
    const saved = await writeCoreState(core);
    return { ok: true, core: saved, premium: snapshot };
  }

  if (action === "open_next") {
    const nextId = core.resumeQueue[0];
    if (!nextId) {
      return { ok: false, error: "RESUME_QUEUE_EMPTY", premium: snapshot };
    }
    const item = core.items.find((entry) => entry.id === nextId);
    if (item?.url) {
      chrome.tabs.create({ url: item.url });
    }
    core.resumeQueue = core.resumeQueue.filter((id) => id !== nextId);
    const saved = await writeCoreState(core);
    return { ok: true, core: saved, openedItemId: nextId, premium: snapshot };
  }

  if (!itemId || !core.items.some((entry) => entry.id === itemId)) {
    return { ok: false, error: "ITEM_NOT_FOUND", premium: snapshot };
  }

  if (action === "remove") {
    core.resumeQueue = core.resumeQueue.filter((id) => id !== itemId);
    const saved = await writeCoreState(core);
    return { ok: true, core: saved, premium: snapshot };
  }

  core.resumeQueue = [itemId, ...core.resumeQueue.filter((id) => id !== itemId)].slice(0, CORE_RESUME_LIMIT);
  const saved = await writeCoreState(core);
  return { ok: true, core: saved, premium: snapshot };
}

async function coreImportState(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const imported = normalizeCoreState(source.core || source);
  const saved = await writeCoreState(imported);
  await rescheduleCoreReminders(saved);
  return { ok: true, core: saved };
}

async function coreResetState() {
  const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
  const reset = normalizeCoreState({});
  const snapshot = premiumSnapshot(settings, entitlement);
  reset.premium = {
    licenseKey: String(settings.licenseKey || "").trim().toUpperCase(),
    status: snapshot.premiumActive ? "valid" : "invalid",
    planKey: String(snapshot.plan || "free"),
    statusText: snapshot.premiumActive ? "PREMIUM ACTIVE" : "FREE MODE",
    lastValidatedAt: Date.now(),
    nextCheckAt: Date.now() + 24 * 60 * 60 * 1000
  };
  const saved = await writeCoreState(reset);
  await rescheduleCoreReminders(saved);
  return { ok: true, core: saved };
}

async function coreGetState() {
  const [settings, entitlement, core] = await Promise.all([getSettings(), getEntitlement(), getCoreState()]);
  const snapshot = premiumSnapshot(settings, entitlement);
  core.premium = {
    licenseKey: String(settings.licenseKey || "").trim().toUpperCase(),
    status: snapshot.premiumActive ? "valid" : "invalid",
    planKey: String(snapshot.plan || "free"),
    statusText: snapshot.premiumActive ? "PREMIUM ACTIVE" : "FREE MODE",
    lastValidatedAt: Date.now(),
    nextCheckAt: Date.now() + 24 * 60 * 60 * 1000
  };
  const saved = await writeCoreState(core);
  return {
    ok: true,
    core: saved,
    premium: snapshot
  };
}

async function bootstrap() {
  let settings = await getSettings();
  if (!String(settings.installId || "").trim()) {
    settings = await updateSettings({ installId: createInstallId() });
  }
  const core = await getCoreState();
  const entitlement = await refreshEntitlement(settings, true);
  await rescheduleCoreReminders(core);
  await scheduleWellnessAlarms(settings, entitlement);
  chrome.alarms.create(ALARMS.entitlement, {
    periodInMinutes: 30
  });
}

chrome.runtime.onInstalled.addListener(() => {
  bootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  bootstrap();
});

chrome.commands?.onCommand?.addListener(async (command) => {
  try {
    if (command === "save_current_tab") {
      await coreSaveCurrentTab({});
      return;
    }
    if (command === "toggle-filters") {
      const settings = await getSettings();
      const nextSettings = await updateSettings({ filterEnabled: !settings.filterEnabled });
      const entitlement = await getEntitlement();
      await applyFiltersToActiveTabs(nextSettings, entitlement);
      return;
    }
    if (command === "toggle-color-accurate") {
      const settings = await getSettings();
      const nextSettings = await updateSettings({ colorAccurate: !settings.colorAccurate });
      const entitlement = await getEntitlement();
      await applyFiltersToActiveTabs(nextSettings, entitlement);
      return;
    }
    if (command === "increase-intensity" || command === "decrease-intensity") {
      const settings = await getSettings();
      const delta = command === "increase-intensity" ? 0.05 : -0.05;
      const next = Math.max(0, Math.min(1, Number(settings.filterIntensity || 0) + delta));
      const nextSettings = await updateSettings({ filterIntensity: next });
      const entitlement = await getEntitlement();
      await applyFiltersToActiveTabs(nextSettings, entitlement);
    }
  } catch (_) {
    // no-op
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const name = String(alarm?.name || "");
  if (!name) {
    return;
  }

  if (name === ALARMS.entitlement) {
    const settings = await getSettings();
    const entitlement = await refreshEntitlement(settings, false);
    await scheduleWellnessAlarms(settings, entitlement);
    return;
  }

  if (name === ALARMS.wellnessBreak) {
    const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
    const wellness = normalizeWellness(settings);
    if (wellness.snoozeUntilTs > Date.now()) {
      return;
    }
    if (!Boolean(settings?.devBypassPremium || entitlement?.active) || !wellness.breaksEnabled) {
      return;
    }
    await sendReminderToActiveTab({
      reminderType: "movement",
      title: "MICRO BREAK",
      message: "Stand up, reset shoulders, and blink for 30 seconds.",
      defaultSnoozeMin: 15,
      delivery: {
        overlay: true,
        notification: false,
        popupOnly: false,
        sound: false,
        gentle: true
      }
    });
    await notify("holmeta-wellness-break", {
      type: "basic",
      iconUrl: NOTIFICATION_ICON,
      title: "holmeta break",
      message: "Micro-break time: stand, blink, reset."
    });
    return;
  }

  if (name === ALARMS.wellnessEye) {
    const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
    const wellness = normalizeWellness(settings);
    if (wellness.snoozeUntilTs > Date.now()) {
      return;
    }
    if (!Boolean(settings?.devBypassPremium || entitlement?.active) || !wellness.eyeEnabled) {
      return;
    }
    await sendReminderToActiveTab({
      reminderType: "eye",
      title: "20-20-20",
      message: "Look 20 feet away for 20 seconds.",
      defaultSnoozeMin: 15,
      delivery: {
        overlay: true,
        notification: false,
        popupOnly: false,
        sound: false,
        gentle: true
      }
    });
    await notify("holmeta-wellness-eye", {
      type: "basic",
      iconUrl: NOTIFICATION_ICON,
      title: "holmeta eye reset",
      message: "20-20-20 reset: look far for 20 seconds."
    });
    return;
  }

  const reminderId = parseReminderIdFromAlarmName(name);
  if (reminderId) {
    await triggerCoreReminder(reminderId, "time");
  }
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab?.url) {
    return;
  }
  const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
  await applyFilterToTab(tab, settings, entitlement);
  await handleCoreNextVisit(tab.url);
});

chrome.webNavigation?.onCompleted?.addListener(async (details) => {
  if (details?.frameId !== 0 || !details?.url) {
    return;
  }
  await handleCoreNextVisit(details.url);
}, {
  url: [{ schemes: ["http", "https"] }]
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const reminderId = parseReminderIdFromNotification(notificationId);
  if (!reminderId) {
    return;
  }

  const core = await getCoreState();
  const reminder = core.reminders.find((entry) => entry.id === reminderId);
  const item = reminder ? core.items.find((entry) => entry.id === reminder.itemId) : null;
  if (item?.url) {
    chrome.tabs.create({ url: item.url });
  }
  await notificationClear(notificationId);
});

chrome.notifications.onButtonClicked.addListener(async (notificationId) => {
  const reminderId = parseReminderIdFromNotification(notificationId);
  if (!reminderId) {
    return;
  }
  await notificationClear(notificationId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) {
    sendResponse({ ok: false, error: "MISSING_TYPE" });
    return false;
  }

  (async () => {
    if (message.type === "holmeta-request-state") {
      const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
      const requestedDomain = normalizeDomain(message.domain || message.hostname || "");
      const filterPayload = HC.computeFilterPayload(
        effectiveSettingsForTier(settings, entitlement),
        new Date(),
        requestedDomain
      );
      sendResponse({
        ok: true,
        settings,
        entitlement,
        filterPayload,
        runtime: {},
        auth: {
          paired: Boolean(String(settings.licenseKey || "").trim()),
          pairedAt: null
        }
      });
      return;
    }

    if (message.type === "holmeta-content-ready") {
      const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
      const requestedDomain = normalizeDomain(message.domain || message.hostname || "");
      const filterPayload = HC.computeFilterPayload(
        effectiveSettingsForTier(settings, entitlement),
        new Date(),
        requestedDomain
      );
      sendResponse({
        ok: true,
        settings,
        entitlement,
        filterPayload,
        runtime: {}
      });
      return;
    }

    if (message.type === "holmeta-update-settings") {
      const patch = message.patch && typeof message.patch === "object" ? message.patch : {};
      const cleanedPatch = { ...patch };
      if (Object.prototype.hasOwnProperty.call(cleanedPatch, "licenseKey")) {
        cleanedPatch.licenseKey = String(cleanedPatch.licenseKey || "").trim().toUpperCase();
      }
      if (Object.prototype.hasOwnProperty.call(cleanedPatch, "installId")) {
        cleanedPatch.installId = String(cleanedPatch.installId || "").trim();
      }
      if (Object.prototype.hasOwnProperty.call(cleanedPatch, "apiBaseUrl")) {
        cleanedPatch.apiBaseUrl = String(cleanedPatch.apiBaseUrl || "").trim();
      }
      if (Object.prototype.hasOwnProperty.call(cleanedPatch, "validateLicenseUrl")) {
        cleanedPatch.validateLicenseUrl = String(cleanedPatch.validateLicenseUrl || "").trim();
      }
      if (Object.prototype.hasOwnProperty.call(cleanedPatch, "checkoutUrl")) {
        cleanedPatch.checkoutUrl = String(cleanedPatch.checkoutUrl || "").trim();
      }
      if (Object.prototype.hasOwnProperty.call(cleanedPatch, "dashboardUrl")) {
        cleanedPatch.dashboardUrl = String(cleanedPatch.dashboardUrl || "").trim();
      }

      const settings = await updateSettings(cleanedPatch);
      const entitlement = (
        Object.prototype.hasOwnProperty.call(cleanedPatch, "validateLicenseUrl")
        || Object.prototype.hasOwnProperty.call(cleanedPatch, "licenseKey")
        || Object.prototype.hasOwnProperty.call(cleanedPatch, "devBypassPremium")
      )
        ? await refreshEntitlement(settings, true)
        : await getEntitlement();

      await Promise.all([
        applyFiltersToActiveTabs(settings, entitlement),
        scheduleWellnessAlarms(settings, entitlement)
      ]);

      sendResponse({ ok: true, settings, entitlement });
      return;
    }

    if (message.type === "holmeta-refresh-entitlement") {
      const settings = await getSettings();
      const entitlement = await refreshEntitlement(settings, true);
      await scheduleWellnessAlarms(settings, entitlement);
      sendResponse({ ok: true, entitlement });
      return;
    }

    if (message.type === "holmeta-activate-license") {
      const clean = String(message.licenseKey || "").trim().toUpperCase();
      if (!clean) {
        sendResponse({ ok: false, error: "LICENSE_KEY_REQUIRED" });
        return;
      }
      const settings = await updateSettings({ licenseKey: clean });
      const entitlement = await refreshEntitlement(settings, true);
      if (!entitlement.active && !settings.devBypassPremium) {
        sendResponse({ ok: false, error: entitlement.error || "LICENSE_INVALID_OR_INACTIVE", entitlement });
        return;
      }
      await scheduleWellnessAlarms(settings, entitlement);
      sendResponse({ ok: true, entitlement });
      return;
    }

    if (message.type === "holmeta-clear-license") {
      const settings = await updateSettings({ licenseKey: "" });
      const entitlement = await refreshEntitlement(settings, true);
      await scheduleWellnessAlarms(settings, entitlement);
      sendResponse({ ok: true, entitlement });
      return;
    }

    if (message.type === "holmeta-reapply-filter") {
      const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
      await applyFiltersToActiveTabs(settings, entitlement);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-save-site-profile") {
      const domain = normalizeDomain(message.domain || "");
      if (!domain) {
        sendResponse({ ok: false, error: "INVALID_DOMAIN" });
        return;
      }
      const patch = message.patch && typeof message.patch === "object" ? message.patch : {};
      const settings = await getSettings();
      const nextSettings = HC.setSiteOverride(settings, domain, patch);
      await writeSettings(nextSettings);
      const entitlement = await getEntitlement();
      await applyFiltersToActiveTabs(nextSettings, entitlement);
      sendResponse({ ok: true, settings: nextSettings });
      return;
    }

    if (message.type === "holmeta-clear-site-profile") {
      const domain = normalizeDomain(message.domain || "");
      if (!domain) {
        sendResponse({ ok: false, error: "INVALID_DOMAIN" });
        return;
      }
      const settings = await getSettings();
      const nextSettings = HC.clearSiteOverride(settings, domain);
      await writeSettings(nextSettings);
      const entitlement = await getEntitlement();
      await applyFiltersToActiveTabs(nextSettings, entitlement);
      sendResponse({ ok: true, settings: nextSettings });
      return;
    }

    if (message.type === "holmeta-snooze-wellness") {
      const minutes = Math.max(5, Math.min(240, Math.round(Number(message.minutes || 15))));
      const settings = await getSettings();
      const wellness = normalizeWellness(settings);
      const nextSettings = await updateSettings({
        wellness: {
          ...wellness,
          snoozeUntilTs: Date.now() + minutes * 60 * 1000
        }
      });
      const entitlement = await getEntitlement();
      await scheduleWellnessAlarms(nextSettings, entitlement);
      sendResponse({ ok: true, settings: nextSettings });
      return;
    }

    if (message.type === "holmeta-core-get-state") {
      sendResponse(await coreGetState());
      return;
    }

    if (message.type === "holmeta-core-save-current-tab") {
      sendResponse(await coreSaveCurrentTab(message.payload || {}));
      return;
    }

    if (message.type === "holmeta-core-undo-save") {
      sendResponse(await coreUndoSave(message.itemId));
      return;
    }

    if (message.type === "holmeta-core-open-item") {
      sendResponse(await coreOpenItem(message.itemId));
      return;
    }

    if (message.type === "holmeta-core-update-item") {
      sendResponse(await coreUpdateItem(message.payload || {}));
      return;
    }

    if (message.type === "holmeta-core-remove-item") {
      sendResponse(await coreRemoveItem(message.itemId));
      return;
    }

    if (message.type === "holmeta-core-set-reminder") {
      sendResponse(await coreSetReminder(message.payload || {}));
      return;
    }

    if (message.type === "holmeta-core-clear-reminder") {
      sendResponse(await coreClearReminder(message.reminderId));
      return;
    }

    if (message.type === "holmeta-core-save-session") {
      sendResponse(await coreSaveSession(message.payload || {}));
      return;
    }

    if (message.type === "holmeta-core-open-session") {
      sendResponse(await coreOpenSession(message.sessionId));
      return;
    }

    if (message.type === "holmeta-core-delete-session") {
      sendResponse(await coreDeleteSession(message.sessionId));
      return;
    }

    if (message.type === "holmeta-core-resume-action") {
      sendResponse(await coreResumeAction(message.payload || {}));
      return;
    }

    if (message.type === "holmeta-core-export-state") {
      const core = await getCoreState();
      sendResponse({ ok: true, core });
      return;
    }

    if (message.type === "holmeta-core-import-state") {
      sendResponse(await coreImportState(message.payload || {}));
      return;
    }

    if (message.type === "holmeta-core-reset-state") {
      sendResponse(await coreResetState());
      return;
    }

    if (message.type === "holmeta-toggle-color-accurate") {
      const settings = await getSettings();
      const nextSettings = await updateSettings({ colorAccurate: !settings.colorAccurate });
      const entitlement = await getEntitlement();
      await applyFiltersToActiveTabs(nextSettings, entitlement);
      sendResponse({ ok: true, settings: nextSettings });
      return;
    }

    if (message.type === "holmeta-get-trends") {
      sendResponse({
        ok: true,
        dailyLogs: [],
        hydration: {},
        calm: {}
      });
      return;
    }

    if (message.type === "holmeta-get-filter-debug") {
      const [settings, entitlement] = await Promise.all([getSettings(), getEntitlement()]);
      const payload = computeFilterPayloadForUrl(settings, entitlement, message.domain || "");
      sendResponse({
        ok: true,
        payload,
        debug: payload.debug || {}
      });
      return;
    }

    if (message.type === "holmeta-get-cadence-preview") {
      sendResponse({
        ok: true,
        rows: []
      });
      return;
    }

    if (message.type === "holmeta-test-entitlement-fetch") {
      const settings = await getSettings();
      const entitlement = await refreshEntitlement(settings, true);
      sendResponse({
        ok: true,
        status: 200,
        entitlement
      });
      return;
    }

    if (message.type === "holmeta-test-reminder") {
      await sendReminderToActiveTab({
        reminderType: String(message.reminderType || "custom"),
        title: "TEST REMINDER",
        message: "Reminder dispatch is working.",
        delivery: {
          overlay: true,
          notification: false,
          popupOnly: false,
          sound: false,
          gentle: true
        }
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-save-daily-log") {
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-get-audit") {
      sendResponse({ ok: true, audit: null });
      return;
    }

    if (message.type === "holmeta-save-audit") {
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-start-focus" || message.type === "holmeta-panic-focus") {
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-snooze-all") {
      const minutes = Math.max(5, Math.min(240, Math.round(Number(message.minutes || 15))));
      const settings = await getSettings();
      const next = await updateSettings({
        cadence: {
          ...(settings.cadence || {}),
          global: {
            ...(settings.cadence?.global || {}),
            snoozeAllUntilTs: Date.now() + minutes * 60 * 1000
          }
        }
      });
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-panic-off") {
      const minutes = Math.max(5, Math.min(240, Math.round(Number(message.minutes || 30))));
      const settings = await getSettings();
      const next = await updateSettings({
        cadence: {
          ...(settings.cadence || {}),
          global: {
            ...(settings.cadence?.global || {}),
            panicUntilTs: Date.now() + minutes * 60 * 1000
          }
        }
      });
      const entitlement = await getEntitlement();
      await applyFiltersToActiveTabs(next, entitlement);
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-toggle-meeting-mode") {
      const enabled = Boolean(message.enabled);
      const settings = await getSettings();
      const next = await updateSettings({
        cadence: {
          ...(settings.cadence || {}),
          global: {
            ...(settings.cadence?.global || {}),
            meetingModeManual: enabled
          }
        }
      });
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-apply-cadence-preset") {
      const settings = await getSettings();
      const presetId = String(message.presetId || "balanced");
      const next = HC.applyCadencePreset(settings, presetId);
      await writeSettings(next);
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "holmeta-activity-ping") {
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "holmeta-reminder-action") {
      if (message.action === "snooze") {
        const minutes = Math.max(5, Math.min(120, Math.round(Number(message.minutes || 15))));
        const settings = await getSettings();
        const wellness = normalizeWellness(settings);
        const nextSettings = await updateSettings({
          wellness: {
            ...wellness,
            snoozeUntilTs: Date.now() + minutes * 60 * 1000
          }
        });
        const entitlement = await getEntitlement();
        await scheduleWellnessAlarms(nextSettings, entitlement);
      }
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "UNKNOWN_MESSAGE_TYPE" });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "BACKGROUND_FAILURE"
    });
  });

  return true;
});

bootstrap();
