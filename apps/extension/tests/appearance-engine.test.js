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
  loadScript(context, path.join(appearanceDir, "appearance-state.js"));

  const state = context.HolmetaAppearanceState;
  assert.ok(state, "HolmetaAppearanceState should exist");

  const darkTokens = state.toTokens({
    mode: "dark",
    darkVariant: "brown",
    intensity: 50
  });
  assert.equal(darkTokens.pageBase, "#3E2723");
  assert.equal(darkTokens.textPrimary, "#FFF8E1");

  const lightTokens = state.toTokens({
    mode: "light",
    lightVariant: "baby_blue",
    intensity: 45
  });
  assert.equal(lightTokens.pageBase, "#E3F2FD");
  assert.equal(lightTokens.textPrimary, "#0D47A1");
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
