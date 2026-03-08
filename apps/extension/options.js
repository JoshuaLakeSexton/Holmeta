// HOLMETA v3 options controller
// Input stability: hydrate once, local edit state, debounced storage writes.

(() => {
  const SAVE_DEBOUNCE_MS = 420;
  const UPGRADE_URL = "https://www.holmeta.com/pricing";

  const state = {
    app: null,
    editing: new Set(),
    pendingPatch: null,
    saveTimer: null,
    saveInFlight: false,
    diagnostics: null,
    activeHost: "",
    profileSearch: ""
  };

  const $ = (id) => document.getElementById(id);

  const refs = {
    premiumBadge: $("premiumBadge"),
    saveState: $("saveState"),
    toastHost: $("toastHost"),

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

    diagSummary: $("diagSummary"),
    diagRefresh: $("diagRefresh"),
    diagResetSite: $("diagResetSite"),

    optBlockerEnabled: $("optBlockerEnabled"),
    optNuclearMode: $("optNuclearMode"),
    optBlockerMode: $("optBlockerMode"),
    optBlockScheduleEnabled: $("optBlockScheduleEnabled"),
    optBlockStart: $("optBlockStart"),
    optBlockEnd: $("optBlockEnd"),
    optBlockedDomains: $("optBlockedDomains"),
    optAllowDomains: $("optAllowDomains"),

    optAlertsEnabled: $("optAlertsEnabled"),
    optAlertFrequency: $("optAlertFrequency"),
    optAlertSound: $("optAlertSound"),
    optAlertEye: $("optAlertEye"),
    optAlertPosture: $("optAlertPosture"),
    optAlertBurnout: $("optAlertBurnout"),

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

  function renderPremium() {
    const premium = Boolean(state.app.license.premium);
    refs.premiumBadge.textContent = premium ? "PREMIUM" : "FREE";
    refs.premiumBadge.classList.toggle("premium", premium);

    document.querySelectorAll("[data-premium='true']").forEach((el) => {
      el.disabled = !premium;
      el.setAttribute("aria-disabled", String(!premium));
      if (!premium) el.setAttribute("title", "Premium feature – upgrade at holmeta.com");
      else el.removeAttribute("title");
    });
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

  function render() {
    if (!state.app) return;
    const s = state.app.settings;

    renderPremium();

    setChecked("optLightEnabled", s.light.enabled);
    setValue("optLightMode", s.light.mode);
    setValue("optLightSpectrumPreset", s.light.spectrumPreset);
    setValue("optLightIntensity", s.light.intensity);
    setValue("optLightDim", s.light.dim);
    setValue("optLightBrightness", s.light.brightness);
    setValue("optLightContrastSoft", s.light.contrastSoft);
    setValue("optLightSaturation", s.light.saturation);
    setValue("optLightBlueCut", s.light.blueCut);
    setValue("optLightTintRed", s.light.tintRed);
    setValue("optLightTintGreen", s.light.tintGreen);
    setValue("optLightTintBlue", s.light.tintBlue);
    setChecked("optReduceWhites", s.light.reduceWhites);
    setChecked("optVideoSafe", s.light.videoSafe);
    setChecked("optSpotlightEnabled", s.light.spotlightEnabled);
    setChecked("optTherapyMode", s.light.therapyMode);
    setValue("optTherapyMinutes", s.light.therapyMinutes);
    setValue("optTherapyCadence", s.light.therapyCadence);
    setChecked("optLightScheduleEnabled", s.light.schedule.enabled);
    setChecked("optUseSunset", s.light.schedule.useSunset);
    setValue("optLightStart", s.light.schedule.start);
    setValue("optLightEnd", s.light.schedule.end);
    setValue("optRampMinutes", s.light.schedule.rampMinutes);
    setValue("optQuickSchedule", s.light.schedule.quickPreset || "custom");
    setValue("optLightExclusions", domainsToLines(s.light.excludedHosts));
    setValue("optSiteProfiles", JSON.stringify(s.light.siteProfiles || {}, null, 2));

    setChecked("optBlockerEnabled", s.blocker.enabled);
    setChecked("optNuclearMode", s.blocker.nuclear);
    setValue("optBlockerMode", s.blocker.activationMode);
    setChecked("optBlockScheduleEnabled", s.blocker.schedule.enabled);
    setValue("optBlockStart", s.blocker.schedule.start);
    setValue("optBlockEnd", s.blocker.schedule.end);
    setValue("optBlockedDomains", domainsToLines(s.blocker.blockedDomains));
    setValue("optAllowDomains", domainsToLines(s.blocker.allowDomains));

    setChecked("optAlertsEnabled", s.alerts.enabled);
    setValue("optAlertFrequency", s.alerts.frequencyMin);
    setChecked("optAlertSound", s.alerts.soundEnabled);
    setChecked("optAlertEye", s.alerts.types.eye);
    setChecked("optAlertPosture", s.alerts.types.posture);
    setChecked("optAlertBurnout", s.alerts.types.burnout);

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
    const response = await sendMessage({ type: "holmeta:get-state" });
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
    bindInput("optBlockedDomains", (el) => queuePatch({ blocker: { blockedDomains: linesToDomains(el.value) } }));
    bindInput("optAllowDomains", (el) => queuePatch({ blocker: { allowDomains: linesToDomains(el.value) } }));

    bindCheck("optAlertsEnabled", (el) => queuePatch({ alerts: { enabled: el.checked } }));
    bindSelect("optAlertFrequency", (el) => queuePatch({ alerts: { frequencyMin: Number(el.value || 45) } }));
    bindCheck("optAlertSound", (el) => queuePatch({ alerts: { soundEnabled: el.checked } }));
    bindCheck("optAlertEye", (el) => queuePatch({ alerts: { types: { eye: el.checked } } }));
    bindCheck("optAlertPosture", (el) => queuePatch({ alerts: { types: { posture: el.checked } } }));
    bindCheck("optAlertBurnout", (el) => queuePatch({ alerts: { types: { burnout: el.checked } } }));

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
      const next = { ...(state.app.settings.light.siteProfiles || {}) };
      delete next[host];
      const excludes = new Set(state.app.settings.light.excludedHosts || []);
      excludes.delete(host);
      queuePatch({ light: { siteProfiles: next, excludedHosts: [...excludes] } });
      toast(`Reset profile + exclusion for ${host}`);
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
