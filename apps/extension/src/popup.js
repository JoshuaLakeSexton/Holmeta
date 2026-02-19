(() => {
  const HC = globalThis.HolmetaCommon;
  const HA = globalThis.HolmetaAudio;

  const state = {
    settings: HC.normalizeSettings(HC.DEFAULT_SETTINGS),
    runtime: HC.normalizeRuntime(HC.DEFAULT_RUNTIME),
    entitlement: {
      active: false,
      status: "inactive",
      plan: null,
      renewsAt: null,
      trialEndsAt: null,
      stale: false,
      graceUntil: null,
      features: {}
    },
    summary: {
      totalCompleted: 0,
      totalScheduled: 0,
      scheduled: HC.emptyReminderMap(0),
      completed: HC.emptyReminderMap(0)
    },
    nextReminder: {
      at: 0,
      type: null
    },
    hydrationToday: 0,
    calmToday: 0
  };

  const $ = (id) => document.getElementById(id);

  function debounce(fn, wait = 120) {
    let timer = null;
    return (...args) => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        fn(...args);
      }, wait);
    };
  }

  function send(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        resolve(response || {});
      });
    });
  }

  function normalizeEntitlement(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      active: Boolean(source.active),
      status: String(source.status || (source.active ? "active" : "inactive")).toLowerCase(),
      plan: source.plan || null,
      renewsAt: source.renewsAt || null,
      trialEndsAt: source.trialEndsAt || null,
      stale: Boolean(source.stale),
      graceUntil: source.graceUntil || null,
      checkedAt: source.checkedAt || null,
      features: source.features && typeof source.features === "object" ? source.features : {}
    };
  }

  function parseIsoTs(value) {
    if (!value) {
      return 0;
    }

    const ts = Date.parse(String(value));
    return Number.isFinite(ts) ? ts : 0;
  }

  function daysRemaining(value) {
    const ts = parseIsoTs(value);
    if (!ts) {
      return null;
    }

    const delta = ts - Date.now();
    if (delta <= 0) {
      return 0;
    }

    return Math.ceil(delta / (24 * 60 * 60 * 1000));
  }

  function isPremium() {
    return Boolean(state.settings.devBypassPremium || state.entitlement.active);
  }

  function formatClock() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function focusCountdown() {
    const focus = state.runtime.focusSession;
    if (!focus) return "IDLE";
    const remainingMs = Math.max(0, Number(focus.endsAt) - Date.now());
    return HC.formatCountdown(remainingMs);
  }

  function reminderCountdown() {
    if (!state.nextReminder?.at) {
      return "--:--";
    }
    const remaining = Math.max(0, Number(state.nextReminder.at) - Date.now());
    return HC.formatCountdown(remaining);
  }

  function statusMode() {
    if (state.runtime.focusSession) return "FOCUS";
    if (state.settings.cadence.global.meetingModeManual) return "MEETING";
    if (Number(state.settings.cadence.global.panicUntilTs || 0) > Date.now()) return "PANIC";
    if (!state.settings.filterEnabled || state.settings.colorAccurate) return "IDLE";
    return "ACTIVE";
  }

  function statusClass(mode) {
    if (mode === "ACTIVE" || mode === "FOCUS") return "status-active";
    if (mode === "MEETING" || mode === "PANIC") return "status-warning";
    if (mode === "IDLE") return "status-idle";
    return "status-locked";
  }

  function setInlineStatus(text) {
    const target = $("testStatus");
    if (!target) return;
    target.textContent = text;
  }

  function currentSfxVolume(scale = 1) {
    return HC.clamp(Number(state.settings.masterVolume || 0.35) * Number(scale || 1), 0, 1);
  }

  function mappedSfx(eventId) {
    return HC.resolveSfxKeyForEvent(state.settings, eventId);
  }

  function playUiSfx(eventId, options = {}) {
    if (!HA?.playSfx) {
      return;
    }

    if (!options.force && !state.settings.soundEnabled) {
      return;
    }

    if (!options.force && eventId === "uiHover" && !state.settings.hoverEnabled) {
      return;
    }

    if (!options.force && options.channel === "reminder" && !state.settings.reminderSoundsEnabled) {
      return;
    }

    const key = options.key || mappedSfx(eventId);
    if (!key) {
      return;
    }

    HA.playSfx(key, {
      volume: HC.clamp(Number(options.volume ?? currentSfxVolume(options.scale || 1)), 0, 1)
    });
  }

  function installAudioUnlock() {
    if (!HA?.initAudioUnlock) {
      return;
    }

    const unlock = () => {
      HA.initAudioUnlock();
    };

    ["pointerdown", "keydown", "touchstart", "click"].forEach((eventName) => {
      document.addEventListener(eventName, unlock, {
        capture: true,
        passive: true
      });
    });

    if (HA.bindUnlockOnGesture) {
      HA.bindUnlockOnGesture();
    }
  }

  function bindPrimaryHoverSfx() {
    let lastHoverTs = 0;
    document.querySelectorAll("button.primary").forEach((button) => {
      button.addEventListener("pointerenter", () => {
        const now = Date.now();
        if (now - lastHoverTs < 250) {
          return;
        }
        lastHoverTs = now;
        playUiSfx("uiHover");
      });
    });
  }

  async function createTab(url) {
    if (!chrome.tabs?.create) {
      return {
        ok: false,
        error: "TAB_API_UNAVAILABLE",
        message: "tabs API unavailable"
      };
    }

    return new Promise((resolve) => {
      chrome.tabs.create({ url }, () => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({
            ok: false,
            error: "TAB_OPEN_FAILED",
            message: err.message || "tabs.create failed"
          });
          return;
        }

        resolve({
          ok: true,
          url,
          method: "chrome.tabs.create"
        });
      });
    });
  }

  async function sendToActiveTab(message) {
    if (!chrome.tabs?.query || !chrome.tabs?.sendMessage) {
      return { ok: false, error: "TABS_API_UNAVAILABLE" };
    }

    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const queryErr = chrome.runtime?.lastError;
        if (queryErr) {
          resolve({ ok: false, error: "TAB_QUERY_FAILED", message: queryErr.message || "query failed" });
          return;
        }

        const tabId = tabs?.[0]?.id;
        if (typeof tabId !== "number") {
          resolve({ ok: false, error: "NO_ACTIVE_TAB" });
          return;
        }

        chrome.tabs.sendMessage(tabId, message, (response) => {
          const sendErr = chrome.runtime?.lastError;
          if (sendErr) {
            resolve({ ok: false, error: "TAB_SEND_FAILED", message: sendErr.message || "sendMessage failed" });
            return;
          }

          resolve({ ok: true, response: response || null });
        });
      });
    });
  }

  async function getActiveTabContext() {
    if (!chrome.tabs?.query) {
      return { ok: false, error: "TABS_API_UNAVAILABLE" };
    }

    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({ ok: false, error: "TAB_QUERY_FAILED", message: err.message || "query failed" });
          return;
        }

        const tab = tabs?.[0];
        if (typeof tab?.id !== "number") {
          resolve({ ok: false, error: "NO_ACTIVE_TAB" });
          return;
        }

        resolve({
          ok: true,
          tabId: tab.id,
          windowId: typeof tab.windowId === "number" ? tab.windowId : null
        });
      });
    });
  }

  async function sendPanelCommand(type) {
    const context = await getActiveTabContext();
    if (!context.ok) {
      return context;
    }

    return send({
      type,
      tabId: context.tabId,
      windowId: context.windowId
    });
  }

  async function openDashboardFlow() {
    const resolved = HC.resolveDashboardUrl(state.settings);
    if (!resolved.ok) {
      setInlineStatus("STATUS: DASHBOARD URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: resolved.error || "INVALID_URL" };
    }

    const opened = await HC.openExternal(resolved.url);
    if (!opened.ok) {
      setInlineStatus("STATUS: DASHBOARD OPEN FAILED (" + (opened.message || opened.error || "UNKNOWN") + ")");
      playUiSfx("uiError", { force: true });
      return opened;
    }

    setInlineStatus("STATUS: DASHBOARD OPENED (" + String(resolved.source || "derived").toUpperCase() + ")");
    playUiSfx("uiSuccess", { force: true });
    return { ok: true };
  }

  async function openSubscribeFlow() {
    const resolved = HC.resolveDashboardUrl(state.settings);
    if (!resolved.ok) {
      setInlineStatus("STATUS: DASHBOARD URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: resolved.error || "INVALID_URL" };
    }

    let subscribeUrl = "";
    try {
      const parsed = new URL(resolved.url);
      const basePath = String(parsed.pathname || "").replace(/\/+$/, "");
      parsed.pathname = `${basePath || ""}/subscribe`.replace(/\/{2,}/g, "/");
      parsed.search = "";
      parsed.hash = "";
      subscribeUrl = parsed.toString();
    } catch (_) {
      setInlineStatus("STATUS: SUBSCRIBE URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: "INVALID_SUBSCRIBE_URL" };
    }

    const opened = await createTab(subscribeUrl);
    if (!opened.ok) {
      setInlineStatus("STATUS: SUBSCRIBE OPEN FAILED (" + (opened.message || opened.error || "UNKNOWN") + ")");
      playUiSfx("uiError", { force: true });
      return opened;
    }

    setInlineStatus("STATUS: SUBSCRIBE PAGE OPENED");
    playUiSfx("uiSuccess", { force: true });
    return opened;
  }

  function refreshBreakdown() {
    const container = $("completionBreakdown");
    container.innerHTML = "";

    HC.REMINDER_TYPES.forEach((type) => {
      const completed = Number(state.summary.completed[type] || 0);
      const scheduled = Number(state.summary.scheduled[type] || 0);
      const item = document.createElement("div");
      item.className = "breakdown-item";
      item.textContent = `${HC.REMINDER_LABELS[type] || type}: ${completed}/${scheduled}`;
      container.appendChild(item);
    });
  }

  function applyPresetLocks() {
    const presetSelect = $("presetSelect");
    if (!presetSelect) {
      return;
    }

    const freePresetIds = Array.isArray(HC.FREE_FILTER_PRESET_IDS) && HC.FREE_FILTER_PRESET_IDS.length
      ? HC.FREE_FILTER_PRESET_IDS
      : ["blueShieldMild", "nightWarmMild", "contrastGuard"];

    const premium = isPremium();
    [...presetSelect.options].forEach((option) => {
      const allowed = premium || freePresetIds.includes(option.value);
      option.disabled = !allowed;
      option.dataset.locked = allowed ? "0" : "1";
    });

    if (!premium && !freePresetIds.includes(presetSelect.value)) {
      const fallback = freePresetIds.find((id) => [...presetSelect.options].some((opt) => opt.value === id && !opt.disabled));
      if (fallback) {
        presetSelect.value = fallback;
      }
    }
  }

  function renderPaywall() {
    const entitlementChip = $("entitlementStatus");
    const trialChip = $("trialChip");
    const copy = $("paywallCopy");
    const banner = $("premiumBanner");

    const status = String(state.entitlement.status || "inactive").toLowerCase();
    const trialDays = daysRemaining(state.entitlement.trialEndsAt);

    if (state.settings.devBypassPremium) {
      entitlementChip.className = "status-chip status-active";
      entitlementChip.textContent = "STATUS: DEV BYPASS";
      trialChip.className = "status-chip status-idle";
      trialChip.textContent = "STATUS: DEV MODE";
      copy.textContent = "Premium controls are unlocked in dev bypass mode.";
      banner.hidden = true;
    } else if (state.entitlement.active) {
      entitlementChip.className = "status-chip status-active";
      entitlementChip.textContent = status === "trialing" ? "STATUS: TRIAL ACTIVE" : "STATUS: PREMIUM ACTIVE";

      if (status === "trialing") {
        trialChip.className = "status-chip status-warning";
        trialChip.textContent = trialDays === null
          ? "STATUS: TRIAL"
          : `STATUS: TRIAL ${Math.max(0, trialDays)}D LEFT`;
        copy.textContent = trialDays === null
          ? "Trial active. Premium cadence and analytics are unlocked."
          : `Trial active with ${Math.max(0, trialDays)} day(s) remaining.`;
      } else if (state.entitlement.stale) {
        trialChip.className = "status-chip status-warning";
        trialChip.textContent = "STATUS: OFFLINE GRACE";
        copy.textContent = "Premium active from cached entitlement. Reconnect within 72 hours to refresh.";
      } else {
        trialChip.className = "status-chip status-active";
        trialChip.textContent = "STATUS: PREMIUM";
        copy.textContent = "Premium active. Advanced cadence and analytics unlocked.";
      }

      banner.hidden = true;
    } else {
      entitlementChip.className = "status-chip status-locked";
      entitlementChip.textContent = "STATUS: LOCKED";

      const trialEnded = status === "trialing" && trialDays === 0;
      if (trialEnded) {
        trialChip.className = "status-chip status-locked";
        trialChip.textContent = "STATUS: TRIAL ENDED";
        copy.textContent = "Trial ended. Subscribe to continue premium controls.";
      } else {
        trialChip.className = "status-chip status-idle";
        trialChip.textContent = "STATUS: FREE MODE";
        copy.textContent = "Free mode includes basic filters + interval reminders.";
      }

      banner.hidden = false;
      banner.classList.toggle("is-trial", trialEnded);
      banner.textContent = trialEnded
        ? "TRIAL ENDED - SUBSCRIBE TO CONTINUE PREMIUM CONTROLS."
        : "SUBSCRIBE TO UNLOCK PREMIUM CONTROLS.";
    }

    const premium = isPremium();
    document.querySelectorAll("[data-premium]").forEach((el) => {
      el.disabled = !premium;
      if (!premium) {
        el.title = "Premium required";
      } else {
        el.removeAttribute("title");
      }
    });

    applyPresetLocks();
  }

  function render() {
    const mode = statusMode();
    const chip = $("statusChip");
    chip.className = `status-chip ${statusClass(mode)}`;
    chip.textContent = `STATUS: ${mode}`;

    $("nextReminderReadout").textContent = reminderCountdown();
    $("nextReminderMeta").textContent = state.nextReminder?.type
      ? `TYPE: ${(HC.REMINDER_LABELS[state.nextReminder.type] || state.nextReminder.type).toUpperCase()} · ${formatClock()}`
      : `TYPE: NONE · ${formatClock()}`;

    $("completionReadout").textContent = `${state.summary.totalCompleted} / ${state.summary.totalScheduled}`;
    $("completionMeta").textContent = `HYDRATION: ${state.hydrationToday}/${state.settings.cadence.reminders.hydration.dailyGoalGlasses}`;

    $("focusReadout").textContent = focusCountdown();
    $("focusMeta").textContent = state.runtime.focusSession
      ? `ENDS: ${new Date(state.runtime.focusSession.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "MODE: READY";

    $("filterReadout").textContent = HC.getPresetById(state.settings.filterPreset).label;
    $("filterMeta").textContent = `INTENSITY: ${Math.round(state.settings.filterIntensity * 100)}%`;

    $("presetSelect").value = state.settings.filterPreset;
    $("intensityRange").value = String(Math.round(Number(state.settings.filterIntensity) * 100));
    $("intensityValue").textContent = `${Math.round(Number(state.settings.filterIntensity) * 100)}%`;

    $("cadencePresetSelect").value = state.settings.cadence.activeProfile || "balanced";
    $("colorAccurateToggle").checked = Boolean(state.settings.colorAccurate);
    $("meetingManualToggle").checked = Boolean(state.settings.cadence.global.meetingModeManual);

    $("focusDomains").value = (state.settings.distractorDomains || []).join(", ");

    $("meetingToggle").textContent = state.settings.cadence.global.meetingModeManual
      ? "MEETING MODE: ON"
      : "MEETING MODE: OFF";

    $("filterToggle").textContent = state.settings.filterEnabled ? "FILTERS: ON" : "FILTERS: OFF";

    $("soundEnabledToggle").checked = Boolean(state.settings.soundEnabled);
    $("hoverEnabledToggle").checked = Boolean(state.settings.hoverEnabled);
    $("hoverEnabledToggle").disabled = !state.settings.soundEnabled;
    $("reminderSoundsToggle").checked = Boolean(state.settings.reminderSoundsEnabled);
    $("reminderSoundsToggle").disabled = !state.settings.soundEnabled;
    $("masterVolumeRange").value = String(Math.round(Number(state.settings.masterVolume || 0.35) * 100));
    $("masterVolumeValue").textContent = Math.round(Number(state.settings.masterVolume || 0.35) * 100) + "%";

    refreshBreakdown();
    renderPaywall();
  }

  async function refreshState() {
    const response = await send({ type: "holmeta-request-state", domain: "" });

    if (response.settings) state.settings = HC.normalizeSettings(response.settings);
    if (response.runtime) state.runtime = HC.normalizeRuntime(response.runtime);
    if (response.entitlement) state.entitlement = normalizeEntitlement(response.entitlement);

    state.hydrationToday = Number(response.hydrationToday || 0);
    state.calmToday = Number(response.calmToday || 0);

    if (response.reminderSummary) {
      state.summary = {
        ...state.summary,
        ...response.reminderSummary,
        scheduled: response.reminderSummary.scheduled || HC.emptyReminderMap(0),
        completed: response.reminderSummary.completed || HC.emptyReminderMap(0)
      };
    }

    if (response.nextReminder) {
      state.nextReminder = response.nextReminder;
    }

    render();
  }

  async function patchSettings(patch) {
    const response = await send({
      type: "holmeta-update-settings",
      patch
    });

    if (response.settings) {
      state.settings = HC.normalizeSettings(response.settings);
    }

    await refreshState();
  }

  async function applyCadencePreset(presetId) {
    const response = await send({
      type: "holmeta-apply-cadence-preset",
      presetId
    });

    if (response.settings) {
      state.settings = HC.normalizeSettings(response.settings);
    }

    await refreshState();
  }

  function bindEvents() {
    const debouncedPatch = debounce((patch) => {
      patchSettings(patch);
    }, 130);

    bindPrimaryHoverSfx();

    document.querySelectorAll("[data-focus]").forEach((button) => {
      button.addEventListener("click", async () => {
        playUiSfx("uiClick");
        const durationMin = Number(button.getAttribute("data-focus"));
        const domains = HC.parseDomainList($("focusDomains").value);
        await send({
          type: "holmeta-start-focus",
          payload: {
            durationMin,
            domains,
            closeExistingTabs: true
          }
        });
        await refreshState();
      });
    });

    $("stopFocus").addEventListener("click", async () => {
      playUiSfx("uiWarn");
      await send({ type: "holmeta-panic-focus" });
      await refreshState();
    });

    $("filterToggle").addEventListener("click", async () => {
      const nextEnabled = !state.settings.filterEnabled;
      playUiSfx(nextEnabled ? "uiToggleOn" : "uiToggleOff");
      await send({ type: "holmeta-set-filter-enabled", enabled: nextEnabled });
      await refreshState();
    });

    $("meetingToggle").addEventListener("click", async () => {
      const nextEnabled = !state.settings.cadence.global.meetingModeManual;
      playUiSfx(nextEnabled ? "uiToggleOn" : "uiToggleOff");
      await send({
        type: "holmeta-toggle-meeting-mode",
        enabled: nextEnabled
      });
      await refreshState();
    });

    $("meetingManualToggle").addEventListener("change", async (event) => {
      const nextEnabled = Boolean(event.target.checked);
      playUiSfx(nextEnabled ? "uiToggleOn" : "uiToggleOff");
      await send({
        type: "holmeta-toggle-meeting-mode",
        enabled: nextEnabled
      });
      await refreshState();
    });

    $("snoozeAll").addEventListener("click", async () => {
      playUiSfx("uiWarn");
      await send({ type: "holmeta-snooze-all", minutes: 15 });
      await refreshState();
    });

    $("panicOff").addEventListener("click", async () => {
      playUiSfx("uiWarn");
      await send({ type: "holmeta-panic-off", minutes: 30 });
      await refreshState();
    });

    $("presetSelect").addEventListener("change", (event) => {
      playUiSfx("uiToggleOn");
      const preset = HC.getPresetById(event.target.value);
      patchSettings({
        filterPreset: event.target.value,
        overlayColorPreset: preset.overlay.color,
        overlayBlendMode: preset.overlay.blend
      });
    });

    $("intensityRange").addEventListener("input", (event) => {
      const value = Number(event.target.value || 0) / 100;
      $("intensityValue").textContent = Math.round(value * 100) + "%";
      debouncedPatch({ filterIntensity: value });
    });

    $("colorAccurateToggle").addEventListener("change", (event) => {
      playUiSfx(Boolean(event.target.checked) ? "uiToggleOn" : "uiToggleOff");
      patchSettings({
        colorAccurate: Boolean(event.target.checked),
        filterEnabled: true
      });
    });

    $("applyCadencePreset").addEventListener("click", async () => {
      playUiSfx("uiSave");
      await applyCadencePreset($("cadencePresetSelect").value);
      playUiSfx("uiSuccess");
    });

    $("saveFocusDomains").addEventListener("click", async () => {
      playUiSfx("uiSave");
      const domains = HC.parseDomainList($("focusDomains").value);
      await patchSettings({ distractorDomains: domains });
      await refreshState();
      playUiSfx("uiSuccess");
    });

    document.querySelectorAll("[data-test-reminder]").forEach((button) => {
      button.addEventListener("click", async () => {
        const reminderType = button.getAttribute("data-test-reminder");
        $("testStatus").textContent = "STATUS: TESTING " + String(reminderType || "").toUpperCase();
        playUiSfx("uiTest", { force: true });
        await send({ type: "holmeta-test-reminder", reminderType });
        $("testStatus").textContent = "STATUS: DISPATCHED " + String(reminderType || "").toUpperCase();
        await refreshState();
      });
    });

    $("soundEnabledToggle").addEventListener("change", async (event) => {
      const enabled = Boolean(event.target.checked);
      if (!enabled) {
        playUiSfx("uiToggleOff", { force: true });
      }

      await patchSettings({ soundEnabled: enabled });

      if (enabled) {
        playUiSfx("uiToggleOn", { force: true });
      }
    });

    $("hoverEnabledToggle").addEventListener("change", async (event) => {
      const enabled = Boolean(event.target.checked);
      playUiSfx(enabled ? "uiToggleOn" : "uiToggleOff");
      await patchSettings({ hoverEnabled: enabled });
    });

    $("reminderSoundsToggle").addEventListener("change", async (event) => {
      const enabled = Boolean(event.target.checked);
      playUiSfx(enabled ? "uiToggleOn" : "uiToggleOff");
      await patchSettings({ reminderSoundsEnabled: enabled });
    });

    $("masterVolumeRange").addEventListener("input", (event) => {
      const value = Number(event.target.value || 0);
      $("masterVolumeValue").textContent = Math.round(value) + "%";
      debouncedPatch({ masterVolume: value / 100 });
    });

    $("soundTestPing").addEventListener("click", async () => {
      await HA?.initAudioUnlock?.();
      playUiSfx("uiTest", { force: true });
      setInlineStatus("STATUS: SFX TEST PING");
    });

    $("unlockPremium").addEventListener("click", async () => {
      playUiSfx("uiClick");
      await openSubscribeFlow();
    });

    $("refreshEntitlement").addEventListener("click", async () => {
      playUiSfx("uiClick");
      await send({ type: "holmeta-refresh-entitlement" });
      await refreshState();
      playUiSfx("uiSuccess");
    });
    const openSidePanelBtn = $("openSidePanel");
    const closeSidePanelBtn = $("closeSidePanel");
    const sidePanelSupported = Boolean(chrome.sidePanel && typeof chrome.sidePanel.setOptions === "function");

    if (sidePanelSupported) {
      openSidePanelBtn.addEventListener("click", async () => {
        playUiSfx("uiClick");
        const response = await sendPanelCommand("HOLMETA_PANEL_OPEN");
        if (!response?.ok) {
          setInlineStatus("STATUS: SIDE PANEL OPEN FAILED (" + String(response?.error || "UNKNOWN") + ")");
          playUiSfx("uiError", { force: true });
          return;
        }

        setInlineStatus("STATUS: SIDE PANEL OPENED");
        playUiSfx("uiSuccess", { force: true });
      });

      closeSidePanelBtn.addEventListener("click", async () => {
        playUiSfx("uiClick");
        const response = await sendPanelCommand("HOLMETA_PANEL_CLOSE");
        if (!response?.ok) {
          setInlineStatus("STATUS: SIDE PANEL CLOSE FAILED (" + String(response?.error || "UNKNOWN") + ")");
          playUiSfx("uiError", { force: true });
          return;
        }

        setInlineStatus("STATUS: SIDE PANEL CLOSED");
        playUiSfx("uiSuccess", { force: true });
      });
    } else {
      [openSidePanelBtn, closeSidePanelBtn].forEach((button) => {
        if (!button) {
          return;
        }

        button.disabled = true;
        button.hidden = true;
      });
    }

    $("openHud").addEventListener("click", async () => {
      playUiSfx("uiClick");
      const result = await sendToActiveTab({ type: "HOLMETA_HUD_OPEN" });
      if (!result.ok) {
        setInlineStatus("STATUS: HUD OPEN FAILED (" + String(result.error || "UNKNOWN") + ")");
        playUiSfx("uiError", { force: true });
        return;
      }

      setInlineStatus("STATUS: HUD OPEN REQUESTED");
      playUiSfx("uiSuccess", { force: true });
    });

    $("closeHud").addEventListener("click", async () => {
      playUiSfx("uiClick");
      const result = await sendToActiveTab({ type: "HOLMETA_HUD_CLOSE" });
      if (!result.ok) {
        setInlineStatus("STATUS: HUD CLOSE FAILED (" + String(result.error || "UNKNOWN") + ")");
        playUiSfx("uiError", { force: true });
        return;
      }

      setInlineStatus("STATUS: HUD CLOSE REQUESTED");
      playUiSfx("uiSuccess", { force: true });
    });

    $("openDashboard").addEventListener("click", async () => {
      playUiSfx("uiClick");
      await openDashboardFlow();
    });

    $("openOptions").addEventListener("click", () => {
      playUiSfx("uiClick");
      chrome.runtime.openOptionsPage();
    });
  }

  async function bootstrap() {
    installAudioUnlock();
    bindEvents();
    await refreshState();

    setInterval(() => {
      render();
    }, 1000);
  }

  bootstrap();
})();
