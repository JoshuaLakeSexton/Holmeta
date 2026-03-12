(() => {
  if (globalThis.HolmetaAppearanceTokenGenerator) return;

  const palettes = globalThis.HolmetaAppearancePalettes;

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function mix(a, b, ratio = 0.5) {
    if (palettes?.mix) return palettes.mix(a, b, ratio);
    return String(a || "#000000");
  }

  function alpha(hex, value) {
    if (palettes?.alpha) return palettes.alpha(hex, value);
    return "rgba(0, 0, 0, 0)";
  }

  function defaultsForMode(mode) {
    if (mode === "light") {
      return {
        background: "#FFFFFF",
        textPrimary: "#111111",
        textSecondary: "#3A3A3A",
        accent: "#2196F3",
        selectedAccent: "#1976D2"
      };
    }
    return {
      background: "#121212",
      textPrimary: "#E0E0E0",
      textSecondary: "#B8B8B8",
      accent: "#424242",
      selectedAccent: "#757575"
    };
  }

  function resolvePalette(mode, darkVariant, lightVariant) {
    if (!palettes?.getPalette) {
      return defaultsForMode(mode);
    }
    const preset = mode === "light"
      ? palettes.getPalette("light", lightVariant)
      : palettes.getPalette("dark", darkVariant);
    return {
      ...defaultsForMode(mode),
      ...(preset || {})
    };
  }

  function siteClassAdjustments(siteClass = "general", mode = "dark", strength = 0.46) {
    const dark = mode === "dark";
    const light = !dark;
    const common = {
      surfaceLift: dark ? 0.18 : 0.09,
      borderBoost: dark ? 0.01 : 0.04,
      accentBoost: 0
    };

    if (siteClass === "dashboard") {
      return {
        ...common,
        surfaceLift: dark ? 0.24 : 0.12,
        borderBoost: dark ? 0.04 : 0.10,
        accentBoost: 0.04 + (strength * 0.03)
      };
    }

    if (siteClass === "social") {
      return {
        ...common,
        surfaceLift: dark ? 0.22 : 0.10,
        borderBoost: dark ? 0.03 : 0.07,
        accentBoost: 0.03 + (strength * 0.03)
      };
    }

    if (siteClass === "docs_editor") {
      return {
        ...common,
        surfaceLift: dark ? 0.16 : 0.08,
        borderBoost: dark ? 0.02 : 0.07,
        accentBoost: light ? -0.01 : 0
      };
    }

    if (siteClass === "content") {
      return {
        ...common,
        surfaceLift: dark ? 0.17 : 0.10,
        borderBoost: dark ? 0.02 : 0.06,
        accentBoost: 0.01
      };
    }

    if (siteClass === "ecommerce") {
      return {
        ...common,
        surfaceLift: dark ? 0.23 : 0.12,
        borderBoost: dark ? 0.04 : 0.09,
        accentBoost: 0.05
      };
    }

    if (siteClass === "media" || siteClass === "app_shell") {
      return {
        ...common,
        surfaceLift: dark ? 0.14 : 0.07,
        borderBoost: dark ? 0.01 : 0.04,
        accentBoost: 0
      };
    }

    return common;
  }

  function generateTokens(input = {}) {
    const mode = String(input.mode || "dark") === "light" ? "light" : "dark";
    const strength = clamp(Number(input.intensity ?? 46) / 100, 0, 1);
    const pageTone = String(input.pageTone || "mixed");
    const siteClass = String(input.siteClass || "general");
    const compat = String(input.compatibilityMode || "normal");
    const palette = resolvePalette(mode, input.darkVariant, input.lightVariant);
    const moodDepth = clamp(
      Number(palette.mood?.depth ?? (mode === "dark" ? 0.9 : 0.12)),
      0,
      1
    );
    const moodWarmth = clamp(Number(palette.mood?.warmth ?? 0.1), 0, 1);
    const moodContrast = clamp(Number(palette.mood?.contrast ?? 0.94), 0, 1);
    const adj = siteClassAdjustments(siteClass, mode, strength);

    const isDark = mode === "dark";
    const darkBg = "#070707";
    const lightBg = "#ffffff";
    const moodLift = isDark
      ? ((1 - moodDepth) * 0.05) + (moodWarmth * 0.015)
      : (moodDepth * 0.04) + (moodWarmth * 0.012);
    const contrastBias = (1 - moodContrast) * 0.06;

    let pageBackground = mix(
      palette.background,
      isDark ? darkBg : lightBg,
      isDark
        ? (0.17 + (strength * 0.08) + moodLift)
        : (0.04 + (strength * 0.03) + (moodLift * 0.65))
    );

    // Keep already-dark pages conservative on dark mode to avoid muddy stacking.
    if (isDark && pageTone === "dark") {
      pageBackground = mix(pageBackground, palette.background, 0.65);
    }

    const pageBackgroundAlt = mix(pageBackground, isDark ? "#020202" : "#ffffff", (isDark ? 0.10 : 0.04) + (moodLift * 0.30));
    const sidebarBackground = mix(
      pageBackground,
      isDark ? darkBg : palette.accent,
      (isDark ? 0.06 : 0.07) + (adj.surfaceLift * 0.22) + (moodLift * 0.60)
    );
    const sectionBackground = mix(
      pageBackground,
      palette.accent,
      (isDark ? 0.04 : 0.06) + (adj.surfaceLift * 0.26) + (moodLift * 0.42)
    );
    const panelBackground = mix(
      pageBackground,
      palette.accent,
      (isDark ? 0.09 : 0.08) + (adj.surfaceLift * 0.44) + (moodLift * 0.48)
    );
    const cardBackground = mix(
      pageBackground,
      palette.accent,
      (isDark ? 0.15 : 0.11) + (adj.surfaceLift * 0.62) + (moodLift * 0.56)
    );
    const elevatedBackground = mix(
      pageBackground,
      palette.accent,
      (isDark ? 0.23 : 0.15) + (adj.surfaceLift * 0.74) + (moodLift * 0.62)
    );
    const modalBackground = mix(elevatedBackground, isDark ? "#000000" : "#ffffff", isDark ? 0.10 : 0.08);
    const dropdownBackground = mix(panelBackground, isDark ? "#060606" : "#ffffff", isDark ? 0.10 : 0.08);
    const inputBackground = mix(cardBackground, isDark ? darkBg : lightBg, isDark ? 0.12 : 0.18);
    const hoverBackground = mix(elevatedBackground, palette.accent, (isDark ? 0.16 : 0.12) + (strength * 0.08) + (moodLift * 0.20));
    const selectedAnchor = isDark ? palette.accent : (palette.selectedAccent || palette.accent);
    const selectedBackground = mix(elevatedBackground, selectedAnchor, (isDark ? 0.30 : 0.22) + adj.accentBoost);

    // Keep Tool 2 typography neutral and high-contrast regardless of preset tint.
    const textPrimary = isDark ? "#F3F3F4" : "#111111";
    const textSecondary = isDark ? "#D5D6DA" : "#2A2A2A";
    const textMuted = isDark ? "#B8BAC2" : "#565962";

    const borderSubtle = alpha(textPrimary, (isDark ? 0.07 : 0.15) + (adj.borderBoost * 0.35) + (contrastBias * 0.25));
    const borderStrong = alpha(textPrimary, (isDark ? 0.14 : 0.24) + (adj.borderBoost * 0.45) + (contrastBias * 0.35));
    const divider = alpha(textPrimary, (isDark ? 0.08 : 0.16) + (contrastBias * 0.30));
    const lineSubtle = alpha(textPrimary, (isDark ? 0.06 : 0.12) + (contrastBias * 0.22));
    const lineStrong = alpha(textPrimary, (isDark ? 0.12 : 0.20) + (contrastBias * 0.30));
    const rowSeparator = alpha(textPrimary, (isDark ? 0.09 : 0.16) + (contrastBias * 0.28));
    const tableHeader = mix(panelBackground, isDark ? "#000000" : "#ffffff", isDark ? 0.24 : 0.14);
    const tableRow = mix(cardBackground, panelBackground, isDark ? 0.52 : 0.34);
    const tableRowAlt = mix(tableRow, panelBackground, isDark ? 0.30 : 0.18);
    const navItem = mix(sidebarBackground, palette.accent, 0.10 + (strength * 0.06));

    const accent = palette.accent;
    const accentSoft = alpha(accent, isDark ? 0.26 : 0.18);
    const accentStrong = mix(accent, isDark ? "#ffffff" : "#0d47a1", isDark ? 0.12 : 0.10);
    const textOnAccent = isDark ? "#0E0E10" : "#ffffff";
    const iconPrimary = textPrimary;
    const iconMuted = textMuted;
    const inputBorder = borderStrong;
    const buttonBackground = mix(elevatedBackground, palette.accent, (isDark ? 0.10 : 0.06) + (moodLift * 0.22));
    const buttonText = textPrimary;
    const buttonBorder = borderStrong;
    const chipBackground = mix(cardBackground, accent, isDark ? 0.14 : 0.11);
    const chipBorder = alpha(accent, isDark ? 0.32 : 0.28);
    const chipText = textPrimary;
    const dropdownBorder = borderSubtle;
    const focusRing = alpha(accentStrong, 0.58);
    const success = isDark ? "#73d48d" : "#1b8f3b";
    const warning = isDark ? "#ffcf6b" : "#c77f00";
    const danger = isDark ? "#ff8e8e" : "#c42021";
    const headerBackground = mix(panelBackground, selectedAnchor, isDark ? 0.10 : 0.08);
    const navBackground = mix(sidebarBackground, selectedAnchor, isDark ? 0.10 : 0.07);
    const navHarmonizedBackground = mix(pageBackground, selectedAnchor, isDark ? 0.12 : 0.08);
    const navHarmonizedText = textPrimary;
    const headerMutedAccent = alpha(accent, isDark ? 0.22 : 0.18);
    const lowContrastFixText = isDark ? "#F7F7F8" : "#16181C";
    const logoSafeBackground = isDark
      ? mix(pageBackground, "#ffffff", 0.14)
      : mix(pageBackground, "#ffffff", 0.06);
    const logoOnDarkText = isDark ? "#F5F6F8" : textPrimary;

    // Strongly reduce veil overlays to keep crisp light mode and rich dark mode.
    let overlayTint = alpha(isDark ? "#000000" : "#ffffff", isDark ? 0.006 : 0.002);
    if (compat === "media-safe") overlayTint = alpha(isDark ? "#000000" : "#ffffff", isDark ? 0.006 : 0.002);
    if (compat === "minimal" || compat === "app-safe") {
      overlayTint = alpha(isDark ? "#000000" : "#ffffff", isDark ? 0.008 : 0.003);
    }

    return {
      mode,
      siteClass,
      pageBackground,
      pageBackgroundAlt,
      sidebarBackground,
      sectionBackground,
      panelBackground,
      cardBackground,
      elevatedBackground,
      modalBackground,
      dropdownBackground,
      dropdownBorder,
      inputBackground,
      inputBorder,
      buttonBackground,
      buttonText,
      buttonBorder,
      selectedBackground,
      hoverBackground,
      borderSubtle,
      borderStrong,
      lineSubtle,
      lineStrong,
      rowSeparator,
      textPrimary,
      textSecondary,
      textMuted,
      textOnAccent,
      iconPrimary,
      iconMuted,
      accent,
      accentSoft,
      accentStrong,
      divider,
      tableRowBackground: tableRow,
      tableRowAlt,
      tableHeaderBackground: tableHeader,
      navItem,
      chipBackground,
      chipBorder,
      chipText,
      controlBackground: buttonBackground,
      controlText: buttonText,
      focusRing,
      success,
      warning,
      danger,
      overlayTint,
      headerBackground,
      navBackground,
      navHarmonizedBackground,
      navHarmonizedText,
      headerMutedAccent,
      lowContrastFixText,
      logoSafeBackground,
      logoOnDarkText,

      // Compatibility aliases to preserve existing remapper usage.
      pageBase: pageBackground,
      sectionBg: sectionBackground,
      surface1: panelBackground,
      surface2: cardBackground,
      surface3: elevatedBackground,
      interactiveBg: navItem,
      interactiveHover: hoverBackground,
      selectedBg: selectedBackground,
      selectedText: textPrimary,
      inputBg: inputBackground,
      inputBorder,
      cardBg: cardBackground,
      menuBg: dropdownBackground,
      badgeBg: accentSoft,
      buttonBg: buttonBackground,
      buttonText,
      buttonBorder,
      link: accentStrong,
      lineSubtle,
      lineStrong,
      rowSeparator,
      tableHeader: tableHeader,
      tableRow: tableRow,
      tableRowAlt,
      shadow: alpha("#000000", isDark ? 0.42 : 0.14)
    };
  }

  globalThis.HolmetaAppearanceTokenGenerator = {
    generateTokens
  };
})();
