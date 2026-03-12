const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScript(context, filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  vm.runInContext(code, context, { filename: filePath });
}

function createContext() {
  const context = vm.createContext({
    console,
    location: { hostname: "example.com" }
  });
  context.globalThis = context;
  return context;
}

function alphaFromRgba(value) {
  const match = String(value || "").match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\s*\)/i);
  if (!match) return 1;
  return Number(match[1]);
}

test("appearance presets include required dark and light variants", () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");
  loadScript(context, path.join(appearanceDir, "palette-presets.js"));

  const palettes = context.HolmetaAppearancePalettes;
  assert.ok(palettes, "HolmetaAppearancePalettes should exist");

  const darkIds = palettes.darkPresets.map((preset) => preset.id);
  const lightIds = palettes.lightPresets.map((preset) => preset.id);
  assert.equal(JSON.stringify(darkIds), JSON.stringify([
    "coal",
    "black",
    "brown",
    "grey",
    "sepia",
    "teal",
    "purple",
    "forest_green"
  ]));
  assert.equal(JSON.stringify(lightIds), JSON.stringify([
    "white",
    "warm",
    "off_white",
    "soft_green",
    "baby_blue",
    "light_brown"
  ]));
});

test("appearance state tokens map to selected palette values", () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");
  loadScript(context, path.join(appearanceDir, "palette-presets.js"));
  loadScript(context, path.join(appearanceDir, "token-generator.js"));
  loadScript(context, path.join(appearanceDir, "appearance-state.js"));

  const state = context.HolmetaAppearanceState;
  assert.ok(state, "HolmetaAppearanceState should exist");

  const darkTokens = state.toTokens({
    mode: "dark",
    darkVariant: "brown",
    intensity: 50,
    siteClass: "dashboard",
    pageTone: "light",
    compatibilityMode: "normal"
  });
  assert.equal(darkTokens.mode, "dark");
  assert.equal(darkTokens.textPrimary, "#F3F3F4");
  assert.equal(darkTokens.accent, "#6D4C41");
  assert.ok(darkTokens.cardBackground, "token generator should emit cardBackground");
  assert.ok(darkTokens.sidebarBackground, "token generator should emit sidebarBackground");
  assert.ok(alphaFromRgba(darkTokens.lineSubtle) <= 0.12, "dark lineSubtle should stay quiet");
  assert.ok(alphaFromRgba(darkTokens.rowSeparator) <= 0.14, "dark row separators should be softened");
  assert.ok(alphaFromRgba(darkTokens.borderStrong) <= 0.20, "dark borderStrong should avoid harsh white outlines");
  const requiredKeys = [
    "pageBackground",
    "pageBackgroundAlt",
    "sidebarBackground",
    "sectionBackground",
    "panelBackground",
    "cardBackground",
    "elevatedBackground",
    "inputBackground",
    "inputBorder",
    "buttonBackground",
    "buttonText",
    "buttonBorder",
    "hoverBackground",
    "selectedBackground",
    "selectedText",
    "divider",
    "lineSubtle",
    "lineStrong",
    "rowSeparator",
    "tableHeaderBackground",
    "tableRowBackground",
    "tableRowAlt",
    "iconPrimary",
    "iconMuted",
    "textPrimary",
    "textSecondary",
    "textMuted",
    "textOnAccent",
    "accent",
    "accentSoft",
    "accentStrong",
    "chipBackground",
    "chipBorder",
    "chipText",
    "modalBackground",
    "dropdownBackground",
    "dropdownBorder",
    "headerBackground",
    "navBackground",
    "navHarmonizedBackground",
    "navHarmonizedText",
    "headerMutedAccent",
    "lowContrastFixText",
    "logoSafeBackground",
    "logoOnDarkText",
    "focusRing",
    "success",
    "warning",
    "danger"
  ];
  for (const key of requiredKeys) {
    assert.ok(typeof darkTokens[key] === "string" && darkTokens[key].length > 0, `missing token key ${key}`);
  }

  const lightTokens = state.toTokens({
    mode: "light",
    lightVariant: "baby_blue",
    intensity: 45,
    siteClass: "content",
    pageTone: "mixed",
    compatibilityMode: "normal"
  });
  assert.equal(lightTokens.mode, "light");
  assert.equal(lightTokens.textPrimary, "#111111");
  assert.equal(lightTokens.accent, "#42A5F5");
  assert.ok(lightTokens.panelBackground, "token generator should emit panelBackground");
  assert.ok(lightTokens.inputBackground, "token generator should emit inputBackground");
});

test("site rules resolve exclusion and per-site override precedence", () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");
  loadScript(context, path.join(appearanceDir, "site-rules.js"));

  const siteRules = context.HolmetaAppearanceSiteRules;
  assert.ok(siteRules, "HolmetaAppearanceSiteRules should exist");

  const excluded = siteRules.resolveProfile({
    enabled: true,
    excludedSites: { "github.com": true }
  }, "github.com");
  assert.equal(excluded.excluded, true);

  const withOverride = siteRules.resolveProfile({
    enabled: true,
    appearance: "dark",
    darkVariant: "coal",
    perSiteOverrides: {
      "example.com": {
        appearance: "light",
        lightVariant: "warm"
      }
    }
  }, "example.com");
  assert.equal(withOverride.excluded, false);
  assert.equal(withOverride.usingSiteOverride, true);
  assert.equal(withOverride.profile.appearance, "light");
  assert.equal(withOverride.profile.lightVariant, "warm");
});

test("site classifier maps key hosts and fallback types", () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");
  loadScript(context, path.join(appearanceDir, "site-classifier.js"));

  const classifier = context.HolmetaAppearanceSiteClassifier;
  assert.ok(classifier, "HolmetaAppearanceSiteClassifier should exist");

  assert.equal(classifier.classify({ host: "x.com", siteType: "general" }).siteClass, "social");
  assert.equal(classifier.classify({ host: "stripe.com", siteType: "general" }).siteClass, "dashboard");
  assert.equal(classifier.classify({ host: "example.com", siteType: "docs_code" }).siteClass, "docs_editor");
  assert.equal(classifier.classify({ host: "example.com", siteType: "article" }).siteClass, "content");
});
