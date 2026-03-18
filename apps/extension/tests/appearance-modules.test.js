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
    Date,
    localStorage: {
      _store: new Map(),
      getItem(key) {
        return this._store.has(key) ? this._store.get(key) : null;
      },
      setItem(key, value) {
        this._store.set(key, String(value));
      },
      removeItem(key) {
        this._store.delete(key);
      }
    }
  });
  context.globalThis = context;
  return context;
}

test("repair memory normalizes and merges site fixes", async () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");
  loadScript(context, path.join(appearanceDir, "repair-memory.js"));

  const repair = context.HolmetaAppearanceRepairMemory;
  assert.ok(repair, "HolmetaAppearanceRepairMemory should exist");

  const normalized = repair.normalizeProfile({
    preserveImages: false,
    preservedSelectors: [".hero", ".hero", "  .nav-logo  "],
    excludedSelectors: [".ad", ""],
    tokenOverrides: { accent: "#ff6600", "": "#000000" }
  });
  assert.equal(normalized.preserveImages, false);
  assert.equal(JSON.stringify(normalized.preservedSelectors), JSON.stringify([".hero", ".nav-logo"]));
  assert.equal(JSON.stringify(normalized.excludedSelectors), JSON.stringify([".ad"]));
  assert.equal(normalized.tokenOverrides.accent, "#ff6600");

  const merged = repair.mergeProfile(
    { preserveImages: true, preservedSelectors: [".hero"], tokenOverrides: { accent: "#ff6600" } },
    { softerSurfaces: true, preservedSelectors: [".footer"], tokenOverrides: { pageBackground: "#111111" } }
  );
  assert.equal(merged.softerSurfaces, true);
  assert.equal(JSON.stringify(merged.preservedSelectors), JSON.stringify([".hero", ".footer"]));
  assert.equal(merged.tokenOverrides.accent, "#ff6600");
  assert.equal(merged.tokenOverrides.pageBackground, "#111111");

  const saved = await repair.update("example.com", {
    higherContrast: true,
    contrastStrength: 66,
    preservedSelectors: [".article-body"]
  });
  assert.equal(saved.higherContrast, true);
  assert.equal(saved.contrastStrength, 66);
  const cached = repair.getCached("example.com");
  assert.equal(cached.higherContrast, true);
  assert.equal(JSON.stringify(cached.preservedSelectors), JSON.stringify([".article-body"]));
});

test("site profile builds stable fingerprint from scan summary", () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");
  loadScript(context, path.join(appearanceDir, "site-profile.js"));

  const siteProfile = context.HolmetaAppearanceSiteProfile;
  assert.ok(siteProfile, "HolmetaAppearanceSiteProfile should exist");

  const first = siteProfile.build({
    host: "example.com",
    pageTone: "mixed",
    siteType: "dashboard_app",
    siteClass: "dashboard",
    scanSummary: {
      nodes: 320,
      interactive: 42,
      mediaContainers: 4,
      tokenSignals: 18,
      averageLuminance: 0.46
    },
    tokenDetection: { confidence: 0.82 },
    media: { mediaCount: 6, canvasCount: 1, iframeCount: 0 }
  });
  const second = siteProfile.build({
    host: "example.com",
    pageTone: "mixed",
    siteType: "dashboard_app",
    siteClass: "dashboard",
    scanSummary: {
      nodes: 320,
      interactive: 42,
      mediaContainers: 4,
      tokenSignals: 18,
      averageLuminance: 0.46
    },
    tokenDetection: { confidence: 0.82 },
    media: { mediaCount: 6, canvasCount: 1, iframeCount: 0 }
  });

  assert.equal(first.pageType, "dashboard");
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(typeof first.fingerprint, "string");
  assert.ok(first.fingerprint.length > 0);
});

test("color engine detects contrast and accent-like colors", () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");
  loadScript(context, path.join(appearanceDir, "color-engine.js"));

  const color = context.HolmetaAppearanceColor;
  assert.ok(color, "HolmetaAppearanceColor should exist");
  assert.equal(color.toHex("rgb(255, 102, 0)"), "#ff6600");
  assert.ok(color.contrast("#ffffff", "#111111") > 10);
  assert.equal(color.isNearNeutral("#777777"), true);
  assert.equal(color.isLikelyAccent("#ff6600"), true);
});
