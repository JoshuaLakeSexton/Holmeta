// HOLMETA v3 options controller
// Input stability: hydrate once, local edit state, debounced storage writes.

(() => {
  const SAVE_DEBOUNCE_MS = 420;
  const UPGRADE_URL = "https://www.holmeta.com/pricing";
  const BILLING_URL = "https://www.holmeta.com/pricing";

  const state = {
    app: null,
    editing: new Set(),
    pendingPatch: null,
    saveTimer: null,
    saveInFlight: false,
    diagnostics: null,
    activeHost: "",
    profileSearch: "",
    optionsOrderApplied: false
  };

  const $ = (id) => document.getElementById(id);

  const refs = {
    premiumBadge: $("premiumBadge"),
    saveState: $("saveState"),
    toastHost: $("toastHost"),
    optAccessLockPanel: $("optAccessLockPanel"),
    optAccessLockMessage: $("optAccessLockMessage"),
    optAccessLockTiming: $("optAccessLockTiming"),
    optAccessStartTrial: $("optAccessStartTrial"),
    optAccessManageBilling: $("optAccessManageBilling"),
    optAccessRefresh: $("optAccessRefresh"),

    optLightEnabled: $("optLightEnabled"),
    optLightMode: $("optLightMode"),
    optLightSpectrumPreset: $("optLightSpectrumPreset"),
    optLightIntensity: $("optLightIntensity"),
    optLightDim: $("optLightDim"),
    optLightBrightness: $("optLightBrightness"),
    optLightContrastSoft: $("optLightContrastSoft"),
    optLightSaturation: $("optLightSaturation"),
    optLightBlueCut: $("optLightBlueCut"),
    optLightTintRed: $("optLightTintRed"),
    optLightTintGreen: $("optLightTintGreen"),
    optLightTintBlue: $("optLightTintBlue"),
    optReduceWhites: $("optReduceWhites"),
    optVideoSafe: $("optVideoSafe"),
    optSpotlightEnabled: $("optSpotlightEnabled"),
    optTherapyMode: $("optTherapyMode"),
    optTherapyMinutes: $("optTherapyMinutes"),
    optTherapyCadence: $("optTherapyCadence"),
    optLightScheduleEnabled: $("optLightScheduleEnabled"),
    optUseSunset: $("optUseSunset"),
    optLightStart: $("optLightStart"),
    optLightEnd: $("optLightEnd"),
    optRampMinutes: $("optRampMinutes"),
    optQuickSchedule: $("optQuickSchedule"),
    applyQuickSchedule: $("applyQuickSchedule"),
    calcSunset: $("calcSunset"),
    optLightExclusions: $("optLightExclusions"),
    optProfileSearch: $("optProfileSearch"),
    resetProfileHost: $("resetProfileHost"),
    siteProfileList: $("siteProfileList"),
    optSiteProfiles: $("optSiteProfiles"),
    optReadingEnabled: $("optReadingEnabled"),
    optReadingAppearance: $("optReadingAppearance"),
    optReadingDarkVariant: $("optReadingDarkVariant"),
    optReadingLightVariant: $("optReadingLightVariant"),
    optReadingScheduleMode: $("optReadingScheduleMode"),
    optReadingStart: $("optReadingStart"),
    optReadingEnd: $("optReadingEnd"),
    optReadingThisSiteEnabled: $("optReadingThisSiteEnabled"),
    optReadingExcludeSite: $("optReadingExcludeSite"),
    optReadingHostStatus: $("optReadingHostStatus"),
    optReadingExclusions: $("optReadingExclusions"),
    optReadingSiteProfiles: $("optReadingSiteProfiles"),
    optAdaptiveEnabled: $("optAdaptiveEnabled"),
    optAdaptiveMode: $("optAdaptiveMode"),
    optAdaptivePreset: $("optAdaptivePreset"),
    optAdaptiveIntensity: $("optAdaptiveIntensity"),
    optAdaptiveStrategy: $("optAdaptiveStrategy"),
    optAdaptiveCompatibility: $("optAdaptiveCompatibility"),
    optAdaptiveThisSiteEnabled: $("optAdaptiveThisSiteEnabled"),
    optAdaptiveExcludeSite: $("optAdaptiveExcludeSite"),
    optAdaptiveHostStatus: $("optAdaptiveHostStatus"),
    optAdaptiveExclusions: $("optAdaptiveExclusions"),
    optAdaptiveSiteProfiles: $("optAdaptiveSiteProfiles"),

    diagSummary: $("diagSummary"),
    diagRefresh: $("diagRefresh"),
    diagResetSite: $("diagResetSite"),

    optBlockerEnabled: $("optBlockerEnabled"),
    optNuclearMode: $("optNuclearMode"),
    optBlockerMode: $("optBlockerMode"),
    optBlockScheduleEnabled: $("optBlockScheduleEnabled"),
    optBlockStart: $("optBlockStart"),
    optBlockEnd: $("optBlockEnd"),
    optBlockCatAds: $("optBlockCatAds"),
    optBlockCatTrackers: $("optBlockCatTrackers"),
    optBlockCatMalware: $("optBlockCatMalware"),
    optBlockCatAnnoyances: $("optBlockCatAnnoyances"),
    optBlockCatVideoAds: $("optBlockCatVideoAds"),
    optBlockCosmeticEnabled: $("optBlockCosmeticEnabled"),
    optBlockAntiDetect: $("optBlockAntiDetect"),
    optBlockAutoUpdate: $("optBlockAutoUpdate"),
    optBlockUpdateInterval: $("optBlockUpdateInterval"),
    optRefreshBlockLists: $("optRefreshBlockLists"),
    optBlockCosmeticDisabledHosts: $("optBlockCosmeticDisabledHosts"),
    optBlockCustomCosmeticJson: $("optBlockCustomCosmeticJson"),
    optBlockedDomains: $("optBlockedDomains"),
    optAllowDomains: $("optAllowDomains"),

    optTunnelEnabled: $("optTunnelEnabled"),
    optTunnelMode: $("optTunnelMode"),
    optTunnelPreset: $("optTunnelPreset"),
    optTunnelAutoReapply: $("optTunnelAutoReapply"),
    optTunnelReapplyMinutes: $("optTunnelReapplyMinutes"),
    optTunnelCustomScheme: $("optTunnelCustomScheme"),
    optTunnelCustomHost: $("optTunnelCustomHost"),
    optTunnelCustomPort: $("optTunnelCustomPort"),
    optTunnelCustomUser: $("optTunnelCustomUser"),
    optTunnelCustomPass: $("optTunnelCustomPass"),
    optTunnelBypassList: $("optTunnelBypassList"),
    optTunnelConnect: $("optTunnelConnect"),
    optTunnelDisconnect: $("optTunnelDisconnect"),
    optTunnelStatus: $("optTunnelStatus"),

    optAlertsEnabled: $("optAlertsEnabled"),
    optAlertFrequency: $("optAlertFrequency"),
    optAlertCadence: $("optAlertCadence"),
    optAlertSound: $("optAlertSound"),
    optAlertVolume: $("optAlertVolume"),
    optAlertPattern: $("optAlertPattern"),
    optAlertToastEnabled: $("optAlertToastEnabled"),
    optAlertNotificationEnabled: $("optAlertNotificationEnabled"),
    optAlertSnoozeMinutes: $("optAlertSnoozeMinutes"),
    optAlertCooldown: $("optAlertCooldown"),
    optAlertBurnoutThreshold: $("optAlertBurnoutThreshold"),
    optAlertQuietHoursEnabled: $("optAlertQuietHoursEnabled"),
    optAlertQuietStart: $("optAlertQuietStart"),
    optAlertQuietEnd: $("optAlertQuietEnd"),
    optAlertEye: $("optAlertEye"),
    optAlertPosture: $("optAlertPosture"),
    optAlertBurnout: $("optAlertBurnout"),
    optAlertHydration: $("optAlertHydration"),
    optAlertBlink: $("optAlertBlink"),
    optAlertMovement: $("optAlertMovement"),
    optAlertTestType: $("optAlertTestType"),
    optAlertTest: $("optAlertTest"),

    optSiteInsightEnabled: $("optSiteInsightEnabled"),
    optSiteInsightShowOnEverySite: $("optSiteInsightShowOnEverySite"),
    optSiteInsightAutoMinimize: $("optSiteInsightAutoMinimize"),
    optSiteInsightPill: $("optSiteInsightPill"),
    optSiteInsightProfile: $("optSiteInsightProfile"),
    optSiteInsightDuration: $("optSiteInsightDuration"),
    optSiteInsightShowAlgorithm: $("optSiteInsightShowAlgorithm"),
    optSiteInsightShowPurpose: $("optSiteInsightShowPurpose"),
    optSiteInsightRegular: $("optSiteInsightRegular"),
    optSiteInsightDev: $("optSiteInsightDev"),
    optSiteInsightDesign: $("optSiteInsightDesign"),
    optSiteInsightUxr: $("optSiteInsightUxr"),
    optSiteInsightDisabledHosts: $("optSiteInsightDisabledHosts"),
    optSiteInsightClearCache: $("optSiteInsightClearCache"),

    optFocusMinutes: $("optFocusMinutes"),
    optBreakMinutes: $("optBreakMinutes"),
    optAutoBlocker: $("optAutoBlocker"),
    optAutoLight: $("optAutoLight"),

    optLicenseKey: $("optLicenseKey"),
    activateLicense: $("activateLicense"),
    clearLicense: $("clearLicense"),
    openPricing: $("openPricing"),

    optBiofeedback: $("optBiofeedback"),
    optMorphing: $("optMorphing"),
    optTaskWeaver: $("optTaskWeaver"),
    optDashboardPredictions: $("optDashboardPredictions"),
    optCollaborative: $("optCollaborative"),

    statFocus: $("statFocus"),
    statAlerts: $("statAlerts"),
    statBlocks: $("statBlocks"),
    statLight: $("statLight"),
    weeklyBars: $("weeklyBars"),

    optDebug: $("optDebug"),
    exportSettings: $("exportSettings"),
    importSettings: $("importSettings"),
    exportLogs: $("exportLogs"),
    resetAll: $("resetAll")
  };

  function debugEnabled() {
    return Boolean(state.app?.meta?.debug);
  }

  function log(...args) {
    if (debugEnabled()) console.info("[Holmeta options]", ...args);
  }

  function toast(text) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    refs.toastHost.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function setStatus(text, error = false) {
    refs.saveState.textContent = String(text || "Ready");
    refs.saveState.style.color = error ? "#ffb300" : "#d9c5b2";
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: err.message || "runtime_error" });
          return;
        }
        resolve(response || { ok: false, error: "empty_response" });
      });
    });
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

  function getAccessInfo() {
    return state.app?.access || {
      allowed: true,
      locked: false,
      state: "ACCESS_UNKNOWN",
      reason: ""
    };
  }

  function hasExtensionAccess() {
    const access = getAccessInfo();
    return Boolean(access.allowed) && !Boolean(access.locked);
  }

  function formatRemaining(ms) {
    const totalSec = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${Math.max(0, mins)}m`;
  }

  function humanAccessReason(reason) {
    const key = String(reason || "").toLowerCase();
    if (!key) return "Subscription inactive.";
    if (key === "trial_missing") return "Trial not started.";
    if (key === "trial_expired") return "Trial ended.";
    if (key === "billing_failed") return "Billing failed.";
    if (key === "subscription_inactive") return "Subscription inactive.";
    if (key === "subscription_status_inactive") return "Subscription inactive.";
    if (key === "no_license") return "No active license found.";
    return key.replaceAll("_", " ");
  }

  function applyOptionsToolRegistry() {
    if (state.optionsOrderApplied) return;
    const layout = document.querySelector(".layout");
    const registry = globalThis.HolmetaToolRegistry?.options;
    if (!layout || !Array.isArray(registry) || !registry.length) return;

    const footer = layout.querySelector(".statusbar");
    registry.forEach((entry, index) => {
      const node = document.getElementById(String(entry.id || ""));
      if (!node) return;
      const heading = node.querySelector("h2");
      if (heading) heading.textContent = `${index + 1}) ${String(entry.title || "").trim()}`;
      if (footer) layout.insertBefore(node, footer);
      else layout.appendChild(node);
    });
    state.optionsOrderApplied = true;
  }

  function linesToDomains(text) {
    return [...new Set(
      String(text || "")
        .split(/\n|,/g)
        .map((line) => line.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
        .filter(Boolean)
    )];
  }

  function domainsToLines(list) {
    return Array.isArray(list) ? list.join("\n") : "";
  }

  function linesToBypassList(text) {
    const seen = new Set();
    const out = [];
    String(text || "")
      .split(/\n|,/g)
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .forEach((value) => {
        const normalized = value === "<local>"
          ? "<local>"
          : value
              .toLowerCase()
              .replace(/^https?:\/\//, "")
              .replace(/^www\./, "")
              .replace(/\/.*$/, "");
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        out.push(normalized);
      });
    return out;
  }

  function hostMapToLines(map) {
    if (!map || typeof map !== "object") return "";
    return Object.entries(map)
      .filter(([, value]) => Boolean(value))
      .map(([host]) => normalizeHost(host))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join("\n");
  }

  function linesToHostMap(text) {
    return Object.fromEntries(linesToDomains(text).map((host) => [host, true]));
  }

  function setValue(id, value) {
    const el = $(id);
    if (!el) return;
    if (document.activeElement === el || state.editing.has(id)) return;
    const next = String(value ?? "");
    if (el.value !== next) el.value = next;
  }

  function setChecked(id, value) {
    const el = $(id);
    if (!el) return;
    if (document.activeElement === el || state.editing.has(id)) return;
    el.checked = Boolean(value);
  }

  function queuePatch(patch) {
    state.pendingPatch = mergeDeep(state.pendingPatch, patch);
    setStatus("Saving...");
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(flushPatch, SAVE_DEBOUNCE_MS);
  }

  async function flushPatch() {
    if (!state.pendingPatch || state.saveInFlight) return;
    const patch = state.pendingPatch;
    state.pendingPatch = null;
    state.saveInFlight = true;

    const response = await sendMessage({ type: "holmeta:update-settings", patch });
    state.saveInFlight = false;

    if (!response.ok) {
      if (response.state) {
        state.app = response.state;
        render();
      }
      setStatus(`Save failed: ${response.error || "unknown"}`, true);
      return;
    }

    state.app = response.state;
    render();
    setStatus("Saved");
  }

  function normalizeHost(urlLike) {
    try {
      const url = new URL(String(urlLike || ""));
      if (!/^https?:$/.test(url.protocol)) return "";
      return url.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }

  function getLightSettings() {
    const settings = state.app?.settings || {};
    return settings.lightFilter || settings.light || {};
  }

  function getReadingSettings() {
    const settings = state.app?.settings || {};
    return settings.darkLightTheme || settings.readingTheme || {};
  }

  function normalizeReadingDarkVariant(value, fallback = "coal") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "gray") return "grey";
    if (raw === "dim_slate") return "grey";
    if (raw === "gentle_night") return "brown";
    if (raw === "soft_black") return "coal";
    return ["coal", "black", "brown", "grey", "sepia", "teal", "purple", "forest_green"].includes(raw)
      ? raw
      : fallback;
  }

  function normalizeReadingLightVariant(value, fallback = "white") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "gray") return "off_white";
    if (raw === "soft_paper") return "off_white";
    if (raw === "warm_page") return "warm";
    if (raw === "neutral_light") return "white";
    return ["white", "warm", "off_white", "soft_green", "baby_blue", "light_brown"].includes(raw)
      ? raw
      : fallback;
  }

  function darkVariantFromPreset(preset, fallback = "coal") {
    const key = String(preset || "").trim().toLowerCase();
    if (["coal", "black", "brown", "grey", "sepia", "teal", "purple", "forest_green"].includes(key)) return key;
    if (key === "soft_black") return "coal";
    if (key === "dim_slate") return "grey";
    if (key === "gentle_night") return "brown";
    return normalizeReadingDarkVariant(fallback, "coal");
  }

  function lightVariantFromPreset(preset, fallback = "white") {
    const key = String(preset || "").trim().toLowerCase();
    if (["white", "warm", "off_white", "soft_green", "baby_blue", "light_brown"].includes(key)) return key;
    if (key === "soft_paper") return "off_white";
    if (key === "warm_page") return "warm";
    if (key === "neutral_light") return "white";
    return normalizeReadingLightVariant(fallback, "white");
  }

  function readingPresetFor(mode, darkVariant, lightVariant) {
    return mode === "light" ? lightVariant : darkVariant;
  }

  function getAdaptiveSettings() {
    const settings = state.app?.settings || {};
    return settings.adaptiveSiteTheme || {};
  }

  async function getActiveHost() {
    const tab = await pickInspectableTab();
    state.activeHost = normalizeHost(tab?.url || "");
    return state.activeHost;
  }

  async function pickInspectableTab() {
    const activeTabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
    const active = Array.isArray(activeTabs) ? activeTabs[0] : null;
    const activeUrl = String(active?.url || "");
    if (/^https?:/i.test(activeUrl)) return active;

    const tabs = await new Promise((resolve) => chrome.tabs.query({ currentWindow: true }, resolve));
    const candidate = Array.isArray(tabs)
      ? tabs.find((tab) => /^https?:/i.test(String(tab?.url || "")))
      : null;
    return candidate || null;
  }

  function getCurrentHostOrToast() {
    const host = String(state.activeHost || "").trim().toLowerCase();
    if (!host) {
      toast("No active website detected.");
      return "";
    }
    return host;
  }

  function buildReadingSiteOverride(settings) {
    const appearance = String(
      settings.appearance || (String(settings.mode || "dark") === "light" ? "light" : "dark")
    );
    const sourcePreset = String(settings.preset || "");
    const darkVariant = normalizeReadingDarkVariant(
      settings.darkVariant || settings.darkThemeVariant,
      darkVariantFromPreset(sourcePreset, "coal")
    );
    const lightVariant = normalizeReadingLightVariant(
      settings.lightVariant || settings.lightThemeVariant,
      lightVariantFromPreset(sourcePreset, "white")
    );
    const scheduleMode = String(
      settings.scheduleMode || (settings.schedule?.useSunset ? "sunset" : "system")
    );
    const safeScheduleMode = ["system", "sunset", "custom"].includes(scheduleMode)
      ? scheduleMode
      : "system";
    const mode = appearance === "light" ? "light" : "dark";
    const schedule = {
      enabled: appearance === "auto",
      useSunset: safeScheduleMode === "sunset",
      start: String(settings.schedule?.start || "20:00"),
      end: String(settings.schedule?.end || "06:00")
    };
    return {
      enabled: true,
      appearance,
      darkVariant,
      darkThemeVariant: darkVariant,
      lightVariant,
      lightThemeVariant: lightVariant,
      scheduleMode: safeScheduleMode,
      schedule,
      // Backward compatibility for older renderers still reading legacy keys.
      mode,
      preset: String(settings.preset || readingPresetFor(mode, darkVariant, lightVariant)),
      intensity: Number(settings.intensity ?? 44)
    };
  }

  function buildAdaptiveSiteOverride(settings) {
    return {
      enabled: true,
      mode: String(settings.mode || "smart_dark"),
      preset: String(settings.preset || "balanced"),
      strategy: String(settings.strategy || "auto"),
      compatibilityMode: String(settings.compatibilityMode || "normal"),
      intensity: Number(settings.intensity || 52)
    };
  }

  function renderPremium() {
    const access = getAccessInfo();
    const entitlementState = String(state.app?.entitlement?.state || "");
    const premium = hasExtensionAccess();
    const trialActive = entitlementState === "TRIAL_ACTIVE";

    if (access.locked) {
      refs.premiumBadge.textContent = "LOCKED";
      refs.premiumBadge.classList.remove("premium");
    } else if (trialActive) {
      refs.premiumBadge.textContent = "TRIAL";
      refs.premiumBadge.classList.add("premium");
    } else {
      refs.premiumBadge.textContent = "ACTIVE";
      refs.premiumBadge.classList.add("premium");
    }

    document.querySelectorAll("[data-premium='true']").forEach((el) => {
      el.disabled = !premium;
      el.setAttribute("aria-disabled", String(!premium));
      if (!premium) el.setAttribute("title", "Premium feature – upgrade at holmeta.com");
      else el.removeAttribute("title");
    });
  }

  function setOptionsPanelsHidden(hidden) {
    const ids = (globalThis.HolmetaToolRegistry?.options || []).map((entry) => String(entry.id || ""));
    ids.forEach((id) => {
      if (!id) return;
      const panel = document.getElementById(id);
      if (!panel) return;
      if (id === "optPanelAccess") {
        panel.hidden = false;
        return;
      }
      panel.hidden = Boolean(hidden);
    });
  }

  function renderAccessGate() {
    const lockPanel = refs.optAccessLockPanel;
    if (!lockPanel || !state.app) return;

    const access = getAccessInfo();
    const locked = Boolean(access.locked);
    lockPanel.hidden = !locked;
    setOptionsPanelsHidden(locked);
    if (!locked) return;

    const entitlement = state.app?.entitlement || {};
    const reason = humanAccessReason(access.reason || entitlement.reason);
    const trialRemaining = Number(entitlement?.trial?.remainingMs || 0);
    const trialEndedAt = Number(entitlement?.trial?.endsAt || 0);
    const subStatus = String(entitlement?.subscription?.status || "inactive");

    refs.optAccessLockMessage.textContent = `Holmeta access has ended. Reason: ${reason}.`;
    if (trialRemaining > 0) {
      refs.optAccessLockTiming.textContent = `Trial time remaining: ${formatRemaining(trialRemaining)}.`;
      return;
    }
    if (trialEndedAt > 0) {
      refs.optAccessLockTiming.textContent = `Trial ended at ${new Date(trialEndedAt).toLocaleString()} · subscription: ${subStatus}.`;
      return;
    }
    refs.optAccessLockTiming.textContent = "Reactivate subscription, then refresh access.";
  }

  function renderStats() {
    const stats = state.app.stats || {};
    const today = new Date().toISOString().slice(0, 10);
    const day = stats.daily?.[today] || {};

    refs.statFocus.textContent = String(Math.round(Number(day.focusMinutes || 0)));
    refs.statAlerts.textContent = String(Math.round(Number(day.alerts || 0)));
    refs.statBlocks.textContent = String(Math.round(Number(day.blocks || 0)));
    refs.statLight.textContent = String(Math.round(Number(day.lightMinutes || 0)));

    const rows = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const item = stats.daily?.[key] || {};
      rows.push({ key, focus: Number(item.focusMinutes || 0) });
    }

    const max = Math.max(1, ...rows.map((r) => r.focus));
    refs.weeklyBars.innerHTML = rows
      .map((r) => {
        const width = Math.max(5, Math.round((r.focus / max) * 100));
        return `<div class="bar"><small>${r.key.slice(5)}</small><div class="fill" style="width:${width}%"></div><small>${Math.round(r.focus)}m</small></div>`;
      })
      .join("");
  }

  function renderSiteProfiles() {
    const map = state.app.settings.light.siteProfiles || {};
    const query = String(state.profileSearch || "").trim().toLowerCase();

    const entries = Object.entries(map)
      .filter(([host]) => (query ? host.includes(query) : true))
      .sort(([a], [b]) => a.localeCompare(b));

    if (!entries.length) {
      refs.siteProfileList.innerHTML = '<p class="muted">No matching site profiles.</p>';
      return;
    }

    refs.siteProfileList.innerHTML = entries
      .map(([host, profile]) => {
        const mode = String(profile?.mode || "warm");
        const intensity = Number(profile?.intensity ?? 45);
        return `<article class="profile-item"><div><strong>${host}</strong><small>${mode} · ${intensity}%</small></div><button type="button" data-host="${host}" class="secondary remove-profile">Remove</button></article>`;
      })
      .join("");

    refs.siteProfileList.querySelectorAll(".remove-profile").forEach((btn) => {
      btn.addEventListener("click", () => {
        const host = btn.getAttribute("data-host") || "";
        const next = { ...(state.app.settings.light.siteProfiles || {}) };
        delete next[host];
        queuePatch({ light: { siteProfiles: next } });
        toast(`Removed profile for ${host}`);
      });
    });
  }

  function renderDiagnostics() {
    if (!state.diagnostics) {
      refs.diagSummary.textContent = "Diagnostics unavailable for current tab.";
      return;
    }

    const d = state.diagnostics;
    refs.diagSummary.textContent = [
      `Host: ${d.host || "n/a"}`,
      `Active: ${d.active ? "yes" : "no"}`,
      `Strategy: ${d.strategy || "n/a"}`,
      `Mode: ${d.mode || "n/a"}`,
      `Media: ${d.mediaCount || 0} video/audio, ${d.canvasCount || 0} canvas, ${d.iframeCount || 0} iframe`,
      `Profile: ${d.profileSource || "global"}`
    ].join(" · ");
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function renderSecureTunnel() {
    const tunnel = state.app.settings.secureTunnel || {};
    const runtime = state.app.runtime?.secureTunnel || {};
    const presets = Array.isArray(runtime.presets) ? runtime.presets : [];

    if (refs.optTunnelPreset && !refs.optTunnelPreset.dataset.initialized) {
      refs.optTunnelPreset.innerHTML = presets
        .map((preset) => `<option value="${preset.id}">${preset.label}</option>`)
        .join("");
      refs.optTunnelPreset.dataset.initialized = "true";
    } else if (refs.optTunnelPreset && presets.length) {
      const existing = new Set([...refs.optTunnelPreset.options].map((option) => option.value));
      const mismatch = presets.some((preset) => !existing.has(preset.id)) || existing.size !== presets.length;
      if (mismatch) {
        refs.optTunnelPreset.innerHTML = presets
          .map((preset) => `<option value="${preset.id}">${preset.label}</option>`)
          .join("");
      }
    }

    setChecked("optTunnelEnabled", tunnel.enabled);
    setValue("optTunnelMode", tunnel.mode || "preset");
    setValue("optTunnelPreset", tunnel.selectedPresetId || "fastest");
    setChecked("optTunnelAutoReapply", tunnel.autoReapply);
    setValue("optTunnelReapplyMinutes", tunnel.reapplyMinutes || 20);
    setValue("optTunnelCustomScheme", tunnel.custom?.scheme || "http");
    setValue("optTunnelCustomHost", tunnel.custom?.host || "");
    setValue("optTunnelCustomPort", tunnel.custom?.port || 8080);
    setValue("optTunnelCustomUser", tunnel.custom?.username || "");
    setValue("optTunnelCustomPass", tunnel.custom?.password || "");
    setValue("optTunnelBypassList", Array.isArray(tunnel.bypassList) ? tunnel.bypassList.join("\n") : "<local>\nlocalhost\n127.0.0.1");

    refs.optTunnelPreset.disabled = String(tunnel.mode || "preset") === "custom";
    refs.optTunnelCustomPass.disabled = String(tunnel.mode || "preset") !== "custom";
    refs.optTunnelCustomUser.disabled = String(tunnel.mode || "preset") !== "custom";
    refs.optTunnelCustomHost.disabled = String(tunnel.mode || "preset") !== "custom";
    refs.optTunnelCustomPort.disabled = String(tunnel.mode || "preset") !== "custom";
    refs.optTunnelCustomScheme.disabled = String(tunnel.mode || "preset") !== "custom";

    if (runtime.connected) {
      const label = runtime.activeLabel || runtime.activePresetId || "proxy";
      const session = runtime.connectedAt ? formatDuration(Date.now() - Number(runtime.connectedAt || 0)) : "00:00:00";
      refs.optTunnelStatus.textContent = `Connected via ${label} · Session ${session}`;
    } else if (runtime.lastError) {
      refs.optTunnelStatus.textContent = `Connection failed: ${runtime.lastError}`;
    } else {
      refs.optTunnelStatus.textContent = "Disconnected.";
    }
  }

  function render() {
    if (!state.app) return;
    applyOptionsToolRegistry();
    const s = state.app.settings;
    const light = getLightSettings();
    const reading = getReadingSettings();
    const adaptive = getAdaptiveSettings();
    const lightSiteProfiles = light.perSiteOverrides || light.siteProfiles || {};
    const lightExcludedHosts = Array.isArray(light.excludedHosts)
      ? light.excludedHosts
      : Object.entries(light.excludedSites || {})
          .filter(([, enabled]) => Boolean(enabled))
          .map(([host]) => host);
    const readingSiteProfiles = reading.perSiteOverrides || reading.siteProfiles || {};
    const readingExcludedMap = Array.isArray(reading.excludedHosts)
      ? Object.fromEntries(reading.excludedHosts.map((host) => [normalizeHost(host), true]).filter(([host]) => Boolean(host)))
      : (reading.excludedSites || {});
    const adaptiveSiteProfiles = adaptive.perSiteOverrides || adaptive.siteProfiles || {};
    const adaptiveExcludedMap = Array.isArray(adaptive.excludedHosts)
      ? Object.fromEntries(adaptive.excludedHosts.map((host) => [normalizeHost(host), true]).filter(([host]) => Boolean(host)))
      : (adaptive.excludedSites || {});

    renderPremium();
    renderAccessGate();
    if (!hasExtensionAccess()) {
      setValue("optLicenseKey", "");
      setStatus("Access locked. Reactivate subscription to continue.");
      return;
    }

    setChecked("optLightEnabled", light.enabled);
    setValue("optLightMode", light.mode);
    setValue("optLightSpectrumPreset", light.spectrumPreset);
    setValue("optLightIntensity", light.intensity);
    setValue("optLightDim", light.dim);
    setValue("optLightBrightness", light.brightness);
    setValue("optLightContrastSoft", light.contrastSoft);
    setValue("optLightSaturation", light.saturation);
    setValue("optLightBlueCut", light.blueCut);
    setValue("optLightTintRed", light.tintRed);
    setValue("optLightTintGreen", light.tintGreen);
    setValue("optLightTintBlue", light.tintBlue);
    setChecked("optReduceWhites", light.reduceWhites);
    setChecked("optVideoSafe", light.videoSafe);
    setChecked("optSpotlightEnabled", light.spotlightEnabled);
    setChecked("optTherapyMode", light.therapyMode);
    setValue("optTherapyMinutes", light.therapyDuration ?? light.therapyMinutes ?? 3);
    setValue("optTherapyCadence", light.therapyCadence);
    setChecked("optLightScheduleEnabled", light.schedule?.enabled);
    setChecked("optUseSunset", light.schedule?.useSunset);
    setValue("optLightStart", light.schedule?.start || "20:00");
    setValue("optLightEnd", light.schedule?.end || "06:00");
    setValue("optRampMinutes", light.schedule?.rampMinutes ?? 45);
    setValue("optQuickSchedule", light.schedule?.quickPreset || "custom");
    setValue("optLightExclusions", domainsToLines(lightExcludedHosts));
    setValue("optSiteProfiles", JSON.stringify(lightSiteProfiles || {}, null, 2));

    const readingAppearance = String(
      reading.appearance || (String(reading.mode || "dark") === "light" ? "light" : "dark")
    );
    const readingDarkVariant = normalizeReadingDarkVariant(
      reading.darkVariant || reading.darkThemeVariant,
      darkVariantFromPreset(reading.preset, "coal")
    );
    const readingLightVariant = normalizeReadingLightVariant(
      reading.lightVariant || reading.lightThemeVariant,
      lightVariantFromPreset(reading.preset, "white")
    );
    const readingScheduleModeRaw = String(
      reading.scheduleMode || (reading.schedule?.useSunset ? "sunset" : "system")
    );
    const readingScheduleMode = ["system", "sunset", "custom"].includes(readingScheduleModeRaw)
      ? readingScheduleModeRaw
      : "system";
    const readingIsAuto = readingAppearance === "auto";
    setChecked("optReadingEnabled", reading.enabled);
    setValue("optReadingAppearance", readingAppearance);
    setValue("optReadingDarkVariant", readingDarkVariant);
    setValue("optReadingLightVariant", readingLightVariant);
    setValue("optReadingScheduleMode", readingScheduleMode);
    setValue("optReadingStart", reading.schedule?.start || "20:00");
    setValue("optReadingEnd", reading.schedule?.end || "06:00");
    if (refs.optReadingScheduleMode) refs.optReadingScheduleMode.disabled = !readingIsAuto;
    const readingCustomEnabled = readingIsAuto && readingScheduleMode === "custom";
    if (refs.optReadingStart) refs.optReadingStart.disabled = !readingCustomEnabled;
    if (refs.optReadingEnd) refs.optReadingEnd.disabled = !readingCustomEnabled;
    setValue("optReadingExclusions", hostMapToLines(readingExcludedMap));
    setValue("optReadingSiteProfiles", JSON.stringify(readingSiteProfiles || {}, null, 2));
    setChecked("optReadingThisSiteEnabled", Boolean(state.activeHost && readingSiteProfiles[state.activeHost]));
    setChecked("optReadingExcludeSite", Boolean(state.activeHost && readingExcludedMap[state.activeHost]));
    if (refs.optReadingHostStatus) {
      refs.optReadingHostStatus.textContent = state.activeHost
        ? `Active host: ${state.activeHost}`
        : "Active host: unavailable";
    }

    setChecked("optAdaptiveEnabled", adaptive.enabled);
    setValue("optAdaptiveMode", adaptive.mode || "smart_dark");
    setValue("optAdaptivePreset", adaptive.preset || "balanced");
    setValue("optAdaptiveIntensity", adaptive.intensity ?? 52);
    setValue("optAdaptiveStrategy", adaptive.strategy || "auto");
    setValue("optAdaptiveCompatibility", adaptive.compatibilityMode || "normal");
    setValue("optAdaptiveExclusions", hostMapToLines(adaptiveExcludedMap));
    setValue("optAdaptiveSiteProfiles", JSON.stringify(adaptiveSiteProfiles || {}, null, 2));
    setChecked("optAdaptiveThisSiteEnabled", Boolean(state.activeHost && adaptiveSiteProfiles[state.activeHost]));
    setChecked("optAdaptiveExcludeSite", Boolean(state.activeHost && adaptiveExcludedMap[state.activeHost]));
    if (refs.optAdaptiveHostStatus) {
      refs.optAdaptiveHostStatus.textContent = state.activeHost
        ? `Active host: ${state.activeHost}`
        : "Active host: unavailable";
    }

    setChecked("optBlockerEnabled", s.blocker.enabled);
    setChecked("optNuclearMode", s.blocker.nuclear);
    setValue("optBlockerMode", s.blocker.activationMode);
    setChecked("optBlockScheduleEnabled", s.blocker.schedule.enabled);
    setValue("optBlockStart", s.blocker.schedule.start);
    setValue("optBlockEnd", s.blocker.schedule.end);
    setChecked("optBlockCatAds", s.blocker.categories?.ads);
    setChecked("optBlockCatTrackers", s.blocker.categories?.trackers);
    setChecked("optBlockCatMalware", s.blocker.categories?.malware);
    setChecked("optBlockCatAnnoyances", s.blocker.categories?.annoyances);
    setChecked("optBlockCatVideoAds", s.blocker.categories?.videoAds);
    setChecked("optBlockCosmeticEnabled", s.blocker.cosmeticFiltering);
    setChecked("optBlockAntiDetect", s.blocker.antiDetection);
    setChecked("optBlockAutoUpdate", s.blocker.autoUpdateLists);
    setValue("optBlockUpdateInterval", s.blocker.updateIntervalHours || 48);
    setValue("optBlockedDomains", domainsToLines(s.blocker.blockedDomains));
    setValue("optAllowDomains", domainsToLines(s.blocker.allowDomains));
    setValue("optBlockCosmeticDisabledHosts", hostMapToLines(s.blocker.disableCosmeticOnSite));
    setValue("optBlockCustomCosmeticJson", JSON.stringify(s.blocker.customCosmeticSelectors || {}, null, 2));
    renderSecureTunnel();

    setChecked("optAlertsEnabled", s.alerts.enabled);
    setValue("optAlertFrequency", s.alerts.frequencyMin);
    setValue("optAlertCadence", s.alerts.cadenceMode || "focus_weighted");
    setChecked("optAlertSound", s.alerts.soundEnabled);
    setValue("optAlertVolume", s.alerts.soundVolume || 35);
    setValue("optAlertPattern", s.alerts.soundPattern || "double");
    setChecked("optAlertToastEnabled", s.alerts.toastEnabled);
    setChecked("optAlertNotificationEnabled", s.alerts.notificationEnabled);
    setValue("optAlertSnoozeMinutes", s.alerts.snoozeMinutes || 10);
    setValue("optAlertCooldown", s.alerts.cooldownMin || 0);
    setValue("optAlertBurnoutThreshold", s.alerts.burnoutFocusThresholdMin || 90);
    setChecked("optAlertQuietHoursEnabled", s.alerts.quietHours?.enabled);
    setValue("optAlertQuietStart", s.alerts.quietHours?.start || "22:30");
    setValue("optAlertQuietEnd", s.alerts.quietHours?.end || "06:30");
    setChecked("optAlertEye", s.alerts.types.eye);
    setChecked("optAlertPosture", s.alerts.types.posture);
    setChecked("optAlertBurnout", s.alerts.types.burnout);
    setChecked("optAlertHydration", s.alerts.types.hydration);
    setChecked("optAlertBlink", s.alerts.types.blink);
    setChecked("optAlertMovement", s.alerts.types.movement);

    setChecked("optSiteInsightEnabled", s.siteInsight.enabled);
    setChecked("optSiteInsightShowOnEverySite", s.siteInsight.showOnEverySite);
    setChecked("optSiteInsightAutoMinimize", s.siteInsight.autoMinimize);
    setChecked("optSiteInsightPill", s.siteInsight.minimizedPill);
    setValue("optSiteInsightProfile", s.siteInsight.selectedProfile);
    setValue("optSiteInsightDuration", s.siteInsight.durationMs);
    setChecked("optSiteInsightShowAlgorithm", s.siteInsight.showAlgorithmLabel);
    setChecked("optSiteInsightShowPurpose", s.siteInsight.showPurposeSummary);
    setChecked("optSiteInsightRegular", s.siteInsight.enabledProfiles.regular);
    setChecked("optSiteInsightDev", s.siteInsight.enabledProfiles.dev);
    setChecked("optSiteInsightDesign", s.siteInsight.enabledProfiles.design);
    setChecked("optSiteInsightUxr", s.siteInsight.enabledProfiles.uxr);
    setValue("optSiteInsightDisabledHosts", hostMapToLines(s.siteInsight.perSiteDisabled));

    setValue("optFocusMinutes", s.deepWork.focusMin);
    setValue("optBreakMinutes", s.deepWork.breakMin);
    setChecked("optAutoBlocker", s.deepWork.autoBlocker);
    setChecked("optAutoLight", s.deepWork.autoLight);

    setValue("optLicenseKey", state.app.license.premium ? "PREMIUM ACTIVE" : "");
    setChecked("optBiofeedback", s.advanced.biofeedback);
    setChecked("optMorphing", s.advanced.morphing);
    setChecked("optTaskWeaver", s.advanced.taskWeaver);
    setChecked("optDashboardPredictions", s.advanced.dashboardPredictions);
    setChecked("optCollaborative", s.advanced.collaborativeSync);

    setChecked("optDebug", state.app.meta.debug);

    renderSiteProfiles();
    renderDiagnostics();
    renderStats();
  }

  async function hydrate() {
    const response = await sendMessage({ type: "holmeta:get-state", source: "options" });
    if (!response.ok) {
      setStatus(`Load failed: ${response.error || "unknown"}`, true);
      return;
    }

    state.app = response.state;
    await getActiveHost();
    await refreshDiagnostics();
    render();
  }

  function bindEditingTracking() {
    document.addEventListener("focusin", (event) => {
      if (event.target?.id) state.editing.add(event.target.id);
    });

    document.addEventListener("focusout", (event) => {
      if (event.target?.id) state.editing.delete(event.target.id);
      flushPatch();
    });
  }

  function bindSettingsInputs() {
    const bindCheck = (id, buildPatch) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => buildPatch(el));
    };

    const bindInput = (id, buildPatch) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => buildPatch(el));
    };

    const bindSelect = (id, buildPatch) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => buildPatch(el));
    };

    bindCheck("optLightEnabled", (el) => queuePatch({ light: { enabled: el.checked } }));
    bindSelect("optLightMode", (el) => queuePatch({ light: { mode: el.value } }));
    bindSelect("optLightSpectrumPreset", (el) => queuePatch({ light: { spectrumPreset: el.value } }));
    bindInput("optLightIntensity", (el) => queuePatch({ light: { intensity: Number(el.value || 45) } }));
    bindInput("optLightDim", (el) => queuePatch({ light: { dim: Number(el.value || 18) } }));
    bindInput("optLightBrightness", (el) => queuePatch({ light: { brightness: Number(el.value || 96) } }));
    bindInput("optLightContrastSoft", (el) => queuePatch({ light: { contrastSoft: Number(el.value || 8) } }));
    bindInput("optLightSaturation", (el) => queuePatch({ light: { saturation: Number(el.value || 100) } }));
    bindInput("optLightBlueCut", (el) => queuePatch({ light: { blueCut: Number(el.value || 65) } }));
    bindInput("optLightTintRed", (el) => queuePatch({ light: { tintRed: Number(el.value || 100) } }));
    bindInput("optLightTintGreen", (el) => queuePatch({ light: { tintGreen: Number(el.value || 62) } }));
    bindInput("optLightTintBlue", (el) => queuePatch({ light: { tintBlue: Number(el.value || 30) } }));
    bindCheck("optReduceWhites", (el) => queuePatch({ light: { reduceWhites: el.checked } }));
    bindCheck("optVideoSafe", (el) => queuePatch({ light: { videoSafe: el.checked } }));
    bindCheck("optSpotlightEnabled", (el) => queuePatch({ light: { spotlightEnabled: el.checked } }));
    bindCheck("optTherapyMode", (el) => queuePatch({ light: { therapyMode: el.checked } }));
    bindInput("optTherapyMinutes", (el) => queuePatch({ light: { therapyMinutes: Number(el.value || 3) } }));
    bindSelect("optTherapyCadence", (el) => queuePatch({ light: { therapyCadence: el.value } }));
    bindCheck("optLightScheduleEnabled", (el) => queuePatch({ light: { schedule: { enabled: el.checked } } }));
    bindCheck("optUseSunset", (el) => queuePatch({ light: { schedule: { useSunset: el.checked } } }));
    bindInput("optLightStart", (el) => queuePatch({ light: { schedule: { start: el.value || "20:00" } } }));
    bindInput("optLightEnd", (el) => queuePatch({ light: { schedule: { end: el.value || "06:00" } } }));
    bindInput("optRampMinutes", (el) => queuePatch({ light: { schedule: { rampMinutes: Number(el.value || 45) } } }));
    bindSelect("optQuickSchedule", (el) => queuePatch({ light: { schedule: { quickPreset: el.value } } }));
    bindInput("optLightExclusions", (el) => queuePatch({ light: { excludedHosts: linesToDomains(el.value) } }));

    bindCheck("optReadingEnabled", (el) => queuePatch({ readingTheme: { enabled: el.checked } }));
    bindSelect("optReadingAppearance", (el) => {
      const appearance = String(el.value || "dark");
      const isAuto = appearance === "auto";
      const scheduleMode = ["system", "sunset", "custom"].includes(String(refs.optReadingScheduleMode?.value || ""))
        ? String(refs.optReadingScheduleMode.value)
        : "system";
      const darkVariant = normalizeReadingDarkVariant(refs.optReadingDarkVariant?.value, "coal");
      const lightVariant = normalizeReadingLightVariant(refs.optReadingLightVariant?.value, "white");
      const mode = appearance === "light" ? "light" : "dark";
      if (refs.optReadingScheduleMode) refs.optReadingScheduleMode.disabled = !isAuto;
      const customEnabled = isAuto && scheduleMode === "custom";
      if (refs.optReadingStart) refs.optReadingStart.disabled = !customEnabled;
      if (refs.optReadingEnd) refs.optReadingEnd.disabled = !customEnabled;
      queuePatch({
        readingTheme: {
          appearance,
          darkVariant,
          darkThemeVariant: darkVariant,
          lightVariant,
          lightThemeVariant: lightVariant,
          mode,
          preset: readingPresetFor(mode, darkVariant, lightVariant),
          schedule: {
            enabled: isAuto,
            useSunset: scheduleMode === "sunset"
          }
        }
      });
    });
    bindSelect("optReadingDarkVariant", (el) => {
      const darkVariant = normalizeReadingDarkVariant(el.value, "coal");
      const appearance = String(refs.optReadingAppearance?.value || "dark");
      const mode = appearance === "light" ? "light" : "dark";
      const lightVariant = normalizeReadingLightVariant(refs.optReadingLightVariant?.value, "white");
      queuePatch({
        readingTheme: {
          darkVariant,
          darkThemeVariant: darkVariant,
          mode,
          preset: readingPresetFor(mode, darkVariant, lightVariant)
        }
      });
    });
    bindSelect("optReadingLightVariant", (el) => {
      const lightVariant = normalizeReadingLightVariant(el.value, "white");
      const appearance = String(refs.optReadingAppearance?.value || "dark");
      const mode = appearance === "light" ? "light" : "dark";
      const darkVariant = normalizeReadingDarkVariant(refs.optReadingDarkVariant?.value, "coal");
      queuePatch({
        readingTheme: {
          lightVariant,
          lightThemeVariant: lightVariant,
          mode,
          preset: readingPresetFor(mode, darkVariant, lightVariant)
        }
      });
    });
    bindSelect("optReadingScheduleMode", (el) => {
      const scheduleMode = ["system", "sunset", "custom"].includes(String(el.value || ""))
        ? String(el.value)
        : "system";
      const isAuto = String(refs.optReadingAppearance?.value || "dark") === "auto";
      const customEnabled = isAuto && scheduleMode === "custom";
      if (refs.optReadingStart) refs.optReadingStart.disabled = !customEnabled;
      if (refs.optReadingEnd) refs.optReadingEnd.disabled = !customEnabled;
      queuePatch({
        readingTheme: {
          scheduleMode,
          schedule: {
            enabled: isAuto,
            useSunset: scheduleMode === "sunset"
          }
        }
      });
    });
    bindInput("optReadingStart", (el) =>
      queuePatch({
        readingTheme: {
          scheduleMode: "custom",
          schedule: {
            enabled: true,
            useSunset: false,
            start: String(el.value || "20:00")
          }
        }
      })
    );
    bindInput("optReadingEnd", (el) =>
      queuePatch({
        readingTheme: {
          scheduleMode: "custom",
          schedule: {
            enabled: true,
            useSunset: false,
            end: String(el.value || "06:00")
          }
        }
      })
    );
    bindInput("optReadingExclusions", (el) => queuePatch({ readingTheme: { excludedSites: linesToHostMap(el.value) } }));
    bindInput("optReadingSiteProfiles", (el) => {
      try {
        const parsed = JSON.parse(el.value || "{}");
        queuePatch({ readingTheme: { perSiteOverrides: parsed } });
      } catch {
        setStatus("Reading profiles JSON invalid", true);
      }
    });

    bindCheck("optAdaptiveEnabled", (el) => queuePatch({ adaptiveSiteTheme: { enabled: el.checked } }));
    bindSelect("optAdaptiveMode", (el) => queuePatch({ adaptiveSiteTheme: { mode: String(el.value || "smart_dark") } }));
    bindSelect("optAdaptivePreset", (el) => queuePatch({ adaptiveSiteTheme: { preset: String(el.value || "balanced") } }));
    bindInput("optAdaptiveIntensity", (el) => queuePatch({ adaptiveSiteTheme: { intensity: Number(el.value || 52) } }));
    bindSelect("optAdaptiveStrategy", (el) => queuePatch({ adaptiveSiteTheme: { strategy: String(el.value || "auto") } }));
    bindSelect("optAdaptiveCompatibility", (el) => queuePatch({ adaptiveSiteTheme: { compatibilityMode: String(el.value || "normal") } }));
    bindInput("optAdaptiveExclusions", (el) => queuePatch({ adaptiveSiteTheme: { excludedSites: linesToHostMap(el.value) } }));
    bindInput("optAdaptiveSiteProfiles", (el) => {
      try {
        const parsed = JSON.parse(el.value || "{}");
        queuePatch({ adaptiveSiteTheme: { perSiteOverrides: parsed } });
      } catch {
        setStatus("Adaptive profiles JSON invalid", true);
      }
    });

    bindInput("optSiteProfiles", (el) => {
      try {
        const parsed = JSON.parse(el.value || "{}");
        queuePatch({ light: { siteProfiles: parsed } });
      } catch {
        setStatus("Site profiles JSON invalid", true);
      }
    });

    bindCheck("optBlockerEnabled", (el) => queuePatch({ blocker: { enabled: el.checked } }));
    bindCheck("optNuclearMode", (el) => {
      if (el.checked && !window.confirm("Enable Nuclear Mode? This blocks most sites.")) {
        el.checked = false;
        return;
      }
      queuePatch({ blocker: { nuclear: el.checked } });
    });
    bindSelect("optBlockerMode", (el) => queuePatch({ blocker: { activationMode: el.value } }));
    bindCheck("optBlockScheduleEnabled", (el) => queuePatch({ blocker: { schedule: { enabled: el.checked } } }));
    bindInput("optBlockStart", (el) => queuePatch({ blocker: { schedule: { start: el.value || "09:00" } } }));
    bindInput("optBlockEnd", (el) => queuePatch({ blocker: { schedule: { end: el.value || "17:30" } } }));
    bindCheck("optBlockCatAds", (el) => queuePatch({ blocker: { categories: { ads: el.checked } } }));
    bindCheck("optBlockCatTrackers", (el) => queuePatch({ blocker: { categories: { trackers: el.checked } } }));
    bindCheck("optBlockCatMalware", (el) => queuePatch({ blocker: { categories: { malware: el.checked } } }));
    bindCheck("optBlockCatAnnoyances", (el) => queuePatch({ blocker: { categories: { annoyances: el.checked } } }));
    bindCheck("optBlockCatVideoAds", (el) => queuePatch({ blocker: { categories: { videoAds: el.checked } } }));
    bindCheck("optBlockCosmeticEnabled", (el) => queuePatch({ blocker: { cosmeticFiltering: el.checked } }));
    bindCheck("optBlockAntiDetect", (el) => queuePatch({ blocker: { antiDetection: el.checked } }));
    bindCheck("optBlockAutoUpdate", (el) => queuePatch({ blocker: { autoUpdateLists: el.checked } }));
    bindSelect("optBlockUpdateInterval", (el) => queuePatch({ blocker: { updateIntervalHours: Number(el.value || 48) } }));
    bindInput("optBlockedDomains", (el) => queuePatch({ blocker: { blockedDomains: linesToDomains(el.value) } }));
    bindInput("optAllowDomains", (el) => queuePatch({ blocker: { allowDomains: linesToDomains(el.value) } }));
    bindInput("optBlockCosmeticDisabledHosts", (el) => queuePatch({ blocker: { disableCosmeticOnSite: linesToHostMap(el.value) } }));
    refs.optBlockCustomCosmeticJson?.addEventListener("blur", (event) => {
      const el = event.target;
      try {
        const parsed = JSON.parse(el.value || "{}");
        queuePatch({ blocker: { customCosmeticSelectors: parsed } });
      } catch {
        setStatus("Custom cosmetic selector JSON invalid", true);
      }
    });

    bindCheck("optTunnelEnabled", (el) => queuePatch({ secureTunnel: { enabled: el.checked } }));
    bindSelect("optTunnelMode", (el) => queuePatch({ secureTunnel: { mode: String(el.value || "preset") } }));
    bindSelect("optTunnelPreset", (el) => queuePatch({ secureTunnel: { selectedPresetId: String(el.value || "fastest") } }));
    bindCheck("optTunnelAutoReapply", (el) => queuePatch({ secureTunnel: { autoReapply: el.checked } }));
    bindSelect("optTunnelReapplyMinutes", (el) => queuePatch({ secureTunnel: { reapplyMinutes: Number(el.value || 20) } }));
    bindSelect("optTunnelCustomScheme", (el) => queuePatch({ secureTunnel: { custom: { scheme: String(el.value || "http") } } }));
    bindSelect("optTunnelCustomHost", (el) => queuePatch({ secureTunnel: { custom: { host: String(el.value || "") } } }));
    bindSelect("optTunnelCustomPort", (el) => queuePatch({ secureTunnel: { custom: { port: Number(el.value || 8080) } } }));
    bindSelect("optTunnelCustomUser", (el) => queuePatch({ secureTunnel: { custom: { username: String(el.value || "") } } }));
    bindSelect("optTunnelCustomPass", (el) => queuePatch({ secureTunnel: { custom: { password: String(el.value || "") } } }));
    bindSelect("optTunnelBypassList", (el) => queuePatch({ secureTunnel: { bypassList: linesToBypassList(el.value) } }));

    bindCheck("optAlertsEnabled", (el) => queuePatch({ alerts: { enabled: el.checked } }));
    bindSelect("optAlertFrequency", (el) => queuePatch({ alerts: { frequencyMin: Number(el.value || 45) } }));
    bindSelect("optAlertCadence", (el) => queuePatch({ alerts: { cadenceMode: String(el.value || "focus_weighted") } }));
    bindCheck("optAlertSound", (el) => queuePatch({ alerts: { soundEnabled: el.checked } }));
    bindInput("optAlertVolume", (el) => queuePatch({ alerts: { soundVolume: Number(el.value || 35) } }));
    bindSelect("optAlertPattern", (el) => queuePatch({ alerts: { soundPattern: String(el.value || "double") } }));
    bindCheck("optAlertToastEnabled", (el) => queuePatch({ alerts: { toastEnabled: el.checked } }));
    bindCheck("optAlertNotificationEnabled", (el) => queuePatch({ alerts: { notificationEnabled: el.checked } }));
    bindSelect("optAlertSnoozeMinutes", (el) => queuePatch({ alerts: { snoozeMinutes: Number(el.value || 10) } }));
    bindSelect("optAlertCooldown", (el) => queuePatch({ alerts: { cooldownMin: Number(el.value || 0) } }));
    bindSelect("optAlertBurnoutThreshold", (el) => queuePatch({ alerts: { burnoutFocusThresholdMin: Number(el.value || 90) } }));
    bindCheck("optAlertQuietHoursEnabled", (el) => queuePatch({ alerts: { quietHours: { enabled: el.checked } } }));
    bindInput("optAlertQuietStart", (el) => queuePatch({ alerts: { quietHours: { start: el.value || "22:30" } } }));
    bindInput("optAlertQuietEnd", (el) => queuePatch({ alerts: { quietHours: { end: el.value || "06:30" } } }));
    bindCheck("optAlertEye", (el) => queuePatch({ alerts: { types: { eye: el.checked } } }));
    bindCheck("optAlertPosture", (el) => queuePatch({ alerts: { types: { posture: el.checked } } }));
    bindCheck("optAlertBurnout", (el) => queuePatch({ alerts: { types: { burnout: el.checked } } }));
    bindCheck("optAlertHydration", (el) => queuePatch({ alerts: { types: { hydration: el.checked } } }));
    bindCheck("optAlertBlink", (el) => queuePatch({ alerts: { types: { blink: el.checked } } }));
    bindCheck("optAlertMovement", (el) => queuePatch({ alerts: { types: { movement: el.checked } } }));

    bindCheck("optSiteInsightEnabled", (el) => queuePatch({ siteInsight: { enabled: el.checked } }));
    bindCheck("optSiteInsightShowOnEverySite", (el) => queuePatch({ siteInsight: { showOnEverySite: el.checked } }));
    bindCheck("optSiteInsightAutoMinimize", (el) => queuePatch({ siteInsight: { autoMinimize: el.checked } }));
    bindCheck("optSiteInsightPill", (el) => queuePatch({ siteInsight: { minimizedPill: el.checked } }));
    bindSelect("optSiteInsightProfile", (el) => queuePatch({ siteInsight: { selectedProfile: String(el.value || "regular") } }));
    bindSelect("optSiteInsightDuration", (el) => {
      const durationMs = Math.max(6000, Math.min(10000, Number(el.value || 8000)));
      queuePatch({ siteInsight: { durationMs } });
    });
    bindCheck("optSiteInsightShowAlgorithm", (el) => queuePatch({ siteInsight: { showAlgorithmLabel: el.checked } }));
    bindCheck("optSiteInsightShowPurpose", (el) => queuePatch({ siteInsight: { showPurposeSummary: el.checked } }));
    bindCheck("optSiteInsightRegular", (el) => queuePatch({ siteInsight: { enabledProfiles: { regular: el.checked } } }));
    bindCheck("optSiteInsightDev", (el) => queuePatch({ siteInsight: { enabledProfiles: { dev: el.checked } } }));
    bindCheck("optSiteInsightDesign", (el) => queuePatch({ siteInsight: { enabledProfiles: { design: el.checked } } }));
    bindCheck("optSiteInsightUxr", (el) => queuePatch({ siteInsight: { enabledProfiles: { uxr: el.checked } } }));
    bindInput("optSiteInsightDisabledHosts", (el) => queuePatch({ siteInsight: { perSiteDisabled: linesToHostMap(el.value) } }));

    bindInput("optFocusMinutes", (el) => queuePatch({ deepWork: { focusMin: Number(el.value || 25) } }));
    bindInput("optBreakMinutes", (el) => queuePatch({ deepWork: { breakMin: Number(el.value || 5) } }));
    bindCheck("optAutoBlocker", (el) => queuePatch({ deepWork: { autoBlocker: el.checked } }));
    bindCheck("optAutoLight", (el) => queuePatch({ deepWork: { autoLight: el.checked } }));

    bindCheck("optBiofeedback", (el) => queuePatch({ advanced: { biofeedback: el.checked } }));
    bindCheck("optMorphing", (el) => queuePatch({ advanced: { morphing: el.checked } }));
    bindCheck("optTaskWeaver", (el) => queuePatch({ advanced: { taskWeaver: el.checked } }));
    bindCheck("optDashboardPredictions", (el) => queuePatch({ advanced: { dashboardPredictions: el.checked } }));
    bindCheck("optCollaborative", (el) => queuePatch({ advanced: { collaborativeSync: el.checked } }));

    bindCheck("optDebug", (el) => {
      sendMessage({ type: "holmeta:set-debug", value: el.checked }).then((response) => {
        if (!response.ok) {
          setStatus(`Debug update failed: ${response.error || "unknown"}`, true);
          return;
        }
        state.app = response.state;
        render();
      });
    });

    refs.optProfileSearch.addEventListener("input", (event) => {
      state.profileSearch = String(event.target.value || "").trim().toLowerCase();
      renderSiteProfiles();
    });

    refs.optAlertTest?.addEventListener("click", async () => {
      const kind = String(refs.optAlertTestType?.value || "eye");
      const response = await sendMessage({ type: "holmeta:test-alert", kind });
      if (!response.ok) {
        setStatus(`Test alert failed: ${response.error || "unknown"}`, true);
        return;
      }
      toast(`Test alert sent (${kind}).`);
      setStatus("Alert test sent.");
    });
  }

  function applyQuickSchedulePreset(kind) {
    if (kind === "evening") {
      queuePatch({ light: { schedule: { enabled: true, quickPreset: "evening", start: "20:00", end: "07:00" } } });
      return;
    }
    if (kind === "workday") {
      queuePatch({ light: { schedule: { enabled: true, quickPreset: "workday", start: "09:00", end: "17:00" } } });
      return;
    }
    if (kind === "late_night") {
      queuePatch({ light: { schedule: { enabled: true, quickPreset: "late_night", start: "22:00", end: "06:00" }, mode: "red_overlay" } });
      return;
    }
    queuePatch({ light: { schedule: { quickPreset: "custom" } } });
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function refreshDiagnostics() {
    const tab = await pickInspectableTab();
    const tabId = Number(tab?.id || 0);

    if (!Number.isInteger(tabId) || tabId <= 0) {
      state.diagnostics = null;
      renderDiagnostics();
      return;
    }

    const response = await sendMessage({ type: "holmeta:get-light-diagnostics", tabId });
    if (!response.ok) {
      state.diagnostics = null;
      renderDiagnostics();
      return;
    }

    state.diagnostics = response.diagnostics || null;
    renderDiagnostics();
  }

  function bindActions() {
    refs.optAccessStartTrial?.addEventListener("click", () => {
      chrome.tabs.create({ url: UPGRADE_URL });
    });

    refs.optAccessManageBilling?.addEventListener("click", () => {
      chrome.tabs.create({ url: BILLING_URL });
    });

    refs.optAccessRefresh?.addEventListener("click", async () => {
      refs.optAccessRefresh.disabled = true;
      refs.optAccessRefresh.textContent = "Refreshing...";
      const response = await sendMessage({ type: "holmeta:entitlement-refresh" });
      refs.optAccessRefresh.disabled = false;
      refs.optAccessRefresh.textContent = "Refresh Access";
      if (!response?.ok) {
        toast(`Refresh failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(hasExtensionAccess() ? "Access restored." : "Access still locked.");
    });

    refs.activateLicense.addEventListener("click", async () => {
      const key = String(refs.optLicenseKey.value || "").trim();
      if (!key) {
        toast("Enter a license key.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:activate-license", key });
      if (!response.ok) {
        toast("License invalid.");
        return;
      }
      state.app = response.state;
      render();
      toast("Premium unlocked locally.");
    });

    refs.clearLicense.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:clear-license" });
      if (!response.ok) {
        toast(`Failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("License cleared.");
    });

    refs.openPricing.addEventListener("click", () => {
      chrome.tabs.create({ url: UPGRADE_URL });
    });

    refs.applyQuickSchedule.addEventListener("click", () => {
      applyQuickSchedulePreset(String(refs.optQuickSchedule.value || "custom"));
      toast("Quick schedule applied.");
    });

    refs.optRefreshBlockLists?.addEventListener("click", async () => {
      refs.optRefreshBlockLists.disabled = true;
      refs.optRefreshBlockLists.textContent = "Refreshing...";
      const response = await sendMessage({ type: "holmeta:refresh-blocker-lists" });
      refs.optRefreshBlockLists.disabled = false;
      refs.optRefreshBlockLists.textContent = "Refresh Filter Lists Now";
      if (!response.ok) {
        toast(`Refresh failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Filter lists refreshed.");
    });

    refs.optTunnelConnect?.addEventListener("click", async () => {
      const payload = {
        mode: String(refs.optTunnelMode?.value || "preset"),
        presetId: String(refs.optTunnelPreset?.value || "fastest"),
        custom: {
          scheme: String(refs.optTunnelCustomScheme?.value || "http"),
          host: String(refs.optTunnelCustomHost?.value || "").trim(),
          port: Number(refs.optTunnelCustomPort?.value || 8080),
          username: String(refs.optTunnelCustomUser?.value || "").trim(),
          password: String(refs.optTunnelCustomPass?.value || "")
        }
      };
      refs.optTunnelConnect.disabled = true;
      refs.optTunnelConnect.textContent = "Connecting...";
      const response = await sendMessage({
        type: "holmeta:secure-tunnel-connect",
        ...payload
      });
      refs.optTunnelConnect.disabled = false;
      refs.optTunnelConnect.textContent = "Save & Connect";
      if (!response.ok) {
        toast(`Secure Tunnel failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Secure Tunnel connected.");
    });

    refs.optTunnelDisconnect?.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:secure-tunnel-disconnect" });
      if (!response.ok) {
        toast(`Secure Tunnel disconnect failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Secure Tunnel disconnected.");
    });

    refs.exportSettings.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:export-settings" });
      if (!response.ok) {
        toast(`Export failed: ${response.error || "unknown"}`);
        return;
      }
      downloadJson(`holmeta-v3-settings-${new Date().toISOString().slice(0, 10)}.json`, response.data);
      toast("Settings exported.");
    });

    refs.exportLogs.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:export-logs" });
      if (!response.ok) {
        toast(`Log export failed: ${response.error || "unknown"}`);
        return;
      }
      downloadJson(`holmeta-v3-logs-${new Date().toISOString().slice(0, 10)}.json`, response.logs || []);
      toast("Logs exported.");
    });

    refs.importSettings.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast("Import failed: invalid JSON.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:import-settings", data: parsed });
      if (!response.ok) {
        toast(`Import failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      await refreshDiagnostics();
      render();
      toast("Import complete.");
    });

    refs.resetAll.addEventListener("click", async () => {
      if (!window.confirm("Reset all HOLMETA local data?")) return;
      const response = await sendMessage({ type: "holmeta:reset-all" });
      if (!response.ok) {
        toast(`Reset failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      await refreshDiagnostics();
      render();
      toast("All data reset.");
    });

    refs.calcSunset.addEventListener("click", async () => {
      const has = await new Promise((resolve) => chrome.permissions.contains({ permissions: ["geolocation"] }, resolve));
      let granted = has;
      if (!has) {
        granted = await new Promise((resolve) =>
          chrome.permissions.request({ permissions: ["geolocation"] }, (ok) => resolve(Boolean(ok)))
        );
      }
      if (!granted) {
        toast("Geolocation denied.");
        return;
      }

      if (!navigator.geolocation) {
        toast("Geolocation unavailable in this browser context.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const times = estimateSunTimes(new Date(), latitude, longitude);
          queuePatch({
            light: {
              schedule: {
                enabled: true,
                useSunset: true,
                start: times.sunset,
                end: times.sunrise,
                quickPreset: "custom"
              }
            }
          });
          toast(`Sun schedule set: ${times.sunset} → ${times.sunrise}`);
        },
        (err) => {
          log("geo_error", err);
          toast("Failed to get location.");
        },
        { timeout: 12000 }
      );
    });

    refs.diagRefresh.addEventListener("click", refreshDiagnostics);

    refs.optSiteInsightClearCache.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:clear-site-insight-cache" });
      if (!response.ok) {
        toast(`Clear cache failed: ${response.error || "unknown"}`);
        return;
      }
      toast("Site Insight cache cleared.");
    });

    refs.diagResetSite.addEventListener("click", async () => {
      const host = await getActiveHost();
      if (!host) {
        toast("No active website detected.");
        return;
      }
      const light = getLightSettings();
      const reading = getReadingSettings();
      const adaptive = getAdaptiveSettings();

      const nextLightProfiles = { ...((light.perSiteOverrides || light.siteProfiles || {})) };
      delete nextLightProfiles[host];
      const nextLightExcluded = {
        ...(Array.isArray(light.excludedHosts)
          ? Object.fromEntries(light.excludedHosts.map((row) => [normalizeHost(row), true]).filter(([rowHost]) => Boolean(rowHost)))
          : (light.excludedSites || {}))
      };
      delete nextLightExcluded[host];

      const nextReadingProfiles = { ...((reading.perSiteOverrides || reading.siteProfiles || {})) };
      delete nextReadingProfiles[host];
      const nextReadingExcluded = {
        ...(Array.isArray(reading.excludedHosts)
          ? Object.fromEntries(reading.excludedHosts.map((row) => [normalizeHost(row), true]).filter(([rowHost]) => Boolean(rowHost)))
          : (reading.excludedSites || {}))
      };
      delete nextReadingExcluded[host];

      const nextAdaptiveProfiles = { ...((adaptive.perSiteOverrides || adaptive.siteProfiles || {})) };
      delete nextAdaptiveProfiles[host];
      const nextAdaptiveExcluded = {
        ...(Array.isArray(adaptive.excludedHosts)
          ? Object.fromEntries(adaptive.excludedHosts.map((row) => [normalizeHost(row), true]).filter(([rowHost]) => Boolean(rowHost)))
          : (adaptive.excludedSites || {}))
      };
      delete nextAdaptiveExcluded[host];

      queuePatch({
        lightFilter: { perSiteOverrides: nextLightProfiles, excludedSites: nextLightExcluded },
        readingTheme: { perSiteOverrides: nextReadingProfiles, excludedSites: nextReadingExcluded },
        adaptiveSiteTheme: { perSiteOverrides: nextAdaptiveProfiles, excludedSites: nextAdaptiveExcluded }
      });
      toast(`Reset overrides + exclusions for ${host}`);
    });

    refs.optReadingThisSiteEnabled?.addEventListener("change", (event) => {
      const host = getCurrentHostOrToast();
      if (!host) {
        event.target.checked = false;
        return;
      }
      const checked = Boolean(event.target.checked);
      const settings = getReadingSettings();
      const map = { ...((settings.perSiteOverrides || settings.siteProfiles || {})) };
      if (checked) map[host] = buildReadingSiteOverride(settings);
      else delete map[host];
      queuePatch({ readingTheme: { perSiteOverrides: map } });
      toast(checked ? `Reading override enabled for ${host}` : `Reading override removed for ${host}`);
    });

    refs.optReadingExcludeSite?.addEventListener("change", (event) => {
      const host = getCurrentHostOrToast();
      if (!host) {
        event.target.checked = false;
        return;
      }
      const checked = Boolean(event.target.checked);
      const settings = getReadingSettings();
      const map = {
        ...(Array.isArray(settings.excludedHosts)
          ? Object.fromEntries(settings.excludedHosts.map((row) => [normalizeHost(row), true]).filter(([rowHost]) => Boolean(rowHost)))
          : (settings.excludedSites || {}))
      };
      if (checked) map[host] = true;
      else delete map[host];
      queuePatch({ readingTheme: { excludedSites: map } });
      toast(checked ? `Reading excluded for ${host}` : `Reading exclusion removed for ${host}`);
    });

    refs.optAdaptiveThisSiteEnabled?.addEventListener("change", (event) => {
      const host = getCurrentHostOrToast();
      if (!host) {
        event.target.checked = false;
        return;
      }
      const checked = Boolean(event.target.checked);
      const settings = getAdaptiveSettings();
      const map = { ...((settings.perSiteOverrides || settings.siteProfiles || {})) };
      if (checked) map[host] = buildAdaptiveSiteOverride(settings);
      else delete map[host];
      queuePatch({ adaptiveSiteTheme: { perSiteOverrides: map } });
      toast(checked ? `Adaptive override enabled for ${host}` : `Adaptive override removed for ${host}`);
    });

    refs.optAdaptiveExcludeSite?.addEventListener("change", (event) => {
      const host = getCurrentHostOrToast();
      if (!host) {
        event.target.checked = false;
        return;
      }
      const checked = Boolean(event.target.checked);
      const settings = getAdaptiveSettings();
      const map = {
        ...(Array.isArray(settings.excludedHosts)
          ? Object.fromEntries(settings.excludedHosts.map((row) => [normalizeHost(row), true]).filter(([rowHost]) => Boolean(rowHost)))
          : (settings.excludedSites || {}))
      };
      if (checked) map[host] = true;
      else delete map[host];
      queuePatch({ adaptiveSiteTheme: { excludedSites: map } });
      toast(checked ? `Adaptive excluded for ${host}` : `Adaptive exclusion removed for ${host}`);
    });

    refs.resetProfileHost.addEventListener("click", async () => {
      const target = String(refs.optProfileSearch.value || state.activeHost || "").trim().toLowerCase();
      if (!target) {
        toast("Enter a host in profile search first.");
        return;
      }
      const next = { ...(state.app.settings.light.siteProfiles || {}) };
      if (!next[target]) {
        toast("Host profile not found.");
        return;
      }
      delete next[target];
      queuePatch({ light: { siteProfiles: next } });
      toast(`Removed profile for ${target}`);
    });
  }

  // Approximate sunrise/sunset (local-only, no network).
  function estimateSunTimes(date, lat, lon) {
    const rad = Math.PI / 180;
    const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 86400000);
    const lngHour = lon / 15;

    function calc(t, isSunrise) {
      const M = (0.9856 * t) - 3.289;
      let L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634;
      L = (L + 360) % 360;

      let RA = (Math.atan(0.91764 * Math.tan(L * rad)) / rad + 360) % 360;
      const Lquadrant = Math.floor(L / 90) * 90;
      const RAquadrant = Math.floor(RA / 90) * 90;
      RA = (RA + (Lquadrant - RAquadrant)) / 15;

      const sinDec = 0.39782 * Math.sin(L * rad);
      const cosDec = Math.cos(Math.asin(sinDec));
      const cosH = (Math.cos(90.833 * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));

      if (cosH > 1 || cosH < -1) return isSunrise ? "06:00" : "20:00";
      let H = isSunrise ? 360 - (Math.acos(cosH) / rad) : (Math.acos(cosH) / rad);
      H /= 15;

      const T = H + RA - (0.06571 * t) - 6.622;
      let UT = (T - lngHour + 24) % 24;
      const localOffset = -new Date().getTimezoneOffset() / 60;
      UT = (UT + localOffset + 24) % 24;

      const hours = Math.floor(UT);
      const mins = Math.floor((UT - hours) * 60);
      return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    }

    const tRise = day + ((6 - lngHour) / 24);
    const tSet = day + ((18 - lngHour) / 24);

    return {
      sunrise: calc(tRise, true),
      sunset: calc(tSet, false)
    };
  }

  async function boot() {
    bindEditingTracking();
    bindSettingsInputs();
    bindActions();
    await hydrate();
  }

  boot().catch((error) => {
    console.error("[Holmeta options] boot failed", error);
    setStatus("Options failed to initialize", true);
  });
})();
