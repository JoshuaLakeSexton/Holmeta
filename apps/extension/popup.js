// HOLMETA v3.0 popup controller
// Stable input pattern: hydrate once, local state editing, debounced writes.

(() => {
  const SAVE_DEBOUNCE_MS = 380;
  const ONBOARDING_COMPLETED_KEY = "onboardingCompleted";
  const UPGRADE_URL = "https://www.holmeta.com/pricing";
  const RATE_URL = "https://chromewebstore.google.com";

  const state = {
    hydrated: false,
    editing: new Set(),
    currentHost: "",
    app: null,
    pendingPatch: null,
    saveTimer: null,
    saveInFlight: false,
    onboardingStep: 0,
    diagnostics: null
  };

  const onboardingSteps = [
    {
      title: "MISSION: Reduce screen strain. Increase focus.",
      body: "Start with Warm Shift mode. Adjust intensity and keep reduce-whites enabled for comfort."
    },
    {
      title: "Per-site Profiles",
      body: "Use This Site override to tune docs, code, and video pages independently without global drift."
    },
    {
      title: "Health + Block Protocol",
      body: "Set gentle alerts and blocker mode only when needed to avoid friction fatigue."
    }
  ];

  const refs = {
    modeBadge: document.getElementById("modeBadge"),
    saveState: document.getElementById("saveState"),
    toastHost: document.getElementById("toastHost"),

    lightEnabled: document.getElementById("lightEnabled"),
    lightMode: document.getElementById("lightMode"),
    lightIntensity: document.getElementById("lightIntensity"),
    lightIntensityValue: document.getElementById("lightIntensityValue"),
    lightThisSiteEnabled: document.getElementById("lightThisSiteEnabled"),
    lightExcludeSite: document.getElementById("lightExcludeSite"),
    saveSiteProfile: document.getElementById("saveSiteProfile"),
    copyGlobalToSite: document.getElementById("copyGlobalToSite"),
    siteInfo: document.getElementById("siteInfo"),

    reduceWhites: document.getElementById("reduceWhites"),
    videoSafe: document.getElementById("videoSafe"),
    lightBrightness: document.getElementById("lightBrightness"),
    lightBrightnessValue: document.getElementById("lightBrightnessValue"),
    lightDim: document.getElementById("lightDim"),
    lightDimValue: document.getElementById("lightDimValue"),
    lightContrastSoft: document.getElementById("lightContrastSoft"),
    lightContrastSoftValue: document.getElementById("lightContrastSoftValue"),
    spotlightEnabled: document.getElementById("spotlightEnabled"),
    setSpotlightCenter: document.getElementById("setSpotlightCenter"),

    therapyMode: document.getElementById("therapyMode"),
    therapyMinutes: document.getElementById("therapyMinutes"),
    therapyCadence: document.getElementById("therapyCadence"),

    blockerEnabled: document.getElementById("blockerEnabled"),
    nuclearMode: document.getElementById("nuclearMode"),
    blockerStatus: document.getElementById("blockerStatus"),
    addCurrentSite: document.getElementById("addCurrentSite"),
    editBlocker: document.getElementById("editBlocker"),
    pauseBlocker: document.getElementById("pauseBlocker"),

    alertsEnabled: document.getElementById("alertsEnabled"),
    alertFrequency: document.getElementById("alertFrequency"),
    alertSound: document.getElementById("alertSound"),
    testAlert: document.getElementById("testAlert"),

    pomodoroPreset: document.getElementById("pomodoroPreset"),
    startDeepWork: document.getElementById("startDeepWork"),
    stopDeepWork: document.getElementById("stopDeepWork"),
    deepWorkStatus: document.getElementById("deepWorkStatus"),

    biofeedbackEnabled: document.getElementById("biofeedbackEnabled"),
    morphingEnabled: document.getElementById("morphingEnabled"),
    taskWeaver: document.getElementById("taskWeaver"),
    collabSync: document.getElementById("collabSync"),
    weaverResults: document.getElementById("weaverResults"),
    premiumBanner: document.getElementById("premiumBanner"),
    upgradePremium: document.getElementById("upgradePremium"),

    openOptions: document.getElementById("openOptions"),

    onboarding: document.getElementById("onboarding"),
    onboardBack: document.getElementById("onboardBack"),
    onboardNext: document.getElementById("onboardNext"),
    onboardSkip: document.getElementById("onboardSkip"),
    onboardingTitle: document.getElementById("onboardingTitle"),
    onboardingBody: document.getElementById("onboardingBody")
  };

  function debugEnabled() {
    return Boolean(state.app?.meta?.debug);
  }

  function log(level, ...args) {
    if (level !== "error" && !debugEnabled()) return;
    const prefix = "[Holmeta popup]";
    if (level === "error") console.error(prefix, ...args);
    else console.info(prefix, ...args);
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: err.message || "runtime_error" });
          return;
        }
        resolve(response || { ok: false, error: "empty_response" });
      });
    });
  }

  function queryCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(Array.isArray(tabs) ? tabs[0] : null);
      });
    });
  }

  function normalizeHost(urlLike) {
    try {
      const url = new URL(String(urlLike || ""));
      if (!/^https?:$/.test(url.protocol)) return "";
      return url.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }

  function setStatus(text, error = false) {
    refs.saveState.textContent = text;
    refs.saveState.style.color = error ? "#ffb300" : "#d9c5b2";
  }

  async function readOnboardingCompletion() {
    let chromeValue = false;
    try {
      const data = await chrome.storage.local.get([ONBOARDING_COMPLETED_KEY]);
      chromeValue = Boolean(data?.[ONBOARDING_COMPLETED_KEY]);
    } catch (error) {
      log("error", "read_onboarding_chrome_failed", error);
    }

    let localValue = false;
    try {
      localValue = localStorage.getItem("holmeta_onboarding_completed") === "true";
    } catch (error) {
      log("error", "read_onboarding_local_failed", error);
    }

    return chromeValue || localValue;
  }

  function toast(text) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    refs.toastHost.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    const output = Array.isArray(target) ? [...target] : { ...(target || {}) };
    Object.keys(source).forEach((key) => {
      const src = source[key];
      if (Array.isArray(src)) output[key] = [...src];
      else if (src && typeof src === "object") output[key] = deepMerge(output[key], src);
      else output[key] = src;
    });
    return output;
  }

  function setInputValue(el, value) {
    if (!el) return;
    if (document.activeElement === el || state.editing.has(el.id)) return;
    const next = String(value ?? "");
    if (el.value !== next) el.value = next;
  }

  function setChecked(el, value) {
    if (!el) return;
    if (document.activeElement === el || state.editing.has(el.id)) return;
    el.checked = Boolean(value);
  }

  function getLightSiteProfile() {
    const map = state.app?.settings?.light?.siteProfiles || {};
    return state.currentHost ? map[state.currentHost] : null;
  }

  function isSiteExcluded() {
    const list = state.app?.settings?.light?.excludedHosts || [];
    return Boolean(state.currentHost && list.includes(state.currentHost));
  }

  function renderPremium() {
    const premium = Boolean(state.app?.license?.premium);
    refs.modeBadge.textContent = premium ? "PREMIUM" : "FREE";
    refs.modeBadge.classList.toggle("premium", premium);

    document.querySelectorAll("[data-premium='true']").forEach((node) => {
      node.disabled = !premium;
      node.setAttribute("aria-disabled", String(!premium));
    });

    refs.premiumBanner.hidden = premium;
  }

  function renderLight() {
    const light = state.app.settings.light;
    const siteProfile = getLightSiteProfile();

    const effective = {
      mode: siteProfile?.mode ?? light.mode,
      intensity: siteProfile?.intensity ?? light.intensity,
      dim: siteProfile?.dim ?? light.dim,
      contrastSoft: siteProfile?.contrastSoft ?? light.contrastSoft,
      brightness: siteProfile?.brightness ?? light.brightness,
      reduceWhites: siteProfile?.reduceWhites ?? light.reduceWhites,
      videoSafe: siteProfile?.videoSafe ?? light.videoSafe,
      spotlightEnabled: siteProfile?.spotlightEnabled ?? light.spotlightEnabled,
      therapyMode: siteProfile?.therapyMode ?? light.therapyMode,
      therapyMinutes: siteProfile?.therapyMinutes ?? light.therapyMinutes,
      therapyCadence: siteProfile?.therapyCadence ?? light.therapyCadence
    };

    setChecked(refs.lightEnabled, light.enabled);
    setInputValue(refs.lightMode, effective.mode);
    setInputValue(refs.lightIntensity, effective.intensity);
    refs.lightIntensityValue.textContent = `${effective.intensity}%`;

    setChecked(refs.lightThisSiteEnabled, Boolean(siteProfile));
    setChecked(refs.lightExcludeSite, isSiteExcluded());

    setChecked(refs.reduceWhites, effective.reduceWhites);
    setChecked(refs.videoSafe, effective.videoSafe);
    setInputValue(refs.lightBrightness, effective.brightness);
    refs.lightBrightnessValue.textContent = `${effective.brightness}%`;
    setInputValue(refs.lightDim, effective.dim);
    refs.lightDimValue.textContent = `${effective.dim}%`;
    setInputValue(refs.lightContrastSoft, effective.contrastSoft);
    refs.lightContrastSoftValue.textContent = `${effective.contrastSoft}%`;
    setChecked(refs.spotlightEnabled, effective.spotlightEnabled);

    setChecked(refs.therapyMode, effective.therapyMode);
    setInputValue(refs.therapyMinutes, effective.therapyMinutes);
    setInputValue(refs.therapyCadence, effective.therapyCadence);

    let info = state.currentHost ? `Site: ${state.currentHost}` : "Site: unavailable";
    if (state.diagnostics?.strategy) {
      info += ` · Strategy: ${state.diagnostics.strategy}`;
    }
    refs.siteInfo.textContent = info;
  }

  function renderBlocker() {
    const blocker = state.app.settings.blocker;
    setChecked(refs.blockerEnabled, blocker.enabled);
    setChecked(refs.nuclearMode, blocker.nuclear);
    refs.blockerStatus.textContent = `Active: ${(blocker.blockedDomains || []).length} sites blocked`;
  }

  function renderAlerts() {
    const alerts = state.app.settings.alerts;
    setChecked(refs.alertsEnabled, alerts.enabled);
    setInputValue(refs.alertFrequency, alerts.frequencyMin);
    setChecked(refs.alertSound, alerts.soundEnabled);
  }

  function renderDeepWork() {
    const deep = state.app.settings.deepWork;
    setInputValue(refs.pomodoroPreset, `${deep.focusMin}:${deep.breakMin}`);
    if (!deep.active) {
      refs.deepWorkStatus.textContent = "Idle";
      return;
    }
    const minsLeft = Math.max(0, Math.ceil((Number(deep.nextTransitionAt || 0) - Date.now()) / 60000));
    refs.deepWorkStatus.textContent = `${deep.phase.toUpperCase()} · ${minsLeft}m remaining`;
  }

  function renderAdvanced() {
    const adv = state.app.settings.advanced;
    setChecked(refs.biofeedbackEnabled, adv.biofeedback);
    setChecked(refs.morphingEnabled, adv.morphing);
  }

  function renderWeaver(list = []) {
    refs.weaverResults.innerHTML = "";
    if (!Array.isArray(list) || !list.length) return;
    list.slice(0, 5).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${item.title}</strong><span>${item.reason}</span>`;
      refs.weaverResults.appendChild(li);
    });
  }

  function render() {
    if (!state.app) return;
    renderPremium();
    renderLight();
    renderBlocker();
    renderAlerts();
    renderDeepWork();
    renderAdvanced();
  }

  function queuePatch(patch) {
    state.pendingPatch = deepMerge(state.pendingPatch, patch);
    setStatus("Saving...");
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(flushPatch, SAVE_DEBOUNCE_MS);
  }

  async function flushPatch() {
    if (!state.pendingPatch || state.saveInFlight) return;
    const patch = state.pendingPatch;
    state.pendingPatch = null;
    state.saveInFlight = true;

    const response = await sendMessage({ type: "holmeta:update-settings", patch });
    state.saveInFlight = false;

    if (!response.ok) {
      setStatus(`Save failed: ${response.error || "unknown"}`, true);
      return;
    }

    state.app = response.state;
    await refreshDiagnostics();
    render();
    setStatus("Saved");
  }

  async function refreshDiagnostics() {
    const tab = await queryCurrentTab();
    const tabId = Number(tab?.id || 0);
    if (!Number.isInteger(tabId) || tabId <= 0) {
      state.diagnostics = null;
      return;
    }
    const response = await sendMessage({ type: "holmeta:get-light-diagnostics", tabId });
    if (!response.ok) {
      state.diagnostics = null;
      return;
    }
    state.diagnostics = response.diagnostics || null;
  }

  async function hydrate() {
    const [res, tab] = await Promise.all([
      sendMessage({ type: "holmeta:get-state" }),
      queryCurrentTab()
    ]);

    if (!res.ok) {
      setStatus(`Load failed: ${res.error || "unknown"}`, true);
      return;
    }

    state.currentHost = normalizeHost(tab?.url || "");
    state.app = res.state;
    await refreshDiagnostics();

    state.hydrated = true;
    render();

    const localOnboarded = await readOnboardingCompletion();
    const onboarded = Boolean(state.app.meta?.onboarded) || localOnboarded;

    if (!onboarded) {
      startOnboarding();
      return;
    }

    refs.onboarding.hidden = true;
    if (!state.app.meta?.onboarded) {
      const response = await sendMessage({ type: "holmeta:set-onboarded" });
      if (response.ok) {
        state.app = response.state;
        render();
      }
    }
  }

  function openUpgrade() {
    chrome.tabs.create({ url: UPGRADE_URL });
  }

  async function handleHotkeyButton(command) {
    const response = await sendMessage({ type: "holmeta:run-command", command });
    if (!response.ok) {
      toast(`Action failed: ${response.error || "unknown"}`);
      return;
    }
    state.app = response.state;
    await refreshDiagnostics();
    render();
    toast(`Executed: ${command.replaceAll("_", " ")}`);
  }

  async function handleBiofeedbackToggle(nextEnabled) {
    if (!state.app.license.premium) {
      toast("Premium feature – upgrade at holmeta.com");
      refs.biofeedbackEnabled.checked = false;
      return;
    }

    if (nextEnabled) {
      const has = await new Promise((resolve) => chrome.permissions.contains({ permissions: ["videoCapture"] }, resolve));
      if (!has) {
        const explain = window.confirm(
          "Holmeta needs webcam access for posture/bio-feedback. Video stays local and is never uploaded. Continue?"
        );
        if (!explain) {
          refs.biofeedbackEnabled.checked = false;
          return;
        }
        const granted = await new Promise((resolve) => chrome.permissions.request({ permissions: ["videoCapture"] }, resolve));
        if (!granted) {
          refs.biofeedbackEnabled.checked = false;
          toast("Permission denied. Bio-feedback remains off.");
          return;
        }
      }
    }

    queuePatch({ advanced: { biofeedback: nextEnabled } });
  }

  function currentLightPatchFromUI() {
    const mode = String(refs.lightMode.value || "warm");
    const intensity = Math.max(0, Math.min(100, Number(refs.lightIntensity.value || 0)));
    const dim = Math.max(0, Math.min(60, Number(refs.lightDim.value || 0)));
    const contrastSoft = Math.max(0, Math.min(30, Number(refs.lightContrastSoft.value || 0)));
    const brightness = Math.max(70, Math.min(120, Number(refs.lightBrightness.value || 96)));
    const reduceWhites = Boolean(refs.reduceWhites.checked);
    const videoSafe = Boolean(refs.videoSafe.checked);
    const spotlightEnabled = Boolean(refs.spotlightEnabled.checked);
    const therapyMode = Boolean(refs.therapyMode.checked);
    const therapyMinutes = Math.max(1, Math.min(10, Number(refs.therapyMinutes.value || 3)));
    const therapyCadence = String(refs.therapyCadence.value || "gentle");

    return {
      mode,
      intensity,
      dim,
      contrastSoft,
      brightness,
      reduceWhites,
      videoSafe,
      spotlightEnabled,
      therapyMode,
      therapyMinutes,
      therapyCadence
    };
  }

  async function setSiteOverride(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      refs.lightThisSiteEnabled.checked = false;
      return;
    }

    const map = { ...(state.app.settings.light.siteProfiles || {}) };
    if (enabled) {
      map[state.currentHost] = {
        enabled: true,
        ...currentLightPatchFromUI()
      };
      toast(`Site override enabled for ${state.currentHost}`);
    } else {
      delete map[state.currentHost];
      toast(`Site override removed for ${state.currentHost}`);
    }

    queuePatch({ light: { siteProfiles: map } });
  }

  function setExcludeSite(enabled) {
    if (!state.currentHost) {
      toast("No active website detected.");
      refs.lightExcludeSite.checked = false;
      return;
    }

    const set = new Set(state.app.settings.light.excludedHosts || []);
    if (enabled) set.add(state.currentHost);
    else set.delete(state.currentHost);

    queuePatch({ light: { excludedHosts: [...set] } });
  }

  function queueLightPatch(partial) {
    const siteProfile = getLightSiteProfile();
    if (state.currentHost && siteProfile) {
      const map = { ...(state.app.settings.light.siteProfiles || {}) };
      map[state.currentHost] = deepMerge(map[state.currentHost] || {}, partial);
      queuePatch({ light: { siteProfiles: map } });
      return;
    }
    queuePatch({ light: partial });
  }

  function bindEditingTracking() {
    document.addEventListener("focusin", (event) => {
      if (event.target?.id) state.editing.add(event.target.id);
    });

    document.addEventListener("focusout", (event) => {
      if (event.target?.id) state.editing.delete(event.target.id);
      flushPatch();
    });
  }

  function bindEvents() {
    bindEditingTracking();

    refs.lightEnabled.addEventListener("change", (e) => queuePatch({ light: { enabled: e.target.checked } }));
    refs.lightMode.addEventListener("change", (e) => queueLightPatch({ mode: e.target.value }));
    refs.lightIntensity.addEventListener("input", (e) => {
      const value = Math.max(0, Math.min(100, Number(e.target.value || 0)));
      refs.lightIntensityValue.textContent = `${value}%`;
      queueLightPatch({ intensity: value });
    });

    refs.lightThisSiteEnabled.addEventListener("change", (e) => setSiteOverride(e.target.checked));
    refs.lightExcludeSite.addEventListener("change", (e) => setExcludeSite(e.target.checked));

    refs.saveSiteProfile.addEventListener("click", () => setSiteOverride(true));

    refs.copyGlobalToSite.addEventListener("click", () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const light = state.app.settings.light;
      const map = { ...(light.siteProfiles || {}) };
      map[state.currentHost] = {
        enabled: true,
        mode: light.mode,
        intensity: light.intensity,
        dim: light.dim,
        contrastSoft: light.contrastSoft,
        brightness: light.brightness,
        reduceWhites: light.reduceWhites,
        videoSafe: light.videoSafe,
        spotlightEnabled: light.spotlightEnabled,
        therapyMode: light.therapyMode,
        therapyMinutes: light.therapyMinutes,
        therapyCadence: light.therapyCadence
      };
      queuePatch({ light: { siteProfiles: map } });
      toast(`Copied global profile to ${state.currentHost}`);
    });

    refs.reduceWhites.addEventListener("change", (e) => queueLightPatch({ reduceWhites: e.target.checked }));
    refs.videoSafe.addEventListener("change", (e) => queueLightPatch({ videoSafe: e.target.checked }));
    refs.lightBrightness.addEventListener("input", (e) => {
      const value = Math.max(70, Math.min(120, Number(e.target.value || 96)));
      refs.lightBrightnessValue.textContent = `${value}%`;
      queueLightPatch({ brightness: value });
    });
    refs.lightDim.addEventListener("input", (e) => {
      const value = Math.max(0, Math.min(60, Number(e.target.value || 0)));
      refs.lightDimValue.textContent = `${value}%`;
      queueLightPatch({ dim: value });
    });
    refs.lightContrastSoft.addEventListener("input", (e) => {
      const value = Math.max(0, Math.min(30, Number(e.target.value || 0)));
      refs.lightContrastSoftValue.textContent = `${value}%`;
      queueLightPatch({ contrastSoft: value });
    });

    refs.spotlightEnabled.addEventListener("change", (e) => queueLightPatch({ spotlightEnabled: e.target.checked }));
    refs.setSpotlightCenter.addEventListener("click", async () => {
      await sendMessage({ type: "holmeta:set-spotlight-point", point: { x: 50, y: 42 } });
      toast("Spotlight centered.");
    });

    refs.therapyMode.addEventListener("change", (e) => queueLightPatch({ therapyMode: e.target.checked }));
    refs.therapyMinutes.addEventListener("input", (e) => {
      const value = Math.max(1, Math.min(10, Number(e.target.value || 3)));
      queueLightPatch({ therapyMinutes: value });
    });
    refs.therapyCadence.addEventListener("change", (e) => queueLightPatch({ therapyCadence: e.target.value }));

    refs.blockerEnabled.addEventListener("change", (e) => queuePatch({ blocker: { enabled: e.target.checked } }));
    refs.nuclearMode.addEventListener("change", (e) => {
      const checked = e.target.checked;
      if (checked) {
        const ok = window.confirm("Enable Nuclear Mode? This will block most websites except allowlist.");
        if (!ok) {
          e.target.checked = false;
          return;
        }
      }
      queuePatch({ blocker: { nuclear: checked } });
    });

    refs.addCurrentSite.addEventListener("click", async () => {
      if (!state.currentHost) {
        toast("No active website detected.");
        return;
      }
      const response = await sendMessage({ type: "holmeta:add-blocked-domain", host: state.currentHost });
      if (!response.ok) {
        toast(`Failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast(`Blocked ${state.currentHost}`);
    });

    refs.pauseBlocker.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:pause-blocker", minutes: 10 });
      if (!response.ok) {
        toast(`Pause failed: ${response.error || "unknown"}`);
        return;
      }
      toast("Blocker paused for 10 minutes.");
    });

    refs.editBlocker.addEventListener("click", () => chrome.runtime.openOptionsPage());

    refs.alertsEnabled.addEventListener("change", (e) => queuePatch({ alerts: { enabled: e.target.checked } }));
    refs.alertFrequency.addEventListener("change", (e) => queuePatch({ alerts: { frequencyMin: Number(e.target.value || 45) } }));
    refs.alertSound.addEventListener("change", (e) => queuePatch({ alerts: { soundEnabled: e.target.checked } }));

    refs.testAlert.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:test-alert" });
      if (!response.ok) {
        toast(`Test failed: ${response.error || "unknown"}`);
        return;
      }
      toast("Test alert dispatched.");
    });

    refs.startDeepWork.addEventListener("click", async () => {
      const [focusMin, breakMin] = String(refs.pomodoroPreset.value || "25:5").split(":").map((n) => Number(n));
      const response = await sendMessage({ type: "holmeta:start-deep-work", focusMin, breakMin });
      if (!response.ok) {
        toast(`Start failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Deep Work activated.");
    });

    refs.stopDeepWork.addEventListener("click", async () => {
      const response = await sendMessage({ type: "holmeta:stop-deep-work" });
      if (!response.ok) {
        toast(`Stop failed: ${response.error || "unknown"}`);
        return;
      }
      state.app = response.state;
      render();
      toast("Deep Work stopped.");
    });

    refs.biofeedbackEnabled.addEventListener("change", (e) => handleBiofeedbackToggle(e.target.checked));

    refs.morphingEnabled.addEventListener("change", (e) => {
      if (!state.app.license.premium) {
        e.target.checked = false;
        toast("Premium feature – upgrade at holmeta.com");
        return;
      }
      queuePatch({ advanced: { morphing: e.target.checked } });
    });

    refs.taskWeaver.addEventListener("click", async () => {
      if (!state.app.license.premium) {
        toast("Premium feature – upgrade at holmeta.com");
        return;
      }
      refs.taskWeaver.disabled = true;
      refs.taskWeaver.textContent = "Weaving...";
      const response = await sendMessage({ type: "holmeta:task-weaver" });
      refs.taskWeaver.disabled = false;
      refs.taskWeaver.textContent = "Weave Now";
      if (!response.ok) {
        toast(`Weaver failed: ${response.error || "unknown"}`);
        return;
      }
      renderWeaver(response.results || []);
      toast("Protocol suggestions ready.");
    });

    refs.collabSync.addEventListener("click", () => {
      toast("Collaborative Focus Sync is a premium roadmap feature in this local-first build.");
    });

    refs.upgradePremium.addEventListener("click", openUpgrade);
    refs.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

    document.querySelectorAll(".hotkey").forEach((btn) => {
      btn.addEventListener("click", () => handleHotkeyButton(btn.dataset.command));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !refs.onboarding.hidden) {
        completeOnboarding();
      }
    });
  }

  function startOnboarding() {
    state.onboardingStep = 0;
    refs.onboarding.hidden = false;
    renderOnboarding();
  }

  function renderOnboarding() {
    const step = onboardingSteps[state.onboardingStep];
    refs.onboardingTitle.textContent = step.title;
    refs.onboardingBody.textContent = step.body;
    refs.onboardBack.disabled = state.onboardingStep === 0;
    refs.onboardNext.textContent = state.onboardingStep === onboardingSteps.length - 1 ? "Finish" : "Next";
  }

  async function completeOnboarding() {
    const result = {
      ok: true,
      persisted: false,
      navigated: false
    };

    state.app = state.app || {};
    state.app.meta = { ...(state.app.meta || {}), onboarded: true };

    try {
      await chrome.storage.local.set({ [ONBOARDING_COMPLETED_KEY]: true });
      result.persisted = true;
    } catch (error) {
      log("error", "write_onboarding_chrome_failed", error);
      result.ok = false;
    }

    try {
      localStorage.setItem("holmeta_onboarding_completed", "true");
      result.persisted = true;
    } catch (error) {
      log("error", "write_onboarding_local_failed", error);
      result.ok = false;
    }

    try {
      const response = await sendMessage({ type: "holmeta:set-onboarded" });
      if (response.ok) {
        state.app = response.state;
      } else {
        result.ok = false;
      }
    } catch (error) {
      log("error", "write_onboarding_runtime_failed", error);
      result.ok = false;
    }

    refs.onboarding.hidden = true;

    try {
      window.location.hash = "command-center";
      refs.lightEnabled?.focus({ preventScroll: true });
      result.navigated = true;
    } catch (error) {
      log("error", "onboarding_navigation_failed", error);
      result.ok = false;
    }

    render();
    setStatus(result.ok ? "Onboarding complete" : "Onboarding saved (fallback)");
    return result;
  }

  function bindOnboardingEvents() {
    refs.onboardBack.addEventListener("click", () => {
      state.onboardingStep = Math.max(0, state.onboardingStep - 1);
      renderOnboarding();
    });

    refs.onboardNext.addEventListener("click", async () => {
      if (state.onboardingStep >= onboardingSteps.length - 1) {
        refs.onboardNext.disabled = true;
        refs.onboardNext.textContent = "Finishing...";
        await completeOnboarding();
        refs.onboardNext.disabled = false;
        refs.onboardNext.textContent = "Finish";
        return;
      }
      state.onboardingStep += 1;
      renderOnboarding();
    });

    refs.onboardSkip.addEventListener("click", completeOnboarding);
  }

  async function boot() {
    bindEvents();
    bindOnboardingEvents();
    await hydrate();

    setInterval(() => {
      if (!state.app?.settings?.deepWork?.active) return;
      renderDeepWork();
    }, 20000);
  }

  boot().catch((error) => {
    log("error", "boot_failed", error);
    setStatus("Popup failed to initialize", true);
  });
})();
