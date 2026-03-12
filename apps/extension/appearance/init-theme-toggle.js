(() => {
  if (globalThis.__HOLMETA_APPEARANCE_BOOT__) return;
  globalThis.__HOLMETA_APPEARANCE_BOOT__ = true;

  if (!/^https?:$/.test(String(location.protocol || ""))) return;

  const STORAGE_KEY = "holmeta.v3.state";
  const STYLE_ID = "holmeta-appearance-boot-style-v1";
  const ATTR_BOOT = "data-holmeta-appearance-boot";

  const DARK_PALETTES = {
    black: { page: "#101419", surface: "#171d24", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" },
    coal: { page: "#161b21", surface: "#1f2730", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" },
    iron_ore: { page: "#1b2128", surface: "#262f39", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" },
    brown: { page: "#1C1513", surface: "#2A201D", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" },
    grey: { page: "#202224", surface: "#2A2D30", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" },
    sepia: { page: "#22160F", surface: "#332116", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" },
    teal: { page: "#0C1A18", surface: "#12302B", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" },
    purple: { page: "#18142A", surface: "#251E3C", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" },
    forest_green: { page: "#121B12", surface: "#1E2D1E", text: "#F3F3F4", line: "rgba(243,243,244,0.12)" }
  };

  const LIGHT_PALETTES = {
    white: { page: "#FFFFFF", surface: "#F7F8FA", text: "#111111", line: "rgba(17,17,17,0.15)" },
    warm: { page: "#FFFDE7", surface: "#F8F3DA", text: "#1F1A18", line: "rgba(31,26,24,0.15)" },
    off_white: { page: "#FAFAFA", surface: "#F1F2F4", text: "#141519", line: "rgba(20,21,25,0.15)" },
    soft_green: { page: "#E8F5E9", surface: "#E1EFE2", text: "#112212", line: "rgba(17,34,18,0.15)" },
    baby_blue: { page: "#E3F2FD", surface: "#DFECF8", text: "#0E1826", line: "rgba(14,24,38,0.15)" },
    light_brown: { page: "#D7CCC8", surface: "#CEC3BE", text: "#1F1815", line: "rgba(31,24,21,0.15)" }
  };

  function normalizeHost(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function toMins(hhmm) {
    const parts = String(hhmm || "00:00").split(":");
    const h = Number(parts[0] || 0);
    const m = Number(parts[1] || 0);
    return (h * 60) + m;
  }

  function inRange(start, end) {
    const s = toMins(start);
    const e = toMins(end);
    const now = new Date();
    const cur = (now.getHours() * 60) + now.getMinutes();
    if (s === e) return true;
    if (s < e) return cur >= s && cur < e;
    return cur >= s || cur < e;
  }

  function resolveMode(reading) {
    const appearance = String(reading?.appearance || reading?.mode || "auto").toLowerCase();
    if (appearance === "dark" || appearance === "light") return appearance;

    const scheduleMode = String(reading?.scheduleMode || "system").toLowerCase();
    const schedule = reading?.schedule && typeof reading.schedule === "object"
      ? reading.schedule
      : null;

    if (scheduleMode === "custom" && schedule && schedule.start && schedule.end) {
      return inRange(schedule.start, schedule.end) ? "dark" : "light";
    }

    if (scheduleMode === "sunset") {
      // Sunset mode falls back to system preference in boot phase.
      return globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
    }

    return globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function ensureStyleNode() {
    let node = document.getElementById(STYLE_ID);
    if (!node) {
      node = document.createElement("style");
      node.id = STYLE_ID;
      (document.documentElement || document.head || document).appendChild(node);
    }
    return node;
  }

  function applyBootTheme(mode, variant) {
    const palette = mode === "light"
      ? (LIGHT_PALETTES[String(variant || "white")] || LIGHT_PALETTES.white)
      : (DARK_PALETTES[String(variant || "coal")] || DARK_PALETTES.coal);

    const styleNode = ensureStyleNode();
    styleNode.textContent = `
html[${ATTR_BOOT}='1'] {
  color-scheme: ${mode === "dark" ? "dark" : "light"} !important;
  background-color: ${palette.page} !important;
}
html[${ATTR_BOOT}='1'] body {
  background-color: ${palette.page} !important;
  color: ${palette.text} !important;
}
html[${ATTR_BOOT}='1'] :where(h1, h2, h3, h4, h5, h6, p, span, label, a, li, td, th, button, strong) {
  color: ${palette.text} !important;
}
html[${ATTR_BOOT}='1'] :where(hr, [role='separator']) {
  border-color: ${palette.line} !important;
}
`;

    document.documentElement?.setAttribute(ATTR_BOOT, "1");
  }

  function resolveReadingProfile(rawState) {
    const settings = rawState?.settings || {};
    const host = normalizeHost(location.hostname || "");
    const reading = settings.darkLightTheme || settings.readingTheme || {};
    const excluded = reading?.excludedSites && typeof reading.excludedSites === "object"
      ? reading.excludedSites
      : {};

    if (host && excluded[host]) return null;

    const perSite = reading?.perSiteOverrides && typeof reading.perSiteOverrides === "object"
      ? reading.perSiteOverrides
      : {};

    const siteProfile = host ? perSite[host] : null;
    const effective = siteProfile && typeof siteProfile === "object"
      ? { ...reading, ...siteProfile }
      : reading;

    if (!effective || !effective.enabled) return null;
    return effective;
  }

  function bootFromState(rawState) {
    const profile = resolveReadingProfile(rawState);
    if (!profile) return;

    const mode = resolveMode(profile);
    if (mode !== "dark" && mode !== "light") return;

    const variant = mode === "dark"
      ? String(profile.darkVariant || profile.darkThemeVariant || "coal")
      : String(profile.lightVariant || profile.lightThemeVariant || "white");

    applyBootTheme(mode, variant);
  }

  function readFromChromeStorage() {
    return new Promise((resolve) => {
      const api = globalThis.chrome?.storage?.local;
      if (!api?.get) {
        resolve(null);
        return;
      }
      api.get([STORAGE_KEY], (result) => {
        const err = globalThis.chrome?.runtime?.lastError;
        if (err) {
          resolve(null);
          return;
        }
        resolve(result?.[STORAGE_KEY] || null);
      });
    });
  }

  function readFromLocalStorage() {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  (async () => {
    const fromChrome = await readFromChromeStorage();
    if (fromChrome) {
      bootFromState(fromChrome);
      return;
    }
    const fromLocal = readFromLocalStorage();
    if (fromLocal) {
      bootFromState(fromLocal);
    }
  })();
})();
