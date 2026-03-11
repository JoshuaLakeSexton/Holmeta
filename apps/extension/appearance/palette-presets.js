(() => {
  if (globalThis.HolmetaAppearancePalettes) return;

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
    return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;
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

  const darkPresets = [
    {
      id: "coal",
      label: "Coal",
      modeType: "dark",
      background: "#121212",
      textPrimary: "#E0E0E0",
      accent: "#424242"
    },
    {
      id: "black",
      label: "Black",
      modeType: "dark",
      background: "#000000",
      textPrimary: "#BDBDBD",
      accent: "#2A2A2A"
    },
    {
      id: "brown",
      label: "Brown",
      modeType: "dark",
      background: "#3E2723",
      textPrimary: "#FFF8E1",
      accent: "#6D4C41"
    },
    {
      id: "grey",
      label: "Grey",
      modeType: "dark",
      background: "#424242",
      textPrimary: "#FFFFFF",
      accent: "#757575"
    },
    {
      id: "sepia",
      label: "Sepia",
      modeType: "dark",
      background: "#5C3317",
      textPrimary: "#F4EBD0",
      accent: "#A67C52"
    },
    {
      id: "teal",
      label: "Teal",
      modeType: "dark",
      background: "#004D40",
      textPrimary: "#E0F2F1",
      accent: "#009688"
    },
    {
      id: "purple",
      label: "Purple",
      modeType: "dark",
      background: "#311B92",
      textPrimary: "#E1BEE7",
      accent: "#7E57C2"
    },
    {
      id: "forest_green",
      label: "Forest Green",
      modeType: "dark",
      background: "#1B5E20",
      textPrimary: "#E8F5E9",
      accent: "#4CAF50"
    }
  ].map((preset) => ({
    ...preset,
    surface: mix(preset.background, "#101010", 0.16),
    elevatedSurface: mix(preset.background, preset.accent, 0.20),
    textSecondary: mix(preset.textPrimary, "#8f8f8f", 0.30),
    border: alpha(preset.textPrimary, 0.24),
    selectedAccent: mix(preset.accent, "#ffd27a", 0.34),
    inputBackground: mix(preset.background, preset.accent, 0.20),
    buttonBackground: mix(preset.background, preset.accent, 0.28),
    buttonText: preset.textPrimary
  }));

  const lightPresets = [
    {
      id: "white",
      label: "White",
      modeType: "light",
      background: "#FFFFFF",
      textPrimary: "#000000",
      accent: "#2196F3"
    },
    {
      id: "warm",
      label: "Warm",
      modeType: "light",
      background: "#FFFDE7",
      textPrimary: "#3E2723",
      accent: "#FFB300"
    },
    {
      id: "off_white",
      label: "Off White",
      modeType: "light",
      background: "#FAFAFA",
      textPrimary: "#212121",
      accent: "#757575"
    },
    {
      id: "soft_green",
      label: "Soft Green",
      modeType: "light",
      background: "#E8F5E9",
      textPrimary: "#1B5E20",
      accent: "#66BB6A"
    },
    {
      id: "baby_blue",
      label: "Baby Blue",
      modeType: "light",
      background: "#E3F2FD",
      textPrimary: "#0D47A1",
      accent: "#42A5F5"
    },
    {
      id: "light_brown",
      label: "Light Brown",
      modeType: "light",
      background: "#D7CCC8",
      textPrimary: "#4E342E",
      accent: "#A1887F"
    }
  ].map((preset) => ({
    ...preset,
    surface: mix(preset.background, "#ffffff", 0.09),
    elevatedSurface: mix(preset.background, preset.accent, 0.13),
    textSecondary: mix(preset.textPrimary, "#4a4a4a", 0.20),
    border: alpha(preset.textPrimary, 0.20),
    selectedAccent: mix(preset.accent, "#0d0d0d", 0.10),
    inputBackground: mix(preset.background, "#ffffff", 0.16),
    buttonBackground: mix(preset.background, preset.accent, 0.21),
    buttonText: preset.textPrimary
  }));

  const darkMap = Object.fromEntries(darkPresets.map((preset) => [preset.id, preset]));
  const lightMap = Object.fromEntries(lightPresets.map((preset) => [preset.id, preset]));

  function normalizeDarkVariant(value, fallback = "coal") {
    const key = String(value || "").trim().toLowerCase();
    if (key === "gray") return "grey";
    if (darkMap[key]) return key;
    return darkMap[fallback] ? fallback : "coal";
  }

  function normalizeLightVariant(value, fallback = "white") {
    const key = String(value || "").trim().toLowerCase();
    if (key === "gray") return "off_white";
    if (lightMap[key]) return key;
    return lightMap[fallback] ? fallback : "white";
  }

  function getPalette(mode, variant) {
    if (mode === "light") return lightMap[normalizeLightVariant(variant)] || lightMap.white;
    return darkMap[normalizeDarkVariant(variant)] || darkMap.coal;
  }

  function toTokens({ mode = "dark", darkVariant = "coal", lightVariant = "white", intensity = 46 }) {
    const targetMode = mode === "light" ? "light" : "dark";
    const strength = clamp(intensity, 0, 100) / 100;
    const palette = getPalette(targetMode, targetMode === "light" ? lightVariant : darkVariant);
    if (targetMode === "light") {
      return {
        mode: "light",
        pageBase: palette.background,
        surface1: mix(palette.background, "#ffffff", 0.08),
        surface2: palette.surface,
        surface3: palette.elevatedSurface,
        textPrimary: palette.textPrimary,
        textSecondary: palette.textSecondary,
        textMuted: mix(palette.textPrimary, "#7a7a7a", 0.42),
        borderSoft: alpha(palette.textPrimary, 0.20 + (strength * 0.08)),
        borderStrong: alpha(palette.textPrimary, 0.34 + (strength * 0.08)),
        interactiveBg: mix(palette.background, palette.accent, 0.18),
        interactiveHover: mix(palette.background, palette.accent, 0.27),
        selectedBg: mix(palette.background, palette.selectedAccent, 0.34),
        selectedText: palette.textPrimary,
        inputBg: palette.inputBackground,
        inputBorder: alpha(palette.textPrimary, 0.30),
        cardBg: mix(palette.background, "#ffffff", 0.10),
        menuBg: mix(palette.background, "#ffffff", 0.12),
        badgeBg: mix(palette.background, palette.accent, 0.24),
        buttonBg: palette.buttonBackground,
        buttonText: palette.buttonText,
        link: palette.accent,
        shadow: alpha("#000000", 0.16),
        overlayTint: alpha("#ffffff", 0.03 + (strength * 0.04))
      };
    }

    return {
      mode: "dark",
      pageBase: palette.background,
      surface1: mix(palette.background, "#000000", 0.12),
      surface2: palette.surface,
      surface3: palette.elevatedSurface,
      textPrimary: palette.textPrimary,
      textSecondary: mix(palette.textPrimary, "#ffffff", 0.16),
      textMuted: mix(palette.textPrimary, "#8f8f8f", 0.36),
      borderSoft: alpha(palette.textPrimary, 0.16 + (strength * 0.06)),
      borderStrong: alpha(palette.textPrimary, 0.30 + (strength * 0.08)),
      interactiveBg: mix(palette.background, palette.accent, 0.26),
      interactiveHover: mix(palette.background, palette.accent, 0.34),
      selectedBg: mix(palette.background, palette.selectedAccent, 0.40),
      selectedText: palette.textPrimary,
      inputBg: palette.inputBackground,
      inputBorder: alpha(palette.textPrimary, 0.24),
      cardBg: mix(palette.background, "#101010", 0.22),
      menuBg: mix(palette.background, "#080808", 0.18),
      badgeBg: mix(palette.background, palette.accent, 0.34),
      buttonBg: palette.buttonBackground,
      buttonText: palette.buttonText,
      link: mix(palette.accent, "#ffd27a", 0.36),
      shadow: alpha("#000000", 0.44),
      overlayTint: alpha("#000000", 0.06 + (strength * 0.08))
    };
  }

  globalThis.HolmetaAppearancePalettes = {
    darkPresets,
    lightPresets,
    darkMap,
    lightMap,
    normalizeDarkVariant,
    normalizeLightVariant,
    getPalette,
    toTokens,
    mix,
    alpha,
    clamp
  };
})();
