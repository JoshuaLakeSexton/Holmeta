// HOLMETA v3.0 popup controller
// Stable input pattern: hydrate once, local state editing, debounced writes.

(() => {
  const SAVE_DEBOUNCE_MS = 380;
  const ONBOARDING_COMPLETED_KEY = "onboardingCompleted";
  const UPGRADE_URL = "https://www.holmeta.com/pricing";
  const WEBSITE_URL = "https://holmeta.com";
  const DASHBOARD_URL = "https://holmeta.com/dashboard";
  const BILLING_URL = "https://holmeta.com/pricing";
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
    pageInsight: null,
    eyeDraftHex: "#FFB300",
    favoriteDraftUrl: "",
    screenshotRunning: false,
    translateInputDraft: "",
    translateOutputDraft: "",
    translateLastEntry: null,
    popupOrderApplied: false,
    dashboard: null,
    dashboardClockTimer: null,
    dashboardPomoTimer: null,
    dashboardWeatherRequested: false,
    weaverResults: [],
    vault: {
      ready: false,
      hasVault: false,
      unlocked: false,
      busy: false,
      masterPassword: "",
      activeTab: "passwords",
      search: "",
      revealMap: {},
      credentials: [],
      notes: [],
      prompts: [],
      generator: {
        length: 20,
        upper: true,
        lower: true,
        number: true,
        symbol: true,
        result: ""
      },
      editingCredentialIndex: null,
      editingTextIndex: null,
      editingTextType: "note"
    }
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

  const DASHBOARD_STORAGE_KEYS = {
    clocks: "holmeta-dashboard-clocks",
    tasks: "holmeta-dashboard-tasks",
    workStart: "holmeta-dashboard-work-start",
    workEnd: "holmeta-dashboard-work-end"
  };

  const VAULT_STORAGE_KEYS = {
    ciphertext: "holmeta-vault-ciphertext-v1",
    verify: "holmeta-vault-verify-v1"
  };

  const DASHBOARD_CITIES = [
    { name: "New York", tz: "America/New_York", code: "NYC" },
    { name: "Los Angeles", tz: "America/Los_Angeles", code: "LAX" },
    { name: "Chicago", tz: "America/Chicago", code: "CHI" },
    { name: "Toronto", tz: "America/Toronto", code: "YYZ" },
    { name: "London", tz: "Europe/London", code: "LON" },
    { name: "Paris", tz: "Europe/Paris", code: "CDG" },
    { name: "Berlin", tz: "Europe/Berlin", code: "BER" },
    { name: "Madrid", tz: "Europe/Madrid", code: "MAD" },
    { name: "Rome", tz: "Europe/Rome", code: "FCO" },
    { name: "Dubai", tz: "Asia/Dubai", code: "DXB" },
    { name: "Mumbai", tz: "Asia/Kolkata", code: "BOM" },
    { name: "Singapore", tz: "Asia/Singapore", code: "SIN" },
    { name: "Hong Kong", tz: "Asia/Hong_Kong", code: "HKG" },
    { name: "Shanghai", tz: "Asia/Shanghai", code: "PVG" },
    { name: "Seoul", tz: "Asia/Seoul", code: "ICN" },
    { name: "Tokyo", tz: "Asia/Tokyo", code: "TYO" },
    { name: "Sydney", tz: "Australia/Sydney", code: "SYD" },
    { name: "Auckland", tz: "Pacific/Auckland", code: "AKL" }
  ];

  const refs = {
    modeBadge: document.getElementById("modeBadge"),
    saveState: document.getElementById("saveState"),
    toastHost: document.getElementById("toastHost"),
    dashboardPanel: document.getElementById("dashboardPanel"),
    dashboardHours: document.getElementById("dashboardHours"),
    dashboardMinutes: document.getElementById("dashboardMinutes"),
    dashboardSeconds: document.getElementById("dashboardSeconds"),
    dashboardDate: document.getElementById("dashboardDate"),
    dashboardWorkStart: document.getElementById("dashboardWorkStart"),
    dashboardWorkEnd: document.getElementById("dashboardWorkEnd"),
    dashboardWorkFill: document.getElementById("dashboardWorkFill"),
    dashboardWorkMeta: document.getElementById("dashboardWorkMeta"),
    dashboardClocks: document.getElementById("dashboardClocks"),
    dashboardAddClock: document.getElementById("dashboardAddClock"),
    dashboardWeatherRefresh: document.getElementById("dashboardWeatherRefresh"),
    dashboardWeatherSummary: document.getElementById("dashboardWeatherSummary"),
    dashboardWeatherStats: document.getElementById("dashboardWeatherStats"),
    dashboardWeatherTemp: document.getElementById("dashboardWeatherTemp"),
    dashboardWeatherCond: document.getElementById("dashboardWeatherCond"),
    dashboardWeatherWind: document.getElementById("dashboardWeatherWind"),
    dashboardTaskProgress: document.getElementById("dashboardTaskProgress"),
    dashboardTaskList: document.getElementById("dashboardTaskList"),
    dashboardTaskPriority: document.getElementById("dashboardTaskPriority"),
    dashboardTaskInput: document.getElementById("dashboardTaskInput"),
    dashboardTaskAdd: document.getElementById("dashboardTaskAdd"),
    dashboardPomoTime: document.getElementById("dashboardPomoTime"),
    dashboardPomoPhase: document.getElementById("dashboardPomoPhase"),
    dashboardPomoStart: document.getElementById("dashboardPomoStart"),
    dashboardPomoPause: document.getElementById("dashboardPomoPause"),
    dashboardPomoReset: document.getElementById("dashboardPomoReset"),
    dashboardCityModal: document.getElementById("dashboardCityModal"),
    dashboardCitySearch: document.getElementById("dashboardCitySearch"),
    dashboardCitySuggestions: document.getElementById("dashboardCitySuggestions"),
    dashboardCityClose: document.getElementById("dashboardCityClose"),
    vaultStateBadge: document.getElementById("vaultStateBadge"),
    vaultLockView: document.getElementById("vaultLockView"),
    vaultAppView: document.getElementById("vaultAppView"),
    vaultLockHint: document.getElementById("vaultLockHint"),
    vaultMasterPassword: document.getElementById("vaultMasterPassword"),
    vaultUnlockButton: document.getElementById("vaultUnlockButton"),
    vaultResetButton: document.getElementById("vaultResetButton"),
    vaultSummaryText: document.getElementById("vaultSummaryText"),
    vaultPrimaryAction: document.getElementById("vaultPrimaryAction"),
    vaultLockButton: document.getElementById("vaultLockButton"),
    vaultTabPasswords: document.getElementById("vaultTabPasswords"),
    vaultTabNotes: document.getElementById("vaultTabNotes"),
    vaultTabPrompts: document.getElementById("vaultTabPrompts"),
    vaultTabGenerator: document.getElementById("vaultTabGenerator"),
    vaultCountPasswords: document.getElementById("vaultCountPasswords"),
    vaultCountNotes: document.getElementById("vaultCountNotes"),
    vaultCountPrompts: document.getElementById("vaultCountPrompts"),
    vaultToolbar: document.getElementById("vaultToolbar"),
    vaultSearchInput: document.getElementById("vaultSearchInput"),
    vaultContent: document.getElementById("vaultContent"),
    vaultCredentialModal: document.getElementById("vaultCredentialModal"),
    vaultCredentialModalTitle: document.getElementById("vaultCredentialModalTitle"),
    vaultCredentialModalClose: document.getElementById("vaultCredentialModalClose"),
    vaultCredentialSite: document.getElementById("vaultCredentialSite"),
    vaultCredentialIcon: document.getElementById("vaultCredentialIcon"),
    vaultCredentialUser: document.getElementById("vaultCredentialUser"),
    vaultCredentialPass: document.getElementById("vaultCredentialPass"),
    vaultCredentialReveal: document.getElementById("vaultCredentialReveal"),
    vaultCredentialGenerate: document.getElementById("vaultCredentialGenerate"),
    vaultCredentialUrl: document.getElementById("vaultCredentialUrl"),
    vaultCredentialTag: document.getElementById("vaultCredentialTag"),
    vaultCredentialNotes: document.getElementById("vaultCredentialNotes"),
    vaultCredentialStrength0: document.getElementById("vaultCredentialStrength0"),
    vaultCredentialStrength1: document.getElementById("vaultCredentialStrength1"),
    vaultCredentialStrength2: document.getElementById("vaultCredentialStrength2"),
    vaultCredentialStrength3: document.getElementById("vaultCredentialStrength3"),
    vaultCredentialStrengthLabel: document.getElementById("vaultCredentialStrengthLabel"),
    vaultCredentialCancel: document.getElementById("vaultCredentialCancel"),
    vaultCredentialSave: document.getElementById("vaultCredentialSave"),
    vaultTextModal: document.getElementById("vaultTextModal"),
    vaultTextModalTitle: document.getElementById("vaultTextModalTitle"),
    vaultTextModalClose: document.getElementById("vaultTextModalClose"),
    vaultTextTitle: document.getElementById("vaultTextTitle"),
    vaultTextType: document.getElementById("vaultTextType"),
    vaultTextBody: document.getElementById("vaultTextBody"),
    vaultTextTags: document.getElementById("vaultTextTags"),
    vaultTextCancel: document.getElementById("vaultTextCancel"),
    vaultTextSave: document.getElementById("vaultTextSave"),
    accessLockPanel: document.getElementById("accessLockPanel"),
    accessStateBadge: document.getElementById("accessStateBadge"),
    accessLockMessage: document.getElementById("accessLockMessage"),
    accessLockTiming: document.getElementById("accessLockTiming"),
    accessStartTrial: document.getElementById("accessStartTrial"),
    accessManageBilling: document.getElementById("accessManageBilling"),
    accessRefresh: document.getElementById("accessRefresh"),
    accessEnterLicense: document.getElementById("accessEnterLicense"),

    lightEnabled: document.getElementById("lightEnabled"),
    lightPresetComfort: document.getElementById("lightPresetComfort"),
    lightPresetDeepNight: document.getElementById("lightPresetDeepNight"),
    lightPresetInfrared: document.getElementById("lightPresetInfrared"),
    lightPresetRedLock: document.getElementById("lightPresetRedLock"),
    lightFilterModeChip: document.getElementById("lightFilterModeChip"),
    lightFilterSpectrumChip: document.getElementById("lightFilterSpectrumChip"),
    lightFilterIntensityChip: document.getElementById("lightFilterIntensityChip"),
    lightFilterStrengthFill: document.getElementById("lightFilterStrengthFill"),
    lightFilterSummary: document.getElementById("lightFilterSummary"),
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
    readingThemeDarkVariantRow: document.getElementById("readingThemeDarkVariantRow"),
    readingThemeLightVariantRow: document.getElementById("readingThemeLightVariantRow"),
    readingThemeDarkVariant: document.getElementById("readingThemeDarkVariant"),
    readingThemeLightVariant: document.getElementById("readingThemeLightVariant"),
    readingThemeOpaqueBackground: document.getElementById("readingThemeOpaqueBackground"),
    readingThemePointerCursors: document.getElementById("readingThemePointerCursors"),
    readingThemeSansSize: document.getElementById("readingThemeSansSize"),
    readingThemeSansFamily: document.getElementById("readingThemeSansFamily"),
    readingThemeCodeSize: document.getElementById("readingThemeCodeSize"),
    readingThemeCodeFamily: document.getElementById("readingThemeCodeFamily"),
    readingThemeScheduleMode: document.getElementById("readingThemeScheduleMode"),
    readingThemeScheduleStart: document.getElementById("readingThemeScheduleStart"),
    readingThemeScheduleEnd: document.getElementById("readingThemeScheduleEnd"),
    readingThemeExcludeSite: document.getElementById("readingThemeExcludeSite"),
    readingThemePreserveImages: document.getElementById("readingThemePreserveImages"),
    readingThemePreserveLogos: document.getElementById("readingThemePreserveLogos"),
    readingThemeHigherContrast: document.getElementById("readingThemeHigherContrast"),
    readingThemeSofterSurfaces: document.getElementById("readingThemeSofterSurfaces"),
    readingThemeStatus: document.getElementById("readingThemeStatus"),
    readingThemeShowWidget: document.getElementById("readingThemeShowWidget"),
    readingThemeHideWidget: document.getElementById("readingThemeHideWidget"),
    toggleStateLabel: document.getElementById("toggleStateLabel"),
    appearanceModeText: document.getElementById("appearanceModeText"),
    appearanceModeSub: document.getElementById("appearanceModeSub"),
    readingThemeStatTime: document.getElementById("readingThemeStatTime"),
    readingThemeStatSunrise: document.getElementById("readingThemeStatSunrise"),
    readingThemeStatSunset: document.getElementById("readingThemeStatSunset"),

    lightThisSiteEnabled: document.getElementById("lightThisSiteEnabled"),
    lightExcludeSite: document.getElementById("lightExcludeSite"),

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

    translateEnabled: document.getElementById("translateEnabled"),
    translateSourceLang: document.getElementById("translateSourceLang"),
    translateTargetLang: document.getElementById("translateTargetLang"),
    translateInput: document.getElementById("translateInput"),
    translateOutput: document.getElementById("translateOutput"),
    translateInputRun: document.getElementById("translateInputRun"),
    translateSelectionRun: document.getElementById("translateSelectionRun"),
    translatePageRun: document.getElementById("translatePageRun"),
    translateSectionRun: document.getElementById("translateSectionRun"),
    translateVisibleRun: document.getElementById("translateVisibleRun"),
    translateOverlayRun: document.getElementById("translateOverlayRun"),
    translateRestoreRun: document.getElementById("translateRestoreRun"),
    translateSaveLast: document.getElementById("translateSaveLast"),
    translateChipEnabled: document.getElementById("translateChipEnabled"),
    translateHistoryEnabled: document.getElementById("translateHistoryEnabled"),
    translatePreserveCode: document.getElementById("translatePreserveCode"),
    translateShowOriginalHover: document.getElementById("translateShowOriginalHover"),
    translateSideBySide: document.getElementById("translateSideBySide"),
    translateProvider: document.getElementById("translateProvider"),
    translateSiteDisable: document.getElementById("translateSiteDisable"),
    translateSiteAutoChip: document.getElementById("translateSiteAutoChip"),
    translateSiteAutoArticle: document.getElementById("translateSiteAutoArticle"),
    translateStatus: document.getElementById("translateStatus"),
    translateHistoryList: document.getElementById("translateHistoryList"),
    translateSavedList: document.getElementById("translateSavedList"),
    translateClearHistory: document.getElementById("translateClearHistory"),
    translateClearSaved: document.getElementById("translateClearSaved"),

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

    alertsEnabled: document.getElementById("alertsEnabled"),
    alertFrequency: document.getElementById("alertFrequency"),
    alertCadence: document.getElementById("alertCadence"),
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
    alertSnoozeMinutes: document.getElementById("alertSnoozeMinutes"),
    alertCooldown: document.getElementById("alertCooldown"),
    alertBurnoutThreshold: document.getElementById("alertBurnoutThreshold"),
    testAlert: document.getElementById("testAlert"),
    snoozeAlertsNow: document.getElementById("snoozeAlertsNow"),
    alertPreviewSummary: document.getElementById("alertPreviewSummary"),
    alertStatus: document.getElementById("alertStatus"),
    alertChannelSound: document.getElementById("alertChannelSound"),
    alertChannelToast: document.getElementById("alertChannelToast"),
    alertChannelNotification: document.getElementById("alertChannelNotification"),

    meditationEnabled: document.getElementById("meditationEnabled"),
    meditationLength: document.getElementById("meditationLength"),
    meditationAmbient: document.getElementById("meditationAmbient"),
    meditationVolume: document.getElementById("meditationVolume"),
    meditationVolumeValue: document.getElementById("meditationVolumeValue"),
    meditationPreviewSummary: document.getElementById("meditationPreviewSummary"),
    meditationPreview: document.getElementById("meditationPreview"),
    meditationStart: document.getElementById("meditationStart"),
    meditationStop: document.getElementById("meditationStop"),
    meditationStatus: document.getElementById("meditationStatus"),

    siteInsightEnabled: document.getElementById("siteInsightEnabled"),
    siteInsightAnalyze: document.getElementById("siteInsightAnalyze"),
    siteInsightCopy: document.getElementById("siteInsightCopy"),
    siteInsightSummary: document.getElementById("siteInsightSummary"),
    siteInsightHostChip: document.getElementById("siteInsightHostChip"),
    siteInsightPageType: document.getElementById("siteInsightPageType"),
    siteInsightAppears: document.getElementById("siteInsightAppears"),
    siteInsightSignals: document.getElementById("siteInsightSignals"),
    siteInsightSecurityBlock: document.getElementById("siteInsightSecurityBlock"),
    siteInsightSecurity: document.getElementById("siteInsightSecurity"),
    siteInsightEssentials: document.getElementById("siteInsightEssentials"),
    siteInsightStatus: document.getElementById("siteInsightStatus"),

    pomodoroPreset: document.getElementById("pomodoroPreset"),
    startDeepWork: document.getElementById("startDeepWork"),
    stopDeepWork: document.getElementById("stopDeepWork"),
    deepWorkHeadline: document.getElementById("deepWorkHeadline"),
    deepWorkSubline: document.getElementById("deepWorkSubline"),
    deepWorkCountdown: document.getElementById("deepWorkCountdown"),
    deepWorkPhaseBadge: document.getElementById("deepWorkPhaseBadge"),
    deepWorkCycleValue: document.getElementById("deepWorkCycleValue"),
    deepWorkTodayMinutes: document.getElementById("deepWorkTodayMinutes"),
    deepWorkTodaySessions: document.getElementById("deepWorkTodaySessions"),
    deepWorkAutomationState: document.getElementById("deepWorkAutomationState"),
    deepWorkAutoBlocker: document.getElementById("deepWorkAutoBlocker"),
    deepWorkAutoLight: document.getElementById("deepWorkAutoLight"),
    deepWorkStatus: document.getElementById("deepWorkStatus"),

    biofeedbackEnabled: document.getElementById("biofeedbackEnabled"),
    morphingEnabled: document.getElementById("morphingEnabled"),
    taskWeaverEnabled: document.getElementById("taskWeaverEnabled"),
    dashboardPredictionsEnabled: document.getElementById("dashboardPredictionsEnabled"),
    collabSyncEnabled: document.getElementById("collabSyncEnabled"),
    taskWeaver: document.getElementById("taskWeaver"),
    collabSync: document.getElementById("collabSync"),
    weaverResults: document.getElementById("weaverResults"),
    advancedLabStatus: document.getElementById("advancedLabStatus"),
    advancedLabPrediction: document.getElementById("advancedLabPrediction"),
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

  function readLocalJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeLocalJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // noop
    }
  }

  function readLocalString(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw && String(raw).trim() ? String(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeLocalString(key, value) {
    try {
      localStorage.setItem(key, String(value ?? ""));
    } catch {
      // noop
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toByteBase64(bytes) {
    const chunkSize = 0x8000;
    let binary = "";
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  function fromByteBase64(value) {
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function vaultStorageGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(err);
          return;
        }
        resolve(result || {});
      });
    });
  }

  function vaultStorageSet(payload) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(payload, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  function vaultStorageRemove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async function deriveVaultKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 260000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptVaultPayload(payload, password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveVaultKey(password, salt);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(JSON.stringify(payload))
    );
    const packed = new Uint8Array(44 + ciphertext.byteLength);
    packed.set(salt, 0);
    packed.set(iv, 32);
    packed.set(new Uint8Array(ciphertext), 44);
    return toByteBase64(packed);
  }

  async function decryptVaultPayload(payload, password) {
    const dec = new TextDecoder();
    const packed = fromByteBase64(payload);
    const salt = packed.slice(0, 32);
    const iv = packed.slice(32, 44);
    const ciphertext = packed.slice(44);
    const key = await deriveVaultKey(password, salt);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return JSON.parse(dec.decode(plain));
  }

  function normalizeVaultItems(list, kind) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item, index) => {
        if (kind === "credential") {
          const site = String(item?.site || "").trim().slice(0, 120);
          const user = String(item?.user || "").trim().slice(0, 160);
          const pass = String(item?.pass || "");
          if (!site || !user || !pass) return null;
          return {
            id: Number(item?.id || Date.now() + index),
            site,
            user,
            pass,
            icon: String(item?.icon || "🔐").slice(0, 4),
            url: String(item?.url || "").trim().slice(0, 240),
            tag: String(item?.tag || "").trim().slice(0, 48),
            notes: String(item?.notes || "").trim().slice(0, 2000),
            createdAt: String(item?.createdAt || item?.created || new Date().toISOString()),
            updatedAt: String(item?.updatedAt || item?.updated || new Date().toISOString())
          };
        }
        const title = String(item?.title || "").trim().slice(0, 140);
        const body = String(item?.body || "").trim().slice(0, 12000);
        if (!title || !body) return null;
        return {
          id: Number(item?.id || Date.now() + index),
          title,
          body,
          tags: String(item?.tags || "").trim().slice(0, 240),
          createdAt: String(item?.createdAt || item?.created || new Date().toISOString()),
          updatedAt: String(item?.updatedAt || item?.updated || new Date().toISOString())
        };
      })
      .filter(Boolean);
  }

  function resetVaultSession(keepData = false) {
    state.vault.unlocked = false;
    state.vault.busy = false;
    state.vault.masterPassword = "";
    state.vault.revealMap = {};
    state.vault.search = "";
    state.vault.activeTab = "passwords";
    state.vault.generator.result = "";
    state.vault.editingCredentialIndex = null;
    state.vault.editingTextIndex = null;
    state.vault.editingTextType = "note";
    if (!keepData) {
      state.vault.credentials = [];
      state.vault.notes = [];
      state.vault.prompts = [];
    }
  }

  function vaultPayloadFromState() {
    return {
      credentials: state.vault.credentials,
      notes: state.vault.notes,
      prompts: state.vault.prompts
    };
  }

  async function persistVaultState() {
    if (!state.vault.masterPassword) return;
    const payload = vaultPayloadFromState();
    const ciphertext = await encryptVaultPayload(payload, state.vault.masterPassword);
    const verify = await encryptVaultPayload({ ok: true }, state.vault.masterPassword);
    await vaultStorageSet({
      [VAULT_STORAGE_KEYS.ciphertext]: ciphertext,
      [VAULT_STORAGE_KEYS.verify]: verify
    });
    state.vault.hasVault = true;
  }

  async function loadVaultMeta() {
    try {
      const stored = await vaultStorageGet([VAULT_STORAGE_KEYS.ciphertext]);
      state.vault.hasVault = Boolean(stored?.[VAULT_STORAGE_KEYS.ciphertext]);
    } catch (error) {
      log("error", "vault_meta_failed", error);
      state.vault.hasVault = false;
    } finally {
      state.vault.ready = true;
    }
    renderVault();
  }

  async function unlockVault(password) {
    const stored = await vaultStorageGet([VAULT_STORAGE_KEYS.ciphertext, VAULT_STORAGE_KEYS.verify]);
    const ciphertext = stored?.[VAULT_STORAGE_KEYS.ciphertext];
    const verify = stored?.[VAULT_STORAGE_KEYS.verify];
    if (!ciphertext) {
      state.vault.credentials = [];
      state.vault.notes = [];
      state.vault.prompts = [];
      state.vault.masterPassword = password;
      state.vault.hasVault = true;
      await persistVaultState();
      return true;
    }
    if (verify) {
      await decryptVaultPayload(verify, password);
    }
    const payload = await decryptVaultPayload(ciphertext, password);
    state.vault.credentials = normalizeVaultItems(payload?.credentials, "credential");
    state.vault.notes = normalizeVaultItems(payload?.notes, "note");
    state.vault.prompts = normalizeVaultItems(payload?.prompts, "prompt");
    state.vault.masterPassword = password;
    state.vault.hasVault = true;
    return true;
  }

  function vaultPasswordStrength(value) {
    const raw = String(value || "");
    if (!raw) return 0;
    let score = 0;
    if (raw.length >= 8) score += 1;
    if (raw.length >= 14) score += 1;
    if (/[a-z]/.test(raw) && /[A-Z]/.test(raw)) score += 1;
    if (/\d/.test(raw)) score += 1;
    if (/[^A-Za-z0-9]/.test(raw)) score += 1;
    return Math.max(0, Math.min(4, Math.round(score * 0.8)));
  }

  function renderVaultStrength(value, bars, labelRef) {
    const score = vaultPasswordStrength(value);
    const labels = ["", "Weak", "Fair", "Good", "Strong"];
    bars.forEach((bar, index) => {
      if (!bar) return;
      bar.className = "vault-strength-bar";
      if (index < score) {
        bar.classList.add(`is-active-${score}`);
      }
    });
    if (labelRef) {
      labelRef.textContent = score ? `Strength: ${labels[score]}` : "Strength";
    }
  }

  function generateVaultPassword() {
    const generator = state.vault.generator;
    const pools = [];
    if (generator.upper) pools.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    if (generator.lower) pools.push("abcdefghijklmnopqrstuvwxyz");
    if (generator.number) pools.push("0123456789");
    if (generator.symbol) pools.push("!@#$%^&*()-_=+[]{};:,.?/|");
    if (!pools.length) return "";
    const chars = pools.join("");
    const bytes = crypto.getRandomValues(new Uint8Array(generator.length));
    return Array.from(bytes, (value) => chars[value % chars.length]).join("");
  }

  function formatVaultDate(value) {
    try {
      return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Recent";
    }
  }

  function closeVaultModal(ref) {
    if (ref) ref.hidden = true;
  }

  function openVaultModal(ref) {
    if (ref) ref.hidden = false;
  }

  function setVaultBusy(nextBusy) {
    state.vault.busy = Boolean(nextBusy);
    if (refs.vaultUnlockButton) refs.vaultUnlockButton.disabled = Boolean(nextBusy);
  }

  function updateVaultPrimaryActionLabel() {
    if (!refs.vaultPrimaryAction) return;
    const labelMap = {
      passwords: "Add Credential",
      notes: "Add Note",
      prompts: "Add Prompt",
      generator: "Use Generator"
    };
    refs.vaultPrimaryAction.textContent = labelMap[state.vault.activeTab] || "Add";
  }

  function renderVaultGenerator() {
    const result = escapeHtml(state.vault.generator.result || "Generate a password to use it in new credentials.");
    return `
      <div class="vault-generator-shell">
        <div class="vault-generator-result">${result}</div>
        <div class="vault-generator-length">
          <span class="vault-card-label">Length</span>
          <input id="vaultGeneratorLength" type="range" min="8" max="64" step="1" value="${state.vault.generator.length}" />
          <span class="value">${state.vault.generator.length}</span>
        </div>
        <div class="vault-toggle-grid">
          <label class="switch"><input id="vaultGeneratorUpper" type="checkbox" ${state.vault.generator.upper ? "checked" : ""} /><span>Uppercase</span></label>
          <label class="switch"><input id="vaultGeneratorLower" type="checkbox" ${state.vault.generator.lower ? "checked" : ""} /><span>Lowercase</span></label>
          <label class="switch"><input id="vaultGeneratorNumber" type="checkbox" ${state.vault.generator.number ? "checked" : ""} /><span>Numbers</span></label>
          <label class="switch"><input id="vaultGeneratorSymbol" type="checkbox" ${state.vault.generator.symbol ? "checked" : ""} /><span>Symbols</span></label>
        </div>
        <div class="row actions-row">
          <button id="vaultGeneratorGenerate" class="primary" type="button">Generate</button>
          <button id="vaultGeneratorCopy" class="ghost" type="button">Copy</button>
        </div>
        <div class="row actions-row single-action-row">
          <button id="vaultGeneratorUse" class="secondary" type="button">Use in Credential</button>
        </div>
      </div>
    `;
  }

  function renderVaultList() {
    if (!refs.vaultContent) return;
    const tab = state.vault.activeTab;
    const query = state.vault.search.trim().toLowerCase();

    if (tab === "generator") {
      refs.vaultContent.innerHTML = renderVaultGenerator();
      return;
    }

    const records = (tab === "passwords" ? state.vault.credentials : tab === "notes" ? state.vault.notes : state.vault.prompts)
      .filter((record) => {
        if (!query) return true;
        const haystack = tab === "passwords"
          ? `${record.site} ${record.user} ${record.tag} ${record.notes}`
          : `${record.title} ${record.body} ${record.tags}`;
        return haystack.toLowerCase().includes(query);
      });

    if (!records.length) {
      const emptyCopy = tab === "passwords"
        ? "No credentials stored yet"
        : tab === "notes"
          ? "No secure notes yet"
          : "No saved prompts yet";
      refs.vaultContent.innerHTML = `<div class="vault-empty">${emptyCopy}</div>`;
      return;
    }

    refs.vaultContent.innerHTML = records
      .map((record) => {
        const source = tab === "passwords" ? state.vault.credentials : tab === "notes" ? state.vault.notes : state.vault.prompts;
        const index = source.findIndex((candidate) => candidate.id === record.id);
        if (tab === "passwords") {
          const revealed = Boolean(state.vault.revealMap[record.id]);
          const secret = revealed ? escapeHtml(record.pass) : "••••••••••••";
          const notesRow = record.notes
            ? `<div class="vault-card-row"><span class="vault-card-label">Notes</span><span class="vault-card-value">${escapeHtml(record.notes)}</span></div>`
            : "";
          const urlRow = record.url
            ? `<div class="vault-card-row"><span class="vault-card-label">URL</span><span class="vault-card-value">${escapeHtml(record.url)}</span></div>`
            : "";
          return `
            <div class="vault-card" data-vault-kind="credential" data-vault-index="${index}">
              <div class="vault-card-top">
                <span class="vault-card-icon">${escapeHtml(record.icon || "🔐")}</span>
                <div class="vault-card-copy">
                  <p class="vault-card-title">${escapeHtml(record.site)}</p>
                  <p class="vault-card-subtitle">${escapeHtml(record.user)}</p>
                </div>
                ${record.tag ? `<span class="vault-card-badge">${escapeHtml(record.tag)}</span>` : "<span></span>"}
              </div>
              <div class="vault-card-meta">
                <div class="vault-card-row"><span class="vault-card-label">User</span><span class="vault-card-value">${escapeHtml(record.user)}</span></div>
                <div class="vault-card-row"><span class="vault-card-label">Pass</span><span class="vault-card-value is-secret">${secret}</span></div>
                ${urlRow}
                ${notesRow}
              </div>
              <div class="vault-card-actions">
                <button class="ghost" type="button" data-vault-action="reveal" data-vault-index="${index}">${revealed ? "Hide" : "Reveal"}</button>
                <button class="ghost" type="button" data-vault-action="copy-pass" data-vault-index="${index}">Copy</button>
                <button class="secondary" type="button" data-vault-action="edit-credential" data-vault-index="${index}">Edit</button>
                <button class="danger" type="button" data-vault-action="delete-credential" data-vault-index="${index}">Delete</button>
              </div>
            </div>
          `;
        }

        return `
          <div class="vault-card" data-vault-kind="${tab === "notes" ? "note" : "prompt"}" data-vault-index="${index}">
            <div class="vault-card-top">
              <span class="vault-card-icon">${tab === "notes" ? "📝" : "💬"}</span>
              <div class="vault-card-copy">
                <p class="vault-card-title">${escapeHtml(record.title)}</p>
                <p class="vault-card-subtitle">${formatVaultDate(record.createdAt)}${record.tags ? ` · ${escapeHtml(record.tags)}` : ""}</p>
              </div>
              <span class="vault-card-badge">${tab === "notes" ? "NOTE" : "PROMPT"}</span>
            </div>
            <div class="vault-note-body">${escapeHtml(record.body)}</div>
            <div class="vault-card-actions">
              <button class="ghost" type="button" data-vault-action="copy-text" data-vault-kind="${tab}" data-vault-index="${index}">Copy</button>
              <button class="secondary" type="button" data-vault-action="edit-text" data-vault-kind="${tab}" data-vault-index="${index}">Edit</button>
              <button class="danger" type="button" data-vault-action="delete-text" data-vault-kind="${tab}" data-vault-index="${index}">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderVault() {
    if (!refs.vaultStateBadge || !refs.vaultLockView || !refs.vaultAppView) return;

    const badgeText = !state.vault.ready
      ? "CHECKING"
      : state.vault.unlocked
        ? "ENCRYPTED"
        : state.vault.hasVault
          ? "LOCKED"
          : "NEW";
    refs.vaultStateBadge.textContent = badgeText;
    refs.vaultStateBadge.classList.toggle("premium", state.vault.unlocked);

    refs.vaultLockView.hidden = state.vault.unlocked;
    refs.vaultAppView.hidden = !state.vault.unlocked;

    if (refs.vaultLockHint) {
      refs.vaultLockHint.textContent = state.vault.hasVault
        ? "Unlock your local vault with the master password you already set."
        : "Create a master password to begin storing credentials, notes, and prompts locally.";
    }
    if (refs.vaultUnlockButton) {
      refs.vaultUnlockButton.textContent = state.vault.hasVault ? "Unlock Vault" : "Create Vault";
    }
    if (refs.vaultResetButton) {
      refs.vaultResetButton.hidden = !state.vault.hasVault;
    }

    if (!state.vault.unlocked) {
      return;
    }

    if (refs.vaultSummaryText) {
      refs.vaultSummaryText.textContent = `${state.vault.credentials.length} credentials · ${state.vault.notes.length} notes · ${state.vault.prompts.length} prompts`;
    }
    if (refs.vaultCountPasswords) refs.vaultCountPasswords.textContent = String(state.vault.credentials.length);
    if (refs.vaultCountNotes) refs.vaultCountNotes.textContent = String(state.vault.notes.length);
    if (refs.vaultCountPrompts) refs.vaultCountPrompts.textContent = String(state.vault.prompts.length);

    [
      [refs.vaultTabPasswords, "passwords"],
      [refs.vaultTabNotes, "notes"],
      [refs.vaultTabPrompts, "prompts"],
      [refs.vaultTabGenerator, "generator"]
    ].forEach(([button, tab]) => {
      if (!button) return;
      const active = state.vault.activeTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    if (refs.vaultSearchInput) {
      refs.vaultSearchInput.hidden = state.vault.activeTab === "generator";
      refs.vaultSearchInput.placeholder = state.vault.activeTab === "passwords"
        ? "Search by site, username, tag, or note"
        : state.vault.activeTab === "notes"
          ? "Search secure notes"
          : "Search prompt library";
      if (document.activeElement !== refs.vaultSearchInput) {
        refs.vaultSearchInput.value = state.vault.search;
      }
    }

    updateVaultPrimaryActionLabel();
    renderVaultList();
  }

  function openCredentialEditor(index = null, prefilledPassword = "") {
    state.vault.editingCredentialIndex = Number.isInteger(index) ? index : null;
    const record = Number.isInteger(index) ? state.vault.credentials[index] : null;
    if (refs.vaultCredentialModalTitle) {
      refs.vaultCredentialModalTitle.textContent = record ? "Edit Credential" : "Add Credential";
    }
    if (refs.vaultCredentialSite) refs.vaultCredentialSite.value = record?.site || "";
    if (refs.vaultCredentialIcon) refs.vaultCredentialIcon.value = record?.icon || "";
    if (refs.vaultCredentialUser) refs.vaultCredentialUser.value = record?.user || "";
    if (refs.vaultCredentialPass) refs.vaultCredentialPass.value = record?.pass || prefilledPassword || "";
    if (refs.vaultCredentialPass) refs.vaultCredentialPass.type = "password";
    if (refs.vaultCredentialReveal) refs.vaultCredentialReveal.textContent = "Show";
    if (refs.vaultCredentialUrl) refs.vaultCredentialUrl.value = record?.url || "";
    if (refs.vaultCredentialTag) refs.vaultCredentialTag.value = record?.tag || "";
    if (refs.vaultCredentialNotes) refs.vaultCredentialNotes.value = record?.notes || "";
    renderVaultStrength(
      refs.vaultCredentialPass?.value || "",
      [refs.vaultCredentialStrength0, refs.vaultCredentialStrength1, refs.vaultCredentialStrength2, refs.vaultCredentialStrength3],
      refs.vaultCredentialStrengthLabel
    );
    openVaultModal(refs.vaultCredentialModal);
  }

  function openTextEditor(type = "note", index = null) {
    const safeType = type === "prompt" ? "prompt" : "note";
    state.vault.editingTextType = safeType;
    state.vault.editingTextIndex = Number.isInteger(index) ? index : null;
    const source = safeType === "prompt" ? state.vault.prompts : state.vault.notes;
    const record = Number.isInteger(index) ? source[index] : null;
    if (refs.vaultTextModalTitle) {
      refs.vaultTextModalTitle.textContent = record
        ? safeType === "prompt" ? "Edit Prompt" : "Edit Note"
        : safeType === "prompt" ? "Add Prompt" : "Add Note";
    }
    if (refs.vaultTextTitle) refs.vaultTextTitle.value = record?.title || "";
    if (refs.vaultTextType) refs.vaultTextType.value = safeType;
    if (refs.vaultTextBody) refs.vaultTextBody.value = record?.body || "";
    if (refs.vaultTextTags) refs.vaultTextTags.value = record?.tags || "";
    openVaultModal(refs.vaultTextModal);
  }

  async function copyVaultText(value, successLabel = "Copied") {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast(successLabel);
    } catch {
      toast("Copy failed.");
    }
  }

  async function handleVaultUnlock() {
    if (!refs.vaultMasterPassword) return;
    const password = String(refs.vaultMasterPassword.value || "").trim();
    if (password.length < 4) {
      toast("Use a master password with at least 4 characters.");
      refs.vaultMasterPassword.focus();
      return;
    }
    setVaultBusy(true);
    const existed = state.vault.hasVault;
    try {
      await unlockVault(password);
      state.vault.unlocked = true;
      state.vault.search = "";
      state.vault.generator.result = state.vault.generator.result || generateVaultPassword();
      refs.vaultMasterPassword.value = "";
      renderVault();
      toast(existed ? "Vault unlocked." : "Vault created.");
    } catch (error) {
      log("error", "vault_unlock_failed", error);
      toast("Master password was incorrect or the vault could not be opened.");
    } finally {
      setVaultBusy(false);
    }
  }

  async function handleVaultReset() {
    if (!state.vault.hasVault) return;
    if (!window.confirm("Reset the vault? This permanently removes all stored credentials, notes, and prompts.")) {
      return;
    }
    try {
      await vaultStorageRemove([VAULT_STORAGE_KEYS.ciphertext, VAULT_STORAGE_KEYS.verify]);
      resetVaultSession();
      state.vault.hasVault = false;
      state.vault.ready = true;
      if (refs.vaultMasterPassword) refs.vaultMasterPassword.value = "";
      renderVault();
      toast("Vault reset.");
    } catch (error) {
      log("error", "vault_reset_failed", error);
      toast("Vault reset failed.");
    }
  }

  function handleVaultLock() {
    resetVaultSession();
    renderVault();
    toast("Vault locked.");
  }

  async function saveCredentialFromModal() {
    const site = String(refs.vaultCredentialSite?.value || "").trim();
    const user = String(refs.vaultCredentialUser?.value || "").trim();
    const pass = String(refs.vaultCredentialPass?.value || "");
    if (!site || !user || !pass) {
      toast("Site, username, and password are required.");
      return;
    }
    const now = new Date().toISOString();
    const record = {
      id: state.vault.editingCredentialIndex !== null
        ? state.vault.credentials[state.vault.editingCredentialIndex]?.id || Date.now()
        : Date.now(),
      site: site.slice(0, 120),
      user: user.slice(0, 160),
      pass,
      icon: String(refs.vaultCredentialIcon?.value || "🔐").trim().slice(0, 4) || "🔐",
      url: String(refs.vaultCredentialUrl?.value || "").trim().slice(0, 240),
      tag: String(refs.vaultCredentialTag?.value || "").trim().slice(0, 48),
      notes: String(refs.vaultCredentialNotes?.value || "").trim().slice(0, 2000),
      createdAt: state.vault.editingCredentialIndex !== null
        ? state.vault.credentials[state.vault.editingCredentialIndex]?.createdAt || now
        : now,
      updatedAt: now
    };
    if (state.vault.editingCredentialIndex !== null) {
      state.vault.credentials[state.vault.editingCredentialIndex] = record;
    } else {
      state.vault.credentials.unshift(record);
    }
    await persistVaultState();
    closeVaultModal(refs.vaultCredentialModal);
    state.vault.editingCredentialIndex = null;
    renderVault();
    toast("Credential saved.");
  }

  async function saveTextFromModal() {
    const title = String(refs.vaultTextTitle?.value || "").trim();
    const body = String(refs.vaultTextBody?.value || "").trim();
    const type = String(refs.vaultTextType?.value || "note") === "prompt" ? "prompt" : "note";
    if (!title || !body) {
      toast("Title and content are required.");
      return;
    }
    const currentStore = state.vault.editingTextType === "prompt" ? state.vault.prompts : state.vault.notes;
    const existing = state.vault.editingTextIndex !== null ? currentStore[state.vault.editingTextIndex] : null;
    const record = {
      id: existing?.id || Date.now(),
      title: title.slice(0, 140),
      body: body.slice(0, 12000),
      tags: String(refs.vaultTextTags?.value || "").trim().slice(0, 240),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (state.vault.editingTextIndex !== null && state.vault.editingTextType === type) {
      currentStore[state.vault.editingTextIndex] = record;
    } else {
      if (state.vault.editingTextIndex !== null) {
        currentStore.splice(state.vault.editingTextIndex, 1);
      }
      if (type === "prompt") state.vault.prompts.unshift(record);
      else state.vault.notes.unshift(record);
    }
    await persistVaultState();
    closeVaultModal(refs.vaultTextModal);
    state.vault.editingTextIndex = null;
    state.vault.editingTextType = type;
    state.vault.activeTab = type === "prompt" ? "prompts" : "notes";
    renderVault();
    toast(type === "prompt" ? "Prompt saved." : "Note saved.");
  }

  async function handleVaultContentAction(action, index, kind = "") {
    if (state.vault.activeTab === "passwords") {
      const record = state.vault.credentials[index];
      if (!record) return;
      if (action === "reveal") {
        state.vault.revealMap[record.id] = !state.vault.revealMap[record.id];
        renderVault();
        return;
      }
      if (action === "copy-pass") {
        await copyVaultText(record.pass, "Password copied.");
        return;
      }
      if (action === "edit-credential") {
        openCredentialEditor(index);
        return;
      }
      if (action === "delete-credential") {
        if (!window.confirm(`Delete ${record.site}?`)) return;
        state.vault.credentials.splice(index, 1);
        await persistVaultState();
        renderVault();
        toast("Credential deleted.");
      }
      return;
    }
    const source = kind === "prompts" || state.vault.activeTab === "prompts" ? state.vault.prompts : state.vault.notes;
    const record = source[index];
    if (!record) return;
    if (action === "copy-text") {
      await copyVaultText(record.body, kind === "prompts" ? "Prompt copied." : "Note copied.");
      return;
    }
    if (action === "edit-text") {
      openTextEditor(kind === "prompts" ? "prompt" : "note", index);
      return;
    }
    if (action === "delete-text") {
      if (!window.confirm(`Delete ${record.title}?`)) return;
      source.splice(index, 1);
      await persistVaultState();
      renderVault();
      toast(kind === "prompts" ? "Prompt deleted." : "Note deleted.");
    }
  }

  function bindVaultEvents() {
    refs.vaultUnlockButton?.addEventListener("click", handleVaultUnlock);
    refs.vaultMasterPassword?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleVaultUnlock();
      }
    });
    refs.vaultResetButton?.addEventListener("click", () => {
      handleVaultReset().catch((error) => {
        log("error", "vault_reset_failed", error);
        toast("Vault reset failed.");
      });
    });
    refs.vaultLockButton?.addEventListener("click", handleVaultLock);
    refs.vaultPrimaryAction?.addEventListener("click", () => {
      if (state.vault.activeTab === "passwords") {
        openCredentialEditor();
        return;
      }
      if (state.vault.activeTab === "notes") {
        openTextEditor("note");
        return;
      }
      if (state.vault.activeTab === "prompts") {
        openTextEditor("prompt");
        return;
      }
      state.vault.generator.result = generateVaultPassword();
      renderVault();
      openCredentialEditor(null, state.vault.generator.result);
    });
    [refs.vaultTabPasswords, refs.vaultTabNotes, refs.vaultTabPrompts, refs.vaultTabGenerator].forEach((button) => {
      button?.addEventListener("click", () => {
        state.vault.activeTab = String(button.dataset.vaultTab || "passwords");
        state.vault.search = "";
        if (refs.vaultSearchInput) refs.vaultSearchInput.value = "";
        if (state.vault.activeTab === "generator" && !state.vault.generator.result) {
          state.vault.generator.result = generateVaultPassword();
        }
        renderVault();
      });
    });
    refs.vaultSearchInput?.addEventListener("input", (event) => {
      state.vault.search = String(event.target?.value || "");
      renderVaultList();
    });
    refs.vaultCredentialPass?.addEventListener("input", () => {
      renderVaultStrength(
        refs.vaultCredentialPass?.value || "",
        [refs.vaultCredentialStrength0, refs.vaultCredentialStrength1, refs.vaultCredentialStrength2, refs.vaultCredentialStrength3],
        refs.vaultCredentialStrengthLabel
      );
    });
    refs.vaultCredentialReveal?.addEventListener("click", () => {
      if (!refs.vaultCredentialPass || !refs.vaultCredentialReveal) return;
      const showing = refs.vaultCredentialPass.type === "text";
      refs.vaultCredentialPass.type = showing ? "password" : "text";
      refs.vaultCredentialReveal.textContent = showing ? "Show" : "Hide";
    });
    refs.vaultCredentialGenerate?.addEventListener("click", () => {
      const generated = generateVaultPassword();
      state.vault.generator.result = generated;
      if (refs.vaultCredentialPass) refs.vaultCredentialPass.value = generated;
      if (refs.vaultCredentialPass) refs.vaultCredentialPass.type = "text";
      if (refs.vaultCredentialReveal) refs.vaultCredentialReveal.textContent = "Hide";
      renderVaultStrength(
        generated,
        [refs.vaultCredentialStrength0, refs.vaultCredentialStrength1, refs.vaultCredentialStrength2, refs.vaultCredentialStrength3],
        refs.vaultCredentialStrengthLabel
      );
    });
    refs.vaultCredentialCancel?.addEventListener("click", () => closeVaultModal(refs.vaultCredentialModal));
    refs.vaultCredentialModalClose?.addEventListener("click", () => closeVaultModal(refs.vaultCredentialModal));
    refs.vaultCredentialSave?.addEventListener("click", () => {
      saveCredentialFromModal().catch((error) => {
        log("error", "vault_credential_save_failed", error);
        toast("Credential save failed.");
      });
    });
    refs.vaultTextCancel?.addEventListener("click", () => closeVaultModal(refs.vaultTextModal));
    refs.vaultTextModalClose?.addEventListener("click", () => closeVaultModal(refs.vaultTextModal));
    refs.vaultTextSave?.addEventListener("click", () => {
      saveTextFromModal().catch((error) => {
        log("error", "vault_text_save_failed", error);
        toast("Vault item save failed.");
      });
    });
    refs.vaultContent?.addEventListener("click", (event) => {
      const actionButton = event.target instanceof Element ? event.target.closest("[data-vault-action]") : null;
      if (!actionButton) return;
      const action = String(actionButton.getAttribute("data-vault-action") || "");
      const index = Number(actionButton.getAttribute("data-vault-index"));
      const kind = String(actionButton.getAttribute("data-vault-kind") || "");
      if (!Number.isInteger(index)) return;
      handleVaultContentAction(action, index, kind).catch((error) => {
        log("error", "vault_action_failed", error);
        toast("Vault action failed.");
      });
    });
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.id === "vaultGeneratorLength") {
        state.vault.generator.length = Math.max(8, Math.min(64, Number(target.value || 20)));
        renderVaultList();
      }
    });
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.id === "vaultGeneratorUpper") state.vault.generator.upper = target.checked;
      if (target.id === "vaultGeneratorLower") state.vault.generator.lower = target.checked;
      if (target.id === "vaultGeneratorNumber") state.vault.generator.number = target.checked;
      if (target.id === "vaultGeneratorSymbol") state.vault.generator.symbol = target.checked;
      if (["vaultGeneratorUpper", "vaultGeneratorLower", "vaultGeneratorNumber", "vaultGeneratorSymbol"].includes(target.id)) {
        renderVaultList();
      }
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.id === "vaultGeneratorGenerate") {
        state.vault.generator.result = generateVaultPassword();
        renderVaultList();
      }
      if (target.id === "vaultGeneratorCopy") {
        copyVaultText(state.vault.generator.result, "Generated password copied.").catch(() => {});
      }
      if (target.id === "vaultGeneratorUse") {
        if (!state.vault.generator.result) {
          state.vault.generator.result = generateVaultPassword();
        }
        openCredentialEditor(null, state.vault.generator.result);
      }
    });
    [refs.vaultCredentialModal, refs.vaultTextModal].forEach((modal) => {
      modal?.addEventListener("click", (event) => {
        if (event.target === modal) closeVaultModal(modal);
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!refs.vaultCredentialModal?.hidden) closeVaultModal(refs.vaultCredentialModal);
      if (!refs.vaultTextModal?.hidden) closeVaultModal(refs.vaultTextModal);
    });
  }


  function dashboardPad2(value) {
    return String(Math.max(0, Number(value || 0))).padStart(2, "0");
  }

  function dashboardParseTimeMins(value, fallback) {
    const raw = String(value || "");
    const match = raw.match(/^(\d{2}):(\d{2})$/);
    if (!match) return fallback;
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return fallback;
    return hh * 60 + mm;
  }

  function dashboardSafeTaskText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 140);
  }

  function initDashboardState() {
    if (state.dashboard) return;
    const defaultClocks = [
      { name: "London", tz: "Europe/London", code: "LON" },
      { name: "Tokyo", tz: "Asia/Tokyo", code: "TYO" },
      { name: "New York", tz: "America/New_York", code: "NYC" }
    ];
    const clocksRaw = readLocalJSON(DASHBOARD_STORAGE_KEYS.clocks, defaultClocks);
    const clocks = Array.isArray(clocksRaw)
      ? clocksRaw
          .map((item) => ({
            name: String(item?.name || "").slice(0, 32),
            tz: String(item?.tz || ""),
            code: String(item?.code || "").slice(0, 8)
          }))
          .filter((item) => item.name && item.tz)
          .slice(0, 8)
      : defaultClocks;

    const tasksRaw = readLocalJSON(DASHBOARD_STORAGE_KEYS.tasks, []);
    const tasks = Array.isArray(tasksRaw)
      ? tasksRaw
          .map((task) => ({
            id: Number(task?.id || Date.now() + Math.random()),
            text: dashboardSafeTaskText(task?.text),
            done: Boolean(task?.done),
            priority: ["low", "medium", "high"].includes(String(task?.priority || "")) ? String(task.priority) : "medium",
            time: String(task?.time || "").slice(0, 5) || `${dashboardPad2(new Date().getHours())}:${dashboardPad2(new Date().getMinutes())}`
          }))
          .filter((task) => task.text)
          .slice(0, 40)
      : [];

    state.dashboard = {
      clocks,
      tasks,
      workStart: readLocalString(DASHBOARD_STORAGE_KEYS.workStart, "09:00"),
      workEnd: readLocalString(DASHBOARD_STORAGE_KEYS.workEnd, "17:00"),
      weather: null,
      weatherLoading: false,
      pomo: {
        running: false,
        phase: "focus",
        remainingSec: 25 * 60,
        totalSec: 25 * 60,
        sessions: 0
      }
    };
  }

  function saveDashboardClocks() {
    if (!state.dashboard) return;
    writeLocalJSON(DASHBOARD_STORAGE_KEYS.clocks, state.dashboard.clocks);
  }

  function saveDashboardTasks() {
    if (!state.dashboard) return;
    writeLocalJSON(DASHBOARD_STORAGE_KEYS.tasks, state.dashboard.tasks);
  }

  function renderDashboardClocks() {
    if (!refs.dashboardClocks || !state.dashboard) return;
    const list = state.dashboard.clocks || [];
    if (!list.length) {
      refs.dashboardClocks.innerHTML = "<div class=\"dashboard-clock-empty\">No clocks yet</div>";
      return;
    }
    refs.dashboardClocks.innerHTML = list
      .map(
        (clock, index) => `
        <div class="dashboard-clock-chip">
          <span class="dashboard-clock-city">${clock.name}</span>
          <span class="dashboard-clock-time" id="dashboardClockTime-${index}">--:--</span>
          <button class="dashboard-chip-remove" type="button" data-dash-clock-remove="${index}" aria-label="Remove ${clock.name}">×</button>
        </div>
      `
      )
      .join("");
  }

  function renderDashboardTasks() {
    if (!refs.dashboardTaskList || !refs.dashboardTaskProgress || !state.dashboard) return;
    const list = state.dashboard.tasks || [];
    const done = list.filter((task) => task.done).length;
    refs.dashboardTaskProgress.textContent = `${done} / ${list.length} done`;

    if (!list.length) {
      refs.dashboardTaskList.innerHTML = "<div class=\"dashboard-task-empty\">No assignments yet</div>";
      return;
    }

    refs.dashboardTaskList.innerHTML = list
      .map(
        (task, index) => `
        <div class="dashboard-task-item${task.done ? " is-done" : ""}" role="listitem">
          <button class="dashboard-task-check${task.done ? " is-checked" : ""}" type="button" data-dash-task-toggle="${index}" aria-label="Toggle task">${task.done ? "✓" : ""}</button>
          <span class="dashboard-task-text">${task.text}</span>
          <button class="dashboard-task-remove" type="button" data-dash-task-remove="${index}" aria-label="Remove task">×</button>
        </div>
      `
      )
      .join("");
  }

  function renderDashboardWeather() {
    if (!refs.dashboardWeatherSummary || !refs.dashboardWeatherStats || !state.dashboard) return;
    const weather = state.dashboard.weather;
    if (state.dashboard.weatherLoading) {
      refs.dashboardWeatherSummary.textContent = "Fetching weather...";
      refs.dashboardWeatherStats.hidden = true;
      return;
    }
    if (!weather) {
      refs.dashboardWeatherSummary.textContent = "Weather unavailable. Tap Refresh.";
      refs.dashboardWeatherStats.hidden = true;
      return;
    }
    refs.dashboardWeatherSummary.textContent = weather.location;
    if (refs.dashboardWeatherTemp) refs.dashboardWeatherTemp.textContent = `${weather.tempF}°F`;
    if (refs.dashboardWeatherCond) refs.dashboardWeatherCond.textContent = weather.description;
    if (refs.dashboardWeatherWind) refs.dashboardWeatherWind.textContent = `${weather.windMph} mph wind`;
    refs.dashboardWeatherStats.hidden = false;
  }

  function renderDashboardPomodoro() {
    if (!refs.dashboardPomoTime || !refs.dashboardPomoPhase || !state.dashboard) return;
    const pomo = state.dashboard.pomo;
    const mm = dashboardPad2(Math.floor(pomo.remainingSec / 60));
    const ss = dashboardPad2(pomo.remainingSec % 60);
    refs.dashboardPomoTime.textContent = `${mm}:${ss}`;
    refs.dashboardPomoPhase.textContent = pomo.phase === "focus" ? "Focus" : "Break";
  }

  function renderDashboardClockFrame() {
    if (!refs.dashboardHours || !state.dashboard) return;
    const now = new Date();
    const hh = dashboardPad2(now.getHours());
    const mm = dashboardPad2(now.getMinutes());
    const ss = dashboardPad2(now.getSeconds());
    refs.dashboardHours.textContent = hh;
    refs.dashboardMinutes.textContent = mm;
    refs.dashboardSeconds.textContent = ss;

    if (refs.dashboardDate) refs.dashboardDate.textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    (state.dashboard.clocks || []).forEach((clock, index) => {
      const el = document.getElementById(`dashboardClockTime-${index}`);
      if (!el) return;
      try {
        el.textContent = now.toLocaleTimeString("en-US", {
          timeZone: clock.tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        }).replace(/^0/, "");
      } catch {
        el.textContent = "--:--";
      }
    });

    const startMinsBase = dashboardParseTimeMins(state.dashboard.workStart, 9 * 60);
    const endMinsBase = dashboardParseTimeMins(state.dashboard.workEnd, 17 * 60);
    let startMins = startMinsBase;
    let endMins = endMinsBase;
    let nowMins = now.getHours() * 60 + now.getMinutes();
    if (endMins <= startMins) {
      endMins += 24 * 60;
      if (nowMins < startMins) nowMins += 24 * 60;
    }
    const total = Math.max(1, endMins - startMins);
    const elapsed = Math.max(0, Math.min(total, nowMins - startMins));
    const pct = Math.round((elapsed / total) * 100);
    if (refs.dashboardWorkFill) refs.dashboardWorkFill.style.width = `${pct}%`;
    if (refs.dashboardWorkMeta) {
      const eh = Math.floor(elapsed / 60);
      const em = elapsed % 60;
      refs.dashboardWorkMeta.textContent = `${pct}% complete · ${eh}h ${dashboardPad2(em)}m elapsed`;
    }
  }

  function ensureDashboardClockTicker() {
    if (state.dashboardClockTimer) return;
    state.dashboardClockTimer = setInterval(() => {
      renderDashboardClockFrame();
    }, 1000);
  }

  const DASHBOARD_WX_CODES = {
    0: "Clear sky",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Showers",
    81: "Showers",
    82: "Heavy showers",
    95: "Thunderstorm",
    96: "Thunderstorm",
    99: "Thunderstorm"
  };

  function dashboardCanUseChromePermissions() {
    return typeof chrome !== "undefined"
      && Boolean(chrome.permissions?.contains)
      && Boolean(chrome.permissions?.request);
  }

  async function dashboardContainsPermission(permission) {
    if (!dashboardCanUseChromePermissions()) return false;
    return new Promise((resolve) => {
      chrome.permissions.contains({ permissions: [permission] }, (granted) => {
        resolve(Boolean(granted));
      });
    });
  }

  async function dashboardRequestPermission(permission) {
    if (!dashboardCanUseChromePermissions()) return false;
    return new Promise((resolve) => {
      chrome.permissions.request({ permissions: [permission] }, (granted) => {
        resolve(Boolean(granted));
      });
    });
  }

  function dashboardTimezoneCandidates() {
    const tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "").trim();
    if (!tz) return [];
    const parts = tz.split("/").filter(Boolean);
    const clean = (value) => value.replace(/_/g, " ").trim();
    const candidates = [];
    if (parts.length >= 2) candidates.push(clean(parts[parts.length - 1]));
    if (parts.length >= 3) candidates.push(clean(parts.slice(-2).join(" ")));
    if (parts.length >= 2) candidates.push(clean(parts[1]));
    return [...new Set(candidates.filter(Boolean))];
  }

  async function dashboardLookupCoordsFromTimezone() {
    const candidates = dashboardTimezoneCandidates();
    for (const query of candidates) {
      try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) continue;
        const geoData = await geoRes.json();
        const result = Array.isArray(geoData?.results) ? geoData.results[0] : null;
        if (!result) continue;
        const location = [result.name, result.admin1, result.country].filter(Boolean).join(", ");
        return {
          lat: Number(result.latitude),
          lon: Number(result.longitude),
          location
        };
      } catch {
        continue;
      }
    }
    return null;
  }

  async function dashboardResolveWeatherCoords(force = false) {
    let permissionGranted = await dashboardContainsPermission("geolocation");
    if (!permissionGranted && force) {
      permissionGranted = await dashboardRequestPermission("geolocation");
    }

    if (permissionGranted && navigator.geolocation) {
      try {
        const coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err),
            { timeout: 7000, maximumAge: 300000 }
          );
        });
        return {
          lat: Number(coords?.latitude),
          lon: Number(coords?.longitude),
          location: ""
        };
      } catch {
        // Fall through to non-invasive fallback.
      }
    }

    const timezoneMatch = await dashboardLookupCoordsFromTimezone();
    if (timezoneMatch && Number.isFinite(timezoneMatch.lat) && Number.isFinite(timezoneMatch.lon)) {
      return timezoneMatch;
    }

    try {
      const ipRes = await fetch("https://ipapi.co/json/");
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        return {
          lat: Number(ipData?.latitude),
          lon: Number(ipData?.longitude),
          location: [ipData?.city, ipData?.region, ipData?.country_name].filter(Boolean).join(", ")
        };
      }
    } catch {
      // Keep null result below.
    }

    return null;
  }

  async function fetchDashboardWeather(force = false) {
    if (!state.dashboard || !refs.dashboardWeatherSummary) return;
    if (state.dashboard.weatherLoading && !force) return;
    state.dashboard.weatherLoading = true;
    renderDashboardWeather();

    const resolved = await dashboardResolveWeatherCoords(force);
    if (!resolved || !Number.isFinite(resolved.lat) || !Number.isFinite(resolved.lon)) {
      state.dashboard.weatherLoading = false;
      state.dashboard.weather = null;
      renderDashboardWeather();
      if (force) toast("Weather needs location access or an active connection.");
      return;
    }

    try {
      const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${resolved.lat}&longitude=${resolved.lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
      const wxRes = await fetch(wxUrl);
      if (!wxRes.ok) throw new Error(`weather_http_${wxRes.status}`);
      const wxData = await wxRes.json();
      const current = wxData?.current || {};
      const description = DASHBOARD_WX_CODES[Number(current.weather_code)] || "Weather";
      const cityLabel = resolved.location || `${resolved.lat.toFixed(1)}, ${resolved.lon.toFixed(1)}`;
      state.dashboard.weather = {
        location: cityLabel,
        tempF: Math.round(Number(current.temperature_2m || 0)),
        windMph: Math.round(Number(current.wind_speed_10m || 0)),
        description
      };
    } catch {
      state.dashboard.weather = null;
      if (force) toast("Weather lookup failed. Try Refresh again.");
    }

    state.dashboard.weatherLoading = false;
    renderDashboardWeather();
  }

  function renderDashboardCitySuggestions(query = "") {
    if (!refs.dashboardCitySuggestions) return;
    const q = String(query || "").trim().toLowerCase();
    const list = (q
      ? DASHBOARD_CITIES.filter((city) => city.name.toLowerCase().includes(q) || city.code.toLowerCase().includes(q))
      : DASHBOARD_CITIES
    ).slice(0, 16);

    refs.dashboardCitySuggestions.innerHTML = list
      .map(
        (city) => `
        <button class="dashboard-city-option" type="button" data-dash-city="${city.name}" data-dash-tz="${city.tz}" data-dash-code="${city.code}">
          <span>${city.name}</span>
          <span class="city-code">${city.code}</span>
        </button>
      `
      )
      .join("");
  }

  function openDashboardCityModal() {
    if (!refs.dashboardCityModal || !refs.dashboardCitySearch) return;
    renderDashboardCitySuggestions("");
    refs.dashboardCityModal.hidden = false;
    refs.dashboardCitySearch.value = "";
    setTimeout(() => refs.dashboardCitySearch?.focus(), 0);
  }

  function closeDashboardCityModal() {
    if (!refs.dashboardCityModal) return;
    refs.dashboardCityModal.hidden = true;
  }

  function addDashboardTask() {
    if (!state.dashboard || !refs.dashboardTaskInput) return;
    const text = dashboardSafeTaskText(refs.dashboardTaskInput.value);
    if (!text) return;
    const priority = ["low", "medium", "high"].includes(String(refs.dashboardTaskPriority?.value || ""))
      ? String(refs.dashboardTaskPriority.value)
      : "medium";
    const now = new Date();
    state.dashboard.tasks.unshift({
      id: Date.now(),
      text,
      done: false,
      priority,
      time: `${dashboardPad2(now.getHours())}:${dashboardPad2(now.getMinutes())}`
    });
    state.dashboard.tasks = state.dashboard.tasks.slice(0, 40);
    refs.dashboardTaskInput.value = "";
    saveDashboardTasks();
    renderDashboardTasks();
  }

  function toggleDashboardTask(index) {
    if (!state.dashboard) return;
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= state.dashboard.tasks.length) return;
    state.dashboard.tasks[i].done = !state.dashboard.tasks[i].done;
    saveDashboardTasks();
    renderDashboardTasks();
  }

  function removeDashboardTask(index) {
    if (!state.dashboard) return;
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= state.dashboard.tasks.length) return;
    state.dashboard.tasks.splice(i, 1);
    saveDashboardTasks();
    renderDashboardTasks();
  }

  function startDashboardPomo() {
    if (!state.dashboard || state.dashboard.pomo.running) return;
    state.dashboard.pomo.running = true;
    if (state.dashboardPomoTimer) clearInterval(state.dashboardPomoTimer);
    state.dashboardPomoTimer = setInterval(() => {
      if (!state.dashboard?.pomo.running) return;
      state.dashboard.pomo.remainingSec -= 1;
      if (state.dashboard.pomo.remainingSec <= 0) {
        if (state.dashboard.pomo.phase === "focus") {
          state.dashboard.pomo.sessions = Math.min(8, state.dashboard.pomo.sessions + 1);
          state.dashboard.pomo.phase = "break";
          state.dashboard.pomo.totalSec = 5 * 60;
          state.dashboard.pomo.remainingSec = 5 * 60;
        } else {
          state.dashboard.pomo.phase = "focus";
          state.dashboard.pomo.totalSec = 25 * 60;
          state.dashboard.pomo.remainingSec = 25 * 60;
        }
        state.dashboard.pomo.running = false;
        if (state.dashboardPomoTimer) {
          clearInterval(state.dashboardPomoTimer);
          state.dashboardPomoTimer = null;
        }
      }
      renderDashboardPomodoro();
    }, 1000);
    renderDashboardPomodoro();
  }

  function pauseDashboardPomo() {
    if (!state.dashboard) return;
    state.dashboard.pomo.running = false;
    if (state.dashboardPomoTimer) {
      clearInterval(state.dashboardPomoTimer);
      state.dashboardPomoTimer = null;
    }
    renderDashboardPomodoro();
  }

  function resetDashboardPomo() {
    if (!state.dashboard) return;
    state.dashboard.pomo.running = false;
    state.dashboard.pomo.phase = "focus";
    state.dashboard.pomo.totalSec = 25 * 60;
    state.dashboard.pomo.remainingSec = 25 * 60;
    renderDashboardPomodoro();
  }

  function renderDashboard() {
    if (!refs.dashboardPanel) return;
    initDashboardState();
    if (!state.dashboard) return;
    setInputValue(refs.dashboardWorkStart, state.dashboard.workStart);
    setInputValue(refs.dashboardWorkEnd, state.dashboard.workEnd);
    renderDashboardClocks();
    renderDashboardTasks();
    renderDashboardWeather();
    renderDashboardPomodoro();
    renderDashboardClockFrame();
    ensureDashboardClockTicker();
    if (!state.dashboardWeatherRequested) {
      state.dashboardWeatherRequested = true;
      void fetchDashboardWeather();
    }
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

  function getMeditationState() {
    return state.app?.settings?.meditation || {};
  }

  const READING_DARK_VARIANTS = [
    "coal",
    "iron_ore",
    "brown"
  ];

  const READING_LIGHT_VARIANTS = [
    "white",
    "warm",
    "off_white"
  ];

  const READING_DARK_LABELS = {
    coal: "Night",
    iron_ore: "Iron",
    brown: "Holmeta Brown"
  };

  const READING_LIGHT_LABELS = {
    white: "White",
    warm: "Warm",
    off_white: "Beige"
  };

  function normalizeReadingDarkVariant(value, fallback = "coal") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "iron ore" || raw === "iron") return "iron_ore";
    if (["coal-black", "coal -black", "night", "soft_black", "black", "gray", "grey", "dim_slate", "teal", "purple", "forest_green", "dark purple", "dark green"].includes(raw)) return "coal";
    if (["dark brown", "sepia", "gentle_night", "holmeta brown", "holmeta_brown"].includes(raw)) return "brown";
    if (READING_DARK_VARIANTS.includes(raw)) return raw;
    return normalizeReadingDarkVariant(fallback, "coal");
  }

  function normalizeReadingLightVariant(value, fallback = "white") {
    const raw = String(value || "").trim().toLowerCase();
    if (["gray", "beige", "soft_paper"].includes(raw)) return "off_white";
    if (["warm_page", "light_brown"].includes(raw)) return "warm";
    if (["neutral_light", "soft_green", "baby_blue"].includes(raw)) return "white";
    if (READING_LIGHT_VARIANTS.includes(raw)) return raw;
    return normalizeReadingLightVariant(fallback, "white");
  }

  function normalizeReadingFontSize(value, fallback = 13) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(10, Math.min(24, n));
  }

  function normalizeReadingFontFamily(value, fallback) {
    const raw = String(value ?? "").trim();
    if (!raw) return fallback;
    const safe = raw.replace(/[<>`]/g, "").slice(0, 220);
    return safe || fallback;
  }

  function darkVariantFromPreset(preset, fallback = "coal") {
    const key = String(preset || "").trim().toLowerCase();
    if (key === "iron ore" || key === "iron") return "iron_ore";
    if (READING_DARK_VARIANTS.includes(key)) return key;
    if (["soft_black", "dim_slate", "night", "black", "grey", "gray", "teal", "purple", "forest_green", "dark purple", "dark green"].includes(key)) return "coal";
    if (["gentle_night", "sepia", "holmeta brown", "holmeta_brown", "dark brown"].includes(key)) return "brown";
    return normalizeReadingDarkVariant(fallback, "coal");
  }

  function lightVariantFromPreset(preset, fallback = "white") {
    const key = String(preset || "").trim().toLowerCase();
    if (READING_LIGHT_VARIANTS.includes(key)) return key;
    if (["neutral_light", "baby_blue", "soft_green"].includes(key)) return "white";
    if (["warm_page", "light_brown"].includes(key)) return "warm";
    if (["soft_paper", "gray", "beige"].includes(key)) return "off_white";
    return normalizeReadingLightVariant(fallback, "white");
  }

  function readingPresetForVariants(mode, darkVariant, lightVariant) {
    return mode === "light" ? lightVariant : darkVariant;
  }

  function baseReadingIntensity(mode, darkVariant, lightVariant) {
    if (mode === "light") {
      const lightLevels = {
        white: 72,
        warm: 68,
        off_white: 66
      };
      return lightLevels[lightVariant] || 70;
    }
    const darkLevels = {
      coal: 78,
      iron_ore: 80,
      brown: 76
    };
    return darkLevels[darkVariant] || 78;
  }

  function readingVariantLabel(mode, variant) {
    if (mode === "light") return READING_LIGHT_LABELS[variant] || variant;
    return READING_DARK_LABELS[variant] || variant;
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

  function isSiteInsightDisabledForHost() {
    const insight = state.app?.settings?.siteInsight || {};
    const map = insight.perSiteDisabled && typeof insight.perSiteDisabled === "object"
      ? insight.perSiteDisabled
      : {};
    return Boolean(state.currentHost && map[state.currentHost]);
  }

  function getAccessInfo() {
    const fallback = {
      allowed: true,
      locked: false,
      state: "ACCESS_UNKNOWN",
      reason: ""
    };
    return state.app?.access || fallback;
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

  function toDayKey(ts = Date.now()) {
    const d = ts instanceof Date ? ts : new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatMinutesCompact(minutes) {
    const total = Math.max(0, Math.round(Number(minutes || 0)));
    if (total >= 60) {
      const h = Math.floor(total / 60);
      const m = total % 60;
      return m ? `${h}h ${m}m` : `${h}h`;
    }
    return `${total}m`;
  }

  function formatCountdownClock(ms) {
    const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function getTodayFocusMetrics() {
    const todayKey = toDayKey();
    const daily = state.app?.stats?.daily?.[todayKey] || {};
    const sessions = Array.isArray(state.app?.stats?.focusSessions) ? state.app.stats.focusSessions : [];
    const todaySessions = sessions.filter((entry) => {
      const stamp = Number(entry?.endedAt || entry?.startedAt || 0);
      return stamp > 0 && toDayKey(stamp) === todayKey;
    });
    const activeMinutes = (() => {
      const deep = state.app?.settings?.deepWork;
      if (!deep?.active || deep.phase !== "focus" || !deep.startedAt) return 0;
      return Math.max(0, Math.floor((Date.now() - Number(deep.startedAt || 0)) / 60000));
    })();

    return {
      completedSessions: todaySessions.length,
      completedMinutes: Math.max(0, Number(daily.focusMinutes || 0)),
      liveMinutes: activeMinutes,
      totalMinutes: Math.max(0, Number(daily.focusMinutes || 0)) + activeMinutes
    };
  }

  function getDeepWorkPrediction() {
    const sessions = Array.isArray(state.app?.stats?.focusSessions) ? state.app.stats.focusSessions : [];
    const recent = sessions.slice(-8);
    const average = recent.length
      ? recent.reduce((sum, entry) => sum + Math.max(0, Number(entry?.minutes || 0)), 0) / recent.length
      : 0;
    const recommended = average >= 70 ? "90 / 20" : average >= 40 ? "50 / 10" : "25 / 5";
    const detail = recent.length >= 3
      ? `Recent average ${Math.round(average)}m across ${recent.length} focus blocks.`
      : "Starter recommendation until more focus history builds locally.";
    return {
      average,
      recommended,
      detail
    };
  }

  function describeDeepWorkAutomation(deep) {
    const parts = [];
    if (deep?.autoBlocker) parts.push("Shield");
    if (deep?.autoLight) parts.push("Light");
    return parts.length ? parts.join(" + ") : "Manual";
  }

  function buildFocusSyncSnapshot() {
    const deep = state.app?.settings?.deepWork || {};
    const blocker = state.app?.settings?.blocker || {};
    const light = getLightFilterState();
    const metrics = getTodayFocusMetrics();
    const prediction = getDeepWorkPrediction();
    const topResult = Array.isArray(state.weaverResults) && state.weaverResults.length ? state.weaverResults[0] : null;
    const countdown = deep.active
      ? formatCountdownClock(Math.max(0, Number(deep.nextTransitionAt || 0) - Date.now()))
      : "standby";
    const blockerState = blocker.enabled
      ? (blocker.nuclear ? "Lockdown ready" : "Shield armed")
      : "Shield off";
    const lightState = light?.enabled
      ? `${String(light.mode || "warm").replaceAll("_", " ")} · ${Math.round(Number(light.intensity || 0))}%`
      : "Filter off";

    return [
      "HOLMETA Focus Sync Snapshot",
      `Generated: ${new Date().toLocaleString()}`,
      `Host: ${state.currentHost || "No active website"}`,
      `Deep Work: ${deep.active ? `${deep.phase} · ${deep.focusMin}/${deep.breakMin} · ${countdown}` : `idle · ${deep.focusMin || 25}/${deep.breakMin || 5}`}`,
      `Automation: ${describeDeepWorkAutomation(deep)}`,
      `Shield: ${blockerState}`,
      `Light: ${lightState}`,
      `Today: ${formatMinutesCompact(metrics.totalMinutes)} focus · ${metrics.completedSessions} completed session${metrics.completedSessions === 1 ? "" : "s"}`,
      `Recommended next cycle: ${prediction.recommended}`,
      topResult ? `Next woven move: ${topResult.lane} · ${topResult.title}` : "Next woven move: Run Task Weaver to shape the current tab stack."
    ].join("\n");
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

  function applyPopupToolRegistry() {
    if (state.popupOrderApplied) return;
    const shell = document.getElementById("command-center");
    const registry = globalThis.HolmetaToolRegistry?.popup;
    if (!shell || !Array.isArray(registry) || !registry.length) return;

    const footer = shell.querySelector(".statusbar");
    registry.forEach((entry, index) => {
      const node = document.getElementById(String(entry.id || ""));
      if (!node) return;
      const selector = entry.headingTag === "summary" ? "summary" : ".section-head h2, h2";
      const titleNode = node.querySelector(selector);
      if (titleNode) {
        titleNode.textContent = `${index}) ${String(entry.title || "").trim()}`;
      }
      if (footer) shell.insertBefore(node, footer);
      else shell.appendChild(node);
    });
    state.popupOrderApplied = true;
  }

  function renderPremium() {
    const access = getAccessInfo();
    const entitlementState = String(state.app?.entitlement?.state || "");
    const premium = hasExtensionAccess();
    const trialActive = entitlementState === "TRIAL_ACTIVE";

    if (access.locked) {
      refs.modeBadge.textContent = "LOCKED";
      refs.modeBadge.classList.remove("premium");
    } else if (trialActive) {
      refs.modeBadge.textContent = "TRIAL";
      refs.modeBadge.classList.add("premium");
    } else {
      refs.modeBadge.textContent = "ACTIVE";
      refs.modeBadge.classList.add("premium");
    }

    document.querySelectorAll("[data-premium='true']").forEach((node) => {
      node.disabled = !premium;
      node.setAttribute("aria-disabled", String(!premium));
    });

    refs.premiumBanner.hidden = premium;
  }

  function setToolPanelsHidden(hidden) {
    const ids = (globalThis.HolmetaToolRegistry?.popup || []).map((entry) => String(entry.id || ""));
    ids.forEach((id) => {
      if (!id) return;
      const panel = document.getElementById(id);
      if (!panel) return;
      panel.hidden = Boolean(hidden);
    });
  }

  function renderAccessGate() {
    const lockPanel = refs.accessLockPanel;
    if (!lockPanel || !state.app) return;

    const access = getAccessInfo();
    const locked = Boolean(access.locked);
    lockPanel.hidden = !locked;
    setToolPanelsHidden(locked);

    if (!locked) return;

    const entitlement = state.app?.entitlement || {};
    const reason = humanAccessReason(access.reason || entitlement.reason);
    const trialRemaining = Number(entitlement?.trial?.remainingMs || 0);
    const trialEndedAt = Number(entitlement?.trial?.endsAt || 0);
    const nextCheckAt = Number(entitlement?.nextCheckAt || 0);
    const subStatus = String(entitlement?.subscription?.status || "inactive");

    refs.accessStateBadge.textContent = String(access.state || "ACCESS_LOCKED").replaceAll("_", " ");
    refs.accessLockMessage.textContent = `Holmeta access has ended. Reason: ${reason}.`;
    if (trialRemaining > 0) {
      refs.accessLockTiming.textContent = `Trial time remaining: ${formatRemaining(trialRemaining)}. Complete checkout to keep access uninterrupted.`;
    } else if (trialEndedAt > 0) {
      refs.accessLockTiming.textContent = `Trial ended at ${new Date(trialEndedAt).toLocaleString()}. Subscription status: ${subStatus}.`;
    } else if (nextCheckAt > Date.now()) {
      refs.accessLockTiming.textContent = `Access refresh scheduled at ${new Date(nextCheckAt).toLocaleString()}.`;
    } else {
      refs.accessLockTiming.textContent = "Reactivate subscription or refresh access to continue.";
    }
  }

  function renderReadingTheme() {
    const reading = getReadingThemeState();
    const siteProfile = getReadingSiteProfile();
    const rawAppearance = String(siteProfile?.appearance || reading.appearance || siteProfile?.mode || reading.mode || "dark");
    const appearance = rawAppearance === "auto"
      ? "adaptive"
      : (["light", "dark", "adaptive"].includes(rawAppearance) ? rawAppearance : "dark");
    const sourcePreset = String(siteProfile?.preset || reading.preset || "");
    const darkVariant = normalizeReadingDarkVariant(
      siteProfile?.darkVariant || reading.darkVariant || siteProfile?.darkThemeVariant || reading.darkThemeVariant,
      darkVariantFromPreset(sourcePreset, "coal")
    );
    const lightVariant = normalizeReadingLightVariant(
      siteProfile?.lightVariant || reading.lightVariant || siteProfile?.lightThemeVariant || reading.lightThemeVariant,
      lightVariantFromPreset(sourcePreset, "white")
    );
    const scheduleModeRaw = String(siteProfile?.scheduleMode || reading.scheduleMode || (siteProfile?.schedule?.useSunset || reading.schedule?.useSunset ? "sunset" : "system"));
    const scheduleMode = ["system", "sunset", "custom"].includes(scheduleModeRaw)
      ? scheduleModeRaw
      : ((siteProfile?.schedule?.useSunset || reading.schedule?.useSunset) ? "sunset" : "custom");
    const scheduleStart = String(siteProfile?.schedule?.start || reading.schedule?.start || "20:00");
    const scheduleEnd = String(siteProfile?.schedule?.end || reading.schedule?.end || "06:00");
    const effective = {
      enabled: Boolean(siteProfile?.enabled ?? reading.enabled),
      appearance,
      darkVariant,
      lightVariant,
      scheduleMode,
      scheduleStart,
      scheduleEnd,
      opaqueBackground: Boolean(siteProfile?.opaqueBackground ?? reading.opaqueBackground),
      pointerCursors: Boolean(siteProfile?.pointerCursors ?? reading.pointerCursors),
      preserveImages: Boolean(siteProfile?.preserveImages ?? reading.preserveImages ?? true),
      preserveLogos: Boolean(siteProfile?.preserveLogos ?? reading.preserveLogos ?? true),
      higherContrast: Boolean(siteProfile?.higherContrast ?? reading.higherContrast ?? false),
      softerSurfaces: Boolean(siteProfile?.softerSurfaces ?? reading.softerSurfaces ?? false),
      sansFontSize: normalizeReadingFontSize(siteProfile?.sansFontSize ?? reading.sansFontSize, 13),
      sansFontFamily: normalizeReadingFontFamily(
        siteProfile?.sansFontFamily ?? reading.sansFontFamily,
        "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
      ),
      codeFontSize: normalizeReadingFontSize(siteProfile?.codeFontSize ?? reading.codeFontSize, 12),
      codeFontFamily: normalizeReadingFontFamily(
        siteProfile?.codeFontFamily ?? reading.codeFontFamily,
        "ui-monospace, \"SFMono-Regular\", Menlo, Consolas, monospace"
      )
    };

    setChecked(refs.readingThemeEnabled, effective.enabled);
    refs.readingThemeLight.classList.toggle("is-active", effective.appearance === "light");
    refs.readingThemeDark.classList.toggle("is-active", effective.appearance === "dark");
    refs.readingThemeAuto.classList.toggle("is-active", effective.appearance === "adaptive");
    setInputValue(refs.readingThemeDarkVariant, effective.darkVariant);
    setInputValue(refs.readingThemeLightVariant, effective.lightVariant);
    const scheduleModeForUI = "system";
    setInputValue(refs.readingThemeScheduleMode, scheduleModeForUI);
    setInputValue(refs.readingThemeScheduleStart, effective.scheduleStart);
    setInputValue(refs.readingThemeScheduleEnd, effective.scheduleEnd);
    if (refs.readingThemeDarkVariantRow) {
      refs.readingThemeDarkVariantRow.hidden = effective.appearance === "light";
    }
    if (refs.readingThemeLightVariantRow) {
      refs.readingThemeLightVariantRow.hidden = effective.appearance === "dark";
    }
    setChecked(refs.readingThemeOpaqueBackground, effective.opaqueBackground);
    setChecked(refs.readingThemePointerCursors, effective.pointerCursors);
    setChecked(refs.readingThemePreserveImages, effective.preserveImages);
    setChecked(refs.readingThemePreserveLogos, effective.preserveLogos);
    setChecked(refs.readingThemeHigherContrast, effective.higherContrast);
    setChecked(refs.readingThemeSofterSurfaces, effective.softerSurfaces);
    setInputValue(refs.readingThemeSansSize, effective.sansFontSize);
    setInputValue(refs.readingThemeSansFamily, effective.sansFontFamily);
    setInputValue(refs.readingThemeCodeSize, effective.codeFontSize);
    setInputValue(refs.readingThemeCodeFamily, effective.codeFontFamily);
    if (refs.readingThemeScheduleStart) refs.readingThemeScheduleStart.disabled = true;
    if (refs.readingThemeScheduleEnd) refs.readingThemeScheduleEnd.disabled = true;
    const hasActiveHost = Boolean(state.currentHost);
    if (refs.readingThemeExcludeSite) refs.readingThemeExcludeSite.disabled = !hasActiveHost;
    setChecked(refs.readingThemeExcludeSite, isReadingSiteExcluded());
    if (refs.readingThemeShowWidget) refs.readingThemeShowWidget.disabled = !state.currentHost;
    if (refs.readingThemeHideWidget) refs.readingThemeHideWidget.disabled = !state.currentHost;

    const darkLabel = readingVariantLabel("dark", darkVariant);
    const lightLabel = readingVariantLabel("light", lightVariant);
    if (refs.appearanceModeText) {
      refs.appearanceModeText.textContent = effective.appearance === "adaptive"
        ? "ADAPT"
        : (effective.appearance === "dark" ? "Night" : "Day");
    }
    if (refs.toggleStateLabel) {
      refs.toggleStateLabel.textContent = effective.enabled
        ? (effective.appearance === "dark" ? "NIGHT" : effective.appearance === "light" ? "DAY" : "ADAPT")
        : "OFF";
    }
    const diagnosticsVariant = String(state.diagnostics?.readingVariant || "");
    const activeVariantLabel = (() => {
      if (!diagnosticsVariant) return "";
      const key = diagnosticsVariant.replace("appearance_dark_", "").replace("appearance_light_", "");
      if (!key) return "";
      if (diagnosticsVariant.startsWith("appearance_light_")) {
        return readingVariantLabel("light", key);
      }
      return readingVariantLabel("dark", key);
    })();

    if (refs.readingThemeStatus) {
      const excluded = isReadingSiteExcluded();
      if (excluded) {
        refs.readingThemeStatus.textContent = "[Excluded] This site is excluded from Tool 2.";
        return;
      }

      const hostSuffix = state.currentHost ? ` on ${state.currentHost}` : "";
      if (effective.enabled) {
        if (effective.appearance === "adaptive") {
          refs.readingThemeStatus.textContent = `[On] Adaptive${hostSuffix} · Dark ${darkLabel} / Light ${lightLabel}.`;
          if (activeVariantLabel) {
            refs.readingThemeStatus.textContent += ` Active now: ${activeVariantLabel}.`;
          }
        } else {
          const activeLabel = effective.appearance === "dark" ? `Dark ${darkLabel}` : `Light ${lightLabel}`;
          refs.readingThemeStatus.textContent = `[On] ${activeLabel}${hostSuffix}.`;
        }
        return;
      }

      refs.readingThemeStatus.textContent = "[Off] Appearance is off. Toggle On to apply Dark, Light, or Adaptive mode.";
    }
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

    const modeLabel = refs.lightMode?.selectedOptions?.[0]?.textContent?.trim() || "Warm Shift";
    const spectrumLabel = refs.lightSpectrumPreset?.selectedOptions?.[0]?.textContent?.trim() || "Balanced";
    if (refs.lightFilterModeChip) refs.lightFilterModeChip.textContent = modeLabel;
    if (refs.lightFilterSpectrumChip) refs.lightFilterSpectrumChip.textContent = spectrumLabel;
    if (refs.lightFilterIntensityChip) refs.lightFilterIntensityChip.textContent = `${effective.intensity}% intensity`;
    if (refs.lightFilterStrengthFill) refs.lightFilterStrengthFill.style.width = `${Math.max(0, Math.min(100, effective.intensity))}%`;

    const activePreset = effective.mode === "red_lock"
      ? "red_lock"
      : effective.mode === "near_infrared"
        ? "infrared"
        : effective.mode === "deep_night"
          ? "deep_night"
          : ["warm", "amber", "amber_focus", "candle", "paper", "sunset_glow"].includes(String(effective.mode))
            ? "comfort"
            : "";
    refs.lightPresetComfort?.classList.toggle("is-active", activePreset === "comfort");
    refs.lightPresetDeepNight?.classList.toggle("is-active", activePreset === "deep_night");
    refs.lightPresetInfrared?.classList.toggle("is-active", activePreset === "infrared");
    refs.lightPresetRedLock?.classList.toggle("is-active", activePreset === "red_lock");

    if (refs.lightFilterSummary) {
      const scopeLabel = siteProfile ? "site override" : "global profile";
      const addOns = [
        effective.reduceWhites ? "reduced whites" : null,
        effective.videoSafe ? "video-safe" : null,
        effective.spotlightEnabled ? "spotlight" : null,
        effective.therapyMode ? `therapy ${effective.therapyDuration}m` : null
      ].filter(Boolean);
      if (!light.enabled) {
        refs.lightFilterSummary.textContent = "Filter off. Arm Tool 3 to apply a stronger screen-relief profile.";
      } else if (isFilterSiteExcluded()) {
        refs.lightFilterSummary.textContent = "Current site excluded. Your saved filter profile is intact, but it will not apply on this host.";
      } else {
        refs.lightFilterSummary.textContent = `${modeLabel} with ${spectrumLabel} at ${effective.intensity}% intensity · ${scopeLabel}${addOns.length ? ` · ${addOns.join(" · ")}` : ""}.`;
      }
    }

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

  function getTranslateSettings() {
    return state.app?.settings?.translate || {
      enabled: true,
      autoShowSelectionChip: true,
      targetLanguage: "en",
      sourceLanguage: "auto",
      recentLanguages: ["en", "es", "fr"],
      preserveCodeBlocks: true,
      preserveBrandTerms: true,
      showOriginalOnHover: false,
      enableSideBySide: false,
      perSitePreferences: {},
      historyEnabled: true,
      provider: "local_lite",
      providerConfig: {
        endpoint: "",
        apiKey: "",
        headers: {}
      }
    };
  }

  function getTranslateHistory() {
    const list = state.app?.history?.translate;
    return Array.isArray(list) ? list : [];
  }

  function getSavedPhrases() {
    const list = state.app?.savedPhrases;
    return Array.isArray(list) ? list : [];
  }

  function getTranslateSitePreference() {
    const translate = getTranslateSettings();
    const map = translate.perSitePreferences && typeof translate.perSitePreferences === "object"
      ? translate.perSitePreferences
      : {};
    return state.currentHost ? map[state.currentHost] || null : null;
  }

  function queueTranslatePatch(partial) {
    const current = getTranslateSettings();
    queuePatch({ translate: deepMerge(current, partial) });
  }

  function renderTranslateListItems(container, list, kind) {
    container.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "translate-empty";
      empty.textContent = kind === "saved" ? "No saved phrases yet." : "No recent translations yet.";
      container.appendChild(empty);
      return;
    }

    list.slice(0, 12).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "translate-item";
      const sourceLang = String(entry.sourceLang || "auto").toUpperCase();
      const targetLang = String(entry.targetLang || "en").toUpperCase();
      const domain = String(entry.domain || "").trim();
      const timestamp = Number(entry.timestamp || 0);
      const timeLabel = timestamp > 0 ? new Date(timestamp).toLocaleString() : "Recent";

      item.innerHTML = `
        <div class="meta">${sourceLang} → ${targetLang}${domain ? ` · ${domain}` : ""}</div>
        <div class="line muted">${String(entry.originalText || "").slice(0, 160)}</div>
        <div class="line">${String(entry.translatedText || "").slice(0, 160)}</div>
        <div class="meta">${timeLabel}</div>
        <div class="actions">
          <button type="button" class="ghost" data-translate-copy="${entry.id}">Copy</button>
          <button type="button" class="ghost" data-translate-remove="${kind}:${entry.id}">Remove</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function renderTranslateTool() {
    const translate = getTranslateSettings();
    const sitePref = getTranslateSitePreference() || {};
    const history = getTranslateHistory();
    const saved = getSavedPhrases();
    const disabledOnSite = Boolean(sitePref.disabled);

    setChecked(refs.translateEnabled, translate.enabled !== false);
    setInputValue(refs.translateSourceLang, translate.sourceLanguage || "auto");
    setInputValue(refs.translateTargetLang, translate.targetLanguage || "en");
    setChecked(refs.translateChipEnabled, translate.autoShowSelectionChip !== false);
    setChecked(refs.translateHistoryEnabled, translate.historyEnabled !== false);
    setChecked(refs.translatePreserveCode, translate.preserveCodeBlocks !== false);
    setChecked(refs.translateShowOriginalHover, Boolean(translate.showOriginalOnHover));
    setChecked(refs.translateSideBySide, Boolean(translate.enableSideBySide));
    setInputValue(refs.translateProvider, translate.provider || "local_lite");

    if (!state.editing.has(refs.translateInput.id) && document.activeElement !== refs.translateInput) {
      setInputValue(refs.translateInput, state.translateInputDraft || "");
    }
    if (!state.editing.has(refs.translateOutput.id) && document.activeElement !== refs.translateOutput) {
      setInputValue(refs.translateOutput, state.translateOutputDraft || "");
    }

    setChecked(refs.translateSiteDisable, disabledOnSite);
    setChecked(refs.translateSiteAutoChip, sitePref.autoShowSelectionChip !== false);
    setChecked(refs.translateSiteAutoArticle, Boolean(sitePref.autoTranslateArticles));
    refs.translateSiteDisable.disabled = !state.currentHost;
    refs.translateSiteAutoChip.disabled = !state.currentHost;
    refs.translateSiteAutoArticle.disabled = !state.currentHost;

    refs.translateStatus.textContent = translate.enabled
      ? `Active · ${state.currentHost || "site unavailable"} · ${translate.provider === "remote_api" ? "Remote API provider" : "Local Lite provider"}`
      : "Translate Tool is off.";

    const disableInteractive = !translate.enabled;
    [
      refs.translateSourceLang,
      refs.translateTargetLang,
      refs.translateInput,
      refs.translateInputRun,
      refs.translateSelectionRun,
      refs.translatePageRun,
      refs.translateSectionRun,
      refs.translateVisibleRun,
      refs.translateOverlayRun,
      refs.translateRestoreRun,
      refs.translateSaveLast,
      refs.translateChipEnabled,
      refs.translateHistoryEnabled,
      refs.translatePreserveCode,
      refs.translateShowOriginalHover,
      refs.translateSideBySide,
      refs.translateProvider
    ].forEach((control) => {
      if (!control) return;
      control.disabled = disableInteractive;
    });

    renderTranslateListItems(refs.translateHistoryList, history, "history");
    renderTranslateListItems(refs.translateSavedList, saved, "saved");
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
    const pausedUntil = Math.max(0, Number(blocker.pausedUntil || 0));
    const pauseMinutes = pausedUntil > Date.now() ? Math.max(1, Math.ceil((pausedUntil - Date.now()) / 60000)) : 0;

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
    const blockedDomainCount = (blocker.blockedDomains || []).length;
    if (!blocker.enabled) {
      refs.blockerStatus.textContent = "Shield idle";
    } else if (pauseMinutes > 0) {
      refs.blockerStatus.textContent = `Shield paused · resumes in ${pauseMinutes}m`;
    } else {
      refs.blockerStatus.textContent = `Shield live · ${blockedDomainCount} blocked domain${blockedDomainCount === 1 ? "" : "s"}${quickEnabledCount ? ` · ${quickEnabledCount} quick net${quickEnabledCount === 1 ? "" : "s"}` : ""}`;
    }
    refs.blockerStats.textContent = `Today ${blockedToday} · Lifetime ${blockedTotal}${state.app.runtime?.blockerRuleLimitHit ? " · Dynamic rule cap hit" : ""}`;
    if (!state.currentHost) {
      refs.blockerHostStatus.textContent = "Open a website tab to manage its host here.";
    } else if (hostWhitelisted) {
      refs.blockerHostStatus.textContent = `${state.currentHost} is allowed here right now.`;
    } else if (hostBlocked) {
      refs.blockerHostStatus.textContent = `${state.currentHost} is blocked directly.`;
    } else if (blocker.enabled) {
      refs.blockerHostStatus.textContent = `${state.currentHost} is open and ready.`;
    } else {
      refs.blockerHostStatus.textContent = `${state.currentHost} is ready when the shield is on.`;
    }
    refs.addCurrentSite.textContent = hostBlocked ? "Unblock Site" : "Block Site";
    refs.addCurrentSite.disabled = !state.currentHost;
    refs.toggleWhitelistSite.textContent = hostWhitelisted ? "Remove Allow" : "Allow Site";
    refs.toggleWhitelistSite.disabled = !state.currentHost;
    refs.toggleCosmeticSite.textContent = cosmeticDisabledHost ? "Enable Cosmetic Here" : "Disable Cosmetic Here";
    refs.toggleCosmeticSite.disabled = !state.currentHost;
    refs.pauseBlocker.textContent = pauseMinutes > 0 ? `Paused ${pauseMinutes}m` : "Pause 10m";
    refs.quickBlockSocial.classList.toggle("is-active", Boolean(quickCategories.social));
    refs.quickBlockShopping.classList.toggle("is-active", Boolean(quickCategories.shopping));
    refs.quickBlockEntertainment.classList.toggle("is-active", Boolean(quickCategories.entertainment));
    refs.quickBlockAdult.classList.toggle("is-active", Boolean(quickCategories.adult));
  }

  const ALERT_KIND_LABELS = {
    eye: "Eye Relief",
    posture: "Posture",
    burnout: "Burnout Reset",
    hydration: "Hydration",
    blink: "Blink Reset",
    movement: "Movement"
  };

  const ALERT_KIND_PREVIEW_TEXT = {
    eye: "Look away from the screen and relax your focus for a moment.",
    posture: "Reset your shoulders, neck, and spine before strain builds.",
    burnout: "Step back, breathe, and break the overload cycle.",
    hydration: "Pause and drink water before fatigue sneaks in.",
    blink: "Blink fully a few times to ease eye dryness.",
    movement: "Stand up and move briefly to wake the body back up."
  };

  const ALERT_KIND_SOUND_LABELS = {
    eye: "Soviet Beacon",
    posture: "Watchtower",
    burnout: "Bunker Klaxon",
    hydration: "Command Relay",
    blink: "Single",
    movement: "Double"
  };

  const MEDITATION_AMBIENT_LABELS = {
    brown_hush: "Brown Hush",
    rain_atrium: "Rain Atrium",
    cloud_drift: "Cloud Drift",
    night_tide: "Night Tide"
  };

  const EMPTY_SITE_INSIGHT = Object.freeze({
    pageType: "Unknown / Mixed Page",
    appearsToBe: "Mixed or unclear intent",
    summary: "Analyze the current page to extract useful structure-based insight.",
    signals: ["No high-confidence page signals loaded yet."],
    securityNote: "",
    essentials: ["Title: unavailable", "Domain: unavailable", "Path: /", "Language: und"],
    confidence: 0,
    copyText: ""
  });

  function normalizeSiteInsightPayload(payload = {}) {
    const pageType = String(payload.pageType || EMPTY_SITE_INSIGHT.pageType).slice(0, 96);
    const appearsToBe = String(payload.appearsToBe || payload.intent || EMPTY_SITE_INSIGHT.appearsToBe).slice(0, 140);
    const summary = String(payload.summary || EMPTY_SITE_INSIGHT.summary).slice(0, 320);
    const signals = Array.isArray(payload.signals) && payload.signals.length
      ? payload.signals.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5)
      : [...EMPTY_SITE_INSIGHT.signals];
    const securityNote = String(payload.securityNote || EMPTY_SITE_INSIGHT.securityNote).trim().slice(0, 220);
    const essentials = Array.isArray(payload.essentials) && payload.essentials.length
      ? payload.essentials.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
      : [...EMPTY_SITE_INSIGHT.essentials];
    const confidenceRaw = Number(payload.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, Number(confidenceRaw.toFixed(2))))
      : 0;
    const copyText = String(payload.copyText || "").trim() || [
      `Page Type: ${pageType}`,
      `Appears To Be: ${appearsToBe}`,
      `Summary: ${summary}`,
      ...(securityNote ? [`Security Note: ${securityNote}`] : []),
      ...essentials,
      ...(signals.length ? ["Key Signals:", ...signals.map((line) => `- ${line}`)] : [])
    ].join("\n");
    return { pageType, appearsToBe, summary, signals, securityNote, essentials, confidence, copyText };
  }

  function renderSiteInsightList(target, rows) {
    if (!target) return;
    target.innerHTML = "";
    rows.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      target.appendChild(li);
    });
  }

  let alertPreviewCursor = null;
  let siteInsightRequestSeq = 0;

  function getEnabledAlertKinds(alerts) {
    return Object.entries(alerts?.types || {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }

  function getPreferredAlertKind(alerts) {
    const enabledKinds = getEnabledAlertKinds(alerts);
    if (!enabledKinds.length) {
      alertPreviewCursor = null;
      return "eye";
    }
    if (alertPreviewCursor && enabledKinds.includes(alertPreviewCursor)) {
      return alertPreviewCursor;
    }
    alertPreviewCursor = enabledKinds[0];
    return alertPreviewCursor;
  }

  function advanceAlertPreviewKind(alerts, currentKind) {
    const enabledKinds = getEnabledAlertKinds(alerts);
    if (!enabledKinds.length) {
      alertPreviewCursor = null;
      return null;
    }
    const currentIndex = enabledKinds.indexOf(currentKind);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % enabledKinds.length;
    alertPreviewCursor = enabledKinds[nextIndex];
    return alertPreviewCursor;
  }

  function getAlertSoundLabel(alerts, kind) {
    const raw = String(alerts?.soundPattern || "auto");
    if (raw === "auto") return ALERT_KIND_SOUND_LABELS[kind] || "Soviet Beacon";
    return raw
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function renderAlerts() {
    const alerts = state.app.settings.alerts;
    const enabledTypes = getEnabledAlertKinds(alerts);
    const previewKind = getPreferredAlertKind(alerts);
    const hasPreviewKind = Boolean(alerts.enabled && enabledTypes.length);
    const previewKindLabel = ALERT_KIND_LABELS[previewKind] || "Health Alert";
    const previewSoundLabel = getAlertSoundLabel(alerts, previewKind);
    const previewChannels = [
      alerts.toastEnabled ? "live popup" : null,
      alerts.notificationEnabled ? "system" : null,
      alerts.soundEnabled ? "sound" : null
    ].filter(Boolean);

    setChecked(refs.alertsEnabled, alerts.enabled);
    setInputValue(refs.alertFrequency, alerts.frequencyMin);
    setInputValue(refs.alertCadence, alerts.cadenceMode || "focus_weighted");
    setChecked(refs.alertTypeEye, alerts.types.eye);
    setChecked(refs.alertTypePosture, alerts.types.posture);
    setChecked(refs.alertTypeBurnout, alerts.types.burnout);
    setChecked(refs.alertTypeHydration, alerts.types.hydration);
    setChecked(refs.alertTypeBlink, alerts.types.blink);
    setChecked(refs.alertTypeMovement, alerts.types.movement);
    setChecked(refs.alertSound, alerts.soundEnabled);
    setInputValue(refs.alertSoundVolume, alerts.soundVolume);
    refs.alertSoundVolumeValue.textContent = `${alerts.soundVolume}%`;
    setInputValue(refs.alertSoundPattern, alerts.soundPattern || "auto");
    setChecked(refs.alertToastEnabled, alerts.toastEnabled);
    setChecked(refs.alertNotificationEnabled, alerts.notificationEnabled);
    setInputValue(refs.alertSnoozeMinutes, alerts.snoozeMinutes || 10);
    setInputValue(refs.alertCooldown, alerts.cooldownMin || 0);
    setInputValue(refs.alertBurnoutThreshold, alerts.burnoutFocusThresholdMin || 90);
    refs.alertChannelSound?.classList.toggle("is-on", Boolean(alerts.soundEnabled));
    refs.alertChannelToast?.classList.toggle("is-on", Boolean(alerts.toastEnabled));
    refs.alertChannelNotification?.classList.toggle("is-on", Boolean(alerts.notificationEnabled));
    document
      .querySelectorAll("#alertsPanel .actions-row.alert-types .switch[data-alert-kind]")
      .forEach((tile) => {
        const kind = tile.getAttribute("data-alert-kind");
        tile.classList.toggle("is-preview-kind", Boolean(hasPreviewKind && kind === previewKind));
      });
    if (refs.alertPreviewSummary) {
      const channelText = previewChannels.length ? previewChannels.join(" + ") : "visual channels off";
      refs.alertPreviewSummary.textContent = `${previewKindLabel} · ${previewSoundLabel} · ${channelText}`;
    }

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
    const nowTs = Date.now();
    if (!alerts.enabled) {
      refs.alertStatus.textContent = "Alerts are off. Press Test Alert any time to verify popup and sound delivery.";
      return;
    }
    if (!alerts.notificationEnabled && !alerts.toastEnabled) {
      refs.alertStatus.textContent = "Sound can still run, but enable On-page or System if you want visible reminders during normal use.";
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
    refs.alertStatus.textContent = `${enabledTypeCount} reminder types · every ${alerts.frequencyMin}m (${cadenceLabel})`;
  }

  function renderMeditation() {
    const meditation = getMeditationState();
    const enabled = Boolean(meditation.enabled);
    const durationMin = Math.max(3, Math.min(20, Number(meditation.durationMin || 10)));
    const ambient = String(meditation.ambient || "brown_hush");
    const ambientLabel = MEDITATION_AMBIENT_LABELS[ambient] || "Brown Hush";
    const volume = Math.max(10, Math.min(100, Number(meditation.volume || 48)));

    setChecked(refs.meditationEnabled, enabled);
    setInputValue(refs.meditationLength, durationMin);
    setInputValue(refs.meditationAmbient, ambient);
    setInputValue(refs.meditationVolume, volume);
    if (refs.meditationVolumeValue) refs.meditationVolumeValue.textContent = `${volume}%`;
    if (refs.meditationPreviewSummary) {
      refs.meditationPreviewSummary.textContent = `${durationMin} min · ${ambientLabel} · centered on-page session`;
    }
    if (refs.meditationStart) refs.meditationStart.disabled = !enabled;

    if (!refs.meditationStatus) return;
    if (!enabled) {
      refs.meditationStatus.textContent = "Meditation popup is off. Turn it on when you want a guided pause ready in one click.";
      return;
    }
    refs.meditationStatus.textContent = `Ready for a ${durationMin}-minute ${ambientLabel} session with ${volume}% ambient level.`;
  }

  function renderSiteInsight() {
    const insight = state.app.settings.siteInsight || {};
    const host = state.currentHost || "Site unavailable";
    const siteDisabled = isSiteInsightDisabledForHost();
    const cached = normalizeSiteInsightPayload(state.pageInsight);
    setChecked(refs.siteInsightEnabled, insight.enabled);
    if (refs.siteInsightHostChip) refs.siteInsightHostChip.textContent = host;
    if (refs.siteInsightSummary) refs.siteInsightSummary.textContent = cached.summary;
    if (refs.siteInsightPageType) refs.siteInsightPageType.textContent = cached.pageType;
    if (refs.siteInsightAppears) refs.siteInsightAppears.textContent = cached.appearsToBe;
    renderSiteInsightList(refs.siteInsightSignals, cached.signals);
    if (refs.siteInsightSecurityBlock) refs.siteInsightSecurityBlock.hidden = !cached.securityNote;
    if (refs.siteInsightSecurity) refs.siteInsightSecurity.textContent = cached.securityNote || "";
    renderSiteInsightList(refs.siteInsightEssentials, cached.essentials);
    if (refs.siteInsightAnalyze) refs.siteInsightAnalyze.disabled = !state.currentHost || !insight.enabled || siteDisabled;
    if (refs.siteInsightCopy) refs.siteInsightCopy.disabled = !insight.enabled || siteDisabled || !cached.copyText;
    if (!refs.siteInsightStatus) return;
    if (!insight.enabled) {
      refs.siteInsightStatus.textContent = "Site Insight is off.";
      return;
    }
    if (siteDisabled) {
      refs.siteInsightStatus.textContent = "Insight disabled for this host in settings.";
      return;
    }
    if (!refs.siteInsightStatus.textContent.trim()) {
      refs.siteInsightStatus.textContent = "Ready.";
      return;
    }
    const confidencePct = Math.round((cached.confidence || 0) * 100);
    const statusText = refs.siteInsightStatus.textContent.replace(/\s·\s\d+% confidence$/, "");
    if (confidencePct > 0 && statusText.startsWith("Analyzed ")) {
      refs.siteInsightStatus.textContent = `${statusText} · ${confidencePct}% confidence`;
    }
  }

  async function refreshSiteInsightFromTab({ showToastOnSuccess = false } = {}) {
    const requestId = ++siteInsightRequestSeq;
    const tab = await queryCurrentTab();
    if (requestId !== siteInsightRequestSeq) return;
    state.currentHost = normalizeHost(tab?.url || "");

    if (!state.currentHost) {
      state.pageInsight = null;
      if (refs.siteInsightStatus) refs.siteInsightStatus.textContent = "No active website tab.";
      renderSiteInsight();
      return;
    }

    if (!state.app?.settings?.siteInsight?.enabled) {
      state.pageInsight = null;
      if (refs.siteInsightStatus) refs.siteInsightStatus.textContent = "Site Insight is off.";
      renderSiteInsight();
      return;
    }

    if (isSiteInsightDisabledForHost()) {
      state.pageInsight = null;
      if (refs.siteInsightStatus) refs.siteInsightStatus.textContent = "Insight disabled for this host in settings.";
      renderSiteInsight();
      return;
    }

    if (refs.siteInsightAnalyze) {
      refs.siteInsightAnalyze.disabled = true;
      refs.siteInsightAnalyze.textContent = "Analyzing...";
    }
    if (refs.siteInsightStatus) refs.siteInsightStatus.textContent = `Analyzing ${state.currentHost}...`;

    const response = await sendMessage({ type: "holmeta:collect-page-insight" });
    if (requestId !== siteInsightRequestSeq) return;
    if (refs.siteInsightAnalyze) {
      refs.siteInsightAnalyze.disabled = false;
      refs.siteInsightAnalyze.textContent = "Analyze Page";
    }

    if (!response?.ok || !response?.insight) {
      state.pageInsight = null;
      const reason = String(response?.error || "analysis_failed");
      if (refs.siteInsightStatus) {
        refs.siteInsightStatus.textContent = reason === "insight_disabled_for_site"
          ? "Insight disabled for this host in settings."
          : `Analyze failed: ${reason}`;
      }
      renderSiteInsight();
      return;
    }

    state.pageInsight = normalizeSiteInsightPayload(response.insight);
    if (refs.siteInsightStatus) refs.siteInsightStatus.textContent = `Analyzed ${state.currentHost}`;
    renderSiteInsight();
    if (showToastOnSuccess) toast(`Site Insight updated for ${state.currentHost}`);
  }

  function renderDeepWork() {
    const deep = state.app.settings.deepWork;
    const metrics = getTodayFocusMetrics();
    const countdownMs = Math.max(0, Number(deep.nextTransitionAt || 0) - Date.now());
    const automationLabel = describeDeepWorkAutomation(deep);
    const countdownLabel = deep.active
      ? formatCountdownClock(countdownMs)
      : `${Math.max(10, Number(deep.focusMin || 25))}m`;

    setInputValue(refs.pomodoroPreset, `${deep.focusMin}:${deep.breakMin}`);
    setChecked(refs.deepWorkAutoBlocker, deep.autoBlocker);
    setChecked(refs.deepWorkAutoLight, deep.autoLight);
    if (refs.deepWorkCycleValue) refs.deepWorkCycleValue.textContent = `${deep.focusMin} / ${deep.breakMin}`;
    if (refs.deepWorkTodayMinutes) refs.deepWorkTodayMinutes.textContent = formatMinutesCompact(metrics.totalMinutes);
    if (refs.deepWorkTodaySessions) refs.deepWorkTodaySessions.textContent = String(metrics.completedSessions);
    if (refs.deepWorkAutomationState) refs.deepWorkAutomationState.textContent = automationLabel;
    if (refs.deepWorkCountdown) refs.deepWorkCountdown.textContent = countdownLabel;

    if (!deep.active) {
      if (refs.deepWorkHeadline) refs.deepWorkHeadline.textContent = "Ready to engage";
      if (refs.deepWorkSubline) {
        refs.deepWorkSubline.textContent = `Queue a ${deep.focusMin}/${deep.breakMin} block. ${automationLabel === "Manual" ? "Run it manually or arm the helpers below." : `${automationLabel} will step in when the session starts.`}`;
      }
      if (refs.deepWorkPhaseBadge) {
        refs.deepWorkPhaseBadge.textContent = "Standby";
        refs.deepWorkPhaseBadge.className = "deep-work-phase-chip is-idle";
      }
      refs.startDeepWork.disabled = false;
      refs.stopDeepWork.disabled = true;
      refs.deepWorkStatus.textContent = `Idle · ${formatMinutesCompact(metrics.completedMinutes)} logged today across ${metrics.completedSessions} completed session${metrics.completedSessions === 1 ? "" : "s"}.`;
      return;
    }
    const minsLeft = Math.max(0, Math.ceil(countdownMs / 60000));
    const focusLive = deep.phase === "focus";

    if (refs.deepWorkHeadline) {
      refs.deepWorkHeadline.textContent = focusLive ? "Focus lane engaged" : "Recovery window active";
    }
    if (refs.deepWorkSubline) {
      refs.deepWorkSubline.textContent = focusLive
        ? `${automationLabel} ${automationLabel === "Manual" ? "is off" : "is holding the lane"} while you work. Keep the current block tight and intentional.`
        : `Break window is open for ${minsLeft}m. Reset posture, blink, hydrate, then re-enter the lane clean.`;
    }
    if (refs.deepWorkPhaseBadge) {
      refs.deepWorkPhaseBadge.textContent = focusLive ? "Focus live" : "Break live";
      refs.deepWorkPhaseBadge.className = `deep-work-phase-chip ${focusLive ? "is-focus" : "is-break"}`;
    }
    refs.startDeepWork.disabled = true;
    refs.stopDeepWork.disabled = false;
    refs.deepWorkStatus.textContent = `${focusLive ? "Focus" : "Break"} · ${minsLeft}m remaining · ${formatMinutesCompact(metrics.totalMinutes)} captured today.`;
  }

  function renderAdvanced() {
    const adv = state.app.settings.advanced;
    const premium = hasExtensionAccess();
    const enabledCount = [adv.biofeedback, adv.morphing, adv.taskWeaver, adv.dashboardPredictions, adv.collaborativeSync]
      .filter(Boolean).length;
    const prediction = getDeepWorkPrediction();

    if (!premium || !adv.taskWeaver) {
      state.weaverResults = [];
    }

    setChecked(refs.biofeedbackEnabled, adv.biofeedback);
    setChecked(refs.morphingEnabled, adv.morphing);
    setChecked(refs.taskWeaverEnabled, adv.taskWeaver);
    setChecked(refs.dashboardPredictionsEnabled, adv.dashboardPredictions);
    setChecked(refs.collabSyncEnabled, adv.collaborativeSync);

    if (refs.advancedLabStatus) {
      if (!premium) {
        refs.advancedLabStatus.textContent = "Premium lab locked. Upgrade to activate local experimental modules for focus shaping, workflow weaving, and sync snapshots.";
      } else if (!enabledCount) {
        refs.advancedLabStatus.textContent = "No lab modules are armed yet. Start with Task Weaver and Dashboard Predictions for the quickest lift.";
      } else if (state.weaverResults.length) {
        const lead = state.weaverResults[0];
        refs.advancedLabStatus.textContent = `${enabledCount} lab module${enabledCount === 1 ? "" : "s"} active. Current lead move: ${lead.lane} · ${lead.title}.`;
      } else {
        refs.advancedLabStatus.textContent = `${enabledCount} lab module${enabledCount === 1 ? "" : "s"} active. Run Weave Workflow or copy a Focus Sync snapshot to put them to work.`;
      }
    }

    if (refs.advancedLabPrediction) {
      refs.advancedLabPrediction.textContent = adv.dashboardPredictions
        ? `Predicted next protocol: ${prediction.recommended}. ${prediction.detail}`
        : "Enable Dashboard Predictions to turn your recent focus history into a calmer next-session recommendation.";
    }

    if (refs.taskWeaver) {
      refs.taskWeaver.textContent = state.weaverResults.length ? "Re-Weave Workflow" : "Weave Workflow";
    }
    if (refs.collabSync) {
      refs.collabSync.textContent = state.weaverResults.length ? "Copy Sync Snapshot" : "Focus Sync Snapshot";
    }

    renderWeaver(state.weaverResults);
  }

  function renderWeaver(list = []) {
    refs.weaverResults.innerHTML = "";
    if (!Array.isArray(list) || !list.length) {
      if (!hasExtensionAccess()) return;
      const li = document.createElement("li");
      li.className = "advanced-lab-result is-empty";
      li.textContent = state.app?.settings?.advanced?.taskWeaver
        ? "Run Weave Workflow to turn your current tab stack into a cleaner execution sequence."
        : "Enable Task Weaver to generate a focused run order from the tabs already open in this window.";
      refs.weaverResults.appendChild(li);
      return;
    }
    list.slice(0, 5).forEach((item) => {
      const li = document.createElement("li");
      li.className = "advanced-lab-result";

      const head = document.createElement("div");
      head.className = "advanced-lab-result-head";

      const titleWrap = document.createElement("div");
      titleWrap.className = "advanced-lab-result-copy";

      const lane = document.createElement("span");
      lane.className = "advanced-lab-result-lane";
      lane.textContent = item.lane || "Sequence";

      const title = document.createElement("strong");
      title.textContent = item.title || "Protocol move";

      titleWrap.append(lane, title);
      head.appendChild(titleWrap);

      if (item.url) {
        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "ghost advanced-lab-open";
        openButton.textContent = "Open";
        openButton.addEventListener("click", () => {
          chrome.tabs.create({ url: String(item.url) });
        });
        head.appendChild(openButton);
      }

      const reason = document.createElement("span");
      reason.className = "advanced-lab-result-reason";
      reason.textContent = item.reason || "No rationale available.";

      li.append(head, reason);
      refs.weaverResults.appendChild(li);
    });
  }

  function render() {
    if (!state.app) return;
    applyPopupToolRegistry();
    renderPremium();
    renderAccessGate();
    renderDashboard();
    renderVault();
    if (!hasExtensionAccess()) {
      refs.onboarding.hidden = true;
      setStatus("Access locked. Reactivate subscription to continue.");
      return;
    }
    renderFavorites();
    renderReadingTheme();
    renderLight();
    renderScreenEmulator();
    renderEyeDropper();
    renderScreenshotTool();
    renderTranslateTool();
    renderBlocker();
    renderAlerts();
    renderMeditation();
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
      if (response.state) {
        state.app = response.state;
        render();
      }
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

  async function runTranslateAction(type, payload = {}, successText = "") {
    await flushPatchNow();
    const response = await sendMessage({ type, payload });
    if (!response?.ok) {
      toast(`Translate failed: ${response?.error || "unknown"}`);
      return { ok: false, error: response?.error || "translate_failed" };
    }

    if (response.state) {
      state.app = response.state;
      await refreshDiagnostics();
      render();
    }

    if (response.entry) {
      state.translateLastEntry = response.entry;
      state.translateOutputDraft = String(response.entry.translatedText || "");
      setInputValue(refs.translateOutput, state.translateOutputDraft);
    }

    if (successText) {
      toast(successText);
    }

    return response;
  }

  async function runDayNightAction(action, payload = {}, successText = "") {
    await flushPatchNow();
    const tab = await queryCurrentTab();
    const tabId = Number(tab?.id || 0);
    if (!Number.isInteger(tabId) || tabId <= 0) {
      toast("Appearance action unavailable on this page.");
      return { ok: false, error: "invalid_tab" };
    }

    const response = await sendMessage({
      type: "holmeta:daynight-action",
      tabId,
      action: String(action || ""),
      payload
    });

    if (!response?.ok) {
      toast(`Appearance action failed: ${response?.error || "unknown"}`);
      return { ok: false, error: response?.error || "daynight_action_failed" };
    }

    if (response.result?.settings) {
      state.app.settings = response.result.settings;
      render();
    }

    if (successText) toast(successText);
    return response;
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
      sendMessage({ type: "holmeta:get-state", source: "popup" }),
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
    state.translateInputDraft = "";
    state.translateOutputDraft = "";
    state.translateLastEntry = null;
    await refreshDiagnostics();

    state.hydrated = true;
    render();
    void refreshSiteInsightFromTab();

    if (!hasExtensionAccess()) {
      refs.onboarding.hidden = true;
      return;
    }

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

  function openBilling() {
    chrome.tabs.create({ url: BILLING_URL });
  }

  function openExternal(url) {
    chrome.tabs.create({ url });
  }

  async function handleBiofeedbackToggle(nextEnabled) {
    if (!hasExtensionAccess()) {
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

  function setAdvancedToggle(nextKey, nextEnabled, ref) {
    if (!hasExtensionAccess()) {
      if (ref) ref.checked = false;
      toast("Premium feature – upgrade at holmeta.com");
      return;
    }
    queuePatch({ advanced: { [nextKey]: nextEnabled } });
  }

  function currentReadingPatchFromUI() {
    const appearance = refs.readingThemeAuto.classList.contains("is-active")
      ? "adaptive"
      : refs.readingThemeLight.classList.contains("is-active")
        ? "light"
        : "dark";
    const darkVariant = normalizeReadingDarkVariant(refs.readingThemeDarkVariant?.value, "coal");
    const lightVariant = normalizeReadingLightVariant(refs.readingThemeLightVariant?.value, "white");
    const scheduleMode = "system";
    const schedule = {
      enabled: false,
      useSunset: false,
      start: "20:00",
      end: "06:00"
    };
    const opaqueBackground = Boolean(refs.readingThemeOpaqueBackground?.checked);
    const pointerCursors = Boolean(refs.readingThemePointerCursors?.checked);
    const preserveImages = Boolean(refs.readingThemePreserveImages?.checked);
    const preserveLogos = Boolean(refs.readingThemePreserveLogos?.checked);
    const higherContrast = Boolean(refs.readingThemeHigherContrast?.checked);
    const softerSurfaces = Boolean(refs.readingThemeSofterSurfaces?.checked);
    const sansFontSize = normalizeReadingFontSize(refs.readingThemeSansSize?.value, 13);
    const sansFontFamily = normalizeReadingFontFamily(
      refs.readingThemeSansFamily?.value,
      "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    );
    const codeFontSize = normalizeReadingFontSize(refs.readingThemeCodeSize?.value, 12);
    const codeFontFamily = normalizeReadingFontFamily(
      refs.readingThemeCodeFamily?.value,
      "ui-monospace, \"SFMono-Regular\", Menlo, Consolas, monospace"
    );
    let mode = appearance === "light" ? "light" : "dark";
    if (appearance === "adaptive") {
      const diagnosticsMode = String(state.diagnostics?.readingAppearance?.mode || state.diagnostics?.readingMode || "");
      mode = diagnosticsMode === "light" ? "light" : "dark";
    }
    const preset = readingPresetForVariants(mode, darkVariant, lightVariant);
    const current = getReadingSiteProfile() || getReadingThemeState();
    const targetIntensity = baseReadingIntensity(mode, darkVariant, lightVariant);
    const existingIntensity = Number(current?.intensity);
    const intensity = Number.isFinite(existingIntensity)
      ? Math.max(Math.round(Math.max(0, Math.min(100, existingIntensity))), targetIntensity)
      : targetIntensity;
    return {
      appearance,
      darkVariant,
      darkThemeVariant: darkVariant,
      lightVariant,
      lightThemeVariant: lightVariant,
      scheduleMode,
      schedule,
      mode,
      preset,
      intensity,
      opaqueBackground,
      pointerCursors,
      preserveImages,
      preserveLogos,
      higherContrast,
      softerSurfaces,
      sansFontSize,
      sansFontFamily,
      codeFontSize,
      codeFontFamily
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

  function applyLightPreset(presetKey) {
    const presets = {
      comfort: {
        mode: "amber_focus",
        spectrumPreset: "melatonin_guard",
        intensity: 58,
        dim: 18,
        contrastSoft: 10,
        brightness: 96,
        saturation: 102,
        blueCut: 74,
        tintRed: 100,
        tintGreen: 64,
        tintBlue: 28,
        reduceWhites: true,
        videoSafe: true,
        spotlightEnabled: false,
        therapyMode: false
      },
      deep_night: {
        mode: "deep_night",
        spectrumPreset: "amber_590",
        intensity: 76,
        dim: 26,
        contrastSoft: 14,
        brightness: 90,
        saturation: 92,
        blueCut: 82,
        tintRed: 100,
        tintGreen: 54,
        tintBlue: 18,
        reduceWhites: true,
        videoSafe: true,
        spotlightEnabled: false,
        therapyMode: false
      },
      infrared: {
        mode: "near_infrared",
        spectrumPreset: "deep_red_660",
        intensity: 90,
        dim: 34,
        contrastSoft: 18,
        brightness: 88,
        saturation: 72,
        blueCut: 100,
        tintRed: 100,
        tintGreen: 24,
        tintBlue: 6,
        reduceWhites: true,
        videoSafe: false,
        spotlightEnabled: false,
        therapyMode: false
      },
      red_lock: {
        mode: "red_lock",
        spectrumPreset: "deep_red_660",
        intensity: 100,
        dim: 40,
        contrastSoft: 20,
        brightness: 84,
        saturation: 68,
        blueCut: 100,
        tintRed: 100,
        tintGreen: 12,
        tintBlue: 0,
        reduceWhites: true,
        videoSafe: false,
        spotlightEnabled: false,
        therapyMode: false
      }
    };
    const next = presets[String(presetKey || "")];
    if (!next) return;
    queueLightPatch(next);
    toast(`Light Filter preset armed: ${String(presetKey).replace(/_/g, " ")}`);
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

  function setReadingExcludeSite(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      if (refs.readingThemeExcludeSite) refs.readingThemeExcludeSite.checked = false;
      return;
    }
    const reading = getReadingThemeState();
    const map = { ...(reading.excludedSites || {}) };
    if (enabled) map[state.currentHost] = true;
    else delete map[state.currentHost];
    queuePatch({ readingTheme: { excludedSites: map } });
  }

  function setReadingAppearanceWithEnable(appearance) {
    const safeAppearance = ["light", "dark", "adaptive"].includes(String(appearance || ""))
      ? String(appearance)
      : "dark";
    const patch = currentReadingPatchFromUI();
    patch.appearance = safeAppearance;
    patch.schedule.enabled = false;
    if (safeAppearance === "light") patch.mode = "light";
    else if (safeAppearance === "dark") patch.mode = "dark";
    patch.preset = readingPresetForVariants(patch.mode, patch.darkVariant, patch.lightVariant);
    patch.intensity = Math.max(
      Math.round(Math.max(0, Math.min(100, Number(patch.intensity ?? 0)))),
      baseReadingIntensity(patch.mode, patch.darkVariant, patch.lightVariant)
    );
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

  function setTranslateSitePreference(partial) {
    if (!state.currentHost) {
      toast("No active website detected.");
      return;
    }
    const translate = getTranslateSettings();
    const map = {
      ...(translate.perSitePreferences && typeof translate.perSitePreferences === "object"
        ? translate.perSitePreferences
        : {})
    };
    const current = map[state.currentHost] && typeof map[state.currentHost] === "object"
      ? map[state.currentHost]
      : {};
    map[state.currentHost] = deepMerge(current, partial);
    queueTranslatePatch({ perSitePreferences: map });
  }

  function removeTranslateSitePreference() {
    if (!state.currentHost) {
      toast("No active website detected.");
      return;
    }
    const translate = getTranslateSettings();
    const map = {
      ...(translate.perSitePreferences && typeof translate.perSitePreferences === "object"
        ? translate.perSitePreferences
        : {})
    };
    delete map[state.currentHost];
    queueTranslatePatch({ perSitePreferences: map });
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
    bindVaultEvents();

    refs.dashboardWorkStart?.addEventListener("input", (event) => {
      initDashboardState();
      if (!state.dashboard) return;
      state.dashboard.workStart = String(event.target?.value || "09:00");
      writeLocalString(DASHBOARD_STORAGE_KEYS.workStart, state.dashboard.workStart);
      renderDashboardClockFrame();
    });

    refs.dashboardWorkEnd?.addEventListener("input", (event) => {
      initDashboardState();
      if (!state.dashboard) return;
      state.dashboard.workEnd = String(event.target?.value || "17:00");
      writeLocalString(DASHBOARD_STORAGE_KEYS.workEnd, state.dashboard.workEnd);
      renderDashboardClockFrame();
    });

    refs.dashboardAddClock?.addEventListener("click", () => {
      openDashboardCityModal();
    });

    refs.dashboardCityClose?.addEventListener("click", () => {
      closeDashboardCityModal();
    });

    refs.dashboardCityModal?.addEventListener("click", (event) => {
      if (event.target === refs.dashboardCityModal) {
        closeDashboardCityModal();
      }
    });

    refs.dashboardCitySearch?.addEventListener("input", (event) => {
      renderDashboardCitySuggestions(String(event.target?.value || ""));
    });

    refs.dashboardCitySearch?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDashboardCityModal();
      }
    });

    refs.dashboardCitySuggestions?.addEventListener("click", (event) => {
      const node = event.target?.closest?.("[data-dash-city]");
      if (!node) return;
      initDashboardState();
      if (!state.dashboard) return;
      const name = String(node.dataset?.dashCity || "").trim();
      const tz = String(node.dataset?.dashTz || "").trim();
      const code = String(node.dataset?.dashCode || "").trim();
      if (!name || !tz) return;
      const exists = state.dashboard.clocks.some((clock) => clock.name === name && clock.tz === tz);
      if (!exists) {
        state.dashboard.clocks.push({ name, tz, code });
        state.dashboard.clocks = state.dashboard.clocks.slice(0, 8);
        saveDashboardClocks();
        renderDashboardClocks();
        renderDashboardClockFrame();
      }
      closeDashboardCityModal();
    });

    refs.dashboardClocks?.addEventListener("click", (event) => {
      const removeNode = event.target?.closest?.("[data-dash-clock-remove]");
      if (!removeNode) return;
      initDashboardState();
      if (!state.dashboard) return;
      const index = Number(removeNode.dataset?.dashClockRemove);
      if (!Number.isInteger(index) || index < 0 || index >= state.dashboard.clocks.length) return;
      state.dashboard.clocks.splice(index, 1);
      saveDashboardClocks();
      renderDashboardClocks();
      renderDashboardClockFrame();
    });

    refs.dashboardWeatherRefresh?.addEventListener("click", () => {
      initDashboardState();
      void fetchDashboardWeather(true);
    });

    refs.dashboardTaskAdd?.addEventListener("click", () => {
      addDashboardTask();
    });

    refs.dashboardTaskInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addDashboardTask();
      }
    });

    refs.dashboardTaskList?.addEventListener("click", (event) => {
      const toggleNode = event.target?.closest?.("[data-dash-task-toggle]");
      if (toggleNode) {
        toggleDashboardTask(toggleNode.dataset?.dashTaskToggle);
        return;
      }
      const removeNode = event.target?.closest?.("[data-dash-task-remove]");
      if (removeNode) {
        removeDashboardTask(removeNode.dataset?.dashTaskRemove);
      }
    });

    refs.dashboardPomoStart?.addEventListener("click", () => {
      startDashboardPomo();
    });

    refs.dashboardPomoPause?.addEventListener("click", () => {
      pauseDashboardPomo();
    });

    refs.dashboardPomoReset?.addEventListener("click", () => {
      resetDashboardPomo();
    });

    refs.readingThemeEnabled.addEventListener("change", async (e) => {
      const enabled = Boolean(e.target.checked);
      if (enabled) {
        const patch = currentReadingPatchFromUI();
        queueReadingPatch({
          enabled: true,
          appearance: patch.appearance,
          mode: patch.mode,
          preset: patch.preset,
          intensity: patch.intensity,
          darkVariant: patch.darkVariant,
          darkThemeVariant: patch.darkVariant,
          lightVariant: patch.lightVariant,
          lightThemeVariant: patch.lightVariant
        });
      } else {
        queueReadingPatch({ enabled: false });
      }
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });
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
      setReadingAppearanceWithEnable("adaptive");
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeDarkVariant.addEventListener("change", async () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({
        darkVariant: patch.darkVariant,
        darkThemeVariant: patch.darkVariant,
        mode: patch.mode,
        preset: patch.preset,
        intensity: patch.intensity
      });
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeLightVariant.addEventListener("change", async () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({
        lightVariant: patch.lightVariant,
        lightThemeVariant: patch.lightVariant,
        mode: patch.mode,
        preset: patch.preset,
        intensity: patch.intensity
      });
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeScheduleMode?.addEventListener("change", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({
        appearance: patch.appearance,
        scheduleMode: patch.scheduleMode,
        schedule: patch.schedule,
        mode: patch.mode,
        preset: patch.preset
      });
    });

    refs.readingThemeOpaqueBackground?.addEventListener("change", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ opaqueBackground: patch.opaqueBackground });
    });

    refs.readingThemePointerCursors?.addEventListener("change", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ pointerCursors: patch.pointerCursors });
    });

    refs.readingThemePreserveImages?.addEventListener("change", async () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ preserveImages: patch.preserveImages });
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemePreserveLogos?.addEventListener("change", async () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ preserveLogos: patch.preserveLogos });
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeHigherContrast?.addEventListener("change", async () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ higherContrast: patch.higherContrast });
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeSofterSurfaces?.addEventListener("change", async () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ softerSurfaces: patch.softerSurfaces });
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });

    refs.readingThemeSansSize?.addEventListener("input", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ sansFontSize: patch.sansFontSize });
    });

    refs.readingThemeSansFamily?.addEventListener("input", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ sansFontFamily: patch.sansFontFamily });
    });

    refs.readingThemeCodeSize?.addEventListener("input", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ codeFontSize: patch.codeFontSize });
    });

    refs.readingThemeCodeFamily?.addEventListener("input", () => {
      const patch = currentReadingPatchFromUI();
      queueReadingPatch({ codeFontFamily: patch.codeFontFamily });
    });

    refs.readingThemeExcludeSite?.addEventListener("change", async (e) => {
      setReadingExcludeSite(e.target.checked);
      await applyAllTabs({ ensureLightEnabled: false, quiet: true });
    });
    refs.readingThemeShowWidget?.addEventListener("click", async () => {
      await runDayNightAction("showWidget", {}, "Appearance widget shown on this site.");
    });
    refs.readingThemeHideWidget?.addEventListener("click", async () => {
      await runDayNightAction("hideWidget", {}, "Appearance widget hidden on this site.");
    });
    refs.lightEnabled.addEventListener("change", (e) => queuePatch({ lightFilter: { enabled: e.target.checked } }));
    refs.lightPresetComfort?.addEventListener("click", () => applyLightPreset("comfort"));
    refs.lightPresetDeepNight?.addEventListener("click", () => applyLightPreset("deep_night"));
    refs.lightPresetInfrared?.addEventListener("click", () => applyLightPreset("infrared"));
    refs.lightPresetRedLock?.addEventListener("click", () => applyLightPreset("red_lock"));
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

    refs.translateEnabled.addEventListener("change", (event) => {
      queueTranslatePatch({ enabled: Boolean(event.target.checked) });
    });
    refs.translateSourceLang.addEventListener("change", (event) => {
      queueTranslatePatch({ sourceLanguage: String(event.target.value || "auto") });
    });
    refs.translateTargetLang.addEventListener("change", (event) => {
      const value = String(event.target.value || "en");
      const current = getTranslateSettings();
      const recent = [value, ...(Array.isArray(current.recentLanguages) ? current.recentLanguages : []).filter((lang) => lang !== value)].slice(0, 8);
      queueTranslatePatch({
        targetLanguage: value,
        recentLanguages: recent
      });
    });
    refs.translateInput.addEventListener("input", (event) => {
      state.translateInputDraft = String(event.target.value || "");
    });
    refs.translateChipEnabled.addEventListener("change", (event) => {
      queueTranslatePatch({ autoShowSelectionChip: Boolean(event.target.checked) });
    });
    refs.translateHistoryEnabled.addEventListener("change", (event) => {
      queueTranslatePatch({ historyEnabled: Boolean(event.target.checked) });
    });
    refs.translatePreserveCode.addEventListener("change", (event) => {
      queueTranslatePatch({ preserveCodeBlocks: Boolean(event.target.checked) });
    });
    refs.translateShowOriginalHover.addEventListener("change", (event) => {
      queueTranslatePatch({ showOriginalOnHover: Boolean(event.target.checked) });
    });
    refs.translateSideBySide.addEventListener("change", (event) => {
      queueTranslatePatch({ enableSideBySide: Boolean(event.target.checked) });
    });
    refs.translateProvider.addEventListener("change", (event) => {
      queueTranslatePatch({ provider: String(event.target.value || "local_lite") });
    });

    refs.translateInputRun.addEventListener("click", async () => {
      const text = String(state.translateInputDraft || refs.translateInput.value || "").trim();
      if (!text) {
        toast("Enter text to translate.");
        return;
      }
      const response = await runTranslateAction(
        "holmeta:translate-text",
        {
          text,
          sourceLang: refs.translateSourceLang.value || "auto",
          targetLang: refs.translateTargetLang.value || "en"
        },
        "Text translated."
      );
      if (response?.ok && response.entry) {
        state.translateLastEntry = response.entry;
        state.translateOutputDraft = String(response.entry.translatedText || "");
      }
      renderTranslateTool();
    });

    refs.translateSelectionRun.addEventListener("click", async () => {
      const response = await runTranslateAction(
        "holmeta:translate-selection",
        {
          sourceLang: refs.translateSourceLang.value || "auto",
          targetLang: refs.translateTargetLang.value || "en"
        },
        "Selection translated."
      );
      if (response?.ok && response.entry) {
        state.translateLastEntry = response.entry;
        state.translateOutputDraft = String(response.entry.translatedText || "");
      }
      renderTranslateTool();
    });

    refs.translatePageRun.addEventListener("click", async () => {
      const response = await runTranslateAction(
        "holmeta:translate-page",
        {
          sourceLang: refs.translateSourceLang.value || "auto",
          targetLang: refs.translateTargetLang.value || "en"
        },
        "Page translated."
      );
      if (response?.ok && Number(response.applied || 0) > 0) {
        refs.translateStatus.textContent = `Translated ${response.applied} page text nodes.`;
      }
    });

    refs.translateSectionRun.addEventListener("click", async () => {
      const response = await runTranslateAction(
        "holmeta:translate-section",
        {
          sourceLang: refs.translateSourceLang.value || "auto",
          targetLang: refs.translateTargetLang.value || "en"
        },
        "Section translated."
      );
      if (response?.ok && Number(response.applied || 0) > 0) {
        refs.translateStatus.textContent = `Translated ${response.applied} section text nodes.`;
      }
    });

    refs.translateVisibleRun.addEventListener("click", async () => {
      const response = await runTranslateAction(
        "holmeta:translate-visible",
        {
          sourceLang: refs.translateSourceLang.value || "auto",
          targetLang: refs.translateTargetLang.value || "en"
        },
        "Visible content translated."
      );
      if (response?.ok && Number(response.applied || 0) > 0) {
        refs.translateStatus.textContent = `Translated ${response.applied} visible text nodes.`;
      }
    });

    refs.translateOverlayRun.addEventListener("click", async () => {
      const response = await runTranslateAction(
        "holmeta:translate-overlay",
        {
          sourceLang: refs.translateSourceLang.value || "auto",
          targetLang: refs.translateTargetLang.value || "en"
        },
        "Overlay translation opened."
      );
      if (response?.ok && Number(response.rows || 0) > 0) {
        refs.translateStatus.textContent = `Overlay generated with ${response.rows} translated rows.`;
      }
    });

    refs.translateRestoreRun.addEventListener("click", async () => {
      const response = await runTranslateAction("holmeta:translate-restore", {}, "Original text restored.");
      if (response?.ok) {
        refs.translateStatus.textContent = "Original page text restored.";
      }
    });

    refs.translateSaveLast.addEventListener("click", async () => {
      if (!state.translateLastEntry) {
        toast("Run a translation first.");
        return;
      }
      const response = await sendMessage({
        type: "holmeta:translate-save-phrase",
        entry: state.translateLastEntry
      });
      if (!response?.ok) {
        toast(`Save failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      renderTranslateTool();
      toast("Phrase saved.");
    });

    refs.translateSiteDisable.addEventListener("change", (event) => {
      const checked = Boolean(event.target.checked);
      if (!state.currentHost) {
        refs.translateSiteDisable.checked = false;
        toast("No active website detected.");
        return;
      }
      if (checked) {
        setTranslateSitePreference({ disabled: true });
      } else {
        const pref = getTranslateSitePreference();
        if (pref && !pref.autoTranslateArticles && pref.autoShowSelectionChip !== false) {
          removeTranslateSitePreference();
        } else {
          setTranslateSitePreference({ disabled: false });
        }
      }
    });

    refs.translateSiteAutoChip.addEventListener("change", (event) => {
      const checked = Boolean(event.target.checked);
      setTranslateSitePreference({ autoShowSelectionChip: checked, disabled: false });
    });

    refs.translateSiteAutoArticle.addEventListener("change", (event) => {
      const checked = Boolean(event.target.checked);
      setTranslateSitePreference({ autoTranslateArticles: checked, disabled: false });
    });

    refs.translateClearHistory.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:translate-clear-history" });
      if (!response?.ok) {
        toast(`Clear failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      renderTranslateTool();
      toast("Translation history cleared.");
    });

    refs.translateClearSaved.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:translate-clear-saved" });
      if (!response?.ok) {
        toast(`Clear failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      renderTranslateTool();
      toast("Saved phrases cleared.");
    });

    const handleTranslateListClick = async (event) => {
      const copyBtn = event.target.closest("[data-translate-copy]");
      if (copyBtn) {
        const id = String(copyBtn.getAttribute("data-translate-copy") || "");
        const source = [...getTranslateHistory(), ...getSavedPhrases()].find((row) => String(row.id || "") === id);
        if (!source) return;
        const ok = await copyToClipboard(String(source.translatedText || ""));
        toast(ok ? "Copied translation." : "Copy failed.");
        return;
      }

      const removeBtn = event.target.closest("[data-translate-remove]");
      if (!removeBtn) return;
      const token = String(removeBtn.getAttribute("data-translate-remove") || "");
      const [kind, id] = token.split(":");
      if (!kind || !id) return;
      const type = kind === "saved" ? "holmeta:translate-remove-saved" : "holmeta:translate-remove-history";
      const response = await sendMessage({ type, id });
      if (!response?.ok) {
        toast(`Remove failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      renderTranslateTool();
    };

    refs.translateHistoryList.addEventListener("click", handleTranslateListClick);
    refs.translateSavedList.addEventListener("click", handleTranslateListClick);

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
        const ok = window.confirm("Enable Lockdown Mode? This will block most websites except allowed hosts.");
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
      const hostBlocked = Boolean((state.app?.settings?.blocker?.blockedDomains || []).includes(state.currentHost));
      const response = await sendMessage({
        type: hostBlocked ? "holmeta:remove-blocked-domain" : "holmeta:add-blocked-domain",
        host: state.currentHost
      });
      if (!response.ok) {
        toast(`Failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      if (hostBlocked) {
        toast(response.removed ? `Unblocked ${state.currentHost}` : `${state.currentHost} was not in blocked list`);
      } else {
        toast(`Blocked ${state.currentHost}`);
      }
    });

    refs.toggleWhitelistSite.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:toggle-blocker-whitelist-site", host: state.currentHost });
      if (!response.ok) {
        toast(`Allow rule update failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(response.whitelisted ? `Allowed ${state.currentHost}` : `Removed allow rule for ${state.currentHost}`);
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
      const previousText = refs.refreshBlockLists.textContent;
      refs.refreshBlockLists.textContent = "Refreshing...";
      const response = await sendMessage({ type: "holmeta:refresh-blocker-lists" });
      refs.refreshBlockLists.disabled = false;
      refs.refreshBlockLists.textContent = previousText || "Refresh Lists";
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
    refs.alertSoundPattern.addEventListener("change", (e) => queuePatch({ alerts: { soundPattern: String(e.target.value || "auto") } }));
    refs.alertToastEnabled.addEventListener("change", (e) => queuePatch({ alerts: { toastEnabled: e.target.checked } }));
    refs.alertNotificationEnabled.addEventListener("change", (e) => queuePatch({ alerts: { notificationEnabled: e.target.checked } }));
    refs.alertSnoozeMinutes.addEventListener("change", (e) => queuePatch({ alerts: { snoozeMinutes: Number(e.target.value || 10) } }));
    refs.alertCooldown.addEventListener("change", (e) => queuePatch({ alerts: { cooldownMin: Number(e.target.value || 0) } }));
    refs.alertBurnoutThreshold.addEventListener("change", (e) => queuePatch({ alerts: { burnoutFocusThresholdMin: Number(e.target.value || 90) } }));

    refs.testAlert.addEventListener("click", async () => {
      const alerts = state.app?.settings?.alerts || {};
      const enabledKinds = getEnabledAlertKinds(alerts);
      if (!enabledKinds.length) {
        const message = "Enable at least one reminder type before running a preview.";
        refs.alertStatus.textContent = message;
        toast(message);
        return;
      }
      const kind = getPreferredAlertKind(alerts);
      const response = await sendMessage({ type: "holmeta:test-alert", kind });
      const kindLabel = ALERT_KIND_LABELS[kind] || "Health";
      const kindPreview = ALERT_KIND_PREVIEW_TEXT[kind] || "Short reset cue delivered.";
      const patternLabel = alerts.soundPattern === "auto"
        ? `Auto sound · ${ALERT_KIND_SOUND_LABELS[kind] || "Beacon"}`
        : `Sound pattern · ${String(alerts.soundPattern || "auto").replace(/_/g, " ")}`;
      if (!response.ok) {
        const reason = String(response.reason || response.error || "unknown");
        refs.alertStatus.textContent = `Test failed: ${reason}`;
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
        refs.alertStatus.textContent = "Test ran, but no visible or audible channels were reachable on this page.";
        toast("Test alert ran, but no output channels were reachable on this page.");
        return;
      }
      const summary = `Previewed ${kindLabel}. ${kindPreview} ${patternLabel}. Delivered via ${channels.join(", ")}.`;
      refs.alertStatus.textContent = summary;
      advanceAlertPreviewKind(state.app?.settings?.alerts || alerts, kind);
      renderAlerts();
      toast(summary);
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

    refs.meditationEnabled?.addEventListener("change", (e) => {
      queuePatch({ meditation: { enabled: e.target.checked } });
    });
    refs.meditationLength?.addEventListener("change", (e) => {
      queuePatch({ meditation: { durationMin: Number(e.target.value || 10) } });
    });
    refs.meditationAmbient?.addEventListener("change", (e) => {
      queuePatch({ meditation: { ambient: String(e.target.value || "brown_hush") } });
    });
    refs.meditationVolume?.addEventListener("input", (e) => {
      const value = Math.max(10, Math.min(100, Number(e.target.value || 48)));
      if (refs.meditationVolumeValue) refs.meditationVolumeValue.textContent = `${value}%`;
      queuePatch({ meditation: { volume: value } });
    });

    refs.meditationPreview?.addEventListener("click", async () => {
      const meditation = getMeditationState();
      const response = await sendMessage({ type: "holmeta:test-meditation" });
      const ambientLabel = MEDITATION_AMBIENT_LABELS[String(meditation.ambient || "brown_hush")] || "Brown Hush";
      const durationMin = Math.max(3, Math.min(20, Number(meditation.durationMin || 10)));
      if (!response.ok) {
        const reason = String(response.reason || response.error || "unknown");
        refs.meditationStatus.textContent = `Preview failed: ${reason}`;
        toast(`Meditation preview failed: ${reason}`);
        return;
      }
      const channels = [
        response.delivery?.toast ? "live popup" : null,
        response.delivery?.sound ? `ambient (${response.delivery?.soundChannel || "unknown"})` : null
      ].filter(Boolean);
      const summary = `Previewed ${durationMin}-minute ${ambientLabel}. Delivered via ${channels.join(", ") || "no channels"}.`;
      refs.meditationStatus.textContent = summary;
      toast(summary);
    });

    refs.meditationStart?.addEventListener("click", async () => {
      const meditation = getMeditationState();
      if (!meditation.enabled) {
        refs.meditationStatus.textContent = "Turn Meditation Popup on before starting a session.";
        toast("Turn Meditation Popup on before starting a session.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:start-meditation" });
      const ambientLabel = MEDITATION_AMBIENT_LABELS[String(meditation.ambient || "brown_hush")] || "Brown Hush";
      const durationMin = Math.max(3, Math.min(20, Number(meditation.durationMin || 10)));
      if (!response.ok) {
        const reason = String(response.reason || response.error || "unknown");
        refs.meditationStatus.textContent = `Start failed: ${reason}`;
        toast(`Meditation session failed: ${reason}`);
        return;
      }
      const channels = [
        response.delivery?.toast ? "live popup" : null,
        response.delivery?.sound ? `ambient (${response.delivery?.soundChannel || "unknown"})` : null
      ].filter(Boolean);
      const summary = `Started ${durationMin}-minute ${ambientLabel}. Live via ${channels.join(", ") || "no channels"}.`;
      refs.meditationStatus.textContent = summary;
      toast(summary);
    });

    refs.meditationStop?.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:stop-meditation" });
      if (!response.ok) {
        const reason = String(response.reason || response.error || "unknown");
        refs.meditationStatus.textContent = `Stop failed: ${reason}`;
        toast(`Stop failed: ${reason}`);
        return;
      }
      refs.meditationStatus.textContent = "Meditation session stopped.";
      toast("Meditation session stopped.");
    });

    refs.siteInsightEnabled.addEventListener("change", (e) => {
      siteInsightRequestSeq += 1;
      queuePatch({ siteInsight: { enabled: e.target.checked } });
      if (!e.target.checked) {
        state.pageInsight = null;
        if (refs.siteInsightStatus) refs.siteInsightStatus.textContent = "Site Insight is off.";
      } else if (refs.siteInsightStatus) {
        refs.siteInsightStatus.textContent = "Ready.";
      }
      renderSiteInsight();
    });

    refs.siteInsightAnalyze.addEventListener("click", async () => {
      await refreshSiteInsightFromTab({ showToastOnSuccess: true });
    });

    refs.siteInsightCopy.addEventListener("click", async () => {
      const payload = normalizeSiteInsightPayload(state.pageInsight || {});
      const text = payload.copyText || payload.essentials.join("\n");
      if (!text.trim()) {
        refs.siteInsightStatus.textContent = "Nothing to copy yet.";
        return;
      }
      const ok = await copyToClipboard(text);
      if (!ok) {
        refs.siteInsightStatus.textContent = "Copy failed.";
        return;
      }
      refs.siteInsightStatus.textContent = "Essentials copied.";
      toast("Site Insight essentials copied.");
    });

    refs.startDeepWork.addEventListener("click", async () => {
      await flushPatch();
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

    refs.deepWorkAutoBlocker.addEventListener("change", (e) => {
      queuePatch({ deepWork: { autoBlocker: e.target.checked } });
    });

    refs.deepWorkAutoLight.addEventListener("change", (e) => {
      queuePatch({ deepWork: { autoLight: e.target.checked } });
    });

    refs.biofeedbackEnabled.addEventListener("change", (e) => handleBiofeedbackToggle(e.target.checked));

    refs.morphingEnabled.addEventListener("change", (e) => {
      setAdvancedToggle("morphing", e.target.checked, e.target);
    });

    refs.taskWeaverEnabled.addEventListener("change", (e) => {
      setAdvancedToggle("taskWeaver", e.target.checked, e.target);
    });

    refs.dashboardPredictionsEnabled.addEventListener("change", (e) => {
      setAdvancedToggle("dashboardPredictions", e.target.checked, e.target);
    });

    refs.collabSyncEnabled.addEventListener("change", (e) => {
      setAdvancedToggle("collaborativeSync", e.target.checked, e.target);
    });

    refs.taskWeaver.addEventListener("click", async () => {
      await flushPatch();
      if (!hasExtensionAccess()) {
        toast("Premium feature – upgrade at holmeta.com");
        return;
      }
      if (!state.app.settings.advanced.taskWeaver) {
        toast("Enable Task Weaver in Advanced Lab first.");
        return;
      }
      refs.taskWeaver.disabled = true;
      refs.taskWeaver.textContent = "Weaving...";
      const response = await sendMessage({ type: "holmeta:task-weaver" });
      refs.taskWeaver.disabled = false;
      refs.taskWeaver.textContent = "Weave Workflow";
      if (!response.ok) {
        toast(`Weaver failed: ${response.error || "unknown"}`);
        return;
      }
      state.weaverResults = Array.isArray(response.results) ? response.results : [];
      renderAdvanced();
      toast(state.weaverResults.length ? "Workflow suggestions ready." : "No useful web tabs were available to weave.");
    });

    refs.collabSync.addEventListener("click", async () => {
      await flushPatch();
      if (!hasExtensionAccess()) {
        toast("Premium feature – upgrade at holmeta.com");
        return;
      }
      if (!state.app.settings.advanced.collaborativeSync) {
        toast("Enable Focus Sync in Advanced Lab first.");
        return;
      }
      const snapshot = buildFocusSyncSnapshot();
      const ok = await copyToClipboard(snapshot);
      if (refs.advancedLabStatus) {
        refs.advancedLabStatus.textContent = ok
          ? "Focus Sync snapshot copied. Paste it into chat, notes, or your session handoff."
          : "Focus Sync snapshot generated. Copy failed locally, but the session brief is ready to retry.";
      }
      toast(ok ? "Focus Sync snapshot copied." : "Focus Sync snapshot generated, but copy was blocked.");
    });

    refs.accessStartTrial?.addEventListener("click", () => openUpgrade());
    refs.accessManageBilling?.addEventListener("click", () => openBilling());
    refs.accessEnterLicense?.addEventListener("click", () => chrome.runtime.openOptionsPage());
    refs.accessRefresh?.addEventListener("click", async () => {
      refs.accessRefresh.disabled = true;
      refs.accessRefresh.textContent = "Refreshing...";
      const response = await sendMessage({ type: "holmeta:entitlement-refresh" });
      refs.accessRefresh.disabled = false;
      refs.accessRefresh.textContent = "Refresh Access";
      if (!response?.ok) {
        toast(`Refresh failed: ${response?.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      await refreshDiagnostics();
      render();
      toast(hasExtensionAccess() ? "Access restored." : "Access still locked.");
    });

    refs.upgradePremium.addEventListener("click", openUpgrade);
    refs.openWebsite.addEventListener("click", () => openExternal(WEBSITE_URL));
    refs.openDashboard.addEventListener("click", () => openExternal(DASHBOARD_URL));
    refs.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

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
    await Promise.all([hydrate(), loadVaultMeta()]);

    setInterval(() => {
      if (!state.app?.settings?.deepWork?.active) return;
      renderDeepWork();
    }, 20000);
  }

  boot().catch((error) => {
    log("error", "boot_failed", error);
    setStatus("Popup failed to initialize", true);
  });
})();
