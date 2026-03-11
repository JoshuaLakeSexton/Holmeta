(() => {
  if (globalThis.HolmetaAppearanceState) return;

  const IDS = {
    STYLE: "holmeta-appearance-style-v1"
  };

  const ATTR = {
    ACTIVE: "data-holmeta-appearance-active",
    MODE: "data-holmeta-appearance-mode",
    COMPAT: "data-holmeta-appearance-compat",
    SITE: "data-holmeta-appearance-site",
    SURFACE: "data-holmeta-ui-surface",
    COMPONENT: "data-holmeta-ui-component",
    INNER: "data-holmeta-ui-inner",
    OWNED: "data-holmeta-appearance-owned",
    MEDIA_SAFE: "data-holmeta-media-safe"
  };

  const DARK_VARIANTS = new Set([
    "coal",
    "black",
    "brown",
    "grey",
    "sepia",
    "teal",
    "purple",
    "forest_green"
  ]);

  const LIGHT_VARIANTS = new Set([
    "white",
    "warm",
    "off_white",
    "soft_green",
    "baby_blue",
    "light_brown"
  ]);

  const DARK_PALETTES = {
    coal: { bg: "#121212", text: "#E0E0E0", accent: "#424242" },
    black: { bg: "#000000", text: "#BDBDBD", accent: "#2A2A2A" },
    brown: { bg: "#3E2723", text: "#FFF8E1", accent: "#6D4C41" },
    grey: { bg: "#424242", text: "#FFFFFF", accent: "#757575" },
    sepia: { bg: "#5C3317", text: "#F4EBD0", accent: "#A67C52" },
    teal: { bg: "#004D40", text: "#E0F2F1", accent: "#009688" },
    purple: { bg: "#311B92", text: "#E1BEE7", accent: "#7E57C2" },
    forest_green: { bg: "#1B5E20", text: "#E8F5E9", accent: "#4CAF50" }
  };

  const LIGHT_PALETTES = {
    white: { bg: "#FFFFFF", text: "#000000", accent: "#2196F3" },
    warm: { bg: "#FFFDE7", text: "#3E2723", accent: "#FFB300" },
    off_white: { bg: "#FAFAFA", text: "#212121", accent: "#757575" },
    soft_green: { bg: "#E8F5E9", text: "#1B5E20", accent: "#66BB6A" },
    baby_blue: { bg: "#E3F2FD", text: "#0D47A1", accent: "#42A5F5" },
    light_brown: { bg: "#D7CCC8", text: "#4E342E", accent: "#A1887F" }
  };

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
    const key = String(value || fallback).toLowerCase();
    if (key === "gray") return "grey";
    return DARK_VARIANTS.has(key) ? key : fallback;
  }

  function normalizeLightVariant(value, fallback = "white") {
    const key = String(value || fallback).toLowerCase();
    if (key === "gray") return "off_white";
    return LIGHT_VARIANTS.has(key) ? key : fallback;
  }

  function toTokens({ mode = "dark", darkVariant = "coal", lightVariant = "white", intensity = 46 }) {
    const strength = clamp(intensity, 0, 100) / 100;
    if (mode === "light") {
      const palette = LIGHT_PALETTES[normalizeLightVariant(lightVariant)] || LIGHT_PALETTES.white;
      return {
        mode: "light",
        pageBase: palette.bg,
        surface1: mix(palette.bg, "#ffffff", 0.08),
        surface2: mix(palette.bg, palette.accent, 0.10),
        surface3: mix(palette.bg, palette.accent, 0.16),
        textPrimary: palette.text,
        textSecondary: mix(palette.text, "#4a4a4a", 0.20),
        textMuted: mix(palette.text, "#7a7a7a", 0.42),
        borderSoft: alpha(palette.text, 0.20 + (strength * 0.08)),
        borderStrong: alpha(palette.text, 0.34 + (strength * 0.08)),
        interactiveBg: mix(palette.bg, palette.accent, 0.18),
        interactiveHover: mix(palette.bg, palette.accent, 0.27),
        selectedBg: mix(palette.bg, palette.accent, 0.34),
        selectedText: palette.text,
        inputBg: mix(palette.bg, "#ffffff", 0.16),
        inputBorder: alpha(palette.text, 0.30),
        cardBg: mix(palette.bg, "#ffffff", 0.10),
        menuBg: mix(palette.bg, "#ffffff", 0.12),
        badgeBg: mix(palette.bg, palette.accent, 0.24),
        buttonBg: mix(palette.bg, palette.accent, 0.22),
        buttonText: palette.text,
        link: palette.accent,
        shadow: alpha("#000000", 0.16),
        overlayTint: alpha("#ffffff", 0.03 + (strength * 0.04))
      };
    }

    const palette = DARK_PALETTES[normalizeDarkVariant(darkVariant)] || DARK_PALETTES.coal;
    return {
      mode: "dark",
      pageBase: palette.bg,
      surface1: mix(palette.bg, "#000000", 0.12),
      surface2: mix(palette.bg, palette.accent, 0.16),
      surface3: mix(palette.bg, palette.accent, 0.24),
      textPrimary: palette.text,
      textSecondary: mix(palette.text, "#ffffff", 0.16),
      textMuted: mix(palette.text, "#8f8f8f", 0.36),
      borderSoft: alpha(palette.text, 0.16 + (strength * 0.06)),
      borderStrong: alpha(palette.text, 0.30 + (strength * 0.08)),
      interactiveBg: mix(palette.bg, palette.accent, 0.26),
      interactiveHover: mix(palette.bg, palette.accent, 0.34),
      selectedBg: mix(palette.bg, palette.accent, 0.42),
      selectedText: palette.text,
      inputBg: mix(palette.bg, palette.accent, 0.20),
      inputBorder: alpha(palette.text, 0.24),
      cardBg: mix(palette.bg, "#101010", 0.22),
      menuBg: mix(palette.bg, "#080808", 0.18),
      badgeBg: mix(palette.bg, palette.accent, 0.34),
      buttonBg: mix(palette.bg, palette.accent, 0.30),
      buttonText: palette.text,
      link: mix(palette.accent, "#ffd27a", 0.36),
      shadow: alpha("#000000", 0.44),
      overlayTint: alpha("#000000", 0.06 + (strength * 0.08))
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
