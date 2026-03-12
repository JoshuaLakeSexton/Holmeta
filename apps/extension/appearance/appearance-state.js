(() => {
  if (globalThis.HolmetaAppearanceState) return;

  const paletteLib = globalThis.HolmetaAppearancePalettes || null;
  const tokenGenerator = globalThis.HolmetaAppearanceTokenGenerator || null;

  const IDS = {
    STYLE: "holmeta-appearance-style-v1"
  };

  const ATTR = {
    ACTIVE: "data-holmeta-appearance-active",
    MODE: "data-holmeta-appearance-mode",
    COMPAT: "data-holmeta-appearance-compat",
    SITE: "data-holmeta-appearance-site",
    SITE_CLASS: "data-holmeta-site-class",
    SURFACE: "data-holmeta-ui-surface",
    COMPONENT: "data-holmeta-ui-component",
    INNER: "data-holmeta-ui-inner",
    OWNED: "data-holmeta-appearance-owned",
    MEDIA_SAFE: "data-holmeta-media-safe",
    FORCE_TEXT: "data-holmeta-force-text",
    LOGO_WORDMARK: "data-holmeta-logo-wordmark",
    LOGO_SAFE_BG: "data-holmeta-logo-safe-bg",
    LOGO_SVG: "data-holmeta-logo-svg"
  };

  const DARK_VARIANTS = new Set(
    Object.keys(paletteLib?.darkMap || {
      coal: 1,
      black: 1,
      brown: 1,
      grey: 1,
      sepia: 1,
      teal: 1,
      purple: 1,
      forest_green: 1
    })
  );

  const LIGHT_VARIANTS = new Set(
    Object.keys(paletteLib?.lightMap || {
      white: 1,
      warm: 1,
      off_white: 1,
      soft_green: 1,
      baby_blue: 1,
      light_brown: 1
    })
  );

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function hexToRgb(hex) {
    const raw = String(hex || "").trim().replace(/^#/, "");
    if (raw.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((v) => {
      const c = clamp(Math.round(v), 0, 255);
      return c.toString(16).padStart(2, "0");
    }).join("")}`;
  }

  function mix(hexA, hexB, ratio = 0.5) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const r = clamp(ratio, 0, 1);
    return rgbToHex(
      (a.r * (1 - r)) + (b.r * r),
      (a.g * (1 - r)) + (b.g * r),
      (a.b * (1 - r)) + (b.b * r)
    );
  }

  function alpha(hex, value) {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(value, 0, 1).toFixed(3)})`;
  }

  function normalizeDarkVariant(value, fallback = "coal") {
    if (paletteLib?.normalizeDarkVariant) return paletteLib.normalizeDarkVariant(value, fallback);
    const key = String(value || fallback).toLowerCase();
    if (key === "gray") return "grey";
    return DARK_VARIANTS.has(key) ? key : fallback;
  }

  function normalizeLightVariant(value, fallback = "white") {
    if (paletteLib?.normalizeLightVariant) return paletteLib.normalizeLightVariant(value, fallback);
    const key = String(value || fallback).toLowerCase();
    if (key === "gray") return "off_white";
    return LIGHT_VARIANTS.has(key) ? key : fallback;
  }

  function toTokens({
    mode = "dark",
    darkVariant = "coal",
    lightVariant = "white",
    intensity = 46,
    siteClass = "general",
    pageTone = "mixed",
    compatibilityMode = "normal"
  }) {
    if (tokenGenerator?.generateTokens) {
      return tokenGenerator.generateTokens({
        mode,
        darkVariant: normalizeDarkVariant(darkVariant, "coal"),
        lightVariant: normalizeLightVariant(lightVariant, "white"),
        intensity,
        siteClass,
        pageTone,
        compatibilityMode
      });
    }

    if (paletteLib?.toTokens) {
      return paletteLib.toTokens({
        mode,
        darkVariant: normalizeDarkVariant(darkVariant, "coal"),
        lightVariant: normalizeLightVariant(lightVariant, "white"),
        intensity
      });
    }

    return {
      mode: mode === "light" ? "light" : "dark",
      pageBase: mode === "light" ? "#FAFAFA" : "#121212",
      surface1: mode === "light" ? "#FFFFFF" : "#181818",
      surface2: mode === "light" ? "#F4F4F4" : "#1E1E1E",
      surface3: mode === "light" ? "#EFEFEF" : "#262626",
      textPrimary: mode === "light" ? "#111111" : "#E0E0E0",
      textSecondary: mode === "light" ? "#333333" : "#B9B9B9",
      textMuted: mode === "light" ? "#666666" : "#A1A1A1",
      borderSoft: mode === "light" ? "rgba(0,0,0,0.22)" : "rgba(224,224,224,0.16)",
      borderStrong: mode === "light" ? "rgba(0,0,0,0.34)" : "rgba(224,224,224,0.30)",
      interactiveBg: mode === "light" ? "#EAEAEA" : "#2B2B2B",
      interactiveHover: mode === "light" ? "#E0E0E0" : "#363636",
      selectedBg: mode === "light" ? "#DADADA" : "#424242",
      selectedText: mode === "light" ? "#111111" : "#F1F1F1",
      inputBg: mode === "light" ? "#FFFFFF" : "#232323",
      inputBorder: mode === "light" ? "rgba(0,0,0,0.28)" : "rgba(224,224,224,0.22)",
      cardBg: mode === "light" ? "#FFFFFF" : "#191919",
      menuBg: mode === "light" ? "#FFFFFF" : "#161616",
      badgeBg: mode === "light" ? "#E2E2E2" : "#2F2F2F",
      buttonBg: mode === "light" ? "#ECECEC" : "#323232",
      buttonText: mode === "light" ? "#111111" : "#EAEAEA",
      link: mode === "light" ? "#2D6FD1" : "#A9C4FF",
      shadow: mode === "light" ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.42)",
      overlayTint: mode === "light" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)"
    };
  }

  globalThis.HolmetaAppearanceState = {
    IDS,
    ATTR,
    DARK_VARIANTS,
    LIGHT_VARIANTS,
    normalizeDarkVariant,
    normalizeLightVariant,
    toTokens,
    mix,
    alpha,
    clamp
  };
})();
