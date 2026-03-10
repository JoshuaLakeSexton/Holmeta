// HOLMETA v3.0 service worker (Manifest V3)
// - Local-only storage
// - DNR-based blocking
// - Alarm-driven reminders/timers
// - Safe migration + versioning
// - Premium placeholders stored locally (future server validation hook documented)

const STORAGE_KEY = "holmeta.v3.state";
const _LEGACY_KEYS = ["holmeta.v2.state", "holmeta.settings", "holmeta.v3"];
const VERSION = "3.0.0";
const SCHEMA_VERSION = 6;
const LOG_LIMIT = 500;
const DOMAIN_LIMIT = 600;
const SWATCH_LIMIT = 12;
const FAVORITE_LIMIT = 20;
const SITE_INSIGHT_CACHE_LIMIT = 320;
const SITE_INSIGHT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SITE_INSIGHT_THROTTLE_MS = 10 * 1000;
const SCREEN_PRESETS = new Set([
  "desktop_hd",
  "desktop_fhd",
  "desktop_qhd",
  "laptop",
  "tablet_portrait",
  "tablet_landscape",
  "mobile_small",
  "mobile_large"
]);

const LIGHT_FILTER_MODES = [
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
  "spotlight",
  "grayscale",
  "custom"
];

const LIGHT_FILTER_SPECTRUM_PRESETS = [
  "balanced",
  "amber_590",
  "red_630",
  "deep_red_660",
  "candle_1800k",
  "neutral_3500k",
  "daylight_5000k",
  "melatonin_guard"
];

const READING_THEME_PRESETS = [
  "soft_black",
  "dim_slate",
  "gentle_night",
  "soft_paper",
  "neutral_light",
  "warm_page"
];

const ALARMS = {
  HEALTH: "holmeta-v3-health-alert",
  DEEPWORK: "holmeta-v3-deepwork-transition",
  HEARTBEAT: "holmeta-v3-heartbeat",
  PROXY_REAPPLY: "holmeta-v3-proxy-reapply"
};

const DNR_IDS = {
  BASE: 8000,
  NUCLEAR_CATCH_ALL: 8999
};

const DNR_LIMITS = {
  DYNAMIC_SAFE: 5000,
  HARD_RESERVE: 150
};

const DNR_RESOURCE_TYPES_SUBRESOURCE = [
  "sub_frame",
  "script",
  "xmlhttprequest",
  "image",
  "media",
  "font",
  "stylesheet",
  "object",
  "ping",
  "websocket",
  "webtransport"
];

const DNR_CATEGORY_RANGES = {
  ads: { start: 10000, end: 12999 },
  trackers: { start: 13000, end: 15999 },
  malware: { start: 16000, end: 18499 },
  annoyances: { start: 18500, end: 21499 },
  videoAds: { start: 21500, end: 23999 },
  antiAntiAdblock: { start: 24000, end: 24599 }
};

const ALARMS_BLOCKER_UPDATE = "holmeta-v3-blocker-update";

const _FILTER_CATEGORY_META = {
  ads: { label: "Ads & banners" },
  trackers: { label: "Trackers & analytics" },
  malware: { label: "Malware / phishing domains" },
  annoyances: { label: "Annoyances (cookie / widgets / popups)" },
  videoAds: { label: "YouTube / video ad cleanup" }
};

// Curated local-first subsets inspired by EasyList/EasyPrivacy/Fanboy/uBO annoyances.
// Kept compact for MV3 dynamic rule budgets and predictable performance.
const BLOCKER_CURATED_HOSTS = {
  ads: [
    "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
    "adservice.google.co.uk", "adservice.google.de", "adservice.google.fr", "adservice.google.ca",
    "2mdn.net", "adnxs.com", "adsafeprotected.com", "adsrvr.org", "advertising.com",
    "amazon-adsystem.com", "casalemedia.com", "contextweb.com", "criteo.com", "criteo.net",
    "indexww.com", "lijit.com", "moatads.com", "openx.net", "outbrain.com", "pubmatic.com",
    "quantserve.com", "rubiconproject.com", "scorecardresearch.com", "taboola.com", "teads.tv",
    "zedo.com", "smartadserver.com", "adroll.com", "yieldmo.com", "creativecdn.com",
    "media.net", "revcontent.com", "adform.net", "bidr.io", "bluekai.com", "demdex.net",
    "everesttech.net", "eyeota.net", "imrworldwide.com", "krxd.net", "mathtag.com", "rlcdn.com",
    "simpli.fi", "sitescout.com", "smaato.net", "spotxchange.com", "yieldlab.net", "adzerk.net",
    "adcolony.com", "adzerk.net", "aniview.com", "bidswitch.net", "brightroll.com",
    "connatix.com", "exponential.com", "gumgum.com", "hotjar-static.com", "imonomy.com",
    "inmobi.com", "innovid.com", "juicyads.com", "mgid.com", "nativeads.com",
    "onetag-sys.com", "primis.tech", "propellerads.com", "rtbhouse.com", "sharethrough.com",
    "vidoomy.com", "yieldbird.com", "zedo.com"
  ],
  trackers: [
    "google-analytics.com", "googletagmanager.com", "segment.io", "segment.com",
    "mixpanel.com", "amplitude.com", "hotjar.com", "clarity.ms", "fullstory.com",
    "newrelic.com", "nr-data.net", "datadoghq.com", "sentry-cdn.com", "app-measurement.com",
    "branch.io", "braze.com", "bugsnag.com", "intercom.io", "intercomcdn.com",
    "logrocket.com", "matomo.org", "omniture.com", "optimizely.com", "pendo.io",
    "posthog.com", "qualtrics.com", "quantserve.com", "split.io", "statsig.com",
    "tealiumiq.com", "woopra.com", "heap.io", "luckyorange.com", "mouseflow.com",
    "crazyegg.com", "kissmetrics.com", "chartbeat.com", "doubleverify.com", "fathomdns.com",
    "ads-twitter.com", "analytics.twitter.com", "bat.bing.com", "linkedin.com",
    "licdn.com", "snapchat.com", "tiktok.com", "pinterest.com", "redditstatic.com"
  ],
  malware: [
    "adf.ly", "ouo.io", "shorte.st", "linkvertise.com", "clk.sh", "bc.vc", "exe.io",
    "za.gl", "adshort.co", "cpmlink.net", "gplinks.in", "droplink.co", "cut-urls.com",
    "direct-link.net", "urlcash.net", "safelinku.com", "adfoc.us", "tinyurl.com-preview",
    "bitly.ws", "trafficfactory.biz", "smartlinkconverter.com"
  ],
  annoyances: [
    "cookiebot.com", "onetrust.com", "trustarc.com", "quantcast.mgr.consensu.org",
    "consensu.org", "privacy-mgmt.com", "didomi.io", "sourcepoint.com", "cookielaw.org",
    "cookielawinfo.com", "civiccomputing.com", "sirdata.net", "osano.com", "usercentrics.eu",
    "iubenda.com", "termly.io", "onesignal.com", "pushly.com", "pushwoosh.com",
    "adobedtm.com", "addthis.com", "sharethis.com", "sumome.com", "mailchimp.com",
    "klaviyo.com", "convertkit.com", "optinmonster.com", "sleeknote.com", "privacymanager.io"
  ],
  videoAds: [
    "youtube.com", "youtubei.googleapis.com", "ytimg.com", "doubleclick.net", "googleads.g.doubleclick.net",
    "imasdk.googleapis.com"
  ]
};

const BLOCKER_CURATED_PATTERNS = {
  ads: [
    "||doubleclick.net^", "||googlesyndication.com^", "||googleadservices.com^",
    "||taboola.com^", "||outbrain.com^", "||adservice.google.com^",
    "||amazon-adsystem.com^", "||adnxs.com^", "||pubmatic.com^", "||rubiconproject.com^"
  ],
  trackers: [
    "||google-analytics.com^", "||googletagmanager.com^", "||segment.io^", "||mixpanel.com^",
    "||amplitude.com^", "||hotjar.com^", "||clarity.ms^", "||fullstory.com^"
  ],
  malware: [
    "||adf.ly^", "||ouo.io^", "||shorte.st^", "||linkvertise.com^", "||cpmlink.net^"
  ],
  annoyances: [
    "||onetrust.com^", "||cookiebot.com^", "||didomi.io^", "||sourcepoint.com^",
    "||onesignal.com^", "||pushwoosh.com^"
  ],
  videoAds: [
    "||youtube.com/api/stats/ads^",
    "||youtube.com/pagead/",
    "||youtube.com/get_video_info",
    "||youtubei.googleapis.com/youtubei/v1/player/ad_break^",
    "||googleads.g.doubleclick.net/pagead^",
    "||imasdk.googleapis.com/js/sdkloader/ima3.js^"
  ]
};

const QUICK_BLOCK_CATEGORY_HOSTS = {
  social: [
    "facebook.com", "instagram.com", "x.com", "twitter.com", "tiktok.com",
    "reddit.com", "snapchat.com", "pinterest.com", "discord.com", "linkedin.com"
  ],
  shopping: [
    "amazon.com", "ebay.com", "walmart.com", "target.com", "etsy.com",
    "aliexpress.com", "bestbuy.com", "costco.com", "newegg.com", "temu.com"
  ],
  entertainment: [
    "youtube.com", "netflix.com", "hulu.com", "disneyplus.com", "max.com",
    "primevideo.com", "twitch.tv", "spotify.com", "soundcloud.com", "vimeo.com"
  ],
  adult: [
    "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "youporn.com",
    "redtube.com", "spankbang.com", "kaotic.com", "bestgore.fun", "goregrish.com"
  ]
};

const ANTI_ANTI_ADBLOCK_ALLOW_PATTERNS = [
  "||pagefair.com^",
  "||admiral.com^",
  "||blockadblock.com^"
];

const REMOTE_FILTER_SOURCES = {
  ads: [
    "https://easylist.to/easylist/easylist.txt"
  ],
  trackers: [
    "https://easylist.to/easylist/easyprivacy.txt"
  ],
  annoyances: [
    "https://easylist.to/easylist/fanboy-annoyance.txt",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt"
  ],
  malware: [
    "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.wildcard/pro.txt",
    "https://raw.githubusercontent.com/DandelionSprout/adfilt/master/LegitimateURLShortener.txt"
  ]
};

const SECURE_TUNNEL_PRESETS = [
  {
    id: "fastest",
    label: "Fastest (Auto)",
    region: "Auto",
    kind: "auto",
    pool: ["us_fast", "eu_fast", "asia_fast"]
  },
  {
    id: "us_fast",
    label: "US (Community Relay)",
    region: "US",
    kind: "fixed",
    scheme: "http",
    host: "67.169.98.211",
    port: 443
  },
  {
    id: "eu_fast",
    label: "EU (Community Relay)",
    region: "EU",
    kind: "fixed",
    scheme: "http",
    host: "163.5.128.84",
    port: 14270
  },
  {
    id: "asia_fast",
    label: "Asia (Community Relay)",
    region: "Asia",
    kind: "fixed",
    scheme: "http",
    host: "116.80.49.166",
    port: 3172
  },
  {
    id: "global_backup",
    label: "Global Backup (Community Relay)",
    region: "Global",
    kind: "fixed",
    scheme: "http",
    host: "136.49.34.18",
    port: 8888
  }
];

const SECURE_TUNNEL_PROXY_SCHEMES = ["http", "https", "socks4", "socks5"];

let memoryState = null;
let dnrDebugListenerBound = false;
let dnrBufferedCounters = {
  total: 0,
  byCategory: {
    ads: 0,
    trackers: 0,
    malware: 0,
    annoyances: 0,
    videoAds: 0,
    cosmetic: 0
  },
  timer: null
};

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

function normalizeProxyScheme(value, fallback = "http") {
  const scheme = String(value || "").trim().toLowerCase();
  return SECURE_TUNNEL_PROXY_SCHEMES.includes(scheme) ? scheme : fallback;
}

function normalizeProxyPort(value, fallback = 8080) {
  const n = Math.round(clamp(value, 1, 65535));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBypassList(list) {
  if (!Array.isArray(list)) return ["<local>", "localhost", "127.0.0.1"];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const value = String(item || "").trim();
    if (!value || value.length > 120 || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= 40) break;
  }
  if (!out.length) return ["<local>", "localhost", "127.0.0.1"];
  return out;
}

function normalizeTime(value, fallback) {
  const v = String(value || "").trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v) ? v : fallback;
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

function normalizeHexSwatches(list) {
  if (!Array.isArray(list)) return [];
  const unique = [];
  const seen = new Set();
  for (const value of list) {
    const hex = normalizeHexColor(value, "");
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    unique.push(hex);
    if (unique.length >= SWATCH_LIMIT) break;
  }
  return unique;
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

function normalizeFavorites(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenHosts = new Set();
  for (const item of list) {
    const row = item && typeof item === "object" ? item : {};
    const url = normalizeFavoriteUrl(row.url || row.href || "");
    if (!url) continue;
    const host = normalizeHost(url);
    if (!host || seenHosts.has(host)) continue;
    seenHosts.add(host);
    out.push({
      id: String(row.id || host).slice(0, 80),
      url,
      host,
      title: String(row.title || host).trim().slice(0, 80)
    });
    if (out.length >= FAVORITE_LIMIT) break;
  }
  return out;
}

function normalizeScreenshotToolSettings(input, fallback = null) {
  const base = fallback && typeof fallback === "object"
    ? fallback
    : {
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

  const raw = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...raw,
    enabled: Boolean(raw.enabled ?? base.enabled),
    padding: Math.round(clamp(raw.padding ?? base.padding, 0, 24)),
    targetMode: ["smart", "exact", "parent"].includes(String(raw.targetMode || ""))
      ? String(raw.targetMode)
      : String(base.targetMode || "smart"),
    aspectRatio: ["none", "square", "4:3", "16:9", "custom"].includes(String(raw.aspectRatio || ""))
      ? String(raw.aspectRatio)
      : String(base.aspectRatio || "none"),
    customAspectWidth: Math.round(clamp(raw.customAspectWidth ?? base.customAspectWidth, 1, 999)),
    customAspectHeight: Math.round(clamp(raw.customAspectHeight ?? base.customAspectHeight, 1, 999)),
    minTargetWidth: Math.round(clamp(raw.minTargetWidth ?? base.minTargetWidth, 12, 2400)),
    minTargetHeight: Math.round(clamp(raw.minTargetHeight ?? base.minTargetHeight, 12, 1800)),
    outputScale: Number(raw.outputScale ?? base.outputScale) >= 2 ? 2 : 1,
    backgroundMode: ["original", "white", "transparent"].includes(String(raw.backgroundMode || ""))
      ? String(raw.backgroundMode)
      : String(base.backgroundMode || "original"),
    showTooltip: Boolean(raw.showTooltip ?? base.showTooltip),
    autoCopy: Boolean(raw.autoCopy ?? base.autoCopy),
    previewRounded: Boolean(raw.previewRounded ?? base.previewRounded)
  };
}

function createDefaultReadingThemeSettings() {
  return {
    enabled: false,
    mode: "dark", // dark | light
    preset: "soft_black", // soft_black | dim_slate | gentle_night | soft_paper | neutral_light | warm_page
    intensity: 44,
    perSiteOverrides: {},
    excludedSites: {}
  };
}

function createDefaultLightFilterSettings() {
  return {
    enabled: false,
    mode: "warm", // warm | amber | candle | paper | cool_focus | red_overlay | red_mono | red_lock | gray_warm | dim | spotlight | grayscale | custom
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
    therapyDuration: 3,
    therapyCadence: "gentle", // slow | medium | gentle
    schedule: {
      enabled: false,
      start: "20:00",
      end: "06:00",
      useSunset: false,
      rampMinutes: 45,
      quickPreset: "custom" // custom | evening | workday | late_night
    },
    perSiteOverrides: {},
    excludedSites: {}
  };
}

function normalizeSiteOverrideMap(rawMap) {
  if (!rawMap || typeof rawMap !== "object") return {};
  return Object.fromEntries(
    Object.entries(rawMap)
      .map(([host, value]) => [normalizeHost(host), value])
      .filter(([host, value]) => Boolean(host) && value && typeof value === "object")
  );
}

function normalizeExcludedSiteMap(rawMap) {
  if (Array.isArray(rawMap)) {
    return Object.fromEntries(
      normalizeDomainList(rawMap).map((host) => [host, true])
    );
  }
  if (!rawMap || typeof rawMap !== "object") return {};
  return Object.fromEntries(
    Object.entries(rawMap)
      .map(([host, enabled]) => [normalizeHost(host), Boolean(enabled)])
      .filter(([host, enabled]) => Boolean(host) && enabled)
  );
}

function readingPresetFromLegacy(mode, darkVariant, lightVariant) {
  if (mode === "light") {
    if (lightVariant === "gray") return "soft_paper";
    if (lightVariant === "warm") return "warm_page";
    return "neutral_light";
  }
  if (darkVariant === "gray") return "dim_slate";
  if (darkVariant === "brown") return "gentle_night";
  return "soft_black";
}

function normalizeReadingThemeSettings(rawSettings, fallback, legacyLight = {}) {
  const base = fallback && typeof fallback === "object"
    ? fallback
    : createDefaultReadingThemeSettings();
  const raw = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const legacyMode = ["dark", "light"].includes(String(legacyLight.readingMode || ""))
    ? String(legacyLight.readingMode)
    : "dark";
  const mode = ["dark", "light"].includes(String(raw.mode || ""))
    ? String(raw.mode)
    : legacyMode;
  const presetRaw = String(raw.preset || "");
  const preset = READING_THEME_PRESETS.includes(presetRaw)
    ? presetRaw
    : readingPresetFromLegacy(mode, String(legacyLight.darkThemeVariant || ""), String(legacyLight.lightThemeVariant || ""));
  const enabled = Boolean(raw.enabled ?? legacyLight.readingModeEnabled ?? base.enabled);
  const intensity = Math.round(clamp(raw.intensity ?? legacyLight.intensity ?? base.intensity, 0, 100));
  const siteOverridesRaw = raw.perSiteOverrides || raw.siteProfiles || {};
  const excludeRaw = raw.excludedSites || raw.excludedHosts || legacyLight.excludedHosts || {};
  const siteOverrides = normalizeSiteOverrideMap(siteOverridesRaw);
  const excludedSites = normalizeExcludedSiteMap(excludeRaw);

  const normalizedOverrides = {};
  for (const [host, value] of Object.entries(siteOverrides)) {
    const row = value && typeof value === "object" ? value : {};
    const rowMode = ["dark", "light"].includes(String(row.mode || "")) ? String(row.mode) : mode;
    normalizedOverrides[host] = {
      enabled: Boolean(row.enabled ?? true),
      mode: rowMode,
      preset: READING_THEME_PRESETS.includes(String(row.preset || ""))
        ? String(row.preset)
        : readingPresetFromLegacy(rowMode, String(row.darkThemeVariant || legacyLight.darkThemeVariant || ""), String(row.lightThemeVariant || legacyLight.lightThemeVariant || "")),
      intensity: Math.round(clamp(row.intensity ?? intensity, 0, 100))
    };
  }

  return {
    ...base,
    ...raw,
    enabled,
    mode,
    preset,
    intensity,
    perSiteOverrides: normalizedOverrides,
    excludedSites
  };
}

function normalizeLightFilterSettings(rawSettings, fallback, legacyLight = {}) {
  const base = fallback && typeof fallback === "object"
    ? fallback
    : createDefaultLightFilterSettings();
  const raw = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const schedule = {
    ...base.schedule,
    ...(raw.schedule && typeof raw.schedule === "object" ? raw.schedule : {}),
    ...(legacyLight.schedule && typeof legacyLight.schedule === "object" ? legacyLight.schedule : {})
  };
  const modeRaw = String(raw.mode || legacyLight.mode || base.mode || "warm");
  const mode = LIGHT_FILTER_MODES.includes(modeRaw)
    ? modeRaw
    : (modeRaw === "red" ? "red_overlay" : "warm");
  const spectrumPresetRaw = String(raw.spectrumPreset || legacyLight.spectrumPreset || base.spectrumPreset || "balanced");
  const spectrumPreset = LIGHT_FILTER_SPECTRUM_PRESETS.includes(spectrumPresetRaw)
    ? spectrumPresetRaw
    : "balanced";
  const siteOverridesRaw = raw.perSiteOverrides || raw.siteProfiles || {};
  const excludeRaw = raw.excludedSites || raw.excludedHosts || legacyLight.excludedHosts || {};
  const siteOverrides = normalizeSiteOverrideMap(siteOverridesRaw);
  const excludedSites = normalizeExcludedSiteMap(excludeRaw);

  const normalizedOverrides = {};
  for (const [host, value] of Object.entries(siteOverrides)) {
    const row = value && typeof value === "object" ? value : {};
    const rowModeRaw = String(row.mode || mode);
    normalizedOverrides[host] = {
      enabled: Boolean(row.enabled ?? true),
      mode: LIGHT_FILTER_MODES.includes(rowModeRaw) ? rowModeRaw : mode,
      spectrumPreset: LIGHT_FILTER_SPECTRUM_PRESETS.includes(String(row.spectrumPreset || ""))
        ? String(row.spectrumPreset)
        : spectrumPreset,
      intensity: Math.round(clamp(row.intensity ?? raw.intensity ?? legacyLight.intensity ?? base.intensity, 0, 100)),
      dim: Math.round(clamp(row.dim ?? raw.dim ?? legacyLight.dim ?? base.dim, 0, 60)),
      contrastSoft: Math.round(clamp(row.contrastSoft ?? raw.contrastSoft ?? legacyLight.contrastSoft ?? base.contrastSoft, 0, 30)),
      brightness: Math.round(clamp(row.brightness ?? raw.brightness ?? legacyLight.brightness ?? base.brightness, 70, 120)),
      saturation: Math.round(clamp(row.saturation ?? raw.saturation ?? legacyLight.saturation ?? base.saturation, 40, 140)),
      blueCut: Math.round(clamp(row.blueCut ?? raw.blueCut ?? legacyLight.blueCut ?? base.blueCut, 0, 100)),
      tintRed: Math.round(clamp(row.tintRed ?? raw.tintRed ?? legacyLight.tintRed ?? base.tintRed, 0, 100)),
      tintGreen: Math.round(clamp(row.tintGreen ?? raw.tintGreen ?? legacyLight.tintGreen ?? base.tintGreen, 0, 100)),
      tintBlue: Math.round(clamp(row.tintBlue ?? raw.tintBlue ?? legacyLight.tintBlue ?? base.tintBlue, 0, 100)),
      reduceWhites: Boolean(row.reduceWhites ?? raw.reduceWhites ?? legacyLight.reduceWhites ?? base.reduceWhites),
      videoSafe: Boolean(row.videoSafe ?? raw.videoSafe ?? legacyLight.videoSafe ?? base.videoSafe),
      spotlightEnabled: Boolean(row.spotlightEnabled ?? raw.spotlightEnabled ?? legacyLight.spotlightEnabled ?? base.spotlightEnabled),
      therapyMode: Boolean(row.therapyMode ?? raw.therapyMode ?? legacyLight.therapyMode ?? base.therapyMode),
      therapyDuration: Math.round(clamp(row.therapyDuration ?? row.therapyMinutes ?? raw.therapyDuration ?? raw.therapyMinutes ?? legacyLight.therapyMinutes ?? base.therapyDuration, 1, 20)),
      therapyCadence: ["slow", "medium", "gentle"].includes(String(row.therapyCadence || ""))
        ? String(row.therapyCadence)
        : String(raw.therapyCadence || legacyLight.therapyCadence || base.therapyCadence || "gentle")
    };
  }

  return {
    ...base,
    ...raw,
    enabled: Boolean(raw.enabled ?? legacyLight.enabled ?? base.enabled),
    mode,
    spectrumPreset,
    intensity: Math.round(clamp(raw.intensity ?? legacyLight.intensity ?? base.intensity, 0, 100)),
    dim: Math.round(clamp(raw.dim ?? legacyLight.dim ?? base.dim, 0, 60)),
    contrastSoft: Math.round(clamp(raw.contrastSoft ?? legacyLight.contrastSoft ?? base.contrastSoft, 0, 30)),
    brightness: Math.round(clamp(raw.brightness ?? legacyLight.brightness ?? base.brightness, 70, 120)),
    saturation: Math.round(clamp(raw.saturation ?? legacyLight.saturation ?? base.saturation, 40, 140)),
    blueCut: Math.round(clamp(raw.blueCut ?? legacyLight.blueCut ?? base.blueCut, 0, 100)),
    tintRed: Math.round(clamp(raw.tintRed ?? legacyLight.tintRed ?? base.tintRed, 0, 100)),
    tintGreen: Math.round(clamp(raw.tintGreen ?? legacyLight.tintGreen ?? base.tintGreen, 0, 100)),
    tintBlue: Math.round(clamp(raw.tintBlue ?? legacyLight.tintBlue ?? base.tintBlue, 0, 100)),
    reduceWhites: Boolean(raw.reduceWhites ?? legacyLight.reduceWhites ?? base.reduceWhites),
    videoSafe: Boolean(raw.videoSafe ?? legacyLight.videoSafe ?? base.videoSafe),
    spotlightEnabled: Boolean(raw.spotlightEnabled ?? legacyLight.spotlightEnabled ?? base.spotlightEnabled),
    therapyMode: Boolean(raw.therapyMode ?? legacyLight.therapyMode ?? base.therapyMode),
    therapyDuration: Math.round(clamp(raw.therapyDuration ?? raw.therapyMinutes ?? legacyLight.therapyMinutes ?? base.therapyDuration, 1, 20)),
    therapyCadence: ["slow", "medium", "gentle"].includes(String(raw.therapyCadence || legacyLight.therapyCadence || ""))
      ? String(raw.therapyCadence || legacyLight.therapyCadence || "gentle")
      : "gentle",
    schedule: {
      enabled: Boolean(schedule.enabled),
      start: normalizeTime(schedule.start, base.schedule.start),
      end: normalizeTime(schedule.end, base.schedule.end),
      useSunset: Boolean(schedule.useSunset),
      rampMinutes: Math.round(clamp(schedule.rampMinutes, 0, 120)),
      quickPreset: ["custom", "evening", "workday", "late_night"].includes(String(schedule.quickPreset || ""))
        ? String(schedule.quickPreset)
        : "custom"
    },
    perSiteOverrides: normalizedOverrides,
    excludedSites
  };
}

function lightFilterModeToLegacy(mode = "warm") {
  if (mode === "grayscale") return "gray_warm";
  if (mode === "custom") return "warm";
  return mode;
}

function readingThemeToLegacyVariants(reading = {}) {
  const mode = reading.mode === "light" ? "light" : "dark";
  const preset = String(reading.preset || "");
  if (mode === "dark") {
    if (preset === "dim_slate") return { darkThemeVariant: "gray", lightThemeVariant: "white" };
    if (preset === "gentle_night") return { darkThemeVariant: "brown", lightThemeVariant: "white" };
    return { darkThemeVariant: "black", lightThemeVariant: "white" };
  }
  if (preset === "soft_paper") return { darkThemeVariant: "black", lightThemeVariant: "gray" };
  if (preset === "warm_page") return { darkThemeVariant: "black", lightThemeVariant: "warm" };
  return { darkThemeVariant: "black", lightThemeVariant: "white" };
}

function buildLegacyLightFromSeparated(lightFilter = {}, readingTheme = {}, fallback = null) {
  const base = fallback && typeof fallback === "object"
    ? fallback
    : {};
  const variants = readingThemeToLegacyVariants(readingTheme);
  const excludedHosts = normalizeDomainList([
    ...Object.keys(lightFilter.excludedSites || {}),
    ...Object.keys(readingTheme.excludedSites || {})
  ]);
  const siteProfiles = {};
  const hosts = new Set([
    ...Object.keys(lightFilter.perSiteOverrides || {}),
    ...Object.keys(readingTheme.perSiteOverrides || {})
  ]);
  for (const host of hosts) {
    const filterSite = lightFilter.perSiteOverrides?.[host] || {};
    const readingSite = readingTheme.perSiteOverrides?.[host] || {};
    const readingVars = readingThemeToLegacyVariants(readingSite);
    siteProfiles[host] = {
      enabled: Boolean(filterSite.enabled ?? readingSite.enabled ?? true),
      mode: lightFilterModeToLegacy(filterSite.mode || lightFilter.mode || "warm"),
      readingModeEnabled: Boolean(readingSite.enabled ?? readingTheme.enabled ?? false),
      readingMode: readingSite.mode || readingTheme.mode || "dark",
      darkThemeVariant: readingVars.darkThemeVariant,
      lightThemeVariant: readingVars.lightThemeVariant,
      spectrumPreset: filterSite.spectrumPreset || lightFilter.spectrumPreset || "balanced",
      intensity: Math.round(clamp(filterSite.intensity ?? lightFilter.intensity ?? 45, 0, 100)),
      dim: Math.round(clamp(filterSite.dim ?? lightFilter.dim ?? 18, 0, 60)),
      contrastSoft: Math.round(clamp(filterSite.contrastSoft ?? lightFilter.contrastSoft ?? 8, 0, 30)),
      brightness: Math.round(clamp(filterSite.brightness ?? lightFilter.brightness ?? 96, 70, 120)),
      saturation: Math.round(clamp(filterSite.saturation ?? lightFilter.saturation ?? 100, 40, 140)),
      blueCut: Math.round(clamp(filterSite.blueCut ?? lightFilter.blueCut ?? 65, 0, 100)),
      tintRed: Math.round(clamp(filterSite.tintRed ?? lightFilter.tintRed ?? 100, 0, 100)),
      tintGreen: Math.round(clamp(filterSite.tintGreen ?? lightFilter.tintGreen ?? 62, 0, 100)),
      tintBlue: Math.round(clamp(filterSite.tintBlue ?? lightFilter.tintBlue ?? 30, 0, 100)),
      reduceWhites: Boolean(filterSite.reduceWhites ?? lightFilter.reduceWhites ?? true),
      videoSafe: Boolean(filterSite.videoSafe ?? lightFilter.videoSafe ?? false),
      spotlightEnabled: Boolean(filterSite.spotlightEnabled ?? lightFilter.spotlightEnabled ?? false),
      therapyMode: Boolean(filterSite.therapyMode ?? lightFilter.therapyMode ?? false),
      therapyMinutes: Math.round(clamp(filterSite.therapyDuration ?? filterSite.therapyMinutes ?? lightFilter.therapyDuration ?? 3, 1, 20)),
      therapyCadence: String(filterSite.therapyCadence || lightFilter.therapyCadence || "gentle")
    };
  }

  return {
    ...base,
    enabled: Boolean(lightFilter.enabled),
    mode: lightFilterModeToLegacy(lightFilter.mode || "warm"),
    readingModeEnabled: Boolean(readingTheme.enabled),
    readingMode: readingTheme.mode === "light" ? "light" : "dark",
    darkThemeVariant: variants.darkThemeVariant,
    lightThemeVariant: variants.lightThemeVariant,
    spectrumPreset: lightFilter.spectrumPreset || "balanced",
    intensity: Math.round(clamp(lightFilter.intensity ?? 45, 0, 100)),
    dim: Math.round(clamp(lightFilter.dim ?? 18, 0, 60)),
    contrastSoft: Math.round(clamp(lightFilter.contrastSoft ?? 8, 0, 30)),
    brightness: Math.round(clamp(lightFilter.brightness ?? 96, 70, 120)),
    saturation: Math.round(clamp(lightFilter.saturation ?? 100, 40, 140)),
    blueCut: Math.round(clamp(lightFilter.blueCut ?? 65, 0, 100)),
    tintRed: Math.round(clamp(lightFilter.tintRed ?? 100, 0, 100)),
    tintGreen: Math.round(clamp(lightFilter.tintGreen ?? 62, 0, 100)),
    tintBlue: Math.round(clamp(lightFilter.tintBlue ?? 30, 0, 100)),
    reduceWhites: Boolean(lightFilter.reduceWhites),
    videoSafe: Boolean(lightFilter.videoSafe),
    spotlightEnabled: Boolean(lightFilter.spotlightEnabled),
    therapyMode: Boolean(lightFilter.therapyMode),
    therapyMinutes: Math.round(clamp(lightFilter.therapyDuration ?? 3, 1, 20)),
    therapyCadence: String(lightFilter.therapyCadence || "gentle"),
    schedule: {
      enabled: Boolean(lightFilter.schedule?.enabled),
      start: normalizeTime(lightFilter.schedule?.start, "20:00"),
      end: normalizeTime(lightFilter.schedule?.end, "06:00"),
      useSunset: Boolean(lightFilter.schedule?.useSunset),
      rampMinutes: Math.round(clamp(lightFilter.schedule?.rampMinutes ?? 45, 0, 120)),
      quickPreset: ["custom", "evening", "workday", "late_night"].includes(String(lightFilter.schedule?.quickPreset || ""))
        ? String(lightFilter.schedule?.quickPreset)
        : "custom"
    },
    excludedHosts,
    siteProfiles
  };
}

function legacyLightPatchToSeparated(lightPatch) {
  const raw = lightPatch && typeof lightPatch === "object" ? lightPatch : {};
  const lightFilter = {};
  const readingTheme = {};

  if (Object.prototype.hasOwnProperty.call(raw, "enabled")) lightFilter.enabled = Boolean(raw.enabled);
  if (Object.prototype.hasOwnProperty.call(raw, "mode")) lightFilter.mode = String(raw.mode || "warm");
  if (Object.prototype.hasOwnProperty.call(raw, "spectrumPreset")) lightFilter.spectrumPreset = String(raw.spectrumPreset || "balanced");
  if (Object.prototype.hasOwnProperty.call(raw, "intensity")) lightFilter.intensity = Number(raw.intensity || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "dim")) lightFilter.dim = Number(raw.dim || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "contrastSoft")) lightFilter.contrastSoft = Number(raw.contrastSoft || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "brightness")) lightFilter.brightness = Number(raw.brightness || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "saturation")) lightFilter.saturation = Number(raw.saturation || 100);
  if (Object.prototype.hasOwnProperty.call(raw, "blueCut")) lightFilter.blueCut = Number(raw.blueCut || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "tintRed")) lightFilter.tintRed = Number(raw.tintRed || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "tintGreen")) lightFilter.tintGreen = Number(raw.tintGreen || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "tintBlue")) lightFilter.tintBlue = Number(raw.tintBlue || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "reduceWhites")) lightFilter.reduceWhites = Boolean(raw.reduceWhites);
  if (Object.prototype.hasOwnProperty.call(raw, "videoSafe")) lightFilter.videoSafe = Boolean(raw.videoSafe);
  if (Object.prototype.hasOwnProperty.call(raw, "spotlightEnabled")) lightFilter.spotlightEnabled = Boolean(raw.spotlightEnabled);
  if (Object.prototype.hasOwnProperty.call(raw, "therapyMode")) lightFilter.therapyMode = Boolean(raw.therapyMode);
  if (Object.prototype.hasOwnProperty.call(raw, "therapyMinutes")) lightFilter.therapyDuration = Number(raw.therapyMinutes || 0);
  if (Object.prototype.hasOwnProperty.call(raw, "therapyCadence")) lightFilter.therapyCadence = String(raw.therapyCadence || "gentle");
  if (raw.schedule && typeof raw.schedule === "object") lightFilter.schedule = { ...raw.schedule };
  if (Object.prototype.hasOwnProperty.call(raw, "excludedHosts")) {
    lightFilter.excludedSites = normalizeExcludedSiteMap(raw.excludedHosts);
  }

  if (Object.prototype.hasOwnProperty.call(raw, "readingModeEnabled")) {
    readingTheme.enabled = Boolean(raw.readingModeEnabled);
  }
  const mode = ["dark", "light"].includes(String(raw.readingMode || "")) ? String(raw.readingMode) : "dark";
  if (Object.prototype.hasOwnProperty.call(raw, "readingMode")) readingTheme.mode = mode;
  if (
    Object.prototype.hasOwnProperty.call(raw, "darkThemeVariant") ||
    Object.prototype.hasOwnProperty.call(raw, "lightThemeVariant") ||
    Object.prototype.hasOwnProperty.call(raw, "readingMode")
  ) {
    readingTheme.preset = readingPresetFromLegacy(mode, String(raw.darkThemeVariant || ""), String(raw.lightThemeVariant || ""));
  }
  if (Object.prototype.hasOwnProperty.call(raw, "intensity")) {
    readingTheme.intensity = Number(raw.intensity || 0);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "excludedHosts")) {
    readingTheme.excludedSites = normalizeExcludedSiteMap(raw.excludedHosts);
  }

  if (raw.siteProfiles && typeof raw.siteProfiles === "object") {
    const filterOverrides = {};
    const readingOverrides = {};
    for (const [hostInput, profileInput] of Object.entries(raw.siteProfiles)) {
      const host = normalizeHost(hostInput);
      if (!host || !profileInput || typeof profileInput !== "object") continue;
      const profile = profileInput;
      filterOverrides[host] = {
        enabled: Boolean(profile.enabled ?? true),
        mode: String(profile.mode || raw.mode || "warm"),
        spectrumPreset: String(profile.spectrumPreset || raw.spectrumPreset || "balanced"),
        intensity: Number(profile.intensity ?? raw.intensity ?? 45),
        dim: Number(profile.dim ?? raw.dim ?? 18),
        contrastSoft: Number(profile.contrastSoft ?? raw.contrastSoft ?? 8),
        brightness: Number(profile.brightness ?? raw.brightness ?? 96),
        saturation: Number(profile.saturation ?? raw.saturation ?? 100),
        blueCut: Number(profile.blueCut ?? raw.blueCut ?? 65),
        tintRed: Number(profile.tintRed ?? raw.tintRed ?? 100),
        tintGreen: Number(profile.tintGreen ?? raw.tintGreen ?? 62),
        tintBlue: Number(profile.tintBlue ?? raw.tintBlue ?? 30),
        reduceWhites: Boolean(profile.reduceWhites ?? raw.reduceWhites ?? true),
        videoSafe: Boolean(profile.videoSafe ?? raw.videoSafe ?? false),
        spotlightEnabled: Boolean(profile.spotlightEnabled ?? raw.spotlightEnabled ?? false),
        therapyMode: Boolean(profile.therapyMode ?? raw.therapyMode ?? false),
        therapyDuration: Number(profile.therapyDuration ?? profile.therapyMinutes ?? raw.therapyMinutes ?? 3),
        therapyCadence: String(profile.therapyCadence || raw.therapyCadence || "gentle")
      };
      const rowMode = ["dark", "light"].includes(String(profile.readingMode || "")) ? String(profile.readingMode) : mode;
      readingOverrides[host] = {
        enabled: Boolean(profile.readingModeEnabled ?? true),
        mode: rowMode,
        preset: readingPresetFromLegacy(rowMode, String(profile.darkThemeVariant || raw.darkThemeVariant || ""), String(profile.lightThemeVariant || raw.lightThemeVariant || "")),
        intensity: Number(profile.intensity ?? raw.intensity ?? 45)
      };
    }
    if (Object.keys(filterOverrides).length) lightFilter.perSiteOverrides = filterOverrides;
    if (Object.keys(readingOverrides).length) readingTheme.perSiteOverrides = readingOverrides;
  }

  return { lightFilter, readingTheme };
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
      readingTheme: createDefaultReadingThemeSettings(),
      lightFilter: createDefaultLightFilterSettings(),
      light: {
        enabled: false,
        mode: "warm", // warm | amber | candle | paper | cool_focus | red_overlay | red_mono | red_lock | gray_warm | dim | spotlight
        readingModeEnabled: true, // toggle for dark/light reading layer
        readingMode: "dark", // dark | light
        darkThemeVariant: "black", // black | brown | gray
        lightThemeVariant: "white", // white | warm | gray
        spectrumPreset: "balanced", // balanced | amber_590 | red_630 | deep_red_660 | candle_1800k | neutral_3500k | daylight_5000k | melatonin_guard
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
        quickCategories: {
          social: false,
          shopping: false,
          entertainment: false,
          adult: false
        },
        allowDomains: ["docs.google.com", "notion.so", "github.com"],
        categories: {
          ads: true,
          trackers: true,
          malware: true,
          annoyances: true,
          videoAds: true
        },
        cosmeticFiltering: true,
        antiDetection: true,
        disableCosmeticOnSite: {},
        customCosmeticSelectors: {},
        autoUpdateLists: false,
        updateIntervalHours: 48,
        lastFilterUpdateAt: 0,
        lastFilterUpdateStatus: "idle",
        maxDynamicRules: DNR_LIMITS.DYNAMIC_SAFE,
        schedule: {
          enabled: false,
          start: "09:00",
          end: "17:30",
          days: [1, 2, 3, 4, 5]
        },
        pausedUntil: 0,
        passwordHash: ""
      },
      secureTunnel: {
        enabled: false,
        mode: "preset", // preset | custom
        selectedPresetId: "fastest",
        custom: {
          scheme: "http",
          host: "",
          port: 8080,
          username: "",
          password: ""
        },
        bypassList: ["<local>", "localhost", "127.0.0.1"],
        autoReapply: true,
        reapplyMinutes: 20
      },
      alerts: {
        enabled: false,
        frequencyMin: 45,
        cadenceMode: "focus_weighted", // cycle | random | focus_weighted
        soundEnabled: true,
        soundVolume: 35, // 5..100
        soundPattern: "double", // single | double | triple
        toastEnabled: true,
        notificationEnabled: true,
        cooldownMin: 20,
        snoozeUntil: 0,
        snoozeMinutes: 10,
        burnoutFocusThresholdMin: 90,
        quietHours: {
          enabled: false,
          start: "22:30",
          end: "06:30"
        },
        types: {
          eye: true,
          posture: true,
          burnout: true,
          hydration: false,
          blink: false,
          movement: false
        }
      },
      eyeDropper: {
        recentHex: "#FFB300",
        swatches: []
      },
      screenshotTool: {
        enabled: true,
        padding: 8,
        targetMode: "smart", // smart | exact | parent
        aspectRatio: "none", // none | square | 4:3 | 16:9 | custom
        customAspectWidth: 16,
        customAspectHeight: 9,
        minTargetWidth: 40,
        minTargetHeight: 24,
        outputScale: 1, // 1 | 2
        backgroundMode: "original", // original | white | transparent
        showTooltip: true,
        autoCopy: false,
        previewRounded: false
      },
      favorites: {
        links: []
      },
      screenEmulator: {
        preset: "desktop_hd",
        width: 1366,
        height: 768,
        active: false,
        lastAppliedAt: 0
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
      adBlockEventsTotal: 0,
      adBlockByCategory: {
        ads: 0,
        trackers: 0,
        malware: 0,
        annoyances: 0,
        videoAds: 0,
        cosmetic: 0
      },
      lightUsageMinutes: 0,
      blockerUsageMinutes: 0
    },
    runtime: {
      dynamicRuleIds: [],
      lastAlertCursor: 0,
      lastHeartbeatAt: 0,
      lastAlertAt: 0,
      lastAlertType: "",
      windowResizeBackup: null,
      blockerRuleLimitHit: false,
      blockerLastRuleCount: 0,
      blockerLastRuleSignature: "",
      secureTunnel: {
        connected: false,
        connectedAt: 0,
        activePresetId: "",
        activeLabel: "",
        activeScheme: "",
        activeHost: "",
        activePort: 0,
        lastAppliedAt: 0,
        lastError: "",
        lastErrorAt: 0,
        authFailures: 0,
        autoCursor: 0,
        lastAppliedSignature: ""
      },
      screenshotTool: {
        activeTabId: 0,
        activeWindowId: 0,
        startedAt: 0,
        lastCaptureAt: 0,
        lastError: ""
      }
    },
    cache: {
      siteInsight: {},
      blockerRemote: {
        updatedAt: 0,
        byCategory: {
          ads: [],
          trackers: [],
          malware: [],
          annoyances: [],
          videoAds: []
        },
        sourceStatus: {}
      }
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
      adBlockEvents: 0,
      lightMinutes: 0,
      blockerMinutes: 0,
      blockedAds: 0,
      blockedTrackers: 0,
      blockedMalware: 0,
      blockedAnnoyances: 0,
      blockedVideoAds: 0,
      blockedCosmetic: 0
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
  const rawSettings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const hasReadingTheme = Object.prototype.hasOwnProperty.call(rawSettings, "readingTheme");
  const hasLightFilter = Object.prototype.hasOwnProperty.call(rawSettings, "lightFilter");

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

  const legacyLight = {
    ...base.settings.light,
    ...(merged.settings.light || {}),
    schedule: {
      ...base.settings.light.schedule,
      ...(merged.settings.light?.schedule || {})
    }
  };
  if (legacyLight.mode === "red") legacyLight.mode = "red_overlay";

  merged.settings.readingTheme = normalizeReadingThemeSettings(
    hasReadingTheme ? (merged.settings.readingTheme || {}) : {},
    base.settings.readingTheme,
    legacyLight
  );
  merged.settings.lightFilter = normalizeLightFilterSettings(
    hasLightFilter ? (merged.settings.lightFilter || {}) : {},
    base.settings.lightFilter,
    legacyLight
  );
  merged.settings.light = buildLegacyLightFromSeparated(
    merged.settings.lightFilter,
    merged.settings.readingTheme,
    legacyLight
  );

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
  merged.settings.blocker.quickCategories = {
    social: Boolean(merged.settings.blocker.quickCategories?.social),
    shopping: Boolean(merged.settings.blocker.quickCategories?.shopping),
    entertainment: Boolean(merged.settings.blocker.quickCategories?.entertainment),
    adult: Boolean(merged.settings.blocker.quickCategories?.adult)
  };
  merged.settings.blocker.allowDomains = normalizeDomainList(merged.settings.blocker.allowDomains);
  merged.settings.blocker.categories = {
    ads: Boolean(merged.settings.blocker.categories?.ads ?? true),
    trackers: Boolean(merged.settings.blocker.categories?.trackers ?? true),
    malware: Boolean(merged.settings.blocker.categories?.malware ?? true),
    annoyances: Boolean(merged.settings.blocker.categories?.annoyances ?? true),
    videoAds: Boolean(merged.settings.blocker.categories?.videoAds ?? true)
  };
  merged.settings.blocker.cosmeticFiltering = Boolean(merged.settings.blocker.cosmeticFiltering ?? true);
  merged.settings.blocker.antiDetection = Boolean(merged.settings.blocker.antiDetection ?? true);
  merged.settings.blocker.disableCosmeticOnSite =
    merged.settings.blocker.disableCosmeticOnSite && typeof merged.settings.blocker.disableCosmeticOnSite === "object"
      ? Object.fromEntries(
          Object.entries(merged.settings.blocker.disableCosmeticOnSite)
            .map(([host, enabled]) => [normalizeHost(host), Boolean(enabled)])
            .filter(([host, enabled]) => Boolean(host) && enabled)
        )
      : {};
  merged.settings.blocker.customCosmeticSelectors =
    merged.settings.blocker.customCosmeticSelectors && typeof merged.settings.blocker.customCosmeticSelectors === "object"
      ? Object.fromEntries(
          Object.entries(merged.settings.blocker.customCosmeticSelectors)
            .map(([host, list]) => [normalizeHost(host), Array.isArray(list) ? list : []])
            .filter(([host]) => Boolean(host))
            .map(([host, list]) => [
              host,
              [...new Set(list.map((item) => String(item || "").trim()).filter((item) => item.length > 0 && item.length <= 220))].slice(0, 120)
            ])
        )
      : {};
  merged.settings.blocker.autoUpdateLists = Boolean(merged.settings.blocker.autoUpdateLists);
  merged.settings.blocker.updateIntervalHours = Math.round(clamp(merged.settings.blocker.updateIntervalHours, 24, 48));
  merged.settings.blocker.lastFilterUpdateAt = Math.max(0, Number(merged.settings.blocker.lastFilterUpdateAt || 0));
  merged.settings.blocker.lastFilterUpdateStatus = ["idle", "ok", "error", "updating"].includes(String(merged.settings.blocker.lastFilterUpdateStatus || ""))
    ? String(merged.settings.blocker.lastFilterUpdateStatus)
    : "idle";
  merged.settings.blocker.maxDynamicRules = Math.round(clamp(merged.settings.blocker.maxDynamicRules, 1000, DNR_LIMITS.DYNAMIC_SAFE));
  merged.settings.blocker.schedule.enabled = Boolean(merged.settings.blocker.schedule.enabled);
  merged.settings.blocker.schedule.start = normalizeTime(merged.settings.blocker.schedule.start, "09:00");
  merged.settings.blocker.schedule.end = normalizeTime(merged.settings.blocker.schedule.end, "17:30");
  merged.settings.blocker.schedule.days = Array.isArray(merged.settings.blocker.schedule.days)
    ? merged.settings.blocker.schedule.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : [1, 2, 3, 4, 5];
  merged.settings.blocker.pausedUntil = Math.max(0, Number(merged.settings.blocker.pausedUntil || 0));

  merged.settings.secureTunnel = {
    ...base.settings.secureTunnel,
    ...(merged.settings.secureTunnel || {}),
    custom: {
      ...base.settings.secureTunnel.custom,
      ...(merged.settings.secureTunnel?.custom || {})
    }
  };
  merged.settings.secureTunnel.enabled = Boolean(merged.settings.secureTunnel.enabled);
  merged.settings.secureTunnel.mode = ["preset", "custom"].includes(String(merged.settings.secureTunnel.mode || ""))
    ? String(merged.settings.secureTunnel.mode)
    : "preset";
  merged.settings.secureTunnel.selectedPresetId = SECURE_TUNNEL_PRESETS.some((preset) => preset.id === merged.settings.secureTunnel.selectedPresetId)
    ? String(merged.settings.secureTunnel.selectedPresetId)
    : "fastest";
  merged.settings.secureTunnel.custom.scheme = normalizeProxyScheme(merged.settings.secureTunnel.custom.scheme, "http");
  merged.settings.secureTunnel.custom.host = normalizeHost(merged.settings.secureTunnel.custom.host);
  merged.settings.secureTunnel.custom.port = normalizeProxyPort(merged.settings.secureTunnel.custom.port, 8080);
  merged.settings.secureTunnel.custom.username = String(merged.settings.secureTunnel.custom.username || "").slice(0, 120);
  merged.settings.secureTunnel.custom.password = String(merged.settings.secureTunnel.custom.password || "").slice(0, 180);
  merged.settings.secureTunnel.bypassList = normalizeBypassList(merged.settings.secureTunnel.bypassList);
  merged.settings.secureTunnel.autoReapply = Boolean(merged.settings.secureTunnel.autoReapply);
  merged.settings.secureTunnel.reapplyMinutes = Math.round(clamp(merged.settings.secureTunnel.reapplyMinutes, 5, 60));

  merged.settings.alerts = {
    ...base.settings.alerts,
    ...(merged.settings.alerts || {}),
    quietHours: {
      ...base.settings.alerts.quietHours,
      ...(merged.settings.alerts?.quietHours || {})
    },
    types: {
      ...base.settings.alerts.types,
      ...(merged.settings.alerts?.types || {})
    }
  };
  merged.settings.alerts.enabled = Boolean(merged.settings.alerts.enabled);
  merged.settings.alerts.frequencyMin = Math.round(clamp(merged.settings.alerts.frequencyMin, 10, 180));
  merged.settings.alerts.cadenceMode = ["cycle", "random", "focus_weighted"].includes(merged.settings.alerts.cadenceMode)
    ? merged.settings.alerts.cadenceMode
    : "focus_weighted";
  merged.settings.alerts.soundEnabled = Boolean(merged.settings.alerts.soundEnabled);
  merged.settings.alerts.soundVolume = Math.round(clamp(merged.settings.alerts.soundVolume, 5, 100));
  merged.settings.alerts.soundPattern = ["single", "double", "triple"].includes(merged.settings.alerts.soundPattern)
    ? merged.settings.alerts.soundPattern
    : "double";
  merged.settings.alerts.toastEnabled = Boolean(merged.settings.alerts.toastEnabled);
  merged.settings.alerts.notificationEnabled = Boolean(merged.settings.alerts.notificationEnabled);
  merged.settings.alerts.cooldownMin = Math.round(clamp(merged.settings.alerts.cooldownMin, 0, 180));
  merged.settings.alerts.snoozeUntil = Math.max(0, Number(merged.settings.alerts.snoozeUntil || 0));
  merged.settings.alerts.snoozeMinutes = Math.round(clamp(merged.settings.alerts.snoozeMinutes, 1, 240));
  merged.settings.alerts.burnoutFocusThresholdMin = Math.round(clamp(merged.settings.alerts.burnoutFocusThresholdMin, 15, 360));
  merged.settings.alerts.quietHours.enabled = Boolean(merged.settings.alerts.quietHours.enabled);
  merged.settings.alerts.quietHours.start = normalizeTime(merged.settings.alerts.quietHours.start, "22:30");
  merged.settings.alerts.quietHours.end = normalizeTime(merged.settings.alerts.quietHours.end, "06:30");
  merged.settings.alerts.types.eye = Boolean(merged.settings.alerts.types.eye);
  merged.settings.alerts.types.posture = Boolean(merged.settings.alerts.types.posture);
  merged.settings.alerts.types.burnout = Boolean(merged.settings.alerts.types.burnout);
  merged.settings.alerts.types.hydration = Boolean(merged.settings.alerts.types.hydration);
  merged.settings.alerts.types.blink = Boolean(merged.settings.alerts.types.blink);
  merged.settings.alerts.types.movement = Boolean(merged.settings.alerts.types.movement);

  merged.settings.eyeDropper = {
    ...base.settings.eyeDropper,
    ...(merged.settings.eyeDropper || {})
  };
  merged.settings.eyeDropper.recentHex = normalizeHexColor(merged.settings.eyeDropper.recentHex, "#FFB300");
  merged.settings.eyeDropper.swatches = normalizeHexSwatches(merged.settings.eyeDropper.swatches);

  merged.settings.screenshotTool = {
    ...base.settings.screenshotTool,
    ...(merged.settings.screenshotTool || {})
  };
  merged.settings.screenshotTool = normalizeScreenshotToolSettings(merged.settings.screenshotTool, base.settings.screenshotTool);

  merged.settings.favorites = {
    ...base.settings.favorites,
    ...(merged.settings.favorites || {})
  };
  merged.settings.favorites.links = normalizeFavorites(merged.settings.favorites.links);

  merged.settings.screenEmulator = {
    ...base.settings.screenEmulator,
    ...(merged.settings.screenEmulator || {})
  };
  merged.settings.screenEmulator.preset = SCREEN_PRESETS.has(merged.settings.screenEmulator.preset)
    ? merged.settings.screenEmulator.preset
    : "desktop_hd";
  merged.settings.screenEmulator.width = Math.round(clamp(merged.settings.screenEmulator.width, 320, 5120));
  merged.settings.screenEmulator.height = Math.round(clamp(merged.settings.screenEmulator.height, 320, 2880));
  merged.settings.screenEmulator.active = Boolean(merged.settings.screenEmulator.active);
  merged.settings.screenEmulator.lastAppliedAt = Math.max(0, Number(merged.settings.screenEmulator.lastAppliedAt || 0));

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
  merged.stats.adBlockEventsTotal = Math.max(0, Number(merged.stats.adBlockEventsTotal || 0));
  merged.stats.adBlockByCategory = {
    ads: Math.max(0, Number(merged.stats.adBlockByCategory?.ads || 0)),
    trackers: Math.max(0, Number(merged.stats.adBlockByCategory?.trackers || 0)),
    malware: Math.max(0, Number(merged.stats.adBlockByCategory?.malware || 0)),
    annoyances: Math.max(0, Number(merged.stats.adBlockByCategory?.annoyances || 0)),
    videoAds: Math.max(0, Number(merged.stats.adBlockByCategory?.videoAds || 0)),
    cosmetic: Math.max(0, Number(merged.stats.adBlockByCategory?.cosmetic || 0))
  };
  merged.stats.lightUsageMinutes = Math.max(0, Number(merged.stats.lightUsageMinutes || 0));
  merged.stats.blockerUsageMinutes = Math.max(0, Number(merged.stats.blockerUsageMinutes || 0));

  merged.runtime.dynamicRuleIds = Array.isArray(merged.runtime.dynamicRuleIds)
    ? merged.runtime.dynamicRuleIds.map(Number).filter((n) => Number.isInteger(n))
    : [];
  merged.runtime.lastAlertCursor = Math.max(0, Number(merged.runtime.lastAlertCursor || 0));
  merged.runtime.lastHeartbeatAt = Math.max(0, Number(merged.runtime.lastHeartbeatAt || 0));
  merged.runtime.lastAlertAt = Math.max(0, Number(merged.runtime.lastAlertAt || 0));
  merged.runtime.lastAlertType = String(merged.runtime.lastAlertType || "").slice(0, 32);
  merged.runtime.blockerRuleLimitHit = Boolean(merged.runtime.blockerRuleLimitHit);
  merged.runtime.blockerLastRuleCount = Math.max(0, Number(merged.runtime.blockerLastRuleCount || 0));
  merged.runtime.blockerLastRuleSignature = String(merged.runtime.blockerLastRuleSignature || "").slice(0, 80);
  merged.runtime.secureTunnel = {
    ...base.runtime.secureTunnel,
    ...(merged.runtime.secureTunnel || {})
  };
  merged.runtime.secureTunnel.connected = Boolean(merged.runtime.secureTunnel.connected);
  merged.runtime.secureTunnel.connectedAt = Math.max(0, Number(merged.runtime.secureTunnel.connectedAt || 0));
  merged.runtime.secureTunnel.activePresetId = String(merged.runtime.secureTunnel.activePresetId || "").slice(0, 80);
  merged.runtime.secureTunnel.activeLabel = String(merged.runtime.secureTunnel.activeLabel || "").slice(0, 120);
  merged.runtime.secureTunnel.activeScheme = normalizeProxyScheme(merged.runtime.secureTunnel.activeScheme, "http");
  merged.runtime.secureTunnel.activeHost = normalizeHost(merged.runtime.secureTunnel.activeHost);
  merged.runtime.secureTunnel.activePort = normalizeProxyPort(merged.runtime.secureTunnel.activePort, 8080);
  merged.runtime.secureTunnel.lastAppliedAt = Math.max(0, Number(merged.runtime.secureTunnel.lastAppliedAt || 0));
  merged.runtime.secureTunnel.lastError = String(merged.runtime.secureTunnel.lastError || "").slice(0, 220);
  merged.runtime.secureTunnel.lastErrorAt = Math.max(0, Number(merged.runtime.secureTunnel.lastErrorAt || 0));
  merged.runtime.secureTunnel.authFailures = Math.max(0, Number(merged.runtime.secureTunnel.authFailures || 0));
  merged.runtime.secureTunnel.autoCursor = Math.max(0, Number(merged.runtime.secureTunnel.autoCursor || 0));
  merged.runtime.secureTunnel.lastAppliedSignature = String(merged.runtime.secureTunnel.lastAppliedSignature || "").slice(0, 120);
  merged.runtime.screenshotTool = {
    ...base.runtime.screenshotTool,
    ...(merged.runtime.screenshotTool || {})
  };
  merged.runtime.screenshotTool.activeTabId = Math.max(0, Number(merged.runtime.screenshotTool.activeTabId || 0));
  merged.runtime.screenshotTool.activeWindowId = Math.max(0, Number(merged.runtime.screenshotTool.activeWindowId || 0));
  merged.runtime.screenshotTool.startedAt = Math.max(0, Number(merged.runtime.screenshotTool.startedAt || 0));
  merged.runtime.screenshotTool.lastCaptureAt = Math.max(0, Number(merged.runtime.screenshotTool.lastCaptureAt || 0));
  merged.runtime.screenshotTool.lastError = String(merged.runtime.screenshotTool.lastError || "").slice(0, 220);
  merged.runtime.windowResizeBackup =
    merged.runtime.windowResizeBackup && typeof merged.runtime.windowResizeBackup === "object"
      ? {
          windowId: Number(merged.runtime.windowResizeBackup.windowId || 0),
          left: Number.isFinite(Number(merged.runtime.windowResizeBackup.left))
            ? Number(merged.runtime.windowResizeBackup.left)
            : null,
          top: Number.isFinite(Number(merged.runtime.windowResizeBackup.top))
            ? Number(merged.runtime.windowResizeBackup.top)
            : null,
          width: Number.isFinite(Number(merged.runtime.windowResizeBackup.width))
            ? Number(merged.runtime.windowResizeBackup.width)
            : null,
          height: Number.isFinite(Number(merged.runtime.windowResizeBackup.height))
            ? Number(merged.runtime.windowResizeBackup.height)
            : null,
          state: ["normal", "maximized", "minimized", "fullscreen"].includes(
            String(merged.runtime.windowResizeBackup.state || "")
          )
            ? String(merged.runtime.windowResizeBackup.state)
            : "normal"
        }
      : null;

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
  merged.cache.blockerRemote = {
    updatedAt: Math.max(0, Number(merged.cache?.blockerRemote?.updatedAt || 0)),
    byCategory: {
      ads: normalizeDomainList(merged.cache?.blockerRemote?.byCategory?.ads || []),
      trackers: normalizeDomainList(merged.cache?.blockerRemote?.byCategory?.trackers || []),
      malware: normalizeDomainList(merged.cache?.blockerRemote?.byCategory?.malware || []),
      annoyances: normalizeDomainList(merged.cache?.blockerRemote?.byCategory?.annoyances || []),
      videoAds: normalizeDomainList(merged.cache?.blockerRemote?.byCategory?.videoAds || [])
    },
    sourceStatus: merged.cache?.blockerRemote?.sourceStatus && typeof merged.cache.blockerRemote.sourceStatus === "object"
      ? merged.cache.blockerRemote.sourceStatus
      : {}
  };

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

function tabsCaptureVisibleTab(windowId, options = {}) {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(windowId, options, (dataUrl) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "capture_failed", dataUrl: "" });
        return;
      }
      resolve({ ok: Boolean(dataUrl), error: dataUrl ? "" : "empty_capture", dataUrl: String(dataUrl || "") });
    });
  });
}

function windowsGet(windowId, getInfo = {}) {
  return new Promise((resolve) => {
    chrome.windows.get(windowId, getInfo, (windowObj) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "window_get_failed", window: null });
        return;
      }
      resolve({ ok: true, window: windowObj || null });
    });
  });
}

function windowsGetCurrent(getInfo = {}) {
  return new Promise((resolve) => {
    chrome.windows.getCurrent(getInfo, (windowObj) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "window_current_failed", window: null });
        return;
      }
      resolve({ ok: true, window: windowObj || null });
    });
  });
}

function windowsUpdate(windowId, updateInfo = {}) {
  return new Promise((resolve) => {
    chrome.windows.update(windowId, updateInfo, (windowObj) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "window_update_failed", window: null });
        return;
      }
      resolve({ ok: true, window: windowObj || null });
    });
  });
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

function isRestrictedExtensionPageUrl(urlLike) {
  const url = String(urlLike || "").trim().toLowerCase();
  if (!url) return true;
  if (/^(chrome|edge|brave|vivaldi|opera):\/\//.test(url)) return true;
  if (/^chrome-extension:\/\//.test(url)) return true;
  if (/^about:/.test(url)) return true;
  if (/^file:\/\//.test(url)) return true;
  if (/^https:\/\/chrome\.google\.com\/webstore/i.test(url)) return true;
  if (/^https:\/\/chromewebstore\.google\.com/i.test(url)) return true;
  if (/^https:\/\/microsoftedge\.microsoft\.com\/addons/i.test(url)) return true;
  return !/^https?:\/\//.test(url);
}

async function ensureContentScriptReady(tabId) {
  const ping = await sendTab(tabId, { type: "holmeta:ping" });
  if (ping.ok && ping.res?.ok) return { ok: true, injected: false };
  if (ping.ok && ping.res?.ok === false && !isMissingReceiverError(ping.res?.error)) {
    return { ok: true, injected: false };
  }
  if (!ping.ok && !isMissingReceiverError(ping.error)) {
    return { ok: false, error: ping.error || "receiver_unavailable" };
  }

  const injected = await executeScriptFiles(tabId, ["light/engine.js", "content.js"]);
  if (!injected.ok) return { ok: false, error: injected.error || "inject_failed" };
  const verify = await sendTab(tabId, { type: "holmeta:ping" });
  if (!verify.ok || !verify.res?.ok) {
    return { ok: false, error: verify.error || verify.res?.error || "receiver_not_ready" };
  }
  return { ok: true, injected: true };
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(String(dataUrl || ""));
  return res.blob();
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

function aspectRatioValue(settings = {}) {
  const aspect = String(settings.aspectRatio || "none");
  if (aspect === "square") return 1;
  if (aspect === "4:3") return 4 / 3;
  if (aspect === "16:9") return 16 / 9;
  if (aspect === "custom") {
    const w = Math.max(1, Number(settings.customAspectWidth || 16));
    const h = Math.max(1, Number(settings.customAspectHeight || 9));
    return w / h;
  }
  return 0;
}

function fitRectToAspect(rect, aspect, viewport) {
  if (!Number.isFinite(aspect) || aspect <= 0) return rect;
  let next = { ...rect };
  const currentRatio = rect.width / Math.max(rect.height, 1);
  if (currentRatio > aspect) {
    const targetHeight = rect.width / aspect;
    const delta = targetHeight - rect.height;
    next.y -= delta / 2;
    next.height = targetHeight;
  } else {
    const targetWidth = rect.height * aspect;
    const delta = targetWidth - rect.width;
    next.x -= delta / 2;
    next.width = targetWidth;
  }

  const maxWidth = Math.max(1, Number(viewport.width || next.width));
  const maxHeight = Math.max(1, Number(viewport.height || next.height));
  next.width = Math.min(next.width, maxWidth);
  next.height = Math.min(next.height, maxHeight);
  next.x = clamp(next.x, 0, Math.max(0, maxWidth - next.width));
  next.y = clamp(next.y, 0, Math.max(0, maxHeight - next.height));
  return next;
}

function normalizeCaptureRect(message = {}, settings = {}) {
  const viewport = {
    width: Math.max(1, Number(message.viewport?.width || message.viewportWidth || 0)),
    height: Math.max(1, Number(message.viewport?.height || message.viewportHeight || 0))
  };

  const source = message.rect && typeof message.rect === "object" ? message.rect : {};
  const minW = Math.max(12, Number(settings.minTargetWidth || 40));
  const minH = Math.max(12, Number(settings.minTargetHeight || 24));
  const pad = Math.max(0, Number(settings.padding || 0));

  let width = Math.max(minW, Number(source.width || 0));
  let height = Math.max(minH, Number(source.height || 0));
  let x = Number(source.x || 0);
  let y = Number(source.y || 0);

  const cx = x + (Number(source.width || width) / 2);
  const cy = y + (Number(source.height || height) / 2);
  x = cx - (width / 2);
  y = cy - (height / 2);

  x -= pad;
  y -= pad;
  width += pad * 2;
  height += pad * 2;

  let rect = { x, y, width, height };
  const aspect = aspectRatioValue(settings);
  rect = fitRectToAspect(rect, aspect, viewport);

  rect.x = clamp(rect.x, 0, Math.max(0, viewport.width - 1));
  rect.y = clamp(rect.y, 0, Math.max(0, viewport.height - 1));
  rect.width = clamp(rect.width, 1, Math.max(1, viewport.width - rect.x));
  rect.height = clamp(rect.height, 1, Math.max(1, viewport.height - rect.y));

  return { rect, viewport };
}

async function cropVisibleCapture(dataUrl, message = {}, settings = {}) {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap !== "function") {
    return { ok: false, error: "canvas_api_unavailable" };
  }
  const imageBlob = await dataUrlToBlob(dataUrl);
  const imageBitmap = await createImageBitmap(imageBlob);
  try {
    const normalized = normalizeCaptureRect(message, settings);
    const viewportWidth = Math.max(1, normalized.viewport.width);
    const viewportHeight = Math.max(1, normalized.viewport.height);
    const scaleX = imageBitmap.width / viewportWidth;
    const scaleY = imageBitmap.height / viewportHeight;
    const outputScale = Number(settings.outputScale || 1) >= 2 ? 2 : 1;

    const sx = Math.max(0, Math.floor(normalized.rect.x * scaleX));
    const sy = Math.max(0, Math.floor(normalized.rect.y * scaleY));
    const sw = Math.max(1, Math.floor(normalized.rect.width * scaleX));
    const sh = Math.max(1, Math.floor(normalized.rect.height * scaleY));
    const safeSw = Math.min(sw, Math.max(1, imageBitmap.width - sx));
    const safeSh = Math.min(sh, Math.max(1, imageBitmap.height - sy));

    const canvas = new OffscreenCanvas(
      Math.max(1, Math.floor(safeSw * outputScale)),
      Math.max(1, Math.floor(safeSh * outputScale))
    );
    const ctx = canvas.getContext("2d", { alpha: settings.backgroundMode !== "white" });
    if (!ctx) {
      return { ok: false, error: "canvas_context_unavailable" };
    }

    if (settings.backgroundMode === "white") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (settings.backgroundMode === "transparent") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      imageBitmap,
      sx, sy, safeSw, safeSh,
      0, 0, canvas.width, canvas.height
    );

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const outDataUrl = await blobToDataUrl(blob);
    return {
      ok: true,
      imageDataUrl: outDataUrl,
      width: canvas.width,
      height: canvas.height,
      rect: normalized.rect
    };
  } finally {
    if (typeof imageBitmap.close === "function") imageBitmap.close();
  }
}

async function startScreenshotToolOnActiveTab(state) {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const tab = tabs.find((t) => Number.isInteger(t.id));
  if (!tab) return { ok: false, error: "no_active_tab" };
  const tabUrl = String(tab.url || "");
  if (isRestrictedExtensionPageUrl(tabUrl)) {
    return { ok: false, error: "restricted_page" };
  }
  const ready = await ensureContentScriptReady(tab.id);
  if (!ready.ok) {
    if (ready.error === "cannot_access_tab") {
      return { ok: false, error: "restricted_page" };
    }
    return { ok: false, error: "content_script_unavailable" };
  }
  const result = await sendTab(tab.id, {
    type: "holmeta:screenshot-start",
    payload: { settings: state.settings.screenshotTool }
  });
  if ((!result.ok || result.res?.ok === false) && isMissingReceiverError(result.error || result.res?.error)) {
    const retryReady = await ensureContentScriptReady(tab.id);
    if (!retryReady.ok) {
      return { ok: false, error: "content_script_unavailable" };
    }
    const retry = await sendTab(tab.id, {
      type: "holmeta:screenshot-start",
      payload: { settings: state.settings.screenshotTool }
    });
    if (retry.ok && retry.res?.ok !== false) {
      state.runtime.screenshotTool.activeTabId = Number(tab.id || 0);
      state.runtime.screenshotTool.activeWindowId = Number(tab.windowId || 0);
      state.runtime.screenshotTool.startedAt = now();
      state.runtime.screenshotTool.lastError = "";
      await saveState(state);
      return { ok: true, tabId: tab.id };
    }
    return { ok: false, error: retry.error || retry.res?.error || "start_failed" };
  }
  if (!result.ok || result.res?.ok === false) {
    return { ok: false, error: result.error || result.res?.error || "start_failed" };
  }
  state.runtime.screenshotTool.activeTabId = Number(tab.id || 0);
  state.runtime.screenshotTool.activeWindowId = Number(tab.windowId || 0);
  state.runtime.screenshotTool.startedAt = now();
  state.runtime.screenshotTool.lastError = "";
  await saveState(state);
  return { ok: true, tabId: tab.id };
}

async function stopScreenshotToolOnActiveTab(state) {
  const tabId = Number(state.runtime?.screenshotTool?.activeTabId || 0);
  if (tabId > 0) {
    await sendTab(tabId, { type: "holmeta:screenshot-stop" });
  } else {
    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs.find((t) => Number.isInteger(t.id) && /^https?:/i.test(String(t.url || "")));
    if (tab) await sendTab(tab.id, { type: "holmeta:screenshot-stop" });
  }
  state.runtime.screenshotTool.activeTabId = 0;
  state.runtime.screenshotTool.activeWindowId = 0;
  state.runtime.screenshotTool.startedAt = 0;
  state.runtime.screenshotTool.lastError = "";
  await saveState(state);
  return { ok: true };
}

function runtimeSend(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "runtime_send_failed" });
        return;
      }
      resolve(res || { ok: false, error: "empty_response" });
    });
  });
}

function isWebTab(tab) {
  if (!tab || !Number.isInteger(tab.id)) return false;
  const url = String(tab.url || "");
  return /^https?:/i.test(url);
}

async function sendToBestWebTab(type, payload, preferActive = true) {
  const tried = new Set();
  const trySend = async (tab) => {
    if (!isWebTab(tab)) return { ok: false, error: "not_web_tab" };
    if (tried.has(tab.id)) return { ok: false, error: "already_tried" };
    tried.add(tab.id);
    return sendTab(tab.id, { type, payload });
  };

  if (preferActive) {
    const activeTabs = await tabsQuery({ active: true, lastFocusedWindow: true });
    for (const tab of activeTabs) {
      // eslint-disable-next-line no-await-in-loop
      const sent = await trySend(tab);
      if (sent.ok) return { ok: true, tabId: tab.id };
    }
  }

  const allTabs = await tabsQuery({});
  for (const tab of allTabs) {
    // eslint-disable-next-line no-await-in-loop
    const sent = await trySend(tab);
    if (sent.ok) return { ok: true, tabId: tab.id };
  }

  return { ok: false, error: "no_web_receiver" };
}

async function ensureOffscreenAudioDocument() {
  if (!chrome.offscreen?.createDocument || !chrome.offscreen?.Reason?.AUDIO_PLAYBACK) {
    return { ok: false, error: "offscreen_api_unavailable" };
  }
  try {
    let hasDoc = false;
    if (typeof chrome.offscreen.hasDocument === "function") {
      hasDoc = Boolean(await chrome.offscreen.hasDocument());
    }
    if (!hasDoc) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: "Play Holmeta health alert tones when service worker alarms fire."
      });
    }
    return { ok: true };
  } catch (error) {
    const text = String(error?.message || error || "offscreen_create_failed");
    if (/single offscreen document|already exists/i.test(text)) {
      return { ok: true };
    }
    return { ok: false, error: text };
  }
}

async function playAlertSoundReliable(payload = {}) {
  const offscreen = await ensureOffscreenAudioDocument();
  if (offscreen.ok) {
    const result = await runtimeSend({
      type: "holmeta:offscreen-sound",
      payload
    });
    if (result?.ok) return { ok: true, channel: "offscreen" };
  }

  const fallback = await sendToBestWebTab("holmeta:sound", payload, true);
  if (fallback.ok) {
    return { ok: true, channel: "content_tab" };
  }
  return { ok: false, channel: "none", error: fallback.error || "sound_unavailable" };
}

function executeScriptFiles(tabId, files) {
  return new Promise((resolve) => {
    if (!chrome.scripting?.executeScript) {
      resolve({ ok: false, error: "scripting_api_unavailable" });
      return;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err) {
          const text = String(err.message || "script_inject_failed");
          if (text.toLowerCase().includes("cannot access")) {
            resolve({ ok: false, error: "cannot_access_tab" });
            return;
          }
          resolve({ ok: false, error: text });
          return;
        }
        resolve({ ok: true });
      }
    );
  });
}

function isMissingReceiverError(errorText) {
  const text = String(errorText || "").toLowerCase();
  return text.includes("receiving end does not exist") || text.includes("could not establish connection");
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

function proxySettingsSet(value) {
  return new Promise((resolve) => {
    if (!chrome.proxy?.settings?.set) {
      resolve({ ok: false, error: "proxy_api_unavailable" });
      return;
    }
    chrome.proxy.settings.set({ value, scope: "regular" }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "proxy_set_failed" });
        return;
      }
      resolve({ ok: true });
    });
  });
}

function proxySettingsClear() {
  return new Promise((resolve) => {
    if (!chrome.proxy?.settings?.clear) {
      resolve({ ok: false, error: "proxy_api_unavailable" });
      return;
    }
    chrome.proxy.settings.clear({ scope: "regular" }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message || "proxy_clear_failed" });
        return;
      }
      resolve({ ok: true });
    });
  });
}

function getSecureTunnelPresetCatalog() {
  return SECURE_TUNNEL_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    region: preset.region,
    kind: preset.kind
  }));
}

function getSecureTunnelPresetById(id) {
  return SECURE_TUNNEL_PRESETS.find((preset) => preset.id === id) || null;
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

function patchTouchesSecureTunnel(patch) {
  return Boolean(
    patch &&
    typeof patch === "object" &&
    Object.prototype.hasOwnProperty.call(patch, "secureTunnel")
  );
}

function buildProxyValueFromServer(server, bypassList = ["<local>", "localhost", "127.0.0.1"]) {
  return {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: normalizeProxyScheme(server.scheme, "http"),
        host: normalizeHost(server.host),
        port: normalizeProxyPort(server.port, 8080)
      },
      bypassList: normalizeBypassList(bypassList)
    }
  };
}

function resolveSecureTunnelCandidates(state) {
  const tunnel = state.settings.secureTunnel;
  if (tunnel.mode === "custom") {
    const custom = tunnel.custom || {};
    if (!custom.host) return [];
    return [
      {
        id: "custom",
        label: "Custom Proxy",
        scheme: normalizeProxyScheme(custom.scheme, "http"),
        host: normalizeHost(custom.host),
        port: normalizeProxyPort(custom.port, 8080),
        username: String(custom.username || ""),
        password: String(custom.password || "")
      }
    ];
  }

  const selected = getSecureTunnelPresetById(tunnel.selectedPresetId) || getSecureTunnelPresetById("fastest");
  if (!selected) return [];

  if (selected.kind === "auto" && Array.isArray(selected.pool) && selected.pool.length) {
    const cursor = Math.max(0, Number(state.runtime.secureTunnel?.autoCursor || 0));
    const orderedIds = selected.pool.map((_, idx) => selected.pool[(cursor + idx) % selected.pool.length]);
    const candidates = orderedIds
      .map((id) => getSecureTunnelPresetById(id))
      .filter((preset) => preset && preset.kind === "fixed")
      .map((preset) => ({
        id: preset.id,
        label: preset.label,
        scheme: normalizeProxyScheme(preset.scheme, "http"),
        host: normalizeHost(preset.host),
        port: normalizeProxyPort(preset.port, 8080),
        username: String(preset.username || ""),
        password: String(preset.password || "")
      }));
    return candidates;
  }

  if (selected.kind === "fixed") {
    return [
      {
        id: selected.id,
        label: selected.label,
        scheme: normalizeProxyScheme(selected.scheme, "http"),
        host: normalizeHost(selected.host),
        port: normalizeProxyPort(selected.port, 8080),
        username: String(selected.username || ""),
        password: String(selected.password || "")
      }
    ];
  }

  return [];
}

async function clearSecureTunnel(state, reason = "manual") {
  const result = await proxySettingsClear();
  if (!result.ok && result.error !== "proxy_api_unavailable") {
    state.runtime.secureTunnel.lastError = result.error || "proxy_clear_failed";
    state.runtime.secureTunnel.lastErrorAt = now();
    log(state, "error", "secure_tunnel_clear_failed", { reason, error: result.error });
  } else {
    state.runtime.secureTunnel.lastError = "";
    state.runtime.secureTunnel.lastErrorAt = 0;
  }

  state.runtime.secureTunnel.connected = false;
  state.runtime.secureTunnel.connectedAt = 0;
  state.runtime.secureTunnel.activePresetId = "";
  state.runtime.secureTunnel.activeLabel = "";
  state.runtime.secureTunnel.activeScheme = "";
  state.runtime.secureTunnel.activeHost = "";
  state.runtime.secureTunnel.activePort = 0;
  state.runtime.secureTunnel.lastAppliedAt = now();
  state.runtime.secureTunnel.authFailures = 0;
  state.runtime.secureTunnel.lastAppliedSignature = "";
  await saveState(state);
  return result.ok ? { ok: true } : result;
}

async function applySecureTunnel(state, { force = false, reason = "manual" } = {}) {
  const tunnel = state.settings.secureTunnel || createDefaultState().settings.secureTunnel;
  if (!tunnel.enabled) {
    return clearSecureTunnel(state, reason);
  }

  if (!chrome.proxy?.settings?.set) {
    state.runtime.secureTunnel.connected = false;
    state.runtime.secureTunnel.lastError = "proxy_api_unavailable";
    state.runtime.secureTunnel.lastErrorAt = now();
    log(state, "error", "secure_tunnel_unsupported", { reason });
    await saveState(state);
    return { ok: false, error: "proxy_api_unavailable" };
  }

  const candidates = resolveSecureTunnelCandidates(state).filter((item) => item.host);
  if (!candidates.length) {
    state.runtime.secureTunnel.connected = false;
    state.runtime.secureTunnel.lastError = "missing_proxy_config";
    state.runtime.secureTunnel.lastErrorAt = now();
    log(state, "error", "secure_tunnel_missing_config", { reason, mode: tunnel.mode });
    await saveState(state);
    return { ok: false, error: "missing_proxy_config" };
  }

  const attemptOrder = candidates.slice(0, 4);
  let applied = null;
  let lastError = "";

  for (let idx = 0; idx < attemptOrder.length; idx += 1) {
    const candidate = attemptOrder[idx];
    const signature = hashText(JSON.stringify({
      id: candidate.id,
      host: candidate.host,
      port: candidate.port,
      scheme: candidate.scheme,
      bypassList: tunnel.bypassList || []
    }));

    if (
      !force &&
      state.runtime.secureTunnel.connected &&
      state.runtime.secureTunnel.lastAppliedSignature === signature
    ) {
      return { ok: true, skipped: true };
    }

    const result = await proxySettingsSet(buildProxyValueFromServer(candidate, tunnel.bypassList));
    if (!result.ok) {
      lastError = result.error || "proxy_set_failed";
      continue;
    }

    applied = { ...candidate, signature };
    break;
  }

  if (!applied) {
    state.runtime.secureTunnel.connected = false;
    state.runtime.secureTunnel.lastError = lastError || "proxy_connection_failed";
    state.runtime.secureTunnel.lastErrorAt = now();
    log(state, "error", "secure_tunnel_apply_failed", {
      reason,
      error: state.runtime.secureTunnel.lastError
    });
    await saveState(state);
    return { ok: false, error: state.runtime.secureTunnel.lastError };
  }

  if (tunnel.selectedPresetId === "fastest" && Array.isArray(getSecureTunnelPresetById("fastest")?.pool)) {
    const pool = getSecureTunnelPresetById("fastest").pool;
    const nextCursor = Math.max(0, pool.indexOf(applied.id));
    state.runtime.secureTunnel.autoCursor = nextCursor;
  }

  state.runtime.secureTunnel.connected = true;
  state.runtime.secureTunnel.connectedAt = state.runtime.secureTunnel.connectedAt || now();
  state.runtime.secureTunnel.activePresetId = applied.id;
  state.runtime.secureTunnel.activeLabel = applied.label;
  state.runtime.secureTunnel.activeScheme = applied.scheme;
  state.runtime.secureTunnel.activeHost = applied.host;
  state.runtime.secureTunnel.activePort = applied.port;
  state.runtime.secureTunnel.lastAppliedAt = now();
  state.runtime.secureTunnel.lastError = "";
  state.runtime.secureTunnel.lastErrorAt = 0;
  state.runtime.secureTunnel.lastAppliedSignature = applied.signature;
  await saveState(state);

  log(state, "info", "secure_tunnel_applied", {
    reason,
    mode: tunnel.mode,
    presetId: applied.id,
    host: applied.host
  });
  return { ok: true, applied };
}

function isLightActiveNow(state) {
  const lightFilter = state.settings.lightFilter || state.settings.light || {};
  if (!lightFilter.enabled) return false;
  if (!lightFilter.schedule?.enabled) return true;
  return inTimeRange(lightFilter.schedule.start, lightFilter.schedule.end, new Date());
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
    meta: {
      debug: Boolean(state.meta?.debug)
    },
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
  const resizeBackup = state.runtime?.windowResizeBackup || null;
  const tunnelRuntime = state.runtime?.secureTunnel || createDefaultState().runtime.secureTunnel;
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
      lightActive: isLightActiveNow(state),
      windowResizeActive: Boolean(resizeBackup),
      windowResizeBackup: resizeBackup,
      blockerRuleLimitHit: Boolean(state.runtime.blockerRuleLimitHit),
      blockerLastRuleCount: Math.max(0, Number(state.runtime.blockerLastRuleCount || 0)),
      screenshotTool: {
        activeTabId: Math.max(0, Number(state.runtime?.screenshotTool?.activeTabId || 0)),
        activeWindowId: Math.max(0, Number(state.runtime?.screenshotTool?.activeWindowId || 0)),
        startedAt: Math.max(0, Number(state.runtime?.screenshotTool?.startedAt || 0)),
        lastCaptureAt: Math.max(0, Number(state.runtime?.screenshotTool?.lastCaptureAt || 0)),
        lastError: String(state.runtime?.screenshotTool?.lastError || "")
      },
      secureTunnel: {
        connected: Boolean(tunnelRuntime.connected),
        connectedAt: Math.max(0, Number(tunnelRuntime.connectedAt || 0)),
        activePresetId: String(tunnelRuntime.activePresetId || ""),
        activeLabel: String(tunnelRuntime.activeLabel || ""),
        activeScheme: String(tunnelRuntime.activeScheme || ""),
        activeHost: String(tunnelRuntime.activeHost || ""),
        activePort: Math.max(0, Number(tunnelRuntime.activePort || 0)),
        lastAppliedAt: Math.max(0, Number(tunnelRuntime.lastAppliedAt || 0)),
        lastError: String(tunnelRuntime.lastError || ""),
        lastErrorAt: Math.max(0, Number(tunnelRuntime.lastErrorAt || 0)),
        authFailures: Math.max(0, Number(tunnelRuntime.authFailures || 0)),
        presets: getSecureTunnelPresetCatalog()
      }
    }
  };
}

async function resolveTargetWindow(sender, message = {}) {
  const senderWindowId = Number(sender?.tab?.windowId || 0);
  if (Number.isInteger(senderWindowId) && senderWindowId > 0) {
    const res = await windowsGet(senderWindowId, { populate: false });
    if (res.ok && res.window) return { ok: true, window: res.window };
  }
  if (Number.isInteger(Number(message.windowId || 0)) && Number(message.windowId || 0) > 0) {
    const res = await windowsGet(Number(message.windowId), { populate: false });
    if (res.ok && res.window) return { ok: true, window: res.window };
  }
  const current = await windowsGetCurrent({ populate: false });
  if (!current.ok || !current.window) {
    return { ok: false, error: current.error || "no_window" };
  }
  return { ok: true, window: current.window };
}

function createWindowBackup(windowObj) {
  if (!windowObj || !Number.isInteger(Number(windowObj.id || 0))) return null;
  return {
    windowId: Number(windowObj.id),
    left: Number.isFinite(Number(windowObj.left)) ? Number(windowObj.left) : null,
    top: Number.isFinite(Number(windowObj.top)) ? Number(windowObj.top) : null,
    width: Number.isFinite(Number(windowObj.width)) ? Number(windowObj.width) : null,
    height: Number.isFinite(Number(windowObj.height)) ? Number(windowObj.height) : null,
    state: ["normal", "maximized", "minimized", "fullscreen"].includes(String(windowObj.state || ""))
      ? String(windowObj.state)
      : "normal"
  };
}

async function applyWindowResize(state, sender, message = {}) {
  const target = await resolveTargetWindow(sender, message);
  if (!target.ok || !target.window) {
    return { ok: false, error: target.error || "window_not_found" };
  }

  const width = Math.round(clamp(message.width, 320, 5120));
  const height = Math.round(clamp(message.height, 320, 2880));
  const preset = SCREEN_PRESETS.has(String(message.preset || ""))
    ? String(message.preset)
    : state.settings.screenEmulator.preset;

  if (!state.runtime.windowResizeBackup || Number(state.runtime.windowResizeBackup.windowId || 0) !== Number(target.window.id)) {
    state.runtime.windowResizeBackup = createWindowBackup(target.window);
  }

  if (["fullscreen", "maximized", "minimized"].includes(String(target.window.state || ""))) {
    const normalize = await windowsUpdate(Number(target.window.id), { state: "normal" });
    if (!normalize.ok) {
      return { ok: false, error: normalize.error || "window_normalize_failed" };
    }
  }

  const updated = await windowsUpdate(Number(target.window.id), { width, height, state: "normal" });
  if (!updated.ok) {
    return { ok: false, error: updated.error || "window_resize_failed" };
  }

  state.settings.screenEmulator.preset = preset;
  state.settings.screenEmulator.width = width;
  state.settings.screenEmulator.height = height;
  state.settings.screenEmulator.active = true;
  state.settings.screenEmulator.lastAppliedAt = now();
  await saveState(state);
  return { ok: true, state: publicState(state), window: updated.window || null };
}

async function resetWindowResize(state, sender, message = {}) {
  const backup = state.runtime.windowResizeBackup;
  if (!backup || !Number.isInteger(Number(backup.windowId || 0))) {
    state.settings.screenEmulator.active = false;
    await saveState(state);
    return { ok: true, state: publicState(state), restored: false };
  }

  const target = await resolveTargetWindow(sender, { windowId: backup.windowId, ...message });
  if (!target.ok || !target.window) {
    return { ok: false, error: target.error || "window_not_found" };
  }

  let result = null;
  if (backup.state === "maximized" || backup.state === "fullscreen" || backup.state === "minimized") {
    result = await windowsUpdate(Number(target.window.id), { state: backup.state });
  } else {
    const payload = {
      state: "normal",
      width: Number.isFinite(Number(backup.width)) ? Number(backup.width) : target.window.width,
      height: Number.isFinite(Number(backup.height)) ? Number(backup.height) : target.window.height
    };
    if (Number.isFinite(Number(backup.left))) payload.left = Number(backup.left);
    if (Number.isFinite(Number(backup.top))) payload.top = Number(backup.top);
    result = await windowsUpdate(Number(target.window.id), payload);
  }

  if (!result.ok) {
    return { ok: false, error: result.error || "window_restore_failed" };
  }

  state.runtime.windowResizeBackup = null;
  state.settings.screenEmulator.active = false;
  await saveState(state);
  return { ok: true, state: publicState(state), restored: true, window: result.window || null };
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
    next.settings.alerts.frequencyMin = Math.round(clamp(Number(legacySettings.breakIntervalMin || 45), 10, 180));
    next.meta.lastMigrationFrom = "legacy_settings";
  }

  return next;
}

function getEnabledReminderTypes(state) {
  const enabled = state?.settings?.alerts?.types || {};
  return ["eye", "posture", "burnout", "hydration", "blink", "movement"].filter((key) => Boolean(enabled[key]));
}

function getDeepWorkFocusMinutes(state) {
  const deepWork = state?.settings?.deepWork;
  if (!deepWork?.active) return 0;
  if (deepWork.phase !== "focus") return 0;
  const startedAt = Number(deepWork.startedAt || 0);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now() - startedAt) / 60000));
}

function isAlertQuietHours(state, ts = now()) {
  const quiet = state?.settings?.alerts?.quietHours;
  if (!quiet?.enabled) return false;
  return inTimeRange(quiet.start, quiet.end, new Date(ts));
}

function chooseReminderFromPool(state, pool) {
  if (!Array.isArray(pool) || !pool.length) return null;
  const idx = Number(state.runtime.lastAlertCursor || 0) % pool.length;
  state.runtime.lastAlertCursor += 1;
  return pool[idx];
}

function getReminderType(state) {
  const alerts = state.settings.alerts;
  const types = getEnabledReminderTypes(state);
  if (!types.length) return null;

  if (alerts.cadenceMode === "random") {
    const idx = Math.floor(Math.random() * types.length);
    return types[idx];
  }

  if (alerts.cadenceMode === "focus_weighted") {
    const focusMinutes = getDeepWorkFocusMinutes(state);
    if (focusMinutes >= Number(alerts.burnoutFocusThresholdMin || 90)) {
      const highPriority = ["burnout", "movement", "eye", "blink", "posture", "hydration"].filter((kind) => types.includes(kind));
      if (highPriority.length) return chooseReminderFromPool(state, highPriority);
    }
    if (state.settings.deepWork.active) {
      const focusPriority = ["eye", "posture", "blink", "movement", "hydration", "burnout"].filter((kind) => types.includes(kind));
      if (focusPriority.length) return chooseReminderFromPool(state, focusPriority);
    }
  }

  return chooseReminderFromPool(state, types);
}

function reminderCopy(kind) {
  if (kind === "posture") {
    return {
      title: "Posture protocol",
      body: "Chin tuck. Shoulders down. Relax jaw for 20 seconds.",
      severity: "medium"
    };
  }
  if (kind === "burnout") {
    return {
      title: "Nervous system reset",
      body: "Step away for one minute. Breathe slowly and unclench your jaw.",
      severity: "high"
    };
  }
  if (kind === "hydration") {
    return {
      title: "Hydration check",
      body: "Take a few slow sips of water and reset your breathing.",
      severity: "low"
    };
  }
  if (kind === "blink") {
    return {
      title: "Blink reset",
      body: "Blink slowly for 15 seconds to re-wet your eyes.",
      severity: "low"
    };
  }
  if (kind === "movement") {
    return {
      title: "Movement micro-break",
      body: "Stand up, roll shoulders, and walk for 30 seconds.",
      severity: "medium"
    };
  }
  return {
    title: "20-20-20",
    body: "Look 20 feet away for 20 seconds.",
    severity: "low"
  };
}

async function fireAlert(kind = "auto", test = false) {
  const state = await loadState();
  const alerts = state.settings.alerts;
  const ts = now();
  const delivery = {
    notification: false,
    toast: false,
    sound: false,
    soundChannel: "none",
    soundError: ""
  };

  if (!test) {
    if (!alerts.enabled) return { state, skipped: true, reason: "alerts_disabled", delivery };
    if (Number(alerts.snoozeUntil || 0) > ts) return { state, skipped: true, reason: "snoozed", delivery };
    if (isAlertQuietHours(state, ts)) return { state, skipped: true, reason: "quiet_hours", delivery };
    const cooldownMs = Math.max(0, Number(alerts.cooldownMin || 0)) * 60 * 1000;
    if (cooldownMs > 0 && Number(state.runtime.lastAlertAt || 0) > 0 && ts - Number(state.runtime.lastAlertAt || 0) < cooldownMs) {
      return { state, skipped: true, reason: "cooldown", delivery };
    }
  }

  const enabledTypes = getEnabledReminderTypes(state);
  let type = String(kind || "auto");
  if (type !== "auto" && !enabledTypes.includes(type) && !test) {
    type = "auto";
  }
  if (type === "auto") {
    type = getReminderType(state) || "eye";
  }
  if (!enabledTypes.length && !test) return { state, skipped: true, reason: "no_enabled_types", delivery };

  const copy = reminderCopy(type);
  const id = `holmeta-alert-${now()}`;
  const snoozeMinutes = Math.max(1, Number(alerts.snoozeMinutes || 10));

  if (alerts.notificationEnabled) {
    await notificationCreate(id, {
      type: "basic",
      iconUrl: "assets/icons/icon128.png",
      title: `HOLMETA: ${copy.title}`,
      message: copy.body,
      priority: copy.severity === "high" ? 2 : 1,
      requireInteraction: copy.severity === "high",
      buttons: [
        { title: `Snooze ${snoozeMinutes}m` },
        { title: "Open Protocol" }
      ]
    });
    delivery.notification = true;
  }

  if (alerts.toastEnabled) {
    const toastResult = await sendToBestWebTab("holmeta:toast", {
      title: copy.title,
      body: copy.body,
      kind: type,
      severity: copy.severity,
      durationMs: 9000,
      snoozeMinutes
    }, true);
    delivery.toast = Boolean(toastResult.ok);
  }

  if (alerts.soundEnabled) {
    const soundResult = await playAlertSoundReliable({
      kind: type,
      volume: Math.max(0.05, Math.min(0.85, Number(alerts.soundVolume || 35) / 100)),
      pattern: alerts.soundPattern || "double"
    });
    delivery.sound = Boolean(soundResult.ok);
    delivery.soundChannel = soundResult.channel || "none";
    delivery.soundError = String(soundResult.error || "");
  }

  if (!delivery.toast && !delivery.notification) {
    await notificationCreate(`${id}-fallback`, {
      type: "basic",
      iconUrl: "assets/icons/icon128.png",
      title: `HOLMETA: ${copy.title}`,
      message: `${copy.body} (Fallback notification)`
    });
    delivery.notification = true;
  }

  state.runtime.lastAlertAt = ts;
  state.runtime.lastAlertType = type;
  state.stats.alertsFired += 1;
  incrementDaily(state, "alerts", 1);
  log(state, "info", "alert_fired", { type, test, cadenceMode: alerts.cadenceMode, delivery });
  await saveState(state);
  return { state, skipped: false, reason: "", delivery };
}

function isSafeFilterHost(host) {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (normalized.length > 120) return false;
  if (!/\./.test(normalized)) return false;
  if (/[^a-z0-9.-]/.test(normalized)) return false;
  return true;
}

function parseFilterHosts(text, limit = 1400) {
  const hosts = [];
  const seen = new Set();
  const lines = String(text || "").split(/\r?\n/g);
  for (const raw of lines) {
    const line = String(raw || "").trim();
    if (!line || line.startsWith("!") || line.startsWith("#") || line.startsWith("[")) continue;
    if (line.startsWith("@@")) continue;

    let candidate = "";
    const pipeMatch = line.match(/^\|\|([a-z0-9.-]+)\^/i);
    if (pipeMatch) {
      candidate = pipeMatch[1];
    } else {
      const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-z0-9.-]+)/i);
      if (hostsMatch) candidate = hostsMatch[1];
      else if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(line)) candidate = line;
    }

    candidate = normalizeHost(candidate);
    if (!isSafeFilterHost(candidate) || seen.has(candidate)) continue;
    seen.add(candidate);
    hosts.push(candidate);
    if (hosts.length >= limit) break;
  }
  return hosts;
}

async function fetchRemoteFilterHosts(url, limit = 1400) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) {
      return { ok: false, error: `http_${response.status}`, hosts: [] };
    }
    const body = await response.text();
    return { ok: true, hosts: parseFilterHosts(body, limit) };
  } catch (error) {
    return { ok: false, error: String(error?.name || error?.message || "fetch_failed"), hosts: [] };
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshRemoteBlockerLists(state, reason = "manual") {
  const blocker = state.settings.blocker;
  if (!blocker.autoUpdateLists && reason !== "manual") {
    return { ok: true, skipped: true };
  }

  blocker.lastFilterUpdateStatus = "updating";
  await saveState(state);

  const nextByCategory = {
    ads: [],
    trackers: [],
    malware: [],
    annoyances: [],
    videoAds: []
  };
  const sourceStatus = {};

  const categories = ["ads", "trackers", "malware", "annoyances"];
  for (const category of categories) {
    const urls = REMOTE_FILTER_SOURCES[category] || [];
    const hosts = [];
    const seen = new Set();
    for (const sourceUrl of urls) {
      // eslint-disable-next-line no-await-in-loop
      const result = await fetchRemoteFilterHosts(sourceUrl, 1200);
      sourceStatus[`${category}:${sourceUrl}`] = result.ok ? "ok" : result.error || "failed";
      if (!result.ok) continue;
      for (const host of result.hosts) {
        if (!isSafeFilterHost(host) || seen.has(host)) continue;
        seen.add(host);
        hosts.push(host);
        if (hosts.length >= 1400) break;
      }
      if (hosts.length >= 1400) break;
    }
    nextByCategory[category] = hosts;
  }

  state.cache.blockerRemote = {
    updatedAt: now(),
    byCategory: nextByCategory,
    sourceStatus
  };
  blocker.lastFilterUpdateAt = state.cache.blockerRemote.updatedAt;
  blocker.lastFilterUpdateStatus = "ok";
  await saveState(state);

  log(state, "info", "blocker_remote_refresh_complete", {
    reason,
    totals: Object.fromEntries(
      Object.entries(nextByCategory).map(([key, list]) => [key, Array.isArray(list) ? list.length : 0])
    )
  });

  return { ok: true };
}

function getBlockerCategoryHosts(state, category) {
  const curated = BLOCKER_CURATED_HOSTS[category] || [];
  const remote = state.cache?.blockerRemote?.byCategory?.[category] || [];
  const merged = [];
  const seen = new Set();
  for (const host of [...curated, ...remote]) {
    const normalized = normalizeHost(host);
    if (!isSafeFilterHost(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
  }
  return merged;
}

function buildPatternRules({ startId, endId = 29999, patterns, priority = 1, actionType = "block", resourceTypes = DNR_RESOURCE_TYPES_SUBRESOURCE }) {
  const rules = [];
  let id = startId;
  for (const pattern of patterns || []) {
    if (!pattern || id > endId) break;
    const rule = {
      id,
      priority,
      action: actionType === "allow"
        ? { type: "allow" }
        : { type: "block" },
      condition: {
        urlFilter: String(pattern),
        resourceTypes
      }
    };
    rules.push(rule);
    id += 1;
  }
  return rules;
}

function buildHostRulesForCategory({ startId, endId = 29999, hosts, includeMainFrame = false }) {
  const rules = [];
  let id = startId;
  for (const host of hosts || []) {
    if (!host || id > endId) break;
    if (includeMainFrame) {
      if (id > endId) break;
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
    rules.push({
      id: id++,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: `||${host}^`,
        resourceTypes: includeMainFrame ? DNR_RESOURCE_TYPES_SUBRESOURCE : DNR_RESOURCE_TYPES_SUBRESOURCE
      }
    });
  }
  return rules;
}

function blockerCategoryFromRuleId(ruleId) {
  const id = Number(ruleId || 0);
  if (id >= DNR_IDS.BASE && id < DNR_IDS.NUCLEAR_CATCH_ALL) return "ads";
  if (id === DNR_IDS.NUCLEAR_CATCH_ALL) return "malware";
  for (const [category, range] of Object.entries(DNR_CATEGORY_RANGES)) {
    if (id >= range.start && id <= range.end) {
      return category === "antiAntiAdblock" ? "ads" : category;
    }
  }
  return "";
}

function incrementBlockStats(state, category, amount = 1, source = "dnr") {
  const n = Math.max(0, Number(amount || 0));
  if (!n) return;
  state.stats.blockEvents = Math.max(0, Number(state.stats.blockEvents || 0) + n);
  state.stats.adBlockEventsTotal = Math.max(0, Number(state.stats.adBlockEventsTotal || 0) + n);
  if (!state.stats.adBlockByCategory || typeof state.stats.adBlockByCategory !== "object") {
    state.stats.adBlockByCategory = {
      ads: 0,
      trackers: 0,
      malware: 0,
      annoyances: 0,
      videoAds: 0,
      cosmetic: 0
    };
  }
  const key = category || "ads";
  state.stats.adBlockByCategory[key] = Math.max(0, Number(state.stats.adBlockByCategory[key] || 0) + n);
  incrementDaily(state, "blocks", n);
  incrementDaily(state, "adBlockEvents", n);
  if (key === "ads") incrementDaily(state, "blockedAds", n);
  if (key === "trackers") incrementDaily(state, "blockedTrackers", n);
  if (key === "malware") incrementDaily(state, "blockedMalware", n);
  if (key === "annoyances") incrementDaily(state, "blockedAnnoyances", n);
  if (key === "videoAds") incrementDaily(state, "blockedVideoAds", n);
  if (key === "cosmetic" || source === "cosmetic") incrementDaily(state, "blockedCosmetic", n);
}

async function flushBufferedDnrCounters() {
  if (!dnrBufferedCounters.total) return;
  const state = await loadState();
  const total = dnrBufferedCounters.total;
  dnrBufferedCounters.total = 0;

  let accounted = 0;
  for (const [category, count] of Object.entries(dnrBufferedCounters.byCategory || {})) {
    const n = Math.max(0, Number(count || 0));
    if (!n) continue;
    accounted += n;
    incrementBlockStats(state, category, n, "dnr");
    dnrBufferedCounters.byCategory[category] = 0;
  }

  const unknown = Math.max(0, total - accounted);
  if (unknown) incrementBlockStats(state, "ads", unknown, "dnr");

  await saveState(state);
}

function scheduleDnrCounterFlush() {
  if (dnrBufferedCounters.timer) return;
  dnrBufferedCounters.timer = setTimeout(async () => {
    dnrBufferedCounters.timer = null;
    await flushBufferedDnrCounters();
  }, 3500);
}

function maybeBindDnrDebugCounters() {
  if (dnrDebugListenerBound) return;
  if (!chrome.declarativeNetRequest?.onRuleMatchedDebug?.addListener) return;
  try {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
      const ruleId = Number(info?.rule?.ruleId || 0);
      const category = blockerCategoryFromRuleId(ruleId);
      if (!category) return;
      dnrBufferedCounters.total += 1;
      if (dnrBufferedCounters.byCategory[category] !== undefined) {
        dnrBufferedCounters.byCategory[category] += 1;
      }
      scheduleDnrCounterFlush();
    });
    dnrDebugListenerBound = true;
  } catch {
    dnrDebugListenerBound = false;
  }
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

  // Always allow explicit allowlist domains first, across all resource types.
  for (const host of blocker.allowDomains || []) {
    rules.push({
      id: id++,
      priority: 5,
      action: { type: "allow" },
      condition: {
        urlFilter: `||${host}^`,
        resourceTypes: ["main_frame", ...DNR_RESOURCE_TYPES_SUBRESOURCE]
      }
    });
  }

  const blockedSet = new Set(blocker.blockedDomains || []);
  const quickCategories = blocker.quickCategories || {};
  for (const [category, enabled] of Object.entries(quickCategories)) {
    if (!enabled) continue;
    const hosts = QUICK_BLOCK_CATEGORY_HOSTS[category] || [];
    for (const host of hosts) {
      const normalized = normalizeHost(host);
      if (normalized) blockedSet.add(normalized);
    }
  }

  for (const host of blockedSet) {
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

  const categories = blocker.categories || {};
  const adblockEnabled = Object.values(categories).some(Boolean);
  if (!adblockEnabled) return rules;

  const appendCategoryRules = (category, includeMainFrame = false) => {
    if (!categories[category]) return;
    const range = DNR_CATEGORY_RANGES[category];
    if (!range) return;
    const hosts = getBlockerCategoryHosts(state, category);
    const hostRules = buildHostRulesForCategory({
      startId: range.start,
      endId: range.end,
      hosts,
      includeMainFrame
    });
    const patternOffset = range.start + hostRules.length;
    const patterns = BLOCKER_CURATED_PATTERNS[category] || [];
    const patternRules = buildPatternRules({
      startId: patternOffset,
      endId: range.end,
      patterns,
      priority: 1,
      actionType: "block",
      resourceTypes: includeMainFrame
        ? ["main_frame", ...DNR_RESOURCE_TYPES_SUBRESOURCE]
        : DNR_RESOURCE_TYPES_SUBRESOURCE
    });
    rules.push(...hostRules, ...patternRules);
  };

  appendCategoryRules("ads", false);
  appendCategoryRules("trackers", false);
  appendCategoryRules("annoyances", false);
  appendCategoryRules("videoAds", false);
  appendCategoryRules("malware", true);

  if (blocker.antiDetection) {
    rules.push(
      ...buildPatternRules({
        startId: DNR_CATEGORY_RANGES.antiAntiAdblock.start,
        patterns: ANTI_ANTI_ADBLOCK_ALLOW_PATTERNS,
        priority: 6,
        actionType: "allow",
        resourceTypes: ["script", "sub_frame", "xmlhttprequest"]
      })
    );
  }

  return rules;
}

async function applyDnrRules(state) {
  const removeRuleIds = [...(state.runtime.dynamicRuleIds || [])];
  const addRulesRaw = buildBlockRules(state);
  const maxRules = Math.max(1000, Math.min(DNR_LIMITS.DYNAMIC_SAFE, Number(state.settings.blocker.maxDynamicRules || DNR_LIMITS.DYNAMIC_SAFE)));
  const hardCap = Math.max(1000, maxRules - DNR_LIMITS.HARD_RESERVE);
  const addRules = addRulesRaw.slice(0, hardCap);
  state.runtime.blockerRuleLimitHit = addRulesRaw.length > addRules.length;
  state.runtime.blockerLastRuleCount = addRules.length;
  const ids = addRules.map((rule) => Number(rule.id || 0));
  const signature = hashText(JSON.stringify(ids));

  if (
    signature === String(state.runtime.blockerLastRuleSignature || "") &&
    Array.isArray(state.runtime.dynamicRuleIds) &&
    state.runtime.dynamicRuleIds.length === ids.length &&
    state.runtime.dynamicRuleIds.every((id, idx) => Number(id) === ids[idx])
  ) {
    return { ok: true, skipped: true };
  }

  const result = await updateDynamicRules({
    removeRuleIds,
    addRules
  });

  if (!result.ok) {
    log(state, "error", "dnr_update_failed", { error: result.error });
    return result;
  }

  if (state.runtime.blockerRuleLimitHit) {
    log(state, "error", "dnr_rule_limit_trimmed", {
      requested: addRulesRaw.length,
      applied: addRules.length,
      hardCap
    });
  }

  state.runtime.dynamicRuleIds = addRules.map((r) => r.id);
  state.runtime.blockerLastRuleSignature = signature;
  await saveState(state);
  return { ok: true };
}

async function broadcastState(state) {
  const payload = effectivePayload(state);
  const tabs = await tabsQuery({});
  let attempted = 0;
  let applied = 0;
  for (const tab of tabs) {
    if (!Number.isInteger(tab.id)) continue;
    if (!/^https?:/i.test(String(tab.url || ""))) continue;
    attempted += 1;
    // Expected to fail on restricted/internal pages.
    // eslint-disable-next-line no-await-in-loop
    const result = await sendTab(tab.id, { type: "holmeta:apply-state", payload });
    if (result.ok) applied += 1;
  }
  return { attempted, applied };
}

async function scheduleRuntimeAlarms(state) {
  await Promise.all([
    alarmClear(ALARMS.HEALTH),
    alarmClear(ALARMS.DEEPWORK),
    alarmClear(ALARMS.HEARTBEAT),
    alarmClear(ALARMS_BLOCKER_UPDATE),
    alarmClear(ALARMS.PROXY_REAPPLY)
  ]);

  if (state.settings.alerts.enabled && getEnabledReminderTypes(state).length > 0) {
    alarmCreate(ALARMS.HEALTH, { periodInMinutes: state.settings.alerts.frequencyMin });
  }

  if (state.settings.deepWork.active && state.settings.deepWork.nextTransitionAt) {
    alarmCreate(ALARMS.DEEPWORK, { when: state.settings.deepWork.nextTransitionAt });
  }

  const needsHeartbeat =
    Boolean(state.settings.lightFilter?.enabled || state.settings.light?.enabled) ||
    state.settings.blocker.enabled ||
    state.settings.deepWork.active ||
    state.settings.alerts.enabled;

  if (needsHeartbeat) {
    alarmCreate(ALARMS.HEARTBEAT, { periodInMinutes: 5 });
  }

  if (state.settings.blocker.autoUpdateLists) {
    const hours = Math.round(clamp(state.settings.blocker.updateIntervalHours, 24, 48));
    alarmCreate(ALARMS_BLOCKER_UPDATE, { periodInMinutes: hours * 60 });
  }

  if (state.settings.secureTunnel.enabled && state.settings.secureTunnel.autoReapply) {
    const minutes = Math.round(clamp(state.settings.secureTunnel.reapplyMinutes, 5, 60));
    alarmCreate(ALARMS.PROXY_REAPPLY, { periodInMinutes: minutes });
  }
}

async function initializeRuntime(reason = "startup") {
  const state = await loadState();
  log(state, "info", "initialize", { reason });
  maybeBindDnrDebugCounters();
  await scheduleRuntimeAlarms(state);
  await applyDnrRules(state);
  await applySecureTunnel(state, { force: true, reason });
  await broadcastState(state);
  await saveState(state);
}

async function runCommand(command) {
  const state = await loadState();
  const light = state.settings.lightFilter || state.settings.light;

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
    const light = state.settings.lightFilter || state.settings.light;
    light.enabled = true;
    if (light.mode === "dim") light.mode = "warm";
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

async function startColorPickOnActiveTab() {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const tab = tabs.find((t) => Number.isInteger(t.id) && /^https?:/i.test(String(t.url || "")));
  if (!tab) {
    return { ok: false, error: "no_active_tab" };
  }

  let result = await sendTab(tab.id, { type: "holmeta:start-color-pick" });
  if (!result.ok && isMissingReceiverError(result.error)) {
    const injected = await executeScriptFiles(tab.id, ["light/engine.js", "content.js"]);
    if (!injected.ok) {
      return { ok: false, error: injected.error || "inject_failed" };
    }
    result = await sendTab(tab.id, { type: "holmeta:start-color-pick" });
  }
  if (!result.ok) {
    return { ok: false, error: result.error || "pick_unavailable" };
  }

  return {
    ok: true,
    active: true,
    tabId: tab.id
  };
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
    await fireAlert("auto", false);
    return;
  }

  if (alarm.name === ALARMS.DEEPWORK) {
    await transitionDeepWork();
    return;
  }

  if (alarm.name === ALARMS.HEARTBEAT) {
    await heartbeatTick();
    return;
  }

  if (alarm.name === ALARMS_BLOCKER_UPDATE) {
    const state = await loadState();
    const refreshed = await refreshRemoteBlockerLists(state, "alarm");
    if (refreshed.ok && !refreshed.skipped) {
      await applyDnrRules(state);
      await broadcastState(state);
    }
    return;
  }

  if (alarm.name === ALARMS.PROXY_REAPPLY) {
    const state = await loadState();
    await applySecureTunnel(state, { force: true, reason: "alarm_reapply" });
    return;
  }
});

chrome.notifications.onButtonClicked.addListener(async (_notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    const state = await loadState();
    const minutes = Math.max(1, Number(state.settings.alerts.snoozeMinutes || 10));
    state.settings.alerts.snoozeUntil = now() + minutes * 60 * 1000;
    await saveState(state);
    log(state, "info", "alerts_snoozed", { minutes });
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

if (chrome.proxy?.onProxyError?.addListener) {
  chrome.proxy.onProxyError.addListener(async (details) => {
    const state = await loadState();
    const message = String(details?.error || details?.details || "proxy_error");
    state.runtime.secureTunnel.connected = false;
    state.runtime.secureTunnel.lastError = message.slice(0, 220);
    state.runtime.secureTunnel.lastErrorAt = now();
    log(state, "error", "secure_tunnel_proxy_error", {
      fatal: Boolean(details?.fatal),
      message
    });
    await saveState(state);
  });
}

if (chrome.webRequest?.onAuthRequired?.addListener) {
  try {
    chrome.webRequest.onAuthRequired.addListener(
      (details, callback) => {
        (async () => {
          try {
            if (!details?.isProxy) {
              callback({});
              return;
            }
            const state = await loadState();
            const tunnel = state.settings.secureTunnel;
            if (!tunnel.enabled) {
              callback({});
              return;
            }

            const candidates = resolveSecureTunnelCandidates(state);
            const active = candidates.find((item) => item.id === state.runtime.secureTunnel.activePresetId) || candidates[0];
            const username = String(active?.username || "");
            const password = String(active?.password || "");
            if (!username) {
              callback({});
              return;
            }

            state.runtime.secureTunnel.authFailures = Math.max(0, Number(state.runtime.secureTunnel.authFailures || 0));

            callback({
              authCredentials: {
                username,
                password
              }
            });
          } catch {
            callback({});
          }
        })();
      },
      { urls: ["<all_urls>"] },
      ["asyncBlocking"]
    );
  } catch {
    // Missing permission or unsupported in this Chromium build.
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const type = String(message?.type || "");
    if (type === "holmeta:offscreen-sound") {
      // Offscreen document handles this message; ignore in service worker.
      return;
    }

    const state = await loadState();

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
      let tabId = Number(message.tabId || 0);
      if ((!Number.isInteger(tabId) || tabId <= 0) && Number.isInteger(Number(sender?.tab?.id || 0))) {
        const senderUrl = String(sender?.tab?.url || "");
        if (/^https?:/i.test(senderUrl)) {
          tabId = Number(sender.tab.id || 0);
        }
      }
      if (!Number.isInteger(tabId) || tabId <= 0) {
        const tabs = await tabsQuery({ active: true, currentWindow: true });
        const activeTab = tabs.find((candidate) => Number.isInteger(candidate?.id) && /^https?:/i.test(String(candidate?.url || "")));
        tabId = Number(activeTab?.id || 0);
      }
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
      let expandedPatch = patch;
      if (patch.light && typeof patch.light === "object") {
        const mapped = legacyLightPatchToSeparated(patch.light);
        expandedPatch = mergeDeep(expandedPatch, mapped);
      }
      state.settings = normalizeState({ settings: mergeDeep(state.settings, expandedPatch), license: state.license }).settings;
      await saveState(state);
      if (patchTouchesSecureTunnel(expandedPatch)) {
        await applySecureTunnel(state, { force: true, reason: "settings_patch" });
      }
      await scheduleRuntimeAlarms(state);
      await applyDnrRules(state);
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:get-secure-tunnel-presets") {
      sendResponse({
        ok: true,
        presets: getSecureTunnelPresetCatalog(),
        state: publicState(state)
      });
      return;
    }

    if (type === "holmeta:secure-tunnel-toggle") {
      state.settings.secureTunnel.enabled = Boolean(message.enabled);
      await saveState(state);
      const result = await applySecureTunnel(state, { force: true, reason: "toggle" });
      await scheduleRuntimeAlarms(state);
      sendResponse({
        ok: result.ok,
        error: result.ok ? "" : (result.error || "secure_tunnel_toggle_failed"),
        state: publicState(state)
      });
      return;
    }

    if (type === "holmeta:secure-tunnel-connect") {
      const mode = ["preset", "custom"].includes(String(message.mode || ""))
        ? String(message.mode)
        : state.settings.secureTunnel.mode;
      const patch = {
        mode,
        selectedPresetId: SECURE_TUNNEL_PRESETS.some((preset) => preset.id === message.presetId)
          ? String(message.presetId)
          : state.settings.secureTunnel.selectedPresetId,
        custom: {
          scheme: normalizeProxyScheme(message.custom?.scheme, state.settings.secureTunnel.custom.scheme),
          host: normalizeHost(message.custom?.host || state.settings.secureTunnel.custom.host),
          port: normalizeProxyPort(message.custom?.port, state.settings.secureTunnel.custom.port),
          username: String(message.custom?.username ?? state.settings.secureTunnel.custom.username ?? "").slice(0, 120),
          password: String(message.custom?.password ?? state.settings.secureTunnel.custom.password ?? "").slice(0, 180)
        }
      };
      state.settings.secureTunnel = {
        ...state.settings.secureTunnel,
        ...patch,
        enabled: true
      };
      state.settings = normalizeState({ settings: state.settings, license: state.license }).settings;
      await saveState(state);
      const result = await applySecureTunnel(state, { force: true, reason: "manual_connect" });
      await scheduleRuntimeAlarms(state);
      sendResponse({
        ok: result.ok,
        error: result.ok ? "" : (result.error || "secure_tunnel_connect_failed"),
        state: publicState(state)
      });
      return;
    }

    if (type === "holmeta:secure-tunnel-disconnect") {
      state.settings.secureTunnel.enabled = false;
      await saveState(state);
      const result = await clearSecureTunnel(state, "manual_disconnect");
      await scheduleRuntimeAlarms(state);
      sendResponse({
        ok: result.ok,
        error: result.ok ? "" : (result.error || "secure_tunnel_disconnect_failed"),
        state: publicState(state)
      });
      return;
    }

    if (type === "holmeta:apply-all-tabs") {
      let settingsChanged = false;
      if (Boolean(message.ensureLightEnabled) && !(state.settings.lightFilter?.enabled || state.settings.light?.enabled)) {
        if (state.settings.lightFilter) state.settings.lightFilter.enabled = true;
        else state.settings.light.enabled = true;
        settingsChanged = true;
      }

      if (settingsChanged) {
        await saveState(state);
        await scheduleRuntimeAlarms(state);
      }

      const summary = await broadcastState(state);
      sendResponse({
        ok: true,
        state: publicState(state),
        attemptedTabs: Number(summary?.attempted || 0),
        appliedTabs: Number(summary?.applied || 0)
      });
      return;
    }

    if (type === "holmeta:resize-window") {
      const result = await applyWindowResize(state, sender, message);
      if (!result.ok) {
        sendResponse({ ok: false, error: result.error || "resize_failed" });
        return;
      }
      sendResponse(result);
      return;
    }

    if (type === "holmeta:reset-window-size") {
      const result = await resetWindowResize(state, sender, message);
      if (!result.ok) {
        sendResponse({ ok: false, error: result.error || "restore_failed" });
        return;
      }
      sendResponse(result);
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

    if (type === "holmeta:start-color-pick" || type === "holmeta:pick-color") {
      const started = await startColorPickOnActiveTab();
      if (!started.ok) {
        sendResponse(started);
        return;
      }
      sendResponse({ ...started, state: publicState(state) });
      return;
    }

    if (type === "holmeta:screenshot-start" || type === "SCREENSHOT_START") {
      const started = await startScreenshotToolOnActiveTab(state);
      if (!started.ok) {
        state.runtime.screenshotTool.lastError = started.error || "start_failed";
        await saveState(state);
        sendResponse({ ok: false, error: started.error || "start_failed", state: publicState(state) });
        return;
      }
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state), tabId: started.tabId });
      return;
    }

    if (type === "holmeta:screenshot-stop" || type === "SCREENSHOT_CANCEL") {
      const stopped = await stopScreenshotToolOnActiveTab(state);
      await broadcastState(state);
      sendResponse({ ok: Boolean(stopped.ok), state: publicState(state) });
      return;
    }

    if (type === "holmeta:screenshot-capture" || type === "SCREENSHOT_CAPTURE") {
      if (!sender?.tab || !Number.isInteger(Number(sender.tab.id || 0))) {
        sendResponse({ ok: false, error: "invalid_sender_tab" });
        return;
      }

      const incomingSettings = message.settings && typeof message.settings === "object"
        ? message.settings
        : {};
      const screenshotSettings = normalizeScreenshotToolSettings(
        mergeDeep(state.settings.screenshotTool, incomingSettings),
        state.settings.screenshotTool
      );

      const senderWindowId = Number(sender.tab.windowId || 0);
      const captureWindowId = Number.isInteger(senderWindowId) && senderWindowId > 0
        ? senderWindowId
        : undefined;
      const captured = await tabsCaptureVisibleTab(captureWindowId, { format: "png" });
      if (!captured.ok || !captured.dataUrl) {
        state.runtime.screenshotTool.lastError = captured.error || "capture_failed";
        await saveState(state);
        sendResponse({ ok: false, error: captured.error || "capture_failed" });
        return;
      }

      const cropped = await cropVisibleCapture(captured.dataUrl, message, screenshotSettings);
      if (!cropped.ok) {
        state.runtime.screenshotTool.lastError = cropped.error || "crop_failed";
        await saveState(state);
        sendResponse({ ok: false, error: cropped.error || "crop_failed" });
        return;
      }

      state.runtime.screenshotTool.lastCaptureAt = now();
      state.runtime.screenshotTool.lastError = "";
      await saveState(state);
      sendResponse({
        ok: true,
        imageDataUrl: cropped.imageDataUrl,
        width: cropped.width,
        height: cropped.height,
        rect: cropped.rect
      });
      return;
    }

    if (type === "holmeta:color-picked") {
      const hex = normalizeHexColor(message.hex, "");
      if (!hex) {
        sendResponse({ ok: false, error: "invalid_color" });
        return;
      }
      state.settings.eyeDropper.recentHex = hex;
      ensureDailyStats(state);
      log(state, "info", "color_picked", { method: String(message.method || "unknown"), hexHash: hashText(hex) });
      await saveState(state);
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state) });
      return;
    }

    if (type === "holmeta:exclude-site") {
      const host = normalizeHost(message.host);
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      state.settings.lightFilter.excludedSites = {
        ...(state.settings.lightFilter.excludedSites || {}),
        [host]: true
      };
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
      state.settings.lightFilter.perSiteOverrides[host] = {
        enabled: true,
        mode: state.settings.lightFilter.mode,
        spectrumPreset: state.settings.lightFilter.spectrumPreset,
        intensity: state.settings.lightFilter.intensity,
        dim: state.settings.lightFilter.dim,
        contrastSoft: state.settings.lightFilter.contrastSoft,
        brightness: state.settings.lightFilter.brightness,
        saturation: state.settings.lightFilter.saturation,
        blueCut: state.settings.lightFilter.blueCut,
        tintRed: state.settings.lightFilter.tintRed,
        tintGreen: state.settings.lightFilter.tintGreen,
        tintBlue: state.settings.lightFilter.tintBlue,
        reduceWhites: state.settings.lightFilter.reduceWhites,
        videoSafe: state.settings.lightFilter.videoSafe,
        spotlightEnabled: state.settings.lightFilter.spotlightEnabled,
        therapyMode: state.settings.lightFilter.therapyMode,
        therapyDuration: state.settings.lightFilter.therapyDuration,
        therapyCadence: state.settings.lightFilter.therapyCadence
      };
      state.settings.readingTheme.perSiteOverrides[host] = {
        enabled: true,
        mode: state.settings.readingTheme.mode,
        preset: state.settings.readingTheme.preset,
        intensity: state.settings.readingTheme.intensity
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

    if (type === "holmeta:remove-blocked-domain") {
      const host = normalizeHost(message.host || sender?.tab?.url || "");
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      const set = new Set(state.settings.blocker.blockedDomains || []);
      const existed = set.delete(host);
      state.settings.blocker.blockedDomains = [...set];
      await saveState(state);
      await applyDnrRules(state);
      sendResponse({ ok: true, removed: existed, state: publicState(state) });
      return;
    }

    if (type === "holmeta:toggle-blocker-quick-category") {
      const category = String(message.category || "").trim();
      if (!Object.prototype.hasOwnProperty.call(QUICK_BLOCK_CATEGORY_HOSTS, category)) {
        sendResponse({ ok: false, error: "invalid_category" });
        return;
      }
      const current = Boolean(state.settings.blocker.quickCategories?.[category]);
      const nextEnabled = typeof message.enabled === "boolean" ? Boolean(message.enabled) : !current;
      state.settings.blocker.quickCategories = {
        ...(state.settings.blocker.quickCategories || {}),
        [category]: nextEnabled
      };
      await saveState(state);
      await applyDnrRules(state);
      await broadcastState(state);
      sendResponse({ ok: true, category, enabled: nextEnabled, state: publicState(state) });
      return;
    }

    if (type === "holmeta:toggle-blocker-whitelist-site") {
      const host = normalizeHost(message.host || sender?.tab?.url || "");
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      const allow = new Set(state.settings.blocker.allowDomains || []);
      let whitelisted = false;
      if (allow.has(host)) {
        allow.delete(host);
        whitelisted = false;
      } else {
        allow.add(host);
        whitelisted = true;
      }
      state.settings.blocker.allowDomains = [...allow];
      await saveState(state);
      await applyDnrRules(state);
      await broadcastState(state);
      sendResponse({ ok: true, whitelisted, state: publicState(state) });
      return;
    }

    if (type === "holmeta:toggle-cosmetic-site-disable") {
      const host = normalizeHost(message.host || sender?.tab?.url || "");
      if (!host) {
        sendResponse({ ok: false, error: "invalid_host" });
        return;
      }
      const map = {
        ...(state.settings.blocker.disableCosmeticOnSite || {})
      };
      if (map[host]) delete map[host];
      else map[host] = true;
      state.settings.blocker.disableCosmeticOnSite = map;
      await saveState(state);
      await broadcastState(state);
      sendResponse({ ok: true, disabled: Boolean(map[host]), state: publicState(state) });
      return;
    }

    if (type === "holmeta:block-element-picker") {
      const tabs = await tabsQuery({ active: true, currentWindow: true });
      const tab = tabs.find((t) => Number.isInteger(t.id) && /^https?:/i.test(String(t.url || "")));
      if (!tab) {
        sendResponse({ ok: false, error: "no_active_tab" });
        return;
      }
      const result = await sendTab(tab.id, { type: "holmeta:block-element-picker" });
      if (!result.ok) {
        sendResponse({ ok: false, error: result.error || "picker_failed" });
        return;
      }
      sendResponse(result.res || { ok: true });
      return;
    }

    if (type === "holmeta:add-cosmetic-selector") {
      const host = normalizeHost(message.host || sender?.tab?.url || "");
      const selector = String(message.selector || "").trim();
      if (!host || !selector || selector.length > 220) {
        sendResponse({ ok: false, error: "invalid_selector" });
        return;
      }
      const map = { ...(state.settings.blocker.customCosmeticSelectors || {}) };
      const current = Array.isArray(map[host]) ? map[host] : [];
      const deduped = [...new Set([selector, ...current])].slice(0, 120);
      map[host] = deduped;
      state.settings.blocker.customCosmeticSelectors = map;
      await saveState(state);
      await broadcastState(state);
      sendResponse({ ok: true, selector, host, state: publicState(state) });
      return;
    }

    if (type === "holmeta:block-events") {
      const count = Math.round(clamp(message.count || 1, 1, 300));
      const categoryRaw = String(message.category || "cosmetic");
      const category = ["ads", "trackers", "malware", "annoyances", "videoAds", "cosmetic"].includes(categoryRaw)
        ? categoryRaw
        : "cosmetic";
      incrementBlockStats(state, category, count, "cosmetic");
      await saveState(state);
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

    if (type === "holmeta:refresh-blocker-lists") {
      const result = await refreshRemoteBlockerLists(state, "manual");
      if (!result.ok) {
        sendResponse({ ok: false, error: result.error || "refresh_failed" });
        return;
      }
      await applyDnrRules(state);
      await broadcastState(state);
      sendResponse({ ok: true, state: publicState(state) });
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
      const requestedKind = String(message.kind || "eye");
      const result = await fireAlert(requestedKind, true);
      sendResponse({
        ok: !result?.skipped,
        skipped: Boolean(result?.skipped),
        reason: String(result?.reason || ""),
        delivery: result?.delivery || {
          notification: false,
          toast: false,
          sound: false,
          soundChannel: "none",
          soundError: ""
        }
      });
      return;
    }

    if (type === "holmeta:snooze-alerts") {
      const minutes = Math.round(clamp(message.minutes || state.settings.alerts.snoozeMinutes || 10, 1, 240));
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
      await applySecureTunnel(imported, { force: true, reason: "import_settings" });
      await broadcastState(imported);
      sendResponse({ ok: true, state: publicState(imported) });
      return;
    }

    if (type === "holmeta:reset-all") {
      const fresh = createDefaultState();
      await saveState(fresh);
      await scheduleRuntimeAlarms(fresh);
      await applyDnrRules(fresh);
      await applySecureTunnel(fresh, { force: true, reason: "reset_all" });
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
