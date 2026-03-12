const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScript(context, filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  vm.runInContext(code, context, { filename: filePath });
}

function createStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function deepMerge(base = {}, patch = {}) {
  const out = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    if (Array.isArray(value)) out[key] = [...value];
    else if (value && typeof value === "object") out[key] = deepMerge(out[key] || {}, value);
    else out[key] = value;
  }
  return out;
}

function createContext(initialSettings = {}) {
  let settings = deepMerge({
    darkLightTheme: {
      enabled: false,
      appearance: "auto",
      darkVariant: "coal",
      lightVariant: "white",
      excludedSites: {},
      perSiteOverrides: {}
    }
  }, initialSettings);

  const context = vm.createContext({
    console,
    location: { hostname: "example.com", protocol: "https:" },
    localStorage: createStorageMock(),
    chrome: {
      runtime: {
        sendMessage(message, callback) {
          const type = String(message?.type || "");
          if (type === "holmeta:get-state") {
            callback({ ok: true, state: { settings, runtime: {} } });
            return;
          }
          if (type === "holmeta:update-settings") {
            settings = deepMerge(settings, message.patch || {});
            callback({ ok: true, state: { settings, runtime: {} } });
            return;
          }
          callback({ ok: false, error: "unknown_message" });
        },
        lastError: null
      }
    },
    HolmetaDarklightSwitch: {
      setVisible() {},
      refreshState() {},
      init() {}
    }
  });
  context.globalThis = context;
  context.__getSettings = () => settings;
  return context;
}

test("darklight engine actions update day/night settings", async () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");

  loadScript(context, path.join(appearanceDir, "darklight-settings.js"));
  loadScript(context, path.join(appearanceDir, "darklight-engine.js"));

  const engine = context.HolmetaDarklightEngine;
  assert.ok(engine, "HolmetaDarklightEngine should exist");

  const before = await engine.getState();
  assert.equal(before.ok, true);
  assert.equal(before.mode, "auto");
  assert.equal(before.enabled, false);

  const dark = await engine.applyAction("setDark");
  assert.equal(dark.ok, true);
  assert.equal(dark.mode, "dark");
  assert.equal(dark.enabled, true);

  const toggled = await engine.applyAction("toggle");
  assert.equal(toggled.ok, true);
  assert.equal(toggled.enabled, false);

  const excluded = await engine.applyAction("excludeSite", { enabled: true });
  assert.equal(excluded.ok, true);
  assert.equal(excluded.excluded, true);

  const raw = context.__getSettings();
  assert.equal(raw.darkLightTheme.appearance, "dark");
  assert.equal(raw.darkLightTheme.excludedSites["example.com"], true);
});

test("darklight widget state persistence defaults hidden and stores host position", async () => {
  const context = createContext();
  const appearanceDir = path.join(__dirname, "..", "appearance");

  loadScript(context, path.join(appearanceDir, "darklight-settings.js"));
  const store = context.HolmetaDarklightSettings;
  assert.ok(store, "HolmetaDarklightSettings should exist");

  const before = await store.getWidgetState("example.com");
  assert.equal(before.visible, false);
  assert.equal(typeof before.position.x, "number");
  assert.equal(typeof before.position.y, "number");

  await store.setWidgetState("example.com", {
    visible: true,
    position: { x: 120, y: 84 }
  });

  const after = await store.getWidgetState("example.com");
  assert.equal(after.visible, true);
  assert.equal(after.position.x, 120);
  assert.equal(after.position.y, 84);
});
