// HOLMETA v3.0 popup controller
// Stable input pattern: hydrate once, local state editing, debounced writes.

(() => {
  const SAVE_DEBOUNCE_MS = 380;
  const ONBOARDING_COMPLETED_KEY = "onboardingCompleted";
  const UPGRADE_URL = "https://www.holmeta.com/pricing";
  const WEBSITE_URL = "https://holmeta.com";
  const DASHBOARD_URL = "https://holmeta.com/dashboard";
  const FAVORITE_LIMIT = 20;
  const SCREEN_PRESETS = {
    desktop_hd: { width: 1366, height: 768, label: "Desktop HD" },
    desktop_fhd: { width: 1920, height: 1080, label: "Desktop FHD" },
    desktop_qhd: { width: 2560, height: 1440, label: "Desktop QHD" },
    laptop: { width: 1440, height: 900, label: "Laptop" },
    tablet_portrait: { width: 768, height: 1024, label: "Tablet Portrait" },
    tablet_landscape: { width: 1024, height: 768, label: "Tablet Landscape" },
    mobile_small: { width: 375, height: 667, label: "Mobile Small" },
    mobile_large: { width: 430, height: 932, label: "Mobile Large" }
  };

  const state = {
    hydrated: false,
    editing: new Set(),
    currentHost: "",
    app: null,
    pendingPatch: null,
    saveTimer: null,
    saveInFlight: false,
    onboardingStep: 0,
    diagnostics: null,
    alertTestType: "eye",
    eyeDraftHex: "#FFB300",
    favoriteDraftUrl: "",
    tunnelTimerHandle: null,
    screenshotRunning: false
  };

  const onboardingSteps = [
    {
      title: "MISSION: Reduce screen strain. Increase focus.",
      body: "Start with Warm Shift mode. Adjust intensity and keep reduce-whites enabled for comfort."
    },
    {
      title: "Per-site Profiles",
      body: "Use This Site override to tune docs, code, and video pages independently without global drift."
    },
    {
      title: "Health + Block Protocol",
      body: "Set gentle alerts and blocker mode only when needed to avoid friction fatigue."
    }
  ];

  const refs = {
    modeBadge: document.getElementById("modeBadge"),
    saveState: document.getElementById("saveState"),
    toastHost: document.getElementById("toastHost"),

    lightEnabled: document.getElementById("lightEnabled"),
    lightMode: document.getElementById("lightMode"),
    lightIntensity: document.getElementById("lightIntensity"),
    lightIntensityValue: document.getElementById("lightIntensityValue"),
    lightScheduleMode: document.getElementById("lightScheduleMode"),
    lightScheduleStart: document.getElementById("lightScheduleStart"),
    lightScheduleEnd: document.getElementById("lightScheduleEnd"),
    lightCustomScheduleRow: document.getElementById("lightCustomScheduleRow"),
    readingThemeEnabled: document.getElementById("readingThemeEnabled"),
    readingThemeDark: document.getElementById("readingThemeDark"),
    readingThemeLight: document.getElementById("readingThemeLight"),
    readingThemeAuto: document.getElementById("readingThemeAuto"),
    readingThemeScheduleMode: document.getElementById("readingThemeScheduleMode"),
    readingThemeScheduleStart: document.getElementById("readingThemeScheduleStart"),
    readingThemeScheduleEnd: document.getElementById("readingThemeScheduleEnd"),
    readingThemeAutoRow: document.getElementById("readingThemeAutoRow"),
    readingThemeCustomScheduleRow: document.getElementById("readingThemeCustomScheduleRow"),
    readingThemeThisSiteEnabled: document.getElementById("readingThemeThisSiteEnabled"),
    readingThemeExcludeSite: document.getElementById("readingThemeExcludeSite"),
    readingThemeStatus: document.getElementById("readingThemeStatus"),

    adaptiveThemeEnabled: document.getElementById("adaptiveThemeEnabled"),
    adaptiveThemeMode: document.getElementById("adaptiveThemeMode"),
    adaptiveThemePreset: document.getElementById("adaptiveThemePreset"),
    adaptiveThemeIntensity: document.getElementById("adaptiveThemeIntensity"),
    adaptiveThemeIntensityValue: document.getElementById("adaptiveThemeIntensityValue"),
    adaptiveThemeStrategy: document.getElementById("adaptiveThemeStrategy"),
    adaptiveThemeCompatibility: document.getElementById("adaptiveThemeCompatibility"),
    adaptiveThemeThisSiteEnabled: document.getElementById("adaptiveThemeThisSiteEnabled"),
    adaptiveThemeExcludeSite: document.getElementById("adaptiveThemeExcludeSite"),
    adaptiveThemeStatus: document.getElementById("adaptiveThemeStatus"),

    lightThisSiteEnabled: document.getElementById("lightThisSiteEnabled"),
    lightExcludeSite: document.getElementById("lightExcludeSite"),
    lightApplyAll: document.getElementById("lightApplyAll"),
    saveSiteProfile: document.getElementById("saveSiteProfile"),
    copyGlobalToSite: document.getElementById("copyGlobalToSite"),
    resetSiteOverrides: document.getElementById("resetSiteOverrides"),
    siteInfo: document.getElementById("siteInfo"),

    reduceWhites: document.getElementById("reduceWhites"),
    videoSafe: document.getElementById("videoSafe"),
    lightSpectrumPreset: document.getElementById("lightSpectrumPreset"),
    lightBlueCut: document.getElementById("lightBlueCut"),
    lightBlueCutValue: document.getElementById("lightBlueCutValue"),
    lightSaturation: document.getElementById("lightSaturation"),
    lightSaturationValue: document.getElementById("lightSaturationValue"),
    lightTintRed: document.getElementById("lightTintRed"),
    lightTintGreen: document.getElementById("lightTintGreen"),
    lightTintBlue: document.getElementById("lightTintBlue"),
    lightTintValue: document.getElementById("lightTintValue"),
    lightBrightness: document.getElementById("lightBrightness"),
    lightBrightnessValue: document.getElementById("lightBrightnessValue"),
    lightDim: document.getElementById("lightDim"),
    lightDimValue: document.getElementById("lightDimValue"),
    lightContrastSoft: document.getElementById("lightContrastSoft"),
    lightContrastSoftValue: document.getElementById("lightContrastSoftValue"),
    spotlightEnabled: document.getElementById("spotlightEnabled"),
    setSpotlightCenter: document.getElementById("setSpotlightCenter"),

    therapyMode: document.getElementById("therapyMode"),
    therapyMinutes: document.getElementById("therapyMinutes"),
    therapyCadence: document.getElementById("therapyCadence"),

    screenEmulatorActive: document.getElementById("screenEmulatorActive"),
    screenPreset: document.getElementById("screenPreset"),
    screenWidth: document.getElementById("screenWidth"),
    screenHeight: document.getElementById("screenHeight"),
    screenApply: document.getElementById("screenApply"),
    screenReset: document.getElementById("screenReset"),
    screenStatus: document.getElementById("screenStatus"),

    eyePickFromPage: document.getElementById("eyePickFromPage"),
    eyeHexInput: document.getElementById("eyeHexInput"),
    eyeLiveSwatch: document.getElementById("eyeLiveSwatch"),
    eyeLiveHex: document.getElementById("eyeLiveHex"),
    eyeCopyHex: document.getElementById("eyeCopyHex"),
    eyePasteHex: document.getElementById("eyePasteHex"),
    eyeAddSwatch: document.getElementById("eyeAddSwatch"),
    eyeClearSwatches: document.getElementById("eyeClearSwatches"),
    eyeSwatchesGrid: document.getElementById("eyeSwatchesGrid"),
    eyeDropperStatus: document.getElementById("eyeDropperStatus"),

    screenshotEnabled: document.getElementById("screenshotEnabled"),
    screenshotStart: document.getElementById("screenshotStart"),
    screenshotStop: document.getElementById("screenshotStop"),
    screenshotStatus: document.getElementById("screenshotStatus"),
    screenshotPadding: document.getElementById("screenshotPadding"),
    screenshotTargetMode: document.getElementById("screenshotTargetMode"),
    screenshotAspectRatio: document.getElementById("screenshotAspectRatio"),
    screenshotCustomAspectWidth: document.getElementById("screenshotCustomAspectWidth"),
    screenshotCustomAspectHeight: document.getElementById("screenshotCustomAspectHeight"),
    screenshotMinWidth: document.getElementById("screenshotMinWidth"),
    screenshotMinHeight: document.getElementById("screenshotMinHeight"),
    screenshotOutputScale: document.getElementById("screenshotOutputScale"),
    screenshotBackgroundMode: document.getElementById("screenshotBackgroundMode"),
    screenshotShowTooltip: document.getElementById("screenshotShowTooltip"),
    screenshotAutoCopy: document.getElementById("screenshotAutoCopy"),
    screenshotPreviewRounded: document.getElementById("screenshotPreviewRounded"),

    favoriteAddCurrent: document.getElementById("favoriteAddCurrent"),
    favoriteUrlInput: document.getElementById("favoriteUrlInput"),
    favoriteAddUrl: document.getElementById("favoriteAddUrl"),
    favoritesGrid: document.getElementById("favoritesGrid"),
    favoritesStatus: document.getElementById("favoritesStatus"),

    blockerEnabled: document.getElementById("blockerEnabled"),
    nuclearMode: document.getElementById("nuclearMode"),
    blockerStatus: document.getElementById("blockerStatus"),
    blockerStats: document.getElementById("blockerStats"),
    blockerHostStatus: document.getElementById("blockerHostStatus"),
    quickBlockSocial: document.getElementById("quickBlockSocial"),
    quickBlockShopping: document.getElementById("quickBlockShopping"),
    quickBlockEntertainment: document.getElementById("quickBlockEntertainment"),
    quickBlockAdult: document.getElementById("quickBlockAdult"),
    addCurrentSite: document.getElementById("addCurrentSite"),
    removeCurrentSite: document.getElementById("removeCurrentSite"),
    toggleWhitelistSite: document.getElementById("toggleWhitelistSite"),
    blockCatAds: document.getElementById("blockCatAds"),
    blockCatTrackers: document.getElementById("blockCatTrackers"),
    blockCatMalware: document.getElementById("blockCatMalware"),
    blockCatAnnoyances: document.getElementById("blockCatAnnoyances"),
    blockCatVideoAds: document.getElementById("blockCatVideoAds"),
    blockCosmeticEnabled: document.getElementById("blockCosmeticEnabled"),
    blockAntiDetect: document.getElementById("blockAntiDetect"),
    blockElementPicker: document.getElementById("blockElementPicker"),
    toggleCosmeticSite: document.getElementById("toggleCosmeticSite"),
    refreshBlockLists: document.getElementById("refreshBlockLists"),
    editBlocker: document.getElementById("editBlocker"),
    pauseBlocker: document.getElementById("pauseBlocker"),

    secureTunnelEnabled: document.getElementById("secureTunnelEnabled"),
    secureTunnelMode: document.getElementById("secureTunnelMode"),
    secureTunnelPreset: document.getElementById("secureTunnelPreset"),
    secureTunnelStatus: document.getElementById("secureTunnelStatus"),
    secureTunnelTimer: document.getElementById("secureTunnelTimer"),
    secureTunnelCustomWrap: document.getElementById("secureTunnelCustomWrap"),
    secureTunnelCustomScheme: document.getElementById("secureTunnelCustomScheme"),
    secureTunnelCustomHost: document.getElementById("secureTunnelCustomHost"),
    secureTunnelCustomPort: document.getElementById("secureTunnelCustomPort"),
    secureTunnelCustomUser: document.getElementById("secureTunnelCustomUser"),
    secureTunnelCustomPass: document.getElementById("secureTunnelCustomPass"),
    secureTunnelSaveConnect: document.getElementById("secureTunnelSaveConnect"),
    secureTunnelDisconnect: document.getElementById("secureTunnelDisconnect"),

    alertsEnabled: document.getElementById("alertsEnabled"),
    alertFrequency: document.getElementById("alertFrequency"),
    alertCadence: document.getElementById("alertCadence"),
    alertTestType: document.getElementById("alertTestType"),
    alertTypeEye: document.getElementById("alertTypeEye"),
    alertTypePosture: document.getElementById("alertTypePosture"),
    alertTypeBurnout: document.getElementById("alertTypeBurnout"),
    alertTypeHydration: document.getElementById("alertTypeHydration"),
    alertTypeBlink: document.getElementById("alertTypeBlink"),
    alertTypeMovement: document.getElementById("alertTypeMovement"),
    alertSound: document.getElementById("alertSound"),
    alertSoundVolume: document.getElementById("alertSoundVolume"),
    alertSoundVolumeValue: document.getElementById("alertSoundVolumeValue"),
    alertSoundPattern: document.getElementById("alertSoundPattern"),
    alertToastEnabled: document.getElementById("alertToastEnabled"),
    alertNotificationEnabled: document.getElementById("alertNotificationEnabled"),
    alertQuietHoursEnabled: document.getElementById("alertQuietHoursEnabled"),
    alertQuietStart: document.getElementById("alertQuietStart"),
    alertQuietEnd: document.getElementById("alertQuietEnd"),
    alertSnoozeMinutes: document.getElementById("alertSnoozeMinutes"),
    alertCooldown: document.getElementById("alertCooldown"),
    alertBurnoutThreshold: document.getElementById("alertBurnoutThreshold"),
    testAlert: document.getElementById("testAlert"),
    snoozeAlertsNow: document.getElementById("snoozeAlertsNow"),
    alertStatus: document.getElementById("alertStatus"),
    alertChannelSound: document.getElementById("alertChannelSound"),
    alertChannelToast: document.getElementById("alertChannelToast"),
    alertChannelNotification: document.getElementById("alertChannelNotification"),

    siteInsightEnabled: document.getElementById("siteInsightEnabled"),
    siteInsightProfile: document.getElementById("siteInsightProfile"),
    siteInsightDuration: document.getElementById("siteInsightDuration"),
    siteInsightAutoMinimize: document.getElementById("siteInsightAutoMinimize"),
    siteInsightPill: document.getElementById("siteInsightPill"),
    siteInsightDisableSite: document.getElementById("siteInsightDisableSite"),
    siteInsightOpenSettings: document.getElementById("siteInsightOpenSettings"),
    siteInsightStatus: document.getElementById("siteInsightStatus"),

    pomodoroPreset: document.getElementById("pomodoroPreset"),
    startDeepWork: document.getElementById("startDeepWork"),
    stopDeepWork: document.getElementById("stopDeepWork"),
    deepWorkStatus: document.getElementById("deepWorkStatus"),

    biofeedbackEnabled: document.getElementById("biofeedbackEnabled"),
    morphingEnabled: document.getElementById("morphingEnabled"),
    taskWeaver: document.getElementById("taskWeaver"),
    collabSync: document.getElementById("collabSync"),
    weaverResults: document.getElementById("weaverResults"),
    premiumBanner: document.getElementById("premiumBanner"),
    upgradePremium: document.getElementById("upgradePremium"),

    openWebsite: document.getElementById("openWebsite"),
    openDashboard: document.getElementById("openDashboard"),
    openOptions: document.getElementById("openOptions"),

    onboarding: document.getElementById("onboarding"),
    onboardBack: document.getElementById("onboardBack"),
    onboardNext: document.getElementById("onboardNext"),
    onboardSkip: document.getElementById("onboardSkip"),
    onboardingTitle: document.getElementById("onboardingTitle"),
    onboardingBody: document.getElementById("onboardingBody")
  };

  function debugEnabled() {
    return Boolean(state.app?.meta?.debug);
  }

  function log(level, ...args) {
    if (level !== "error" && !debugEnabled()) return;
    const prefix = "[Holmeta popup]";
    if (level === "error") console.error(prefix, ...args);
    else console.info(prefix, ...args);
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

  function queryCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(Array.isArray(tabs) ? tabs[0] : null);
      });
    });
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

  function normalizeFavoriteUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (!/^https?:$/.test(url.protocol)) return "";
      return `${url.protocol}//${url.host}${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
    } catch {
      return "";
    }
  }

  function favoriteLabelFromHost(host) {
    const token = String(host || "")
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/[-_]/g, " ")
      .trim();
    if (!token) return "Site";
    return token
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
      .slice(0, 16);
  }

  function normalizeHexColor(value, fallback = "") {
    const raw = String(value || "").trim().toUpperCase();
    const short = raw.match(/^#([0-9A-F]{3})$/);
    if (short) {
      const [r, g, b] = short[1].split("");
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    if (/^#[0-9A-F]{6}$/.test(raw)) return raw;
    return fallback;
  }

  async function copyToClipboard(text) {
    const value = String(text || "");
    if (!value) return false;

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      try {
        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "true");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand("copy");
        input.remove();
        return Boolean(ok);
      } catch {
        return false;
      }
    }
  }

  function setStatus(text, error = false) {
    refs.saveState.textContent = text;
    refs.saveState.style.color = error ? "#ffb300" : "#d9c5b2";
  }

  async function readOnboardingCompletion() {
    let chromeValue = false;
    try {
      const data = await chrome.storage.local.get([ONBOARDING_COMPLETED_KEY]);
      chromeValue = Boolean(data?.[ONBOARDING_COMPLETED_KEY]);
    } catch (error) {
      log("error", "read_onboarding_chrome_failed", error);
    }

    let localValue = false;
    try {
      localValue = localStorage.getItem("holmeta_onboarding_completed") === "true";
    } catch (error) {
      log("error", "read_onboarding_local_failed", error);
    }

    return chromeValue || localValue;
  }

  function toast(text) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    refs.toastHost.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    const output = Array.isArray(target) ? [...target] : { ...(target || {}) };
    Object.keys(source).forEach((key) => {
      const src = source[key];
      if (Array.isArray(src)) output[key] = [...src];
      else if (src && typeof src === "object") output[key] = deepMerge(output[key], src);
      else output[key] = src;
    });
    return output;
  }

  function setInputValue(el, value) {
    if (!el) return;
    if (document.activeElement === el || state.editing.has(el.id)) return;
    const next = String(value ?? "");
    if (el.value !== next) el.value = next;
  }

  function setChecked(el, value) {
    if (!el) return;
    if (document.activeElement === el || state.editing.has(el.id)) return;
    el.checked = Boolean(value);
  }

  function getLightFilterState() {
    return state.app?.settings?.lightFilter || state.app?.settings?.light || {};
  }

  function getReadingThemeState() {
    return state.app?.settings?.darkLightTheme || state.app?.settings?.readingTheme || {};
  }

  function getAdaptiveThemeState() {
    return state.app?.settings?.adaptiveSiteTheme || {};
  }

  function getLightSiteProfile() {
    const light = getLightFilterState();
    const map = light.perSiteOverrides || light.siteProfiles || {};
    return state.currentHost ? map[state.currentHost] : null;
  }

  function getReadingSiteProfile() {
    const reading = getReadingThemeState();
    const map = reading.perSiteOverrides || reading.siteProfiles || {};
    return state.currentHost ? map[state.currentHost] : null;
  }

  function getAdaptiveSiteProfile() {
    const adaptive = getAdaptiveThemeState();
    const map = adaptive.perSiteOverrides || adaptive.siteProfiles || {};
    return state.currentHost ? map[state.currentHost] : null;
  }

  function isFilterSiteExcluded() {
    const light = getLightFilterState();
    const map = light.excludedSites || {};
    return Boolean(state.currentHost && map[state.currentHost]);
  }

  function isReadingSiteExcluded() {
    const reading = getReadingThemeState();
    const map = reading.excludedSites || {};
    return Boolean(state.currentHost && map[state.currentHost]);
  }

  function isAdaptiveSiteExcluded() {
    const adaptive = getAdaptiveThemeState();
    const map = adaptive.excludedSites || {};
    return Boolean(state.currentHost && map[state.currentHost]);
  }

  function renderPremium() {
    const premium = Boolean(state.app?.license?.premium);
    refs.modeBadge.textContent = premium ? "PREMIUM" : "FREE";
    refs.modeBadge.classList.toggle("premium", premium);

    document.querySelectorAll("[data-premium='true']").forEach((node) => {
      node.disabled = !premium;
      node.setAttribute("aria-disabled", String(!premium));
    });

    refs.premiumBanner.hidden = premium;
  }

  function renderReadingTheme() {
    const reading = getReadingThemeState();
    const siteProfile = getReadingSiteProfile();
    const rawAppearance = String(siteProfile?.appearance || reading.appearance || siteProfile?.mode || reading.mode || "dark");
    const appearance = ["light", "dark", "auto"].includes(rawAppearance) ? rawAppearance : "dark";
    const scheduleMode = String(siteProfile?.scheduleMode || reading.scheduleMode || ((siteProfile?.schedule?.useSunset || reading.schedule?.useSunset) ? "sunset" : "custom"));
    const scheduleStart = String(siteProfile?.schedule?.start || reading.schedule?.start || "20:00");
    const scheduleEnd = String(siteProfile?.schedule?.end || reading.schedule?.end || "06:00");
    const effective = {
      enabled: Boolean(reading.enabled),
      appearance,
      scheduleMode: scheduleMode === "sunset" ? "sunset" : "custom",
      scheduleStart,
      scheduleEnd
    };

    setChecked(refs.readingThemeEnabled, effective.enabled);
    refs.readingThemeLight.classList.toggle("is-active", effective.appearance === "light");
    refs.readingThemeDark.classList.toggle("is-active", effective.appearance === "dark");
    refs.readingThemeAuto.classList.toggle("is-active", effective.appearance === "auto");
    setInputValue(refs.readingThemeScheduleMode, effective.scheduleMode);
    setInputValue(refs.readingThemeScheduleStart, effective.scheduleStart);
    setInputValue(refs.readingThemeScheduleEnd, effective.scheduleEnd);
    refs.readingThemeAutoRow.hidden = effective.appearance !== "auto";
    refs.readingThemeCustomScheduleRow.hidden = effective.appearance !== "auto" || effective.scheduleMode !== "custom";
    refs.readingThemeScheduleStart.disabled = effective.appearance !== "auto" || effective.scheduleMode !== "custom";
    refs.readingThemeScheduleEnd.disabled = effective.appearance !== "auto" || effective.scheduleMode !== "custom";
    setChecked(refs.readingThemeThisSiteEnabled, Boolean(siteProfile));
    setChecked(refs.readingThemeExcludeSite, isReadingSiteExcluded());

    refs.readingThemeStatus.textContent = effective.enabled
      ? (
        effective.appearance === "auto"
          ? `Active: Auto · ${effective.scheduleMode === "sunset" ? "Sunset to Sunrise" : `${effective.scheduleStart} → ${effective.scheduleEnd}`}`
          : `Active: ${effective.appearance === "dark" ? "Dark" : "Light"}`
      )
      : "Appearance is off. Toggle On to apply Light / Dark / Auto.";
  }

  function renderLight() {
    const light = getLightFilterState();
    const siteProfile = getLightSiteProfile();

    const effective = {
      mode: siteProfile?.mode ?? light.mode,
      spectrumPreset: siteProfile?.spectrumPreset ?? light.spectrumPreset,
      intensity: siteProfile?.intensity ?? light.intensity,
      dim: siteProfile?.dim ?? light.dim,
      contrastSoft: siteProfile?.contrastSoft ?? light.contrastSoft,
      brightness: siteProfile?.brightness ?? light.brightness,
      saturation: siteProfile?.saturation ?? light.saturation,
      blueCut: siteProfile?.blueCut ?? light.blueCut,
      tintRed: siteProfile?.tintRed ?? light.tintRed,
      tintGreen: siteProfile?.tintGreen ?? light.tintGreen,
      tintBlue: siteProfile?.tintBlue ?? light.tintBlue,
      reduceWhites: siteProfile?.reduceWhites ?? light.reduceWhites,
      videoSafe: siteProfile?.videoSafe ?? light.videoSafe,
      spotlightEnabled: siteProfile?.spotlightEnabled ?? light.spotlightEnabled,
      therapyMode: siteProfile?.therapyMode ?? light.therapyMode,
      therapyDuration: siteProfile?.therapyDuration ?? siteProfile?.therapyMinutes ?? light.therapyDuration ?? light.therapyMinutes ?? 3,
      therapyCadence: siteProfile?.therapyCadence ?? light.therapyCadence
    };

    setChecked(refs.lightEnabled, Boolean(light.enabled));
    setInputValue(refs.lightMode, effective.mode);
    setInputValue(refs.lightIntensity, effective.intensity);
    refs.lightIntensityValue.textContent = `${effective.intensity}%`;
    const scheduleMode = !light.schedule?.enabled
      ? "off"
      : (light.schedule?.useSunset ? "sunset" : "custom");
    setInputValue(refs.lightScheduleMode, scheduleMode);
    setInputValue(refs.lightScheduleStart, light.schedule?.start || "20:00");
    setInputValue(refs.lightScheduleEnd, light.schedule?.end || "06:00");
    refs.lightCustomScheduleRow.hidden = scheduleMode !== "custom";
    refs.lightScheduleStart.disabled = scheduleMode !== "custom";
    refs.lightScheduleEnd.disabled = scheduleMode !== "custom";

    setChecked(refs.lightThisSiteEnabled, Boolean(siteProfile));
    setChecked(refs.lightExcludeSite, isFilterSiteExcluded());

    setChecked(refs.reduceWhites, effective.reduceWhites);
    setChecked(refs.videoSafe, effective.videoSafe);
    setInputValue(refs.lightSpectrumPreset, effective.spectrumPreset);
    setInputValue(refs.lightBlueCut, effective.blueCut);
    refs.lightBlueCutValue.textContent = `${effective.blueCut}%`;
    setInputValue(refs.lightSaturation, effective.saturation);
    refs.lightSaturationValue.textContent = `${effective.saturation}%`;
    setInputValue(refs.lightTintRed, effective.tintRed);
    setInputValue(refs.lightTintGreen, effective.tintGreen);
    setInputValue(refs.lightTintBlue, effective.tintBlue);
    refs.lightTintValue.textContent = `${effective.tintRed} / ${effective.tintGreen} / ${effective.tintBlue}`;
    setInputValue(refs.lightBrightness, effective.brightness);
    refs.lightBrightnessValue.textContent = `${effective.brightness}%`;
    setInputValue(refs.lightDim, effective.dim);
    refs.lightDimValue.textContent = `${effective.dim}%`;
    setInputValue(refs.lightContrastSoft, effective.contrastSoft);
    refs.lightContrastSoftValue.textContent = `${effective.contrastSoft}%`;
    setChecked(refs.spotlightEnabled, effective.spotlightEnabled);

    setChecked(refs.therapyMode, effective.therapyMode);
    setInputValue(refs.therapyMinutes, effective.therapyDuration);
    setInputValue(refs.therapyCadence, effective.therapyCadence);

    let info = state.currentHost ? `Site: ${state.currentHost}` : "Site: unavailable";
    if (state.diagnostics?.strategy) {
      info += ` · Strategy: ${state.diagnostics.strategy}`;
    }
    if (state.diagnostics?.siteType) {
      info += ` · Type: ${state.diagnostics.siteType}`;
    }
    if (state.diagnostics?.activeSystems) {
      const active = Object.entries(state.diagnostics.activeSystems)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key);
      if (active.length) {
        info += ` · Active: ${active.join(", ")}`;
      }
    }
    refs.siteInfo.textContent = info;
  }

  function renderAdaptiveTheme() {
    const adaptive = getAdaptiveThemeState();
    const siteProfile = getAdaptiveSiteProfile();
    const effective = {
      enabled: Boolean(adaptive.enabled),
      mode: siteProfile?.mode ?? adaptive.mode ?? "smart_dark",
      preset: siteProfile?.preset ?? adaptive.preset ?? "balanced",
      strategy: siteProfile?.strategy ?? adaptive.strategy ?? "auto",
      compatibilityMode: siteProfile?.compatibilityMode ?? adaptive.compatibilityMode ?? "normal",
      intensity: siteProfile?.intensity ?? adaptive.intensity ?? 52
    };

    setChecked(refs.adaptiveThemeEnabled, effective.enabled);
    setInputValue(refs.adaptiveThemeMode, effective.mode);
    setInputValue(refs.adaptiveThemePreset, effective.preset);
    setInputValue(refs.adaptiveThemeStrategy, effective.strategy);
    setInputValue(refs.adaptiveThemeCompatibility, effective.compatibilityMode);
    setInputValue(refs.adaptiveThemeIntensity, effective.intensity);
    refs.adaptiveThemeIntensityValue.textContent = `${effective.intensity}%`;
    setChecked(refs.adaptiveThemeThisSiteEnabled, Boolean(siteProfile));
    setChecked(refs.adaptiveThemeExcludeSite, isAdaptiveSiteExcluded());

    const strategyLabel = String(effective.strategy || "auto").replaceAll("_", " ");
    const compatLabel = String(effective.compatibilityMode || "normal");
    refs.adaptiveThemeStatus.textContent = effective.enabled
      ? `Active: ${effective.mode.replaceAll("_", " ")} · ${strategyLabel} · ${compatLabel}`
      : "Adaptive Site Theme is off. Toggle On for smart site transformation.";
  }

  function renderEyeDropper() {
    const tool = state.app.settings.eyeDropper || { recentHex: "#FFB300", swatches: [] };
    const swatches = Array.isArray(tool.swatches) ? tool.swatches : [];

    if (!state.editing.has(refs.eyeHexInput.id) && document.activeElement !== refs.eyeHexInput) {
      state.eyeDraftHex = normalizeHexColor(state.eyeDraftHex, tool.recentHex || "#FFB300");
      setInputValue(refs.eyeHexInput, state.eyeDraftHex || tool.recentHex || "#FFB300");
    }

    const liveHex = normalizeHexColor(state.eyeDraftHex || tool.recentHex, "#FFB300");
    if (refs.eyeLiveSwatch) refs.eyeLiveSwatch.style.background = liveHex;
    if (refs.eyeLiveHex) refs.eyeLiveHex.textContent = liveHex;

    refs.eyeSwatchesGrid.innerHTML = "";
    swatches.forEach((hex, index) => {
      const item = document.createElement("div");
      item.className = "swatch-item";
      item.setAttribute("role", "listitem");
      item.innerHTML = `
        <button class="swatch-color" type="button" data-hex="${hex}" data-index="${index}" aria-label="Copy ${hex}">
          <span class="swatch-chip" style="background:${hex}"></span>
          <span class="swatch-label">${hex}</span>
        </button>
        <button class="swatch-remove" type="button" data-remove="${index}" aria-label="Remove ${hex}">×</button>
      `;
      refs.eyeSwatchesGrid.appendChild(item);
    });

    if (!swatches.length) {
      const empty = document.createElement("div");
      empty.className = "swatch-empty";
      empty.textContent = "No swatches saved yet.";
      refs.eyeSwatchesGrid.appendChild(empty);
    }

    refs.eyeDropperStatus.textContent = `Saved swatches: ${swatches.length} / 12`;
  }

  function getScreenshotSettings() {
    return state.app?.settings?.screenshotTool || {
      enabled: true,
      padding: 8,
      targetMode: "smart",
      aspectRatio: "none",
      customAspectWidth: 16,
      customAspectHeight: 9,
      minTargetWidth: 40,
      minTargetHeight: 24,
      outputScale: 1,
      backgroundMode: "original",
      showTooltip: true,
      autoCopy: false,
      previewRounded: false
    };
  }

  function renderScreenshotTool() {
    const shot = getScreenshotSettings();
    const runtime = state.app?.runtime?.screenshotTool || {};
    const running = Boolean(state.screenshotRunning || Number(runtime.activeTabId || 0) > 0);
    state.screenshotRunning = running;

    setChecked(refs.screenshotEnabled, shot.enabled);
    setInputValue(refs.screenshotPadding, String(shot.padding ?? 8));
    setInputValue(refs.screenshotTargetMode, shot.targetMode || "smart");
    setInputValue(refs.screenshotAspectRatio, shot.aspectRatio || "none");
    setInputValue(refs.screenshotCustomAspectWidth, String(shot.customAspectWidth ?? 16));
    setInputValue(refs.screenshotCustomAspectHeight, String(shot.customAspectHeight ?? 9));
    setInputValue(refs.screenshotMinWidth, String(shot.minTargetWidth ?? 40));
    setInputValue(refs.screenshotMinHeight, String(shot.minTargetHeight ?? 24));
    setInputValue(refs.screenshotOutputScale, String(shot.outputScale ?? 1));
    setInputValue(refs.screenshotBackgroundMode, shot.backgroundMode || "original");
    setChecked(refs.screenshotShowTooltip, shot.showTooltip !== false);
    setChecked(refs.screenshotAutoCopy, Boolean(shot.autoCopy));
    setChecked(refs.screenshotPreviewRounded, Boolean(shot.previewRounded));

    const customAspect = String(shot.aspectRatio || "none") === "custom";
    refs.screenshotCustomAspectWidth.disabled = !customAspect;
    refs.screenshotCustomAspectHeight.disabled = !customAspect;

    refs.screenshotStart.disabled = !shot.enabled;
    refs.screenshotStop.disabled = !running;

    if (!shot.enabled) {
      refs.screenshotStatus.textContent = "Disabled. Turn on Screenshot Tool to capture elements.";
      return;
    }
    if (running) {
      refs.screenshotStatus.textContent = "Capture mode active. Hover target element, click once to capture.";
      return;
    }
    const lastError = String(runtime.lastError || "");
    if (lastError) {
      if (["restricted_page", "content_script_unavailable", "no_active_tab", "no_active_web_tab"].includes(lastError)) {
        refs.screenshotStatus.textContent = "Last error: Screenshot unavailable on this page.";
      } else {
        refs.screenshotStatus.textContent = `Last error: ${lastError}`;
      }
      return;
    }
    refs.screenshotStatus.textContent = "Ready. Start capture, hover an element, click once to crop.";
  }

  function getFavoritesState() {
    return state.app?.settings?.favorites || { links: [] };
  }

  function queueFavoritesPatch(partial) {
    const current = getFavoritesState();
    queuePatch({ favorites: deepMerge(current, partial) });
  }

  function renderFavorites() {
    const favorites = getFavoritesState();
    const links = Array.isArray(favorites.links) ? favorites.links : [];

    if (!state.editing.has(refs.favoriteUrlInput.id) && document.activeElement !== refs.favoriteUrlInput) {
      setInputValue(refs.favoriteUrlInput, state.favoriteDraftUrl || "");
    }

    refs.favoritesGrid.innerHTML = "";
    links.forEach((entry, index) => {
      const url = String(entry.url || "");
      const host = normalizeHost(url);
      if (!host) return;
      const title = String(entry.title || favoriteLabelFromHost(host)).slice(0, 32);
      const faviconUrl = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`;
      const fallback = favoriteLabelFromHost(host).charAt(0).toUpperCase() || "H";

      const item = document.createElement("div");
      item.className = "favorite-item";
      item.setAttribute("role", "listitem");
      item.innerHTML = `
        <button class="favorite-btn" type="button" data-favorite-open="${index}" title="${host}">
          <img class="fav-icon" src="${faviconUrl}" alt="" loading="lazy" />
          <span class="fav-fallback" hidden>${fallback}</span>
          <span class="fav-label">${title}</span>
        </button>
        <button class="favorite-remove" type="button" data-favorite-remove="${index}" aria-label="Remove ${host}" title="Remove">×</button>
      `;
      const icon = item.querySelector(".fav-icon");
      const fallbackNode = item.querySelector(".fav-fallback");
      icon?.addEventListener("error", () => {
        if (icon) icon.hidden = true;
        if (fallbackNode) fallbackNode.hidden = false;
      });
      refs.favoritesGrid.appendChild(item);
    });

    if (!links.length) {
      const empty = document.createElement("div");
      empty.className = "favorite-empty";
      empty.textContent = "No favorites saved yet.";
      refs.favoritesGrid.appendChild(empty);
    }

    refs.favoritesStatus.textContent = `Saved: ${links.length} / ${FAVORITE_LIMIT}`;
    const atLimit = links.length >= FAVORITE_LIMIT;
    refs.favoriteAddCurrent.disabled = atLimit;
    refs.favoriteAddUrl.disabled = atLimit;
  }

  function getScreenSettings() {
    const defaults = SCREEN_PRESETS.desktop_hd;
    const cfg = state.app?.settings?.screenEmulator || {};
    const preset = Object.prototype.hasOwnProperty.call(SCREEN_PRESETS, cfg.preset)
      ? cfg.preset
      : "desktop_hd";
    return {
      preset,
      width: Math.max(320, Math.min(5120, Number(cfg.width || defaults.width))),
      height: Math.max(320, Math.min(2880, Number(cfg.height || defaults.height))),
      active: Boolean(cfg.active),
      lastAppliedAt: Number(cfg.lastAppliedAt || 0)
    };
  }

  function renderScreenEmulator() {
    const screen = getScreenSettings();
    setInputValue(refs.screenPreset, screen.preset);
    setInputValue(refs.screenWidth, String(screen.width));
    setInputValue(refs.screenHeight, String(screen.height));
    setChecked(refs.screenEmulatorActive, screen.active);

    const activeRuntime = Boolean(state.app?.runtime?.windowResizeActive);
    const activeState = activeRuntime || screen.active;
    const presetName = SCREEN_PRESETS[screen.preset]?.label || "Custom";
    refs.screenStatus.textContent = activeState
      ? `Active: ${screen.width}×${screen.height} (${presetName})`
      : `Ready: ${screen.width}×${screen.height} (${presetName})`;
    refs.screenReset.disabled = !activeRuntime;
  }

  function renderBlocker() {
    const blocker = state.app.settings.blocker;
    const categories = blocker.categories || {};
    const quickCategories = blocker.quickCategories || {};
    const today = new Date().toISOString().slice(0, 10);
    const dayStats = state.app.stats?.daily?.[today] || {};
    const blockedToday = Math.max(0, Number(dayStats.adBlockEvents || dayStats.blocks || 0));
    const blockedTotal = Math.max(0, Number(state.app.stats?.adBlockEventsTotal || state.app.stats?.blockEvents || 0));
    const hostBlocked = Boolean(state.currentHost && (blocker.blockedDomains || []).includes(state.currentHost));
    const hostWhitelisted = Boolean(state.currentHost && (blocker.allowDomains || []).includes(state.currentHost));
    const cosmeticDisabledHost = Boolean(state.currentHost && blocker.disableCosmeticOnSite?.[state.currentHost]);

    setChecked(refs.blockerEnabled, blocker.enabled);
    setChecked(refs.nuclearMode, blocker.nuclear);
    setChecked(refs.blockCatAds, categories.ads);
    setChecked(refs.blockCatTrackers, categories.trackers);
    setChecked(refs.blockCatMalware, categories.malware);
    setChecked(refs.blockCatAnnoyances, categories.annoyances);
    setChecked(refs.blockCatVideoAds, categories.videoAds);
    setChecked(refs.blockCosmeticEnabled, blocker.cosmeticFiltering);
    setChecked(refs.blockAntiDetect, blocker.antiDetection);
    const quickEnabledCount = Object.values(quickCategories).filter(Boolean).length;
    refs.blockerStatus.textContent = `Active: ${(blocker.blockedDomains || []).length} sites blocked${quickEnabledCount ? ` · ${quickEnabledCount} quick category blocks` : ""}`;
    refs.blockerStats.textContent = `Blocked today: ${blockedToday} · Since install: ${blockedTotal}${state.app.runtime?.blockerRuleLimitHit ? " · Rule cap reached" : ""}`;
    if (!state.currentHost) {
      refs.blockerHostStatus.textContent = "Current site: unavailable on this page.";
    } else if (hostWhitelisted) {
      refs.blockerHostStatus.textContent = `Current site: ${state.currentHost} is allowlisted (block rules bypassed).`;
    } else if (hostBlocked) {
      refs.blockerHostStatus.textContent = `Current site: ${state.currentHost} is blocked by your list.`;
    } else {
      refs.blockerHostStatus.textContent = `Current site: ${state.currentHost} is not blocked.`;
    }
    refs.addCurrentSite.disabled = !state.currentHost || hostBlocked;
    refs.removeCurrentSite.disabled = !state.currentHost || !hostBlocked;
    refs.toggleWhitelistSite.textContent = hostWhitelisted ? "Remove from Allowlist" : "Allowlist Site";
    refs.toggleWhitelistSite.disabled = !state.currentHost;
    refs.toggleCosmeticSite.textContent = cosmeticDisabledHost ? "Enable Cosmetic Here" : "Disable Cosmetic Here";
    refs.toggleCosmeticSite.disabled = !state.currentHost;
    refs.quickBlockSocial.classList.toggle("is-active", Boolean(quickCategories.social));
    refs.quickBlockShopping.classList.toggle("is-active", Boolean(quickCategories.shopping));
    refs.quickBlockEntertainment.classList.toggle("is-active", Boolean(quickCategories.entertainment));
    refs.quickBlockAdult.classList.toggle("is-active", Boolean(quickCategories.adult));
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function renderSecureTunnelTimer() {
    const runtime = state.app?.runtime?.secureTunnel || {};
    if (!runtime.connected || !runtime.connectedAt) {
      refs.secureTunnelTimer.textContent = "Session: 00:00:00";
      return;
    }
    refs.secureTunnelTimer.textContent = `Session: ${formatDuration(Date.now() - Number(runtime.connectedAt || 0))}`;
  }

  function syncSecureTunnelTicker() {
    const connected = Boolean(state.app?.runtime?.secureTunnel?.connected);
    if (connected && !state.tunnelTimerHandle) {
      state.tunnelTimerHandle = setInterval(renderSecureTunnelTimer, 1000);
    }
    if (!connected && state.tunnelTimerHandle) {
      clearInterval(state.tunnelTimerHandle);
      state.tunnelTimerHandle = null;
    }
  }

  function getSecureTunnelPresets() {
    const list = state.app?.runtime?.secureTunnel?.presets;
    if (!Array.isArray(list) || !list.length) return [];
    return list;
  }

  function renderSecureTunnel() {
    const tunnel = state.app.settings.secureTunnel || {};
    const runtime = state.app.runtime?.secureTunnel || {};
    const presets = getSecureTunnelPresets();
    const selectedPresetId = String(tunnel.selectedPresetId || "fastest");

    if (refs.secureTunnelPreset && !refs.secureTunnelPreset.dataset.initialized) {
      refs.secureTunnelPreset.innerHTML = presets
        .map((preset) => `<option value="${preset.id}">${preset.label}</option>`)
        .join("");
      refs.secureTunnelPreset.dataset.initialized = "true";
    } else if (refs.secureTunnelPreset && presets.length) {
      const existing = new Set([...refs.secureTunnelPreset.options].map((option) => option.value));
      const mismatch = presets.some((preset) => !existing.has(preset.id)) || existing.size !== presets.length;
      if (mismatch) {
        refs.secureTunnelPreset.innerHTML = presets
          .map((preset) => `<option value="${preset.id}">${preset.label}</option>`)
          .join("");
      }
    }

    setChecked(refs.secureTunnelEnabled, tunnel.enabled);
    setInputValue(refs.secureTunnelMode, tunnel.mode || "preset");
    setInputValue(refs.secureTunnelPreset, selectedPresetId);
    setInputValue(refs.secureTunnelCustomScheme, tunnel.custom?.scheme || "http");
    setInputValue(refs.secureTunnelCustomHost, tunnel.custom?.host || "");
    setInputValue(refs.secureTunnelCustomPort, tunnel.custom?.port || 8080);
    setInputValue(refs.secureTunnelCustomUser, tunnel.custom?.username || "");
    setInputValue(refs.secureTunnelCustomPass, tunnel.custom?.password || "");

    const customMode = String(tunnel.mode || "preset") === "custom";
    refs.secureTunnelPreset.disabled = customMode;
    if (refs.secureTunnelCustomWrap) {
      refs.secureTunnelCustomWrap.open = customMode;
    }

    if (runtime.connected) {
      const label = runtime.activeLabel || runtime.activePresetId || "Proxy";
      refs.secureTunnelStatus.textContent = `Connected via ${label} \u00b7 IP hidden`;
    } else if (runtime.lastError) {
      refs.secureTunnelStatus.textContent = `Connection failed: ${runtime.lastError}`;
    } else {
      refs.secureTunnelStatus.textContent = "Disconnected";
    }

    renderSecureTunnelTimer();
    syncSecureTunnelTicker();
  }

  function renderAlerts() {
    const alerts = state.app.settings.alerts;
    const enabledTypes = Object.entries(alerts.types || {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
    if (!enabledTypes.includes(state.alertTestType)) {
      state.alertTestType = enabledTypes[0] || "eye";
    }

    setChecked(refs.alertsEnabled, alerts.enabled);
    setInputValue(refs.alertFrequency, alerts.frequencyMin);
    setInputValue(refs.alertCadence, alerts.cadenceMode || "focus_weighted");
    setInputValue(refs.alertTestType, state.alertTestType || "eye");
    setChecked(refs.alertTypeEye, alerts.types.eye);
    setChecked(refs.alertTypePosture, alerts.types.posture);
    setChecked(refs.alertTypeBurnout, alerts.types.burnout);
    setChecked(refs.alertTypeHydration, alerts.types.hydration);
    setChecked(refs.alertTypeBlink, alerts.types.blink);
    setChecked(refs.alertTypeMovement, alerts.types.movement);
    setChecked(refs.alertSound, alerts.soundEnabled);
    setInputValue(refs.alertSoundVolume, alerts.soundVolume);
    refs.alertSoundVolumeValue.textContent = `${alerts.soundVolume}%`;
    setInputValue(refs.alertSoundPattern, alerts.soundPattern || "double");
    setChecked(refs.alertToastEnabled, alerts.toastEnabled);
    setChecked(refs.alertNotificationEnabled, alerts.notificationEnabled);
    setChecked(refs.alertQuietHoursEnabled, alerts.quietHours?.enabled);
    setInputValue(refs.alertQuietStart, alerts.quietHours?.start || "22:30");
    setInputValue(refs.alertQuietEnd, alerts.quietHours?.end || "06:30");
    setInputValue(refs.alertSnoozeMinutes, alerts.snoozeMinutes || 10);
    setInputValue(refs.alertCooldown, alerts.cooldownMin || 0);
    setInputValue(refs.alertBurnoutThreshold, alerts.burnoutFocusThresholdMin || 90);
    refs.alertChannelSound?.classList.toggle("is-on", Boolean(alerts.soundEnabled));
    refs.alertChannelToast?.classList.toggle("is-on", Boolean(alerts.toastEnabled));
    refs.alertChannelNotification?.classList.toggle("is-on", Boolean(alerts.notificationEnabled));

    const dependentControls = [
      refs.alertFrequency,
      refs.alertCadence,
      refs.alertTypeEye,
      refs.alertTypePosture,
      refs.alertTypeBurnout,
      refs.alertTypeHydration,
      refs.alertTypeBlink,
      refs.alertTypeMovement,
      refs.alertSound,
      refs.alertSoundVolume,
      refs.alertSoundPattern,
      refs.alertToastEnabled,
      refs.alertNotificationEnabled,
      refs.alertQuietHoursEnabled,
      refs.alertQuietStart,
      refs.alertQuietEnd,
      refs.alertSnoozeMinutes,
      refs.alertCooldown,
      refs.alertBurnoutThreshold
    ];
    dependentControls.forEach((control) => {
      if (!control) return;
      control.disabled = !alerts.enabled;
    });

    const enabledTypeCount = enabledTypes.length;
    const snoozeUntil = Number(alerts.snoozeUntil || 0);
    const quietEnabled = Boolean(alerts.quietHours?.enabled);
    const nowTs = Date.now();
    if (!alerts.enabled) {
      refs.alertStatus.textContent = "Alerts off. Turn on and press Test Alert to verify channels.";
      return;
    }
    if (!alerts.notificationEnabled && !alerts.toastEnabled) {
      refs.alertStatus.textContent = "Enable at least one popup channel (On-page or System) to receive reminders.";
      return;
    }
    if (snoozeUntil > nowTs) {
      const mins = Math.max(1, Math.ceil((snoozeUntil - nowTs) / 60000));
      refs.alertStatus.textContent = `Snoozed for ${mins}m · ${enabledTypeCount} reminder types armed`;
      return;
    }
    const cadenceLabel = alerts.cadenceMode === "focus_weighted"
      ? "focus weighted"
      : alerts.cadenceMode === "random"
        ? "random"
        : "cycle";
    refs.alertStatus.textContent = `${enabledTypeCount} reminder types · every ${alerts.frequencyMin}m (${cadenceLabel})${quietEnabled ? " · quiet hours on" : ""}`;
  }

  function renderSiteInsight() {
    const insight = state.app.settings.siteInsight || {};
    const host = state.currentHost || "";
    const disabledOnHost = Boolean(host && insight.perSiteDisabled?.[host]);

    setChecked(refs.siteInsightEnabled, insight.enabled);
    setInputValue(refs.siteInsightProfile, insight.selectedProfile || "regular");
    setInputValue(refs.siteInsightDuration, insight.durationMs || 8000);
    setChecked(refs.siteInsightAutoMinimize, insight.autoMinimize);
    setChecked(refs.siteInsightPill, insight.minimizedPill);

    refs.siteInsightDisableSite.disabled = !host;
    refs.siteInsightDisableSite.textContent = disabledOnHost ? "Enable on This Site" : "Disable on This Site";

    if (!host) {
      refs.siteInsightStatus.textContent = "Host: unavailable";
      return;
    }

    const stateLabel = insight.enabled
      ? (disabledOnHost ? "disabled on this host" : "enabled")
      : "globally disabled";
    refs.siteInsightStatus.textContent = `Host: ${host} · ${stateLabel}`;
  }

  function renderDeepWork() {
    const deep = state.app.settings.deepWork;
    setInputValue(refs.pomodoroPreset, `${deep.focusMin}:${deep.breakMin}`);
    if (!deep.active) {
      refs.deepWorkStatus.textContent = "Idle";
      return;
    }
    const minsLeft = Math.max(0, Math.ceil((Number(deep.nextTransitionAt || 0) - Date.now()) / 60000));
    refs.deepWorkStatus.textContent = `${deep.phase.toUpperCase()} · ${minsLeft}m remaining`;
  }

  function renderAdvanced() {
    const adv = state.app.settings.advanced;
    setChecked(refs.biofeedbackEnabled, adv.biofeedback);
    setChecked(refs.morphingEnabled, adv.morphing);
  }

  function renderWeaver(list = []) {
    refs.weaverResults.innerHTML = "";
    if (!Array.isArray(list) || !list.length) return;
    list.slice(0, 5).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${item.title}</strong><span>${item.reason}</span>`;
      refs.weaverResults.appendChild(li);
    });
  }

  function render() {
    if (!state.app) return;
    renderPremium();
    renderFavorites();
    renderReadingTheme();
    renderLight();
    renderAdaptiveTheme();
    renderScreenEmulator();
    renderEyeDropper();
    renderScreenshotTool();
    renderBlocker();
    renderSecureTunnel();
    renderAlerts();
    renderSiteInsight();
    renderDeepWork();
    renderAdvanced();
  }

  function queuePatch(patch) {
    state.pendingPatch = deepMerge(state.pendingPatch, patch);
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
    await refreshDiagnostics();
    render();
    setStatus("Saved");
  }

  async function flushPatchNow() {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }

    if (state.pendingPatch && !state.saveInFlight) {
      await flushPatch();
    }

    if (!state.saveInFlight) return;
    let guard = 0;
    while (state.saveInFlight && guard < 80) {
      // Wait for in-flight save to settle before applying to all tabs.
      // 80 * 25ms = 2s max wait.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 25));
      guard += 1;
    }
  }

  async function applyAllTabs({ ensureLightEnabled = false, quiet = false } = {}) {
    await flushPatchNow();
    const response = await sendMessage({
      type: "holmeta:apply-all-tabs",
      ensureLightEnabled: Boolean(ensureLightEnabled)
    });

    if (!response?.ok) {
      if (!quiet) toast(`Apply all failed: ${response?.error || "unknown"}`);
      return { ok: false, error: response?.error || "apply_all_failed" };
    }

    if (response.state) {
      state.app = response.state;
      await refreshDiagnostics();
      render();
    }

    if (!quiet) {
      const applied = Math.max(0, Number(response.appliedTabs || 0));
      toast(`Applied to ${applied} tab${applied === 1 ? "" : "s"}.`);
    }
    return { ok: true };
  }

  async function refreshDiagnostics() {
    const tab = await queryCurrentTab();
    const tabId = Number(tab?.id || 0);
    if (!Number.isInteger(tabId) || tabId <= 0) {
      state.diagnostics = null;
      return;
    }
    const response = await sendMessage({ type: "holmeta:get-light-diagnostics", tabId });
    if (!response.ok) {
      state.diagnostics = null;
      return;
    }
    state.diagnostics = response.diagnostics || null;
  }

  async function hydrate() {
    const [res, tab] = await Promise.all([
      sendMessage({ type: "holmeta:get-state" }),
      queryCurrentTab()
    ]);

    if (!res.ok) {
      setStatus(`Load failed: ${res.error || "unknown"}`, true);
      return;
    }

    state.currentHost = normalizeHost(tab?.url || "");
    state.app = res.state;
    state.eyeDraftHex = normalizeHexColor(state.app?.settings?.eyeDropper?.recentHex, "#FFB300");
    state.favoriteDraftUrl = "";
    await refreshDiagnostics();

    state.hydrated = true;
    render();

    const localOnboarded = await readOnboardingCompletion();
    const onboarded = Boolean(state.app.meta?.onboarded) || localOnboarded;

    if (!onboarded) {
      startOnboarding();
      return;
    }

    refs.onboarding.hidden = true;
    if (!state.app.meta?.onboarded) {
      const response = await sendMessage({ type: "holmeta:set-onboarded" });
      if (response.ok) {
        state.app = response.state;
        render();
      }
    }
  }

  function openUpgrade() {
    chrome.tabs.create({ url: UPGRADE_URL });
  }

  function openExternal(url) {
    chrome.tabs.create({ url });
  }

  async function handleHotkeyButton(command) {
    const response = await sendMessage({ type: "holmeta:run-command", command });
    if (!response.ok) {
      toast(`Action failed: ${response.error || "unknown"}`);
      return;
    }
    state.app = response.state;
    await refreshDiagnostics();
    render();
    toast(`Executed: ${command.replaceAll("_", " ")}`);
  }

  async function handleBiofeedbackToggle(nextEnabled) {
    if (!state.app.license.premium) {
      toast("Premium feature – upgrade at holmeta.com");
      refs.biofeedbackEnabled.checked = false;
      return;
    }

    if (nextEnabled) {
      const has = await new Promise((resolve) => chrome.permissions.contains({ permissions: ["videoCapture"] }, resolve));
      if (!has) {
        const explain = window.confirm(
          "Holmeta needs webcam access for posture/bio-feedback. Video stays local and is never uploaded. Continue?"
        );
        if (!explain) {
          refs.biofeedbackEnabled.checked = false;
          return;
        }
        const granted = await new Promise((resolve) => chrome.permissions.request({ permissions: ["videoCapture"] }, resolve));
        if (!granted) {
          refs.biofeedbackEnabled.checked = false;
          toast("Permission denied. Bio-feedback remains off.");
          return;
        }
      }
    }

    queuePatch({ advanced: { biofeedback: nextEnabled } });
  }

  function currentReadingPatchFromUI() {
    const appearance = refs.readingThemeAuto.classList.contains("is-active")
      ? "auto"
      : refs.readingThemeLight.classList.contains("is-active")
        ? "light"
        : "dark";
    const scheduleMode = String(refs.readingThemeScheduleMode.value || "sunset") === "sunset" ? "sunset" : "custom";
    const schedule = {
      enabled: appearance === "auto",
      useSunset: scheduleMode === "sunset",
      start: String(refs.readingThemeScheduleStart.value || "20:00"),
      end: String(refs.readingThemeScheduleEnd.value || "06:00")
    };
    const mode = appearance === "light" ? "light" : "dark";
    const preset = mode === "light" ? "neutral_light" : "soft_black";
    return {
      appearance,
      scheduleMode,
      schedule,
      mode,
      preset,
      intensity: 44
    };
  }

  function currentLightPatchFromUI() {
    const mode = String(refs.lightMode.value || "warm");
    const spectrumPreset = String(refs.lightSpectrumPreset.value || "balanced");
    const intensity = Math.max(0, Math.min(100, Number(refs.lightIntensity.value || 0)));
    const dim = Math.max(0, Math.min(60, Number(refs.lightDim.value || 0)));
    const contrastSoft = Math.max(0, Math.min(30, Number(refs.lightContrastSoft.value || 0)));
    const brightness = Math.max(70, Math.min(120, Number(refs.lightBrightness.value || 96)));
    const saturation = Math.max(50, Math.min(140, Number(refs.lightSaturation.value || 100)));
    const blueCut = Math.max(0, Math.min(100, Number(refs.lightBlueCut.value || 65)));
    const tintRed = Math.max(0, Math.min(100, Number(refs.lightTintRed.value || 100)));
    const tintGreen = Math.max(0, Math.min(100, Number(refs.lightTintGreen.value || 62)));
    const tintBlue = Math.max(0, Math.min(100, Number(refs.lightTintBlue.value || 30)));
    const reduceWhites = Boolean(refs.reduceWhites.checked);
    const videoSafe = Boolean(refs.videoSafe.checked);
    const spotlightEnabled = Boolean(refs.spotlightEnabled.checked);
    const therapyMode = Boolean(refs.therapyMode.checked);
    const therapyDuration = Math.max(1, Math.min(10, Number(refs.therapyMinutes.value || 3)));
    const therapyCadence = String(refs.therapyCadence.value || "gentle");

    return {
      mode,
      spectrumPreset,
      intensity,
      dim,
      contrastSoft,
      brightness,
      saturation,
      blueCut,
      tintRed,
      tintGreen,
      tintBlue,
      reduceWhites,
      videoSafe,
      spotlightEnabled,
      therapyMode,
      therapyDuration,
      therapyCadence
    };
  }

  function currentAdaptivePatchFromUI() {
    const mode = String(refs.adaptiveThemeMode.value || "smart_dark");
    const preset = String(refs.adaptiveThemePreset.value || "balanced");
    const strategy = String(refs.adaptiveThemeStrategy.value || "auto");
    const compatibilityMode = String(refs.adaptiveThemeCompatibility.value || "normal");
    const intensity = Math.max(0, Math.min(100, Number(refs.adaptiveThemeIntensity.value || 52)));
    return {
      mode,
      preset,
      strategy,
      compatibilityMode,
      intensity
    };
  }

  function queueLightPatch(partial) {
    const light = getLightFilterState();
    const siteProfile = getLightSiteProfile();
    if (state.currentHost && siteProfile) {
      const map = { ...(light.perSiteOverrides || light.siteProfiles || {}) };
      map[state.currentHost] = deepMerge(map[state.currentHost] || {}, partial);
      queuePatch({ lightFilter: { perSiteOverrides: map } });
      return;
    }
    queuePatch({ lightFilter: partial });
  }

  function queueReadingPatch(partial) {
    const reading = getReadingThemeState();
    const siteProfile = getReadingSiteProfile();
    if (state.currentHost && siteProfile) {
      const map = { ...(reading.perSiteOverrides || reading.siteProfiles || {}) };
      map[state.currentHost] = deepMerge(map[state.currentHost] || {}, partial);
      queuePatch({ readingTheme: { perSiteOverrides: map } });
      return;
    }
    queuePatch({ readingTheme: partial });
  }

  function queueAdaptivePatch(partial) {
    const adaptive = getAdaptiveThemeState();
    const siteProfile = getAdaptiveSiteProfile();
    if (state.currentHost && siteProfile) {
      const map = { ...(adaptive.perSiteOverrides || adaptive.siteProfiles || {}) };
      map[state.currentHost] = deepMerge(map[state.currentHost] || {}, partial);
      queuePatch({ adaptiveSiteTheme: { perSiteOverrides: map } });
      return;
    }
    queuePatch({ adaptiveSiteTheme: partial });
  }

  function setLightSiteOverride(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      refs.lightThisSiteEnabled.checked = false;
      return;
    }
    const light = getLightFilterState();
    const map = { ...(light.perSiteOverrides || light.siteProfiles || {}) };
    if (enabled) {
      map[state.currentHost] = {
        enabled: true,
        ...currentLightPatchFromUI()
      };
      toast(`Light Filter override enabled for ${state.currentHost}`);
    } else {
      delete map[state.currentHost];
      toast(`Light Filter override removed for ${state.currentHost}`);
    }
    queuePatch({ lightFilter: { perSiteOverrides: map } });
  }

  function setLightExcludeSite(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      refs.lightExcludeSite.checked = false;
      return;
    }
    const light = getLightFilterState();
    const map = { ...(light.excludedSites || {}) };
    if (enabled) map[state.currentHost] = true;
    else delete map[state.currentHost];
    queuePatch({ lightFilter: { excludedSites: map } });
  }

  function setReadingSiteOverride(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      refs.readingThemeThisSiteEnabled.checked = false;
      return;
    }
    const reading = getReadingThemeState();
    const map = { ...(reading.perSiteOverrides || reading.siteProfiles || {}) };
    if (enabled) {
      map[state.currentHost] = {
        enabled: true,
        ...currentReadingPatchFromUI()
      };
      toast(`Reading Theme override enabled for ${state.currentHost}`);
    } else {
      delete map[state.currentHost];
      toast(`Reading Theme override removed for ${state.currentHost}`);
    }
    queuePatch({ readingTheme: { perSiteOverrides: map } });
  }

  function setReadingExcludeSite(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      refs.readingThemeExcludeSite.checked = false;
      return;
    }
    const reading = getReadingThemeState();
    const map = { ...(reading.excludedSites || {}) };
    if (enabled) map[state.currentHost] = true;
    else delete map[state.currentHost];
    queuePatch({ readingTheme: { excludedSites: map } });
  }

  function setAdaptiveSiteOverride(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      refs.adaptiveThemeThisSiteEnabled.checked = false;
      return;
    }
    const adaptive = getAdaptiveThemeState();
    const map = { ...(adaptive.perSiteOverrides || adaptive.siteProfiles || {}) };
    if (enabled) {
      map[state.currentHost] = {
        enabled: true,
        ...currentAdaptivePatchFromUI()
      };
      toast(`Adaptive Theme override enabled for ${state.currentHost}`);
    } else {
      delete map[state.currentHost];
      toast(`Adaptive Theme override removed for ${state.currentHost}`);
    }
    queuePatch({ adaptiveSiteTheme: { perSiteOverrides: map } });
  }

  function setAdaptiveExcludeSite(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      refs.adaptiveThemeExcludeSite.checked = false;
      return;
    }
    const adaptive = getAdaptiveThemeState();
    const map = { ...(adaptive.excludedSites || {}) };
    if (enabled) map[state.currentHost] = true;
    else delete map[state.currentHost];
    queuePatch({ adaptiveSiteTheme: { excludedSites: map } });
  }

  function setReadingAppearanceWithEnable(appearance) {
    const safeAppearance = ["light", "dark", "auto"].includes(String(appearance || ""))
      ? String(appearance)
      : "dark";
    const patch = currentReadingPatchFromUI();
    patch.appearance = safeAppearance;
    patch.schedule.enabled = safeAppearance === "auto";
    patch.mode = safeAppearance === "light" ? "light" : "dark";
    patch.preset = patch.mode === "light" ? "neutral_light" : "soft_black";
    queueReadingPatch({
      enabled: true,
      ...patch
    });
  }

  function getEyeToolState() {
    return state.app?.settings?.eyeDropper || { recentHex: "#FFB300", swatches: [] };
  }

  function queueEyeDropperPatch(partial) {
    const current = getEyeToolState();
    queuePatch({ eyeDropper: deepMerge(current, partial) });
  }

  function queueScreenshotPatch(partial) {
    const current = getScreenshotSettings();
    queuePatch({ screenshotTool: deepMerge(current, partial) });
  }

  function secureTunnelPayloadFromUI() {
    const mode = String(refs.secureTunnelMode.value || "preset");
    const presetId = String(refs.secureTunnelPreset.value || "fastest");
    const custom = {
      scheme: String(refs.secureTunnelCustomScheme.value || "http"),
      host: String(refs.secureTunnelCustomHost.value || "").trim(),
      port: Number(refs.secureTunnelCustomPort.value || 8080),
      username: String(refs.secureTunnelCustomUser.value || "").trim(),
      password: String(refs.secureTunnelCustomPass.value || "")
    };
    return { mode, presetId, custom };
  }

  function saveCurrentEyeHexToSwatches() {
    const hex = normalizeHexColor(state.eyeDraftHex || refs.eyeHexInput.value, "");
    if (!hex) {
      toast("Enter a valid HEX color, like #FFB300.");
      return;
    }

    state.eyeDraftHex = hex;
    const current = getEyeToolState();
    const list = Array.isArray(current.swatches) ? [...current.swatches] : [];
    const deduped = [hex, ...list.filter((value) => value !== hex)].slice(0, 12);
    queueEyeDropperPatch({
      recentHex: hex,
      swatches: deduped
    });
    toast(`Saved ${hex}`);
  }

  function upsertFavorite(rawUrl, title = "") {
    const normalizedUrl = normalizeFavoriteUrl(rawUrl);
    if (!normalizedUrl) {
      toast("Enter a valid website URL (https://...).");
      return false;
    }

    const host = normalizeHost(normalizedUrl);
    if (!host) {
      toast("Only http/https websites are supported.");
      return false;
    }

    const favorites = getFavoritesState();
    const links = Array.isArray(favorites.links) ? [...favorites.links] : [];
    const existingIndex = links.findIndex((item) => normalizeHost(item.url) === host);
    const entry = {
      id: host,
      url: normalizedUrl,
      host,
      title: String(title || favoriteLabelFromHost(host)).slice(0, 80)
    };

    if (existingIndex >= 0) {
      links.splice(existingIndex, 1);
    } else if (links.length >= FAVORITE_LIMIT) {
      toast(`Maximum ${FAVORITE_LIMIT} favorites reached.`);
      return false;
    }

    links.unshift(entry);
    queueFavoritesPatch({ links: links.slice(0, FAVORITE_LIMIT) });
    state.favoriteDraftUrl = "";
    setInputValue(refs.favoriteUrlInput, "");
    toast(`Saved favorite: ${host}`);
    return true;
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

  function bindEvents() {
    bindEditingTracking();

    refs.readingThemeEnabled.addEventListener("change", (e) => queuePatch({ readingTheme: { enabled: e.target.checked } }));
    refs.readingThemeDark.addEventListener("click", async () => {
      refs.readingThemeDark.classList.add("is-active");
      refs.readingThemeLight.classList.remove("is-active");
      refs.readingThemeAuto.classList.remove("is-active");
      setReadingAppearanceWithEnable("dark");
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeLight.addEventListener("click", async () => {
      refs.readingThemeLight.classList.add("is-active");
      refs.readingThemeDark.classList.remove("is-active");
      refs.readingThemeAuto.classList.remove("is-active");
      setReadingAppearanceWithEnable("light");
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeAuto.addEventListener("click", async () => {
      refs.readingThemeAuto.classList.add("is-active");
      refs.readingThemeDark.classList.remove("is-active");
      refs.readingThemeLight.classList.remove("is-active");
      setReadingAppearanceWithEnable("auto");
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeScheduleMode.addEventListener("change", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({
        appearance: "auto",
        scheduleMode: patch.scheduleMode,
        schedule: patch.schedule,
        mode: patch.mode,
        preset: patch.preset
      });
    });

    refs.readingThemeScheduleStart.addEventListener("input", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({
        appearance: patch.appearance,
        scheduleMode: patch.scheduleMode,
        schedule: patch.schedule
      });
    });

    refs.readingThemeScheduleEnd.addEventListener("input", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({
        appearance: patch.appearance,
        scheduleMode: patch.scheduleMode,
        schedule: patch.schedule
      });
    });

    refs.readingThemeThisSiteEnabled.addEventListener("change", (e) => setReadingSiteOverride(e.target.checked));
    refs.readingThemeExcludeSite.addEventListener("change", (e) => setReadingExcludeSite(e.target.checked));

    refs.adaptiveThemeEnabled.addEventListener("change", (e) => queuePatch({ adaptiveSiteTheme: { enabled: e.target.checked } }));
    refs.adaptiveThemeMode.addEventListener("change", (e) => queueAdaptivePatch({ mode: String(e.target.value || "smart_dark") }));
    refs.adaptiveThemePreset.addEventListener("change", (e) => queueAdaptivePatch({ preset: String(e.target.value || "balanced") }));
    refs.adaptiveThemeStrategy.addEventListener("change", (e) => queueAdaptivePatch({ strategy: String(e.target.value || "auto") }));
    refs.adaptiveThemeCompatibility.addEventListener("change", (e) => queueAdaptivePatch({ compatibilityMode: String(e.target.value || "normal") }));
    refs.adaptiveThemeIntensity.addEventListener("input", (e) => {
      const value = Math.max(0, Math.min(100, Number(e.target.value || 52)));
      refs.adaptiveThemeIntensityValue.textContent = `${value}%`;
      queueAdaptivePatch({ intensity: value });
    });
    refs.adaptiveThemeThisSiteEnabled.addEventListener("change", (e) => setAdaptiveSiteOverride(e.target.checked));
    refs.adaptiveThemeExcludeSite.addEventListener("change", (e) => setAdaptiveExcludeSite(e.target.checked));

    refs.lightEnabled.addEventListener("change", (e) => queuePatch({ lightFilter: { enabled: e.target.checked } }));
    refs.lightMode.addEventListener("change", (e) => queueLightPatch({ mode: e.target.value }));
    refs.lightIntensity.addEventListener("input", (e) => {
      const value = Math.max(0, Math.min(100, Number(e.target.value || 0)));
      refs.lightIntensityValue.textContent = `${value}%`;
      queueLightPatch({ intensity: value });
    });
    refs.lightScheduleMode.addEventListener("change", (e) => {
      const mode = String(e.target.value || "off");
      if (mode === "off") {
        queueLightPatch({ schedule: { enabled: false, useSunset: false } });
        return;
      }
      if (mode === "sunset") {
        queueLightPatch({ schedule: { enabled: true, useSunset: true } });
        return;
      }
      queueLightPatch({ schedule: { enabled: true, useSunset: false } });
    });
    refs.lightScheduleStart.addEventListener("input", (e) => {
      queueLightPatch({ schedule: { start: String(e.target.value || "20:00"), enabled: true, useSunset: false } });
    });
    refs.lightScheduleEnd.addEventListener("input", (e) => {
      queueLightPatch({ schedule: { end: String(e.target.value || "06:00"), enabled: true, useSunset: false } });
    });

    refs.lightThisSiteEnabled.addEventListener("change", (e) => setLightSiteOverride(e.target.checked));
    refs.lightExcludeSite.addEventListener("change", (e) => setLightExcludeSite(e.target.checked));
    refs.lightApplyAll.addEventListener("click", async () => {
      await applyAllTabs({ ensureLightEnabled: false, quiet: false });
    });

    refs.saveSiteProfile.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:save-site-profile", host: state.currentHost });
      if (!response?.ok) {
        toast(`Save profile failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      await refreshDiagnostics();
      render();
      toast(`Saved 3-system profile for ${state.currentHost}`);
    });

    refs.copyGlobalToSite.addEventListener("click", () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const light = getLightFilterState();
      const reading = getReadingThemeState();
      const adaptive = getAdaptiveThemeState();
      const lightMap = { ...(light.perSiteOverrides || light.siteProfiles || {}) };
      const readingMap = { ...(reading.perSiteOverrides || reading.siteProfiles || {}) };
      const adaptiveMap = { ...(adaptive.perSiteOverrides || adaptive.siteProfiles || {}) };
      lightMap[state.currentHost] = {
        enabled: true,
        ...currentLightPatchFromUI()
      };
      readingMap[state.currentHost] = {
        enabled: true,
        ...currentReadingPatchFromUI()
      };
      adaptiveMap[state.currentHost] = {
        enabled: true,
        ...currentAdaptivePatchFromUI()
      };
      queuePatch({
        lightFilter: { perSiteOverrides: lightMap },
        readingTheme: { perSiteOverrides: readingMap },
        adaptiveSiteTheme: { perSiteOverrides: adaptiveMap }
      });
      toast(`Copied global profiles to ${state.currentHost}`);
    });

    refs.resetSiteOverrides.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:reset-site-overrides", host: state.currentHost });
      if (!response?.ok) {
        toast(`Reset failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      await refreshDiagnostics();
      render();
      toast(`Reset overrides for ${state.currentHost}`);
    });

    refs.reduceWhites.addEventListener("change", (e) => queueLightPatch({ reduceWhites: e.target.checked }));
    refs.videoSafe.addEventListener("change", (e) => queueLightPatch({ videoSafe: e.target.checked }));
    refs.lightSpectrumPreset.addEventListener("change", (e) => queueLightPatch({ spectrumPreset: e.target.value }));
    refs.lightBlueCut.addEventListener("input", (e) => {
      const value = Math.max(0, Math.min(100, Number(e.target.value || 65)));
      refs.lightBlueCutValue.textContent = `${value}%`;
      queueLightPatch({ blueCut: value });
    });
    refs.lightSaturation.addEventListener("input", (e) => {
      const value = Math.max(50, Math.min(140, Number(e.target.value || 100)));
      refs.lightSaturationValue.textContent = `${value}%`;
      queueLightPatch({ saturation: value });
    });
    const applyTintPatch = () => {
      const tintRed = Math.max(0, Math.min(100, Number(refs.lightTintRed.value || 100)));
      const tintGreen = Math.max(0, Math.min(100, Number(refs.lightTintGreen.value || 62)));
      const tintBlue = Math.max(0, Math.min(100, Number(refs.lightTintBlue.value || 30)));
      refs.lightTintValue.textContent = `${tintRed} / ${tintGreen} / ${tintBlue}`;
      queueLightPatch({ tintRed, tintGreen, tintBlue });
    };
    refs.lightTintRed.addEventListener("input", applyTintPatch);
    refs.lightTintGreen.addEventListener("input", applyTintPatch);
    refs.lightTintBlue.addEventListener("input", applyTintPatch);
    refs.lightBrightness.addEventListener("input", (e) => {
      const value = Math.max(70, Math.min(120, Number(e.target.value || 96)));
      refs.lightBrightnessValue.textContent = `${value}%`;
      queueLightPatch({ brightness: value });
    });
    refs.lightDim.addEventListener("input", (e) => {
      const value = Math.max(0, Math.min(60, Number(e.target.value || 0)));
      refs.lightDimValue.textContent = `${value}%`;
      queueLightPatch({ dim: value });
    });
    refs.lightContrastSoft.addEventListener("input", (e) => {
      const value = Math.max(0, Math.min(30, Number(e.target.value || 0)));
      refs.lightContrastSoftValue.textContent = `${value}%`;
      queueLightPatch({ contrastSoft: value });
    });

    refs.spotlightEnabled.addEventListener("change", (e) => queueLightPatch({ spotlightEnabled: e.target.checked }));
    refs.setSpotlightCenter.addEventListener("click", async () => {
      await sendMessage({ type: "holmeta:set-spotlight-point", point: { x: 50, y: 42 } });
      toast("Spotlight centered.");
    });

    refs.therapyMode.addEventListener("change", (e) => queueLightPatch({ therapyMode: e.target.checked }));
    refs.therapyMinutes.addEventListener("input", (e) => {
      const value = Math.max(1, Math.min(10, Number(e.target.value || 3)));
      queueLightPatch({ therapyDuration: value });
    });
    refs.therapyCadence.addEventListener("change", (e) => queueLightPatch({ therapyCadence: e.target.value }));

    refs.screenPreset.addEventListener("change", (e) => {
      const presetKey = String(e.target.value || "desktop_hd");
      const preset = SCREEN_PRESETS[presetKey] || SCREEN_PRESETS.desktop_hd;
      setInputValue(refs.screenWidth, String(preset.width));
      setInputValue(refs.screenHeight, String(preset.height));
      queuePatch({
        screenEmulator: {
          preset: presetKey,
          width: preset.width,
          height: preset.height
        }
      });
    });

    refs.screenWidth.addEventListener("change", (e) => {
      const width = Math.max(320, Math.min(5120, Number(e.target.value || 1366)));
      setInputValue(refs.screenWidth, String(width));
      queuePatch({ screenEmulator: { width } });
    });

    refs.screenHeight.addEventListener("change", (e) => {
      const height = Math.max(320, Math.min(2880, Number(e.target.value || 768)));
      setInputValue(refs.screenHeight, String(height));
      queuePatch({ screenEmulator: { height } });
    });

    refs.screenApply.addEventListener("click", async () => {
      const preset = String(refs.screenPreset.value || "desktop_hd");
      const width = Math.max(320, Math.min(5120, Number(refs.screenWidth.value || 1366)));
      const height = Math.max(320, Math.min(2880, Number(refs.screenHeight.value || 768)));
      refs.screenApply.disabled = true;
      refs.screenApply.textContent = "Applying...";
      const response = await sendMessage({ type: "holmeta:resize-window", preset, width, height });
      refs.screenApply.disabled = false;
      refs.screenApply.textContent = "Apply Size";
      if (!response?.ok) {
        toast(`Resize failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(`Window set to ${width}×${height}`);
    });

    refs.screenReset.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:reset-window-size" });
      if (!response?.ok) {
        toast(`Reset failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Window size restored.");
    });

    refs.eyeHexInput.addEventListener("input", (e) => {
      state.eyeDraftHex = String(e.target.value || "").toUpperCase();
    });
    refs.eyeHexInput.addEventListener("blur", () => {
      const normalized = normalizeHexColor(state.eyeDraftHex || refs.eyeHexInput.value, "");
      if (!normalized) return;
      state.eyeDraftHex = normalized;
      queueEyeDropperPatch({ recentHex: normalized });
    });

    refs.eyePickFromPage.addEventListener("click", async () => {
      refs.eyePickFromPage.disabled = true;
      refs.eyePickFromPage.textContent = "Starting...";
      const response = await sendMessage({ type: "holmeta:start-color-pick" });
      refs.eyePickFromPage.disabled = false;
      refs.eyePickFromPage.textContent = "Pick from Page";

      if (!response.ok) {
        const error = String(response.error || "unknown");
        if (error === "no_active_tab") {
          toast("Open a standard website tab (http/https) to sample colors.");
          return;
        }
        if (
          error === "inject_failed" ||
          error === "cannot_access_tab" ||
          error.includes("cannot access contents of url") ||
          error.includes("cannot access a chrome://") ||
          error.includes("cannot access")
        ) {
          toast("This page is restricted. Open a normal website tab, refresh once, then try Pick from Page.");
          return;
        }
        if (error.includes("receiving end does not exist") || error.includes("could not establish connection")) {
          toast("Page connection was stale. Refresh the page and try the picker again.");
          return;
        }
        toast(`Pick failed: ${error}`);
        return;
      }
      if (response.state) {
        state.app = response.state;
      }
      toast("Picker active. Move cursor on page for live swatch, then click to save.");
      setStatus("Eye Dropper active on page");
    });

    refs.eyePasteHex.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        const hex = normalizeHexColor(text, "");
        if (!hex) {
          toast("Clipboard does not contain a valid HEX color.");
          return;
        }
        state.eyeDraftHex = hex;
        setInputValue(refs.eyeHexInput, hex);
        queueEyeDropperPatch({ recentHex: hex });
        toast(`Pasted ${hex}`);
      } catch {
        toast("Clipboard read blocked by browser.");
      }
    });

    refs.eyeCopyHex.addEventListener("click", async () => {
      const hex = normalizeHexColor(state.eyeDraftHex || refs.eyeHexInput.value, "");
      if (!hex) {
        toast("Enter a valid HEX color first.");
        return;
      }
      const ok = await copyToClipboard(hex);
      if (!ok) {
        toast("Copy failed.");
        return;
      }
      state.eyeDraftHex = hex;
      queueEyeDropperPatch({ recentHex: hex });
      toast(`Copied ${hex}`);
    });

    refs.eyeAddSwatch.addEventListener("click", saveCurrentEyeHexToSwatches);

    refs.screenshotEnabled.addEventListener("change", (event) => {
      queueScreenshotPatch({ enabled: Boolean(event.target.checked) });
    });

    refs.screenshotPadding.addEventListener("change", (event) => {
      const value = Math.max(0, Math.min(24, Number(event.target.value || 8)));
      queueScreenshotPatch({ padding: value });
    });

    refs.screenshotTargetMode.addEventListener("change", (event) => {
      queueScreenshotPatch({ targetMode: String(event.target.value || "smart") });
    });

    refs.screenshotAspectRatio.addEventListener("change", (event) => {
      const aspectRatio = String(event.target.value || "none");
      queueScreenshotPatch({ aspectRatio });
    });

    refs.screenshotCustomAspectWidth.addEventListener("change", (event) => {
      const value = Math.max(1, Math.min(999, Number(event.target.value || 16)));
      setInputValue(refs.screenshotCustomAspectWidth, String(value));
      queueScreenshotPatch({ customAspectWidth: value });
    });

    refs.screenshotCustomAspectHeight.addEventListener("change", (event) => {
      const value = Math.max(1, Math.min(999, Number(event.target.value || 9)));
      setInputValue(refs.screenshotCustomAspectHeight, String(value));
      queueScreenshotPatch({ customAspectHeight: value });
    });

    refs.screenshotMinWidth.addEventListener("change", (event) => {
      const value = Math.max(12, Math.min(2400, Number(event.target.value || 40)));
      setInputValue(refs.screenshotMinWidth, String(value));
      queueScreenshotPatch({ minTargetWidth: value });
    });

    refs.screenshotMinHeight.addEventListener("change", (event) => {
      const value = Math.max(12, Math.min(1800, Number(event.target.value || 24)));
      setInputValue(refs.screenshotMinHeight, String(value));
      queueScreenshotPatch({ minTargetHeight: value });
    });

    refs.screenshotOutputScale.addEventListener("change", (event) => {
      const value = Number(event.target.value || 1) >= 2 ? 2 : 1;
      queueScreenshotPatch({ outputScale: value });
    });

    refs.screenshotBackgroundMode.addEventListener("change", (event) => {
      queueScreenshotPatch({ backgroundMode: String(event.target.value || "original") });
    });

    refs.screenshotShowTooltip.addEventListener("change", (event) => {
      queueScreenshotPatch({ showTooltip: Boolean(event.target.checked) });
    });

    refs.screenshotAutoCopy.addEventListener("change", (event) => {
      queueScreenshotPatch({ autoCopy: Boolean(event.target.checked) });
    });

    refs.screenshotPreviewRounded.addEventListener("change", (event) => {
      queueScreenshotPatch({ previewRounded: Boolean(event.target.checked) });
    });

    refs.screenshotStart.addEventListener("click", async () => {
      const settings = getScreenshotSettings();
      if (!settings.enabled) {
        toast("Screenshot Tool is disabled.");
        return;
      }
      await flushPatchNow();
      refs.screenshotStart.disabled = true;
      refs.screenshotStart.textContent = "Starting...";
      const response = await sendMessage({ type: "SCREENSHOT_START" });
      refs.screenshotStart.disabled = false;
      refs.screenshotStart.textContent = "Start Capture";
      if (!response?.ok) {
        const code = String(response?.error || "unknown");
        if (["restricted_page", "no_active_tab", "no_active_web_tab", "content_script_unavailable"].includes(code)) {
          toast("Screenshot unavailable on this page.");
        } else {
          toast("Capture failed. Try reloading the page.");
        }
        state.screenshotRunning = false;
        renderScreenshotTool();
        return;
      }
      if (response.state) {
        state.app = response.state;
      }
      state.screenshotRunning = true;
      renderScreenshotTool();
      toast("Screenshot mode active. Hover any element and click once.");
    });

    refs.screenshotStop.addEventListener("click", async () => {
      const response = await sendMessage({ type: "SCREENSHOT_CANCEL" });
      if (!response?.ok) {
        toast(`Screenshot stop failed: ${response?.error || "unknown"}`);
        return;
      }
      if (response.state) {
        state.app = response.state;
      }
      state.screenshotRunning = false;
      renderScreenshotTool();
      toast("Screenshot mode stopped.");
    });

    refs.favoriteUrlInput.addEventListener("input", (event) => {
      state.favoriteDraftUrl = String(event.target.value || "");
    });

    refs.favoriteUrlInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      upsertFavorite(state.favoriteDraftUrl || refs.favoriteUrlInput.value);
    });

    refs.favoriteAddUrl.addEventListener("click", () => {
      upsertFavorite(state.favoriteDraftUrl || refs.favoriteUrlInput.value);
    });

    refs.favoriteAddCurrent.addEventListener("click", async () => {
      const tab = await queryCurrentTab();
      const tabUrl = String(tab?.url || "");
      const tabTitle = String(tab?.title || "");
      if (!tabUrl || !/^https?:/i.test(tabUrl)) {
        toast("Current tab is not a standard website.");
        return;
      }
      upsertFavorite(tabUrl, tabTitle);
    });

    refs.favoritesGrid.addEventListener("click", (event) => {
      const removeBtn = event.target.closest("[data-favorite-remove]");
      if (removeBtn) {
        const index = Number(removeBtn.getAttribute("data-favorite-remove"));
        const favorites = getFavoritesState();
        const links = Array.isArray(favorites.links) ? [...favorites.links] : [];
        if (!Number.isInteger(index) || index < 0 || index >= links.length) return;
        const removed = links.splice(index, 1)[0];
        queueFavoritesPatch({ links });
        toast(`Removed ${normalizeHost(removed?.url || "") || "favorite"}`);
        return;
      }

      const openBtn = event.target.closest("[data-favorite-open]");
      if (!openBtn) return;
      const index = Number(openBtn.getAttribute("data-favorite-open"));
      const favorites = getFavoritesState();
      const links = Array.isArray(favorites.links) ? favorites.links : [];
      if (!Number.isInteger(index) || index < 0 || index >= links.length) return;
      const entry = links[index];
      const url = normalizeFavoriteUrl(entry?.url || "");
      if (!url) {
        toast("Saved URL is invalid.");
        return;
      }
      chrome.tabs.create({ url });
    });

    refs.eyeClearSwatches.addEventListener("click", () => {
      const confirmed = window.confirm("Clear all saved color swatches?");
      if (!confirmed) return;
      queueEyeDropperPatch({
        swatches: []
      });
      toast("Swatches cleared.");
    });

    refs.eyeSwatchesGrid.addEventListener("click", async (event) => {
      const removeBtn = event.target.closest("[data-remove]");
      if (removeBtn) {
        const index = Number(removeBtn.getAttribute("data-remove"));
        const current = getEyeToolState();
        const swatches = Array.isArray(current.swatches) ? [...current.swatches] : [];
        if (!Number.isInteger(index) || index < 0 || index >= swatches.length) return;
        swatches.splice(index, 1);
        queueEyeDropperPatch({ swatches });
        toast("Swatch removed.");
        return;
      }

      const colorBtn = event.target.closest("[data-hex]");
      if (!colorBtn) return;
      const hex = normalizeHexColor(colorBtn.getAttribute("data-hex"), "");
      if (!hex) return;
      state.eyeDraftHex = hex;
      setInputValue(refs.eyeHexInput, hex);
      const ok = await copyToClipboard(hex);
      if (!ok) {
        toast("Copy failed.");
        return;
      }
      queueEyeDropperPatch({ recentHex: hex });
      toast(`Copied ${hex}`);
    });

    refs.blockerEnabled.addEventListener("change", (e) => queuePatch({ blocker: { enabled: e.target.checked } }));
    refs.nuclearMode.addEventListener("change", (e) => {
      const checked = e.target.checked;
      if (checked) {
        const ok = window.confirm("Enable Nuclear Mode? This will block most websites except allowlist.");
        if (!ok) {
          e.target.checked = false;
          return;
        }
      }
      queuePatch({ blocker: { nuclear: checked } });
    });
    refs.blockCatAds.addEventListener("change", (e) => queuePatch({ blocker: { categories: { ads: e.target.checked } } }));
    refs.blockCatTrackers.addEventListener("change", (e) => queuePatch({ blocker: { categories: { trackers: e.target.checked } } }));
    refs.blockCatMalware.addEventListener("change", (e) => queuePatch({ blocker: { categories: { malware: e.target.checked } } }));
    refs.blockCatAnnoyances.addEventListener("change", (e) => queuePatch({ blocker: { categories: { annoyances: e.target.checked } } }));
    refs.blockCatVideoAds.addEventListener("change", (e) => queuePatch({ blocker: { categories: { videoAds: e.target.checked } } }));
    refs.blockCosmeticEnabled.addEventListener("change", (e) => queuePatch({ blocker: { cosmeticFiltering: e.target.checked } }));
    refs.blockAntiDetect.addEventListener("change", (e) => queuePatch({ blocker: { antiDetection: e.target.checked } }));

    const toggleQuickCategory = async (category) => {
      const response = await sendMessage({ type: "holmeta:toggle-blocker-quick-category", category });
      if (!response?.ok) {
        toast(`Quick block failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      const label = category === "adult"
        ? "18+"
        : category.charAt(0).toUpperCase() + category.slice(1);
      toast(response.enabled ? `${label} category blocked.` : `${label} category unblocked.`);
    };

    refs.quickBlockSocial.addEventListener("click", () => toggleQuickCategory("social"));
    refs.quickBlockShopping.addEventListener("click", () => toggleQuickCategory("shopping"));
    refs.quickBlockEntertainment.addEventListener("click", () => toggleQuickCategory("entertainment"));
    refs.quickBlockAdult.addEventListener("click", () => toggleQuickCategory("adult"));

    refs.addCurrentSite.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:add-blocked-domain", host: state.currentHost });
      if (!response.ok) {
        toast(`Failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(`Blocked ${state.currentHost}`);
    });

    refs.removeCurrentSite.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:remove-blocked-domain", host: state.currentHost });
      if (!response.ok) {
        toast(`Failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(response.removed ? `Unblocked ${state.currentHost}` : `${state.currentHost} was not in blocked list`);
    });

    refs.toggleWhitelistSite.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:toggle-blocker-whitelist-site", host: state.currentHost });
      if (!response.ok) {
        toast(`Whitelist update failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(response.whitelisted ? `Whitelisted ${state.currentHost}` : `Removed ${state.currentHost} from whitelist`);
    });

    refs.toggleCosmeticSite.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:toggle-cosmetic-site-disable", host: state.currentHost });
      if (!response.ok) {
        toast(`Cosmetic site toggle failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(response.disabled ? "Cosmetic filtering disabled for this site." : "Cosmetic filtering enabled for this site.");
    });

    refs.blockElementPicker.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:block-element-picker" });
      if (!response.ok) {
        if (response.error !== "cancelled") toast(`Block element failed: ${response.error || "unknown"}`);
        return;
      }
      if (response.selector) {
        toast(`Blocked selector: ${response.selector}`);
      } else {
        toast("Element picker active.");
      }
    });

    refs.refreshBlockLists.addEventListener("click", async () => {
      refs.refreshBlockLists.disabled = true;
      refs.refreshBlockLists.textContent = "Refreshing...";
      const response = await sendMessage({ type: "holmeta:refresh-blocker-lists" });
      refs.refreshBlockLists.disabled = false;
      refs.refreshBlockLists.textContent = "Refresh Lists";
      if (!response.ok) {
        toast(`Refresh failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Filter lists refreshed.");
    });

    refs.pauseBlocker.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:pause-blocker", minutes: 10 });
      if (!response.ok) {
        toast(`Pause failed: ${response.error || "unknown"}`);
        return;
      }
      toast("Blocker paused for 10 minutes.");
    });

    refs.editBlocker.addEventListener("click", () => chrome.runtime.openOptionsPage());

    refs.secureTunnelEnabled.addEventListener("change", async (event) => {
      const response = await sendMessage({
        type: "holmeta:secure-tunnel-toggle",
        enabled: event.target.checked
      });
      if (!response.ok) {
        toast(`Secure Tunnel failed: ${response.error || "unknown"}`);
        event.target.checked = !event.target.checked;
        return;
      }
      state.app = response.state;
      render();
      toast(event.target.checked ? "Secure Tunnel connected." : "Secure Tunnel disconnected.");
    });

    refs.secureTunnelMode.addEventListener("change", (event) => {
      queuePatch({
        secureTunnel: {
          mode: String(event.target.value || "preset")
        }
      });
    });

    refs.secureTunnelPreset.addEventListener("change", (event) => {
      queuePatch({
        secureTunnel: {
          selectedPresetId: String(event.target.value || "fastest")
        }
      });
    });

    refs.secureTunnelCustomScheme.addEventListener("change", (event) => {
      queuePatch({ secureTunnel: { custom: { scheme: String(event.target.value || "http") } } });
    });
    refs.secureTunnelCustomHost.addEventListener("change", (event) => {
      queuePatch({ secureTunnel: { custom: { host: String(event.target.value || "") } } });
    });
    refs.secureTunnelCustomPort.addEventListener("change", (event) => {
      queuePatch({ secureTunnel: { custom: { port: Number(event.target.value || 8080) } } });
    });
    refs.secureTunnelCustomUser.addEventListener("change", (event) => {
      queuePatch({ secureTunnel: { custom: { username: String(event.target.value || "") } } });
    });
    refs.secureTunnelCustomPass.addEventListener("change", (event) => {
      queuePatch({ secureTunnel: { custom: { password: String(event.target.value || "") } } });
    });

    refs.secureTunnelSaveConnect.addEventListener("click", async () => {
      const payload = secureTunnelPayloadFromUI();
      refs.secureTunnelSaveConnect.disabled = true;
      refs.secureTunnelSaveConnect.textContent = "Connecting...";
      const response = await sendMessage({
        type: "holmeta:secure-tunnel-connect",
        mode: payload.mode,
        presetId: payload.presetId,
        custom: payload.custom
      });
      refs.secureTunnelSaveConnect.disabled = false;
      refs.secureTunnelSaveConnect.textContent = "Save & Connect";
      if (!response.ok) {
        toast(`Connect failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Secure Tunnel connected.");
    });

    refs.secureTunnelDisconnect.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:secure-tunnel-disconnect" });
      if (!response.ok) {
        toast(`Disconnect failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Secure Tunnel disconnected.");
    });

    refs.alertsEnabled.addEventListener("change", (e) => queuePatch({ alerts: { enabled: e.target.checked } }));
    refs.alertFrequency.addEventListener("change", (e) => queuePatch({ alerts: { frequencyMin: Number(e.target.value || 45) } }));
    refs.alertCadence.addEventListener("change", (e) => queuePatch({ alerts: { cadenceMode: String(e.target.value || "focus_weighted") } }));
    refs.alertTypeEye.addEventListener("change", (e) => queuePatch({ alerts: { types: { eye: e.target.checked } } }));
    refs.alertTypePosture.addEventListener("change", (e) => queuePatch({ alerts: { types: { posture: e.target.checked } } }));
    refs.alertTypeBurnout.addEventListener("change", (e) => queuePatch({ alerts: { types: { burnout: e.target.checked } } }));
    refs.alertTypeHydration.addEventListener("change", (e) => queuePatch({ alerts: { types: { hydration: e.target.checked } } }));
    refs.alertTypeBlink.addEventListener("change", (e) => queuePatch({ alerts: { types: { blink: e.target.checked } } }));
    refs.alertTypeMovement.addEventListener("change", (e) => queuePatch({ alerts: { types: { movement: e.target.checked } } }));
    refs.alertSound.addEventListener("change", (e) => queuePatch({ alerts: { soundEnabled: e.target.checked } }));
    refs.alertSoundVolume.addEventListener("input", (e) => {
      const value = Math.max(5, Math.min(100, Number(e.target.value || 35)));
      refs.alertSoundVolumeValue.textContent = `${value}%`;
      queuePatch({ alerts: { soundVolume: value } });
    });
    refs.alertSoundPattern.addEventListener("change", (e) => queuePatch({ alerts: { soundPattern: String(e.target.value || "double") } }));
    refs.alertToastEnabled.addEventListener("change", (e) => queuePatch({ alerts: { toastEnabled: e.target.checked } }));
    refs.alertNotificationEnabled.addEventListener("change", (e) => queuePatch({ alerts: { notificationEnabled: e.target.checked } }));
    refs.alertQuietHoursEnabled.addEventListener("change", (e) => queuePatch({ alerts: { quietHours: { enabled: e.target.checked } } }));
    refs.alertQuietStart.addEventListener("change", (e) => queuePatch({ alerts: { quietHours: { start: e.target.value || "22:30" } } }));
    refs.alertQuietEnd.addEventListener("change", (e) => queuePatch({ alerts: { quietHours: { end: e.target.value || "06:30" } } }));
    refs.alertSnoozeMinutes.addEventListener("change", (e) => queuePatch({ alerts: { snoozeMinutes: Number(e.target.value || 10) } }));
    refs.alertCooldown.addEventListener("change", (e) => queuePatch({ alerts: { cooldownMin: Number(e.target.value || 0) } }));
    refs.alertBurnoutThreshold.addEventListener("change", (e) => queuePatch({ alerts: { burnoutFocusThresholdMin: Number(e.target.value || 90) } }));
    refs.alertTestType.addEventListener("change", (e) => {
      state.alertTestType = String(e.target.value || "eye");
    });

    refs.testAlert.addEventListener("click", async () => {
      const kind = String(state.alertTestType || refs.alertTestType.value || "eye");
      const response = await sendMessage({ type: "holmeta:test-alert", kind });
      if (!response.ok) {
        const reason = String(response.reason || response.error || "unknown");
        toast(`Test failed: ${reason}`);
        return;
      }
      const delivery = response.delivery || {};
      const channels = [
        delivery.notification ? "system" : null,
        delivery.toast ? "on-page" : null,
        delivery.sound ? `sound (${delivery.soundChannel || "unknown"})` : null
      ].filter(Boolean);
      if (!channels.length) {
        toast("Test alert ran, but no output channels were reachable on this page.");
        return;
      }
      toast(`Test alert delivered (${kind}) via ${channels.join(", ")}.`);
    });

    refs.snoozeAlertsNow.addEventListener("click", async () => {
      const minutes = Number(state.app?.settings?.alerts?.snoozeMinutes || refs.alertSnoozeMinutes.value || 10);
      const response = await sendMessage({ type: "holmeta:snooze-alerts", minutes });
      if (!response.ok) {
        toast(`Snooze failed: ${response.error || "unknown"}`);
        return;
      }
      state.app.settings.alerts.snoozeUntil = Number(response.snoozeUntil || 0);
      renderAlerts();
      toast(`Alerts snoozed for ${minutes} minutes.`);
    });

    refs.siteInsightEnabled.addEventListener("change", (e) => {
      queuePatch({ siteInsight: { enabled: e.target.checked } });
    });

    refs.siteInsightProfile.addEventListener("change", (e) => {
      queuePatch({ siteInsight: { selectedProfile: String(e.target.value || "regular") } });
    });

    refs.siteInsightDuration.addEventListener("change", (e) => {
      const durationMs = Math.max(6000, Math.min(10000, Number(e.target.value || 8000)));
      queuePatch({ siteInsight: { durationMs } });
    });

    refs.siteInsightAutoMinimize.addEventListener("change", (e) => {
      queuePatch({ siteInsight: { autoMinimize: e.target.checked } });
    });

    refs.siteInsightPill.addEventListener("change", (e) => {
      queuePatch({ siteInsight: { minimizedPill: e.target.checked } });
    });

    refs.siteInsightDisableSite.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const disabled = Boolean(state.app.settings.siteInsight?.perSiteDisabled?.[state.currentHost]);
      const response = await sendMessage({
        type: disabled ? "holmeta:enable-site-insight-host" : "holmeta:disable-site-insight-host",
        host: state.currentHost
      });
      if (!response.ok) {
        toast(`Site Insight update failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(disabled ? "Site Insight enabled on this site." : "Site Insight disabled on this site.");
    });

    refs.siteInsightOpenSettings.addEventListener("click", () => chrome.runtime.openOptionsPage());

    refs.startDeepWork.addEventListener("click", async () => {
      const [focusMin, breakMin] = String(refs.pomodoroPreset.value || "25:5").split(":").map((n) => Number(n));
      const response = await sendMessage({ type: "holmeta:start-deep-work", focusMin, breakMin });
      if (!response.ok) {
        toast(`Start failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Deep Work activated.");
    });

    refs.stopDeepWork.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:stop-deep-work" });
      if (!response.ok) {
        toast(`Stop failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Deep Work stopped.");
    });

    refs.biofeedbackEnabled.addEventListener("change", (e) => handleBiofeedbackToggle(e.target.checked));

    refs.morphingEnabled.addEventListener("change", (e) => {
      if (!state.app.license.premium) {
        e.target.checked = false;
        toast("Premium feature – upgrade at holmeta.com");
        return;
      }
      queuePatch({ advanced: { morphing: e.target.checked } });
    });

    refs.taskWeaver.addEventListener("click", async () => {
      if (!state.app.license.premium) {
        toast("Premium feature – upgrade at holmeta.com");
        return;
      }
      refs.taskWeaver.disabled = true;
      refs.taskWeaver.textContent = "Weaving...";
      const response = await sendMessage({ type: "holmeta:task-weaver" });
      refs.taskWeaver.disabled = false;
      refs.taskWeaver.textContent = "Weave Now";
      if (!response.ok) {
        toast(`Weaver failed: ${response.error || "unknown"}`);
        return;
      }
      renderWeaver(response.results || []);
      toast("Protocol suggestions ready.");
    });

    refs.collabSync.addEventListener("click", () => {
      toast("Collaborative Focus Sync is a premium roadmap feature in this local-first build.");
    });

    refs.upgradePremium.addEventListener("click", openUpgrade);
    refs.openWebsite.addEventListener("click", () => openExternal(WEBSITE_URL));
    refs.openDashboard.addEventListener("click", () => openExternal(DASHBOARD_URL));
    refs.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

    document.querySelectorAll(".hotkey").forEach((btn) => {
      btn.addEventListener("click", () => handleHotkeyButton(btn.dataset.command));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !refs.onboarding.hidden) {
        completeOnboarding();
      }
    });
  }

  function startOnboarding() {
    state.onboardingStep = 0;
    refs.onboarding.hidden = false;
    renderOnboarding();
  }

  function renderOnboarding() {
    const step = onboardingSteps[state.onboardingStep];
    refs.onboardingTitle.textContent = step.title;
    refs.onboardingBody.textContent = step.body;
    refs.onboardBack.disabled = state.onboardingStep === 0;
    refs.onboardNext.textContent = state.onboardingStep === onboardingSteps.length - 1 ? "Finish" : "Next";
  }

  async function completeOnboarding() {
    const result = {
      ok: true,
      persisted: false,
      navigated: false
    };

    state.app = state.app || {};
    state.app.meta = { ...(state.app.meta || {}), onboarded: true };

    try {
      await chrome.storage.local.set({ [ONBOARDING_COMPLETED_KEY]: true });
      result.persisted = true;
    } catch (error) {
      log("error", "write_onboarding_chrome_failed", error);
      result.ok = false;
    }

    try {
      localStorage.setItem("holmeta_onboarding_completed", "true");
      result.persisted = true;
    } catch (error) {
      log("error", "write_onboarding_local_failed", error);
      result.ok = false;
    }

    try {
      const response = await sendMessage({ type: "holmeta:set-onboarded" });
      if (response.ok) {
        state.app = response.state;
      } else {
        result.ok = false;
      }
    } catch (error) {
      log("error", "write_onboarding_runtime_failed", error);
      result.ok = false;
    }

    refs.onboarding.hidden = true;

    try {
      window.location.hash = "command-center";
      refs.lightEnabled?.focus({ preventScroll: true });
      result.navigated = true;
    } catch (error) {
      log("error", "onboarding_navigation_failed", error);
      result.ok = false;
    }

    render();
    setStatus(result.ok ? "Onboarding complete" : "Onboarding saved (fallback)");
    return result;
  }

  function bindOnboardingEvents() {
    refs.onboardBack.addEventListener("click", () => {
      state.onboardingStep = Math.max(0, state.onboardingStep - 1);
      renderOnboarding();
    });

    refs.onboardNext.addEventListener("click", async () => {
      if (state.onboardingStep >= onboardingSteps.length - 1) {
        refs.onboardNext.disabled = true;
        refs.onboardNext.textContent = "Finishing...";
        await completeOnboarding();
        refs.onboardNext.disabled = false;
        refs.onboardNext.textContent = "Finish";
        return;
      }
      state.onboardingStep += 1;
      renderOnboarding();
    });

    refs.onboardSkip.addEventListener("click", completeOnboarding);
  }

  async function boot() {
    bindEvents();
    bindOnboardingEvents();
    await hydrate();

    setInterval(() => {
      if (!state.app?.settings?.deepWork?.active) return;
      renderDeepWork();
    }, 20000);
  }

  window.addEventListener("unload", () => {
    if (state.tunnelTimerHandle) {
      clearInterval(state.tunnelTimerHandle);
      state.tunnelTimerHandle = null;
    }
  });

  boot().catch((error) => {
    log("error", "boot_failed", error);
    setStatus("Popup failed to initialize", true);
  });
})();
