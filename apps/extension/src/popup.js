(() => {
  const HC = globalThis.HolmetaCommon;
  const HA = globalThis.HolmetaAudio;
  const HS = globalThis.HolmetaPopupStorage;

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
    calmToday: 0,
    lockIn: {
      date: "",
      items: [],
      summary: {
        total: 0,
        completed: 0,
        pending: 0
      }
    },
    blocker: {
      enabled: false,
      categories: {},
      csvDomains: [],
      effectiveDomains: []
    },
    inlineDraft: {
      licenseKey: "",
      checkoutSessionId: "",
      domainsCsv: "",
      notes: "",
      dirtyLicense: false,
      dirtyCheckoutSession: false,
      dirtyDomains: false,
      dirtyNotes: false
    },
    uiState: HS?.DEFAULT_STATE ? { ...HS.DEFAULT_STATE } : {
      version: 1,
      notes: "",
      licenseKeyDraft: "",
      checkoutSessionDraft: "",
      domainsDraft: "",
      updatedAt: 0
    }
  };

  const $ = (id) => document.getElementById(id);

  function on(id, eventName, handler, options) {
    const el = $(id);
    if (!el) {
      console.warn("holmeta popup missing element:", id);
      return false;
    }
    el.addEventListener(eventName, handler, options);
    return true;
  }

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
        const runtimeError = chrome.runtime?.lastError;
        if (runtimeError) {
          resolve({
            ok: false,
            error: runtimeError.message || "RUNTIME_ERROR"
          });
          return;
        }
        resolve(response || {});
      });
    });
  }

  async function loadUiState() {
    if (!HS?.readUiState) {
      return;
    }
    try {
      state.uiState = await HS.readUiState();
    } catch (_) {
      state.uiState = HS.DEFAULT_STATE ? { ...HS.DEFAULT_STATE } : state.uiState;
    }
  }

  async function persistUiStatePatch(patch) {
    if (!HS?.patchUiState) {
      return;
    }
    try {
      const result = await HS.patchUiState(patch || {});
      if (result?.state) {
        state.uiState = result.state;
      }
    } catch (_) {
      // Keep popup responsive even when local storage write fails.
    }
  }

  const debouncedPersistUiState = debounce((patch) => {
    persistUiStatePatch(patch);
  }, 320);

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

  function normalizeLockIn(rawLockIn, rawSummary) {
    const source = rawLockIn && typeof rawLockIn === "object" ? rawLockIn : {};
    const items = Array.isArray(source.items) ? source.items : [];
    const normalizedItems = items.map((item) => ({
      id: String(item?.id || ""),
      title: String(item?.title || "").trim(),
      dueTime: String(item?.dueTime || "09:00"),
      completed: Boolean(item?.completed),
      createdAt: Number(item?.createdAt || 0),
      completedAt: Number(item?.completedAt || 0),
      alarmCount: Math.max(0, Number(item?.alarmCount || 0))
    })).filter((item) => item.id && item.title);

    const derived = {
      total: normalizedItems.length,
      completed: normalizedItems.filter((item) => item.completed).length
    };
    derived.pending = Math.max(0, derived.total - derived.completed);

    const summary = rawSummary && typeof rawSummary === "object"
      ? {
          total: Number(rawSummary.total ?? derived.total),
          completed: Number(rawSummary.completed ?? derived.completed),
          pending: Number(rawSummary.pending ?? derived.pending)
        }
      : derived;

    return {
      date: String(source.date || HC.todayKey()),
      items: normalizedItems,
      summary
    };
  }

  function normalizeBlocker(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const categories = source.categories && typeof source.categories === "object"
      ? source.categories
      : {};
    const csvDomains = Array.isArray(source.csvDomains) ? source.csvDomains : [];
    const effectiveDomains = Array.isArray(source.effectiveDomains) ? source.effectiveDomains : [];
    return {
      enabled: Boolean(source.enabled),
      categories: categories,
      csvDomains: csvDomains,
      effectiveDomains: effectiveDomains
    };
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

  function currentInlineLicenseKey() {
    const input = $("licenseKeyInline");
    if (input) {
      return String(input.value || "").trim().toUpperCase();
    }
    return state.inlineDraft.dirtyLicense
      ? String(state.inlineDraft.licenseKey || "").trim().toUpperCase()
      : String(state.uiState.licenseKeyDraft || state.settings.licenseKey || "").trim().toUpperCase();
  }

  function currentInlineCheckoutSessionId() {
    const input = $("checkoutSessionInline");
    if (input) {
      return String(input.value || "").trim();
    }
    return state.inlineDraft.dirtyCheckoutSession
      ? String(state.inlineDraft.checkoutSessionId || "").trim()
      : String(state.uiState.checkoutSessionDraft || state.settings.checkoutSessionId || "").trim();
  }

  function currentDomainsCsv() {
    const input = $("focusDomains");
    if (input) {
      return String(input.value || "").trim();
    }
    if (state.inlineDraft.dirtyDomains) {
      return String(state.inlineDraft.domainsCsv || "").trim();
    }
    return String(state.uiState.domainsDraft || (state.settings.distractorDomains || []).join(", ")).trim();
  }

  function currentNotes() {
    const input = $("quickNotes");
    if (input) {
      return String(input.value || "");
    }
    if (state.inlineDraft.dirtyNotes) {
      return String(state.inlineDraft.notes || "");
    }
    return String(state.uiState.notes || "");
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

  async function openHomeFlow() {
    const resolved = HC.resolveSiteBaseUrl(state.settings);
    if (!resolved.ok) {
      setInlineStatus("STATUS: HOME URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: resolved.error || "INVALID_URL" };
    }

    const opened = await HC.openExternal(resolved.url);
    if (!opened.ok) {
      setInlineStatus("STATUS: HOME OPEN FAILED (" + (opened.message || opened.error || "UNKNOWN") + ")");
      playUiSfx("uiError", { force: true });
      return opened;
    }

    setInlineStatus("STATUS: HOME OPENED");
    playUiSfx("uiSuccess", { force: true });
    return { ok: true };
  }

  function handlePopupBack() {
    playUiSfx("uiClick");
    try {
      window.close();
    } catch (_) {
      setInlineStatus("STATUS: BACK ACTION UNAVAILABLE");
      playUiSfx("uiError", { force: true });
    }
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

  async function openLicensePageFlow() {
    const sessionId = currentInlineCheckoutSessionId();
    if (!sessionId) {
      setInlineStatus("STATUS: CHECKOUT SESSION ID REQUIRED");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: "SESSION_ID_REQUIRED" };
    }

    const resolved = HC.resolveBillingSuccessUrl(state.settings, sessionId);
    if (!resolved.ok) {
      setInlineStatus("STATUS: BILLING SUCCESS URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: resolved.error || "INVALID_BILLING_URL" };
    }

    const opened = await HC.openExternal(resolved.url);
    if (!opened.ok) {
      setInlineStatus("STATUS: OPEN LICENSE PAGE FAILED (" + (opened.message || opened.error || "UNKNOWN") + ")");
      playUiSfx("uiError", { force: true });
      return opened;
    }

    setInlineStatus("STATUS: LICENSE PAGE OPENED");
    playUiSfx("uiSuccess", { force: true });
    return opened;
  }

  async function openCancelPortalFlow() {
    const sessionId = currentInlineCheckoutSessionId();
    const licenseKey = currentInlineLicenseKey();
    if (!sessionId && !licenseKey) {
      setInlineStatus("STATUS: SESSION ID OR LICENSE KEY REQUIRED");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: "PORTAL_LOOKUP_REQUIRED" };
    }

    const endpoint = HC.resolvePortalSessionUrl(state.settings);
    if (!endpoint.ok) {
      setInlineStatus("STATUS: API BASE URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: endpoint.error || "INVALID_API_BASE" };
    }

    try {
      setInlineStatus("STATUS: OPENING BILLING PORTAL");
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: sessionId || null,
          license_key: licenseKey || null
        })
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (_) {
        payload = {};
      }

      if (!response.ok || !payload?.url) {
        const detail = payload?.error || payload?.code || `HTTP ${response.status}`;
        setInlineStatus(`STATUS: BILLING PORTAL FAILED (${String(detail)})`);
        playUiSfx("uiError", { force: true });
        return { ok: false, error: String(detail) };
      }

      const opened = await HC.openExternal(payload.url);
      if (!opened.ok) {
        setInlineStatus("STATUS: BILLING PORTAL OPEN FAILED (" + (opened.message || opened.error || "UNKNOWN") + ")");
        playUiSfx("uiError", { force: true });
        return opened;
      }

      setInlineStatus("STATUS: BILLING PORTAL OPENED");
      playUiSfx("uiSuccess", { force: true });
      return opened;
    } catch (error) {
      setInlineStatus("STATUS: BILLING PORTAL REQUEST FAILED");
      playUiSfx("uiError", { force: true });
      return {
        ok: false,
        error: error instanceof Error ? error.message : "PORTAL_FETCH_FAILED"
      };
    }
  }

  async function openRefundHelpFlow() {
    const resolved = HC.resolveBillingHelpUrl(state.settings);
    if (!resolved.ok) {
      setInlineStatus("STATUS: BILLING HELP URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: resolved.error || "INVALID_BILLING_HELP_URL" };
    }

    const opened = await HC.openExternal(resolved.url);
    if (!opened.ok) {
      setInlineStatus("STATUS: REFUND HELP OPEN FAILED (" + (opened.message || opened.error || "UNKNOWN") + ")");
      playUiSfx("uiError", { force: true });
      return opened;
    }

    setInlineStatus("STATUS: REFUND HELP OPENED");
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

  function blockerCategoriesFromSettings() {
    const defaults = HC.DEFAULT_BLOCKER_CATEGORIES || {};
    return {
      social: Boolean(state.settings.blockerCategories?.social ?? defaults.social),
      news: Boolean(state.settings.blockerCategories?.news ?? defaults.news),
      video: Boolean(state.settings.blockerCategories?.video ?? defaults.video),
      adult: Boolean(state.settings.blockerCategories?.adult ?? defaults.adult)
    };
  }

  function renderBlockerControls() {
    const categories = blockerCategoriesFromSettings();
    const effectiveDomains = Array.isArray(state.blocker?.effectiveDomains) && state.blocker.effectiveDomains.length
      ? state.blocker.effectiveDomains
      : HC.effectiveDistractorDomains(state.settings);

    [
      ["catSocial", "social"],
      ["catNews", "news"],
      ["catVideo", "video"],
      ["catAdult", "adult"]
    ].forEach(([id, key]) => {
      const button = $(id);
      if (!button) {
        return;
      }
      const active = Boolean(categories[key]);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const chip = $("blockerStateChip");
    if (chip) {
      const enabled = Boolean(state.settings.blockerEnabled);
      chip.className = `status-chip ${enabled ? "status-warning" : "status-idle"}`;
      chip.textContent = enabled ? "STATUS: BLOCKERS ACTIVE" : "STATUS: BLOCKERS PAUSED";
    }

    const count = $("blockerDomainCount");
    if (count) {
      count.textContent = `ACTIVE DOMAINS: ${effectiveDomains.length}`;
    }

    if ($("activateBlockers")) {
      $("activateBlockers").disabled = Boolean(state.settings.blockerEnabled);
    }
    if ($("pauseBlockers")) {
      $("pauseBlockers").disabled = !Boolean(state.settings.blockerEnabled);
    }
  }

  function renderLockIn() {
    const listEl = $("lockInList");
    const statusEl = $("lockInStatus");
    if (!listEl || !statusEl) {
      return;
    }

    listEl.innerHTML = "";

    const lockIn = state.lockIn || normalizeLockIn({}, null);
    const items = Array.isArray(lockIn.items) ? lockIn.items : [];
    const summary = lockIn.summary || { total: 0, completed: 0, pending: 0 };

    statusEl.textContent = `STATUS: ${summary.completed}/${summary.total} COMPLETE · ${summary.pending} PENDING`;

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "lockin-empty";
      empty.textContent = "NO TO-DO ITEMS FOR TODAY. ADD A TASK + DUE TIME TO ARM LOCK IN.";
      listEl.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = `lockin-item${item.completed ? " is-complete" : ""}`;
      row.dataset.lockinId = item.id;

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "lockin-check";
      check.checked = Boolean(item.completed);
      check.setAttribute("aria-label", `Mark ${item.title} complete`);
      check.dataset.action = "toggle";
      check.dataset.lockinId = item.id;

      const copy = document.createElement("div");
      copy.className = "lockin-copy";

      const title = document.createElement("p");
      title.className = "lockin-title";
      title.textContent = item.title;

      const meta = document.createElement("p");
      meta.className = "lockin-meta";
      meta.textContent = `DUE ${item.dueTime}${item.alarmCount ? ` · ALARMS ${item.alarmCount}` : ""}`;

      copy.appendChild(title);
      copy.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "lockin-actions";

      const snoozeBtn = document.createElement("button");
      snoozeBtn.type = "button";
      snoozeBtn.className = "secondary";
      snoozeBtn.textContent = "SNOOZE";
      snoozeBtn.disabled = Boolean(item.completed);
      snoozeBtn.dataset.action = "snooze";
      snoozeBtn.dataset.lockinId = item.id;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "danger";
      deleteBtn.textContent = "DELETE";
      deleteBtn.dataset.action = "delete";
      deleteBtn.dataset.lockinId = item.id;

      actions.appendChild(snoozeBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(check);
      row.appendChild(copy);
      row.appendChild(actions);
      listEl.appendChild(row);
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
          ? "Trial active from your license. Premium controls are unlocked."
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
        trialChip.textContent = "STATUS: LICENSE REQUIRED";
        copy.textContent = "Enter a valid Holmeta license key to unlock premium controls.";
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
    const activeElement = document.activeElement;
    const activeId = activeElement && "id" in activeElement ? String(activeElement.id || "") : "";

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

    if (activeId !== "presetSelect") {
      $("presetSelect").value = state.settings.filterPreset;
    }
    if (activeId !== "intensityRange") {
      $("intensityRange").value = String(Math.round(Number(state.settings.filterIntensity) * 100));
    }
    $("intensityValue").textContent = `${Math.round(Number(state.settings.filterIntensity) * 100)}%`;

    if (activeId !== "cadencePresetSelect") {
      $("cadencePresetSelect").value = state.settings.cadence.activeProfile || "balanced";
    }
    $("colorAccurateToggle").checked = Boolean(state.settings.colorAccurate);
    $("meetingManualToggle").checked = Boolean(state.settings.cadence.global.meetingModeManual);

    const domainsInput = $("focusDomains");
    if (domainsInput instanceof HTMLTextAreaElement) {
      if (activeId === "focusDomains") {
        state.inlineDraft.domainsCsv = String(domainsInput.value || "");
        state.inlineDraft.dirtyDomains = true;
      } else if (state.inlineDraft.dirtyDomains) {
        if (domainsInput.value !== state.inlineDraft.domainsCsv) {
          domainsInput.value = state.inlineDraft.domainsCsv;
        }
      } else {
        const preferredCsv = String(
          state.uiState.domainsDraft || (state.settings.distractorDomains || []).join(", ")
        );
        if (domainsInput.value !== preferredCsv) {
          domainsInput.value = preferredCsv;
        }
      }
    }

    $("meetingToggle").textContent = state.settings.cadence.global.meetingModeManual
      ? "MEETING QUIET: ON"
      : "MEETING QUIET: OFF";

    $("filterToggle").textContent = state.settings.filterEnabled
      ? "TOGGLE FILTERS (ON)"
      : "TOGGLE FILTERS (OFF)";

    $("soundEnabledToggle").checked = Boolean(state.settings.soundEnabled);
    $("hoverEnabledToggle").checked = Boolean(state.settings.hoverEnabled);
    $("hoverEnabledToggle").disabled = !state.settings.soundEnabled;
    $("reminderSoundsToggle").checked = Boolean(state.settings.reminderSoundsEnabled);
    $("reminderSoundsToggle").disabled = !state.settings.soundEnabled;
    $("masterVolumeRange").value = String(Math.round(Number(state.settings.masterVolume || 0.35) * 100));
    $("masterVolumeValue").textContent = Math.round(Number(state.settings.masterVolume || 0.35) * 100) + "%";
    const licenseInput = $("licenseKeyInline");
    if (licenseInput instanceof HTMLInputElement) {
      if (activeId === "licenseKeyInline") {
        const liveValue = String(licenseInput.value || "").toUpperCase();
        state.inlineDraft.licenseKey = liveValue;
        state.inlineDraft.dirtyLicense = true;
      } else if (state.inlineDraft.dirtyLicense) {
        if (licenseInput.value !== state.inlineDraft.licenseKey) {
          licenseInput.value = state.inlineDraft.licenseKey;
        }
      } else {
        const pref = String(state.uiState.licenseKeyDraft || state.settings.licenseKey || "").trim().toUpperCase();
        if (pref && licenseInput.value !== pref) {
          licenseInput.value = pref;
        }
      }
    }

    const checkoutSessionInput = $("checkoutSessionInline");
    if (checkoutSessionInput instanceof HTMLInputElement) {
      if (activeId === "checkoutSessionInline") {
        const liveValue = String(checkoutSessionInput.value || "").trim();
        state.inlineDraft.checkoutSessionId = liveValue;
        state.inlineDraft.dirtyCheckoutSession = true;
      } else if (state.inlineDraft.dirtyCheckoutSession) {
        if (checkoutSessionInput.value !== state.inlineDraft.checkoutSessionId) {
          checkoutSessionInput.value = state.inlineDraft.checkoutSessionId;
        }
      } else {
        const pref = String(state.uiState.checkoutSessionDraft || state.settings.checkoutSessionId || "").trim();
        if (pref && checkoutSessionInput.value !== pref) {
          checkoutSessionInput.value = pref;
        }
      }
    }

    const notesInput = $("quickNotes");
    const notesStatus = $("quickNotesStatus");
    if (notesInput instanceof HTMLTextAreaElement) {
      if (activeId === "quickNotes") {
        state.inlineDraft.notes = String(notesInput.value || "");
        state.inlineDraft.dirtyNotes = true;
      } else if (state.inlineDraft.dirtyNotes) {
        if (notesInput.value !== state.inlineDraft.notes) {
          notesInput.value = state.inlineDraft.notes;
        }
      } else {
        const saved = String(state.uiState.notes || "");
        if (notesInput.value !== saved) {
          notesInput.value = saved;
        }
      }
      if (notesStatus) {
        notesStatus.textContent = state.inlineDraft.dirtyNotes
          ? "STATUS: NOTES EDITING"
          : "STATUS: NOTES SAVED";
      }
    }

    if ($("lockInDueTime") && !$("lockInDueTime").value) {
      const nextHour = new Date(Date.now() + 60 * 60 * 1000);
      $("lockInDueTime").value = `${String(nextHour.getHours()).padStart(2, "0")}:00`;
    }

    refreshBreakdown();
    renderLockIn();
    renderBlockerControls();
    renderPaywall();
  }

  function renderLiveCountersOnly() {
    const nextReminder = $("nextReminderReadout");
    if (nextReminder) {
      nextReminder.textContent = reminderCountdown();
    }

    const nextMeta = $("nextReminderMeta");
    if (nextMeta) {
      nextMeta.textContent = state.nextReminder?.type
        ? `TYPE: ${(HC.REMINDER_LABELS[state.nextReminder.type] || state.nextReminder.type).toUpperCase()} · ${formatClock()}`
        : `TYPE: NONE · ${formatClock()}`;
    }

    const focusReadout = $("focusReadout");
    if (focusReadout) {
      focusReadout.textContent = focusCountdown();
    }
  }

  async function refreshState() {
    const response = await send({ type: "holmeta-request-state", domain: "" });
    if (response?.ok === false) {
      setInlineStatus("STATUS: BACKGROUND ERROR (" + String(response.error || "UNKNOWN") + ")");
      return;
    }

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

    if (response.lockIn || response.lockInSummary) {
      state.lockIn = normalizeLockIn(response.lockIn, response.lockInSummary);
    }

    if (response.blocker) {
      state.blocker = normalizeBlocker(response.blocker);
    } else {
      state.blocker = normalizeBlocker({
        enabled: state.settings.blockerEnabled,
        categories: state.settings.blockerCategories,
        csvDomains: state.settings.distractorDomains,
        effectiveDomains: HC.effectiveDistractorDomains(state.settings)
      });
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

  function applyLockInResponse(response) {
    if (!response) {
      return;
    }

    if (response.lockIn || response.summary) {
      state.lockIn = normalizeLockIn(response.lockIn, response.summary);
    }
  }

  function currentBlockerCategoriesDraft() {
    const categories = blockerCategoriesFromSettings();
    [
      ["catSocial", "social"],
      ["catNews", "news"],
      ["catVideo", "video"],
      ["catAdult", "adult"]
    ].forEach(([id, key]) => {
      const button = $(id);
      if (!button) {
        return;
      }
      categories[key] = button.classList.contains("is-active");
    });
    return categories;
  }

  async function applyBlockerConfig(options = {}) {
    const categories = currentBlockerCategoriesDraft();
    const domains = HC.parseDomainList($("focusDomains").value);
    const enabled = Object.prototype.hasOwnProperty.call(options, "enabled")
      ? Boolean(options.enabled)
      : Boolean(state.settings.blockerEnabled);

    const response = await send({
      type: "holmeta-set-blocker-config",
      domains,
      categories,
      enabled
    });

    if (!response?.ok) {
      setInlineStatus("STATUS: BLOCKER UPDATE FAILED");
      playUiSfx("uiError", { force: true });
      return false;
    }

    if (response.settings) {
      state.settings = HC.normalizeSettings(response.settings);
    }
    if (response.blocker) {
      state.blocker = normalizeBlocker(response.blocker);
    }
    render();
    return true;
  }

  function bindEvents() {
    const debouncedPatch = debounce((patch) => {
      patchSettings(patch);
    }, 130);

    bindPrimaryHoverSfx();

    on("popupBack", "click", () => {
      handlePopupBack();
    });

    on("popupHome", "click", async () => {
      await openHomeFlow();
    });

    on("licenseKeyInline", "input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const normalized = String(target.value || "").toUpperCase();
      if (target.value !== normalized) {
        target.value = normalized;
      }
      state.inlineDraft.licenseKey = normalized;
      state.inlineDraft.dirtyLicense = true;
      debouncedPersistUiState({ licenseKeyDraft: normalized });
    });

    on("licenseKeyInline", "change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const normalized = String(target.value || "").trim().toUpperCase();
      target.value = normalized;
      state.inlineDraft.licenseKey = normalized;
      state.inlineDraft.dirtyLicense = true;
      debouncedPersistUiState({ licenseKeyDraft: normalized });
    });

    on("licenseKeyInline", "paste", () => {
      requestAnimationFrame(() => {
        const target = $("licenseKeyInline");
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        const normalized = String(target.value || "").trim().toUpperCase();
        target.value = normalized;
        state.inlineDraft.licenseKey = normalized;
        state.inlineDraft.dirtyLicense = true;
        debouncedPersistUiState({ licenseKeyDraft: normalized });
      });
    });

    on("checkoutSessionInline", "input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const normalized = String(target.value || "").trim();
      if (target.value !== normalized) {
        target.value = normalized;
      }
      state.inlineDraft.checkoutSessionId = normalized;
      state.inlineDraft.dirtyCheckoutSession = true;
      debouncedPersistUiState({ checkoutSessionDraft: normalized });
      debouncedPatch({ checkoutSessionId: normalized });
    });

    const debouncedDomainSave = debounce(async () => {
      const parsed = HC.parseDomainList(currentDomainsCsv());
      await patchSettings({
        distractorDomains: parsed
      });
      state.inlineDraft.domainsCsv = parsed.join(", ");
      state.inlineDraft.dirtyDomains = false;
      await persistUiStatePatch({
        domainsDraft: state.inlineDraft.domainsCsv
      });
      setInlineStatus("STATUS: DOMAINS SAVED");
    }, 420);

    on("focusDomains", "input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) {
        return;
      }
      const normalized = String(target.value || "");
      state.inlineDraft.domainsCsv = normalized;
      state.inlineDraft.dirtyDomains = true;
      debouncedPersistUiState({ domainsDraft: normalized });
      debouncedDomainSave();
    });

    on("quickNotes", "input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) {
        return;
      }
      const value = String(target.value || "");
      state.inlineDraft.notes = value;
      state.inlineDraft.dirtyNotes = true;
      debouncedPersistUiState({ notes: value });
      const notesStatus = $("quickNotesStatus");
      if (notesStatus) {
        notesStatus.textContent = "STATUS: SAVING NOTES";
      }
    });

    on("quickNotes", "blur", async () => {
      const value = currentNotes();
      state.inlineDraft.notes = value;
      state.inlineDraft.dirtyNotes = false;
      await persistUiStatePatch({ notes: value });
      const notesStatus = $("quickNotesStatus");
      if (notesStatus) {
        notesStatus.textContent = "STATUS: NOTES SAVED";
      }
    });

    document.querySelectorAll("[data-focus]").forEach((button) => {
      button.addEventListener("click", async () => {
        playUiSfx("uiClick");
        const durationMin = Number(button.getAttribute("data-focus"));
        const domains = HC.effectiveDistractorDomains({
          ...state.settings,
          distractorDomains: HC.parseDomainList($("focusDomains").value),
          blockerCategories: currentBlockerCategoriesDraft()
        });
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

    on("stopFocus", "click", async () => {
      playUiSfx("uiWarn");
      await send({ type: "holmeta-panic-focus" });
      await refreshState();
    });

    on("filterToggle", "click", async () => {
      const nextEnabled = !state.settings.filterEnabled;
      playUiSfx(nextEnabled ? "uiToggleOn" : "uiToggleOff");
      await send({ type: "holmeta-set-filter-enabled", enabled: nextEnabled });
      await refreshState();
    });

    on("meetingToggle", "click", async () => {
      const nextEnabled = !state.settings.cadence.global.meetingModeManual;
      playUiSfx(nextEnabled ? "uiToggleOn" : "uiToggleOff");
      await send({
        type: "holmeta-toggle-meeting-mode",
        enabled: nextEnabled
      });
      await refreshState();
    });

    on("meetingManualToggle", "change", async (event) => {
      const nextEnabled = Boolean(event.target.checked);
      playUiSfx(nextEnabled ? "uiToggleOn" : "uiToggleOff");
      await send({
        type: "holmeta-toggle-meeting-mode",
        enabled: nextEnabled
      });
      await refreshState();
    });

    on("snoozeAll", "click", async () => {
      playUiSfx("uiWarn");
      await send({ type: "holmeta-snooze-all", minutes: 15 });
      await refreshState();
    });

    on("panicOff", "click", async () => {
      playUiSfx("uiWarn");
      await send({ type: "holmeta-panic-off", minutes: 30 });
      await refreshState();
    });

    on("lockInAdd", "click", async () => {
      const title = String($("lockInTitle").value || "").trim();
      const dueTime = String($("lockInDueTime").value || "").trim();
      if (!title) {
        setInlineStatus("STATUS: LOCK IN TITLE REQUIRED");
        playUiSfx("uiError", { force: true });
        return;
      }

      playUiSfx("uiSave");
      const response = await send({
        type: "holmeta-lockin-add",
        payload: {
          title,
          dueTime
        }
      });

      if (!response?.ok) {
        setInlineStatus("STATUS: LOCK IN ADD FAILED");
        playUiSfx("uiError", { force: true });
        return;
      }

      $("lockInTitle").value = "";
      applyLockInResponse(response);
      render();
      setInlineStatus("STATUS: LOCK IN ITEM ARMED");
      playUiSfx("uiSuccess", { force: true });
    });

    on("lockInTitle", "keydown", async (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      $("lockInAdd").click();
    });

    on("lockInTestAlarm", "click", async () => {
      playUiSfx("uiTest", { force: true });
      const response = await send({ type: "holmeta-lockin-test" });
      if (!response?.ok) {
        setInlineStatus(`STATUS: LOCK IN TEST FAILED (${String(response?.error || "UNKNOWN")})`);
        return;
      }

      applyLockInResponse(response);
      render();
      setInlineStatus("STATUS: LOCK IN ALARM TRIGGERED");
    });

    on("lockInList", "change", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.dataset.action !== "toggle") {
        return;
      }

      const itemId = String(target.dataset.lockinId || "").trim();
      if (!itemId) {
        return;
      }

      playUiSfx(target.checked ? "uiToggleOn" : "uiToggleOff");
      const response = await send({
        type: "holmeta-lockin-set-completed",
        itemId,
        completed: Boolean(target.checked)
      });

      if (!response?.ok) {
        setInlineStatus("STATUS: LOCK IN UPDATE FAILED");
        playUiSfx("uiError", { force: true });
        return;
      }

      applyLockInResponse(response);
      render();
      setInlineStatus(target.checked ? "STATUS: LOCK IN ITEM COMPLETED" : "STATUS: LOCK IN ITEM REOPENED");
    });

    on("lockInList", "click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = String(target.dataset.action || "").trim();
      const itemId = String(target.dataset.lockinId || "").trim();
      if (!action || !itemId) {
        return;
      }

      if (action === "snooze") {
        playUiSfx("uiWarn");
        const response = await send({
          type: "holmeta-lockin-snooze",
          itemId,
          minutes: 10
        });

        if (!response?.ok) {
          setInlineStatus("STATUS: LOCK IN SNOOZE FAILED");
          playUiSfx("uiError", { force: true });
          return;
        }

        applyLockInResponse(response);
        render();
        setInlineStatus("STATUS: LOCK IN SNOOZED 10M");
        return;
      }

      if (action === "delete") {
        playUiSfx("uiWarn");
        const response = await send({
          type: "holmeta-lockin-delete",
          itemId
        });

        if (!response?.ok) {
          setInlineStatus("STATUS: LOCK IN DELETE FAILED");
          playUiSfx("uiError", { force: true });
          return;
        }

        applyLockInResponse(response);
        render();
        setInlineStatus("STATUS: LOCK IN ITEM DELETED");
      }
    });

    on("presetSelect", "change", (event) => {
      playUiSfx("uiToggleOn");
      const preset = HC.getPresetById(event.target.value);
      patchSettings({
        filterPreset: event.target.value,
        overlayColorPreset: preset.overlay.color,
        overlayBlendMode: preset.overlay.blend
      });
    });

    on("intensityRange", "input", (event) => {
      const value = Number(event.target.value || 0) / 100;
      $("intensityValue").textContent = Math.round(value * 100) + "%";
      debouncedPatch({ filterIntensity: value });
    });

    on("colorAccurateToggle", "change", (event) => {
      playUiSfx(Boolean(event.target.checked) ? "uiToggleOn" : "uiToggleOff");
      patchSettings({
        colorAccurate: Boolean(event.target.checked),
        filterEnabled: true
      });
    });

    on("applyCadencePreset", "click", async () => {
      playUiSfx("uiSave");
      await applyCadencePreset($("cadencePresetSelect").value);
      playUiSfx("uiSuccess");
    });

    document.querySelectorAll(".blocker-cat").forEach((button) => {
      button.addEventListener("click", async () => {
        const willBeActive = !button.classList.contains("is-active");
        button.classList.toggle("is-active", willBeActive);
        button.setAttribute("aria-pressed", willBeActive ? "true" : "false");
        playUiSfx(willBeActive ? "uiToggleOn" : "uiToggleOff");
        const ok = await applyBlockerConfig();
        if (!ok) {
          await refreshState();
          return;
        }
        setInlineStatus("STATUS: BLOCK CATEGORY UPDATED");
      });
    });

    on("activateBlockers", "click", async () => {
      playUiSfx("uiWarn");
      const ok = await applyBlockerConfig({ enabled: true });
      if (!ok) {
        return;
      }
      setInlineStatus("STATUS: DISTRACTOR BLOCKERS ACTIVE");
      playUiSfx("uiSuccess", { force: true });
    });

    on("pauseBlockers", "click", async () => {
      playUiSfx("uiToggleOff");
      const ok = await applyBlockerConfig({ enabled: false });
      if (!ok) {
        return;
      }
      setInlineStatus("STATUS: DISTRACTOR BLOCKERS PAUSED");
    });

    on("saveFocusDomains", "click", async () => {
      playUiSfx("uiSave");
      const ok = await applyBlockerConfig();
      if (!ok) {
        return;
      }
      state.inlineDraft.domainsCsv = (state.settings.distractorDomains || []).join(", ");
      state.inlineDraft.dirtyDomains = false;
      await persistUiStatePatch({
        domainsDraft: state.inlineDraft.domainsCsv
      });
      setInlineStatus("STATUS: DOMAIN LIST SAVED");
      playUiSfx("uiSuccess");
    });

    document.querySelectorAll("[data-test-reminder]").forEach((button) => {
      button.addEventListener("click", async () => {
        const reminderType = button.getAttribute("data-test-reminder");
        $("testStatus").textContent = "STATUS: TESTING " + String(reminderType || "").toUpperCase();
        playUiSfx("uiTest", { force: true });
        const response = await send({ type: "holmeta-test-reminder", reminderType });
        if (!response?.ok) {
          $("testStatus").textContent = "STATUS: TEST FAILED (" + String(response?.error || "UNKNOWN") + ")";
          return;
        }

        if (response?.suppressed) {
          $("testStatus").textContent = "STATUS: SUPPRESSED (" + String(response.reason || "RULE") + ")";
        } else if (response?.delivery && response.delivery.delivered === false) {
          $("testStatus").textContent = "STATUS: NO WEB TAB FOR OVERLAY - OPEN HTTPS TAB";
        } else {
          $("testStatus").textContent = "STATUS: DISPATCHED " + String(reminderType || "").toUpperCase();
        }
        await refreshState();
      });
    });

    on("soundEnabledToggle", "change", async (event) => {
      const enabled = Boolean(event.target.checked);
      if (!enabled) {
        playUiSfx("uiToggleOff", { force: true });
      }

      await patchSettings({ soundEnabled: enabled });

      if (enabled) {
        playUiSfx("uiToggleOn", { force: true });
      }
    });

    on("hoverEnabledToggle", "change", async (event) => {
      const enabled = Boolean(event.target.checked);
      playUiSfx(enabled ? "uiToggleOn" : "uiToggleOff");
      await patchSettings({ hoverEnabled: enabled });
    });

    on("reminderSoundsToggle", "change", async (event) => {
      const enabled = Boolean(event.target.checked);
      playUiSfx(enabled ? "uiToggleOn" : "uiToggleOff");
      await patchSettings({ reminderSoundsEnabled: enabled });
    });

    on("masterVolumeRange", "input", (event) => {
      const value = Number(event.target.value || 0);
      $("masterVolumeValue").textContent = Math.round(value) + "%";
      debouncedPatch({ masterVolume: value / 100 });
    });

    on("soundTestPing", "click", async () => {
      await HA?.initAudioUnlock?.();
      playUiSfx("uiTest", { force: true });
      setInlineStatus("STATUS: SFX TEST PING");
    });

    on("unlockPremium", "click", async () => {
      playUiSfx("uiClick");
      await openSubscribeFlow();
    });

    on("activateLicenseInline", "click", async () => {
      const licenseKey = currentInlineLicenseKey();
      if (!licenseKey) {
        setInlineStatus("STATUS: LICENSE KEY REQUIRED");
        playUiSfx("uiError", { force: true });
        return;
      }

      const response = await send({
        type: "holmeta-activate-license",
        licenseKey
      });

      if (!response?.ok) {
        setInlineStatus(`STATUS: LICENSE INVALID (${String(response?.error || "UNKNOWN")})`);
        playUiSfx("uiError", { force: true });
        return;
      }

      state.inlineDraft.licenseKey = licenseKey;
      state.inlineDraft.dirtyLicense = false;
      await persistUiStatePatch({
        licenseKeyDraft: licenseKey
      });
      setInlineStatus("STATUS: LICENSE ACTIVATED");
      playUiSfx("uiSuccess", { force: true });
      await refreshState();
    });

    on("clearLicenseInline", "click", async () => {
      const response = await send({ type: "holmeta-clear-license" });
      if (!response?.ok) {
        setInlineStatus("STATUS: CLEAR LICENSE FAILED");
        playUiSfx("uiError", { force: true });
        return;
      }

      state.inlineDraft.licenseKey = "";
      state.inlineDraft.dirtyLicense = false;
      await persistUiStatePatch({
        licenseKeyDraft: ""
      });
      setInlineStatus("STATUS: LICENSE CLEARED");
      playUiSfx("uiSuccess", { force: true });
      await refreshState();
    });

    on("refreshEntitlement", "click", async () => {
      playUiSfx("uiClick");
      await send({ type: "holmeta-refresh-entitlement" });
      await refreshState();
      playUiSfx("uiSuccess");
    });

    on("openLicensePageInline", "click", async () => {
      playUiSfx("uiClick");
      await openLicensePageFlow();
    });

    on("openCancelPortalInline", "click", async () => {
      playUiSfx("uiClick");
      await openCancelPortalFlow();
    });

    on("openRefundHelpInline", "click", async () => {
      playUiSfx("uiClick");
      await openRefundHelpFlow();
    });

    on("openHud", "click", async () => {
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

    on("closeHud", "click", async () => {
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

    on("openDashboard", "click", async () => {
      playUiSfx("uiClick");
      await openDashboardFlow();
    });

    on("openOptions", "click", () => {
      playUiSfx("uiClick");
      chrome.runtime.openOptionsPage();
    });
  }

  async function bootstrap() {
    await loadUiState();
    state.inlineDraft.licenseKey = String(state.uiState.licenseKeyDraft || "").trim().toUpperCase();
    state.inlineDraft.checkoutSessionId = String(state.uiState.checkoutSessionDraft || "").trim();
    state.inlineDraft.domainsCsv = String(state.uiState.domainsDraft || "").trim();
    state.inlineDraft.notes = String(state.uiState.notes || "");
    state.inlineDraft.dirtyLicense = false;
    state.inlineDraft.dirtyCheckoutSession = false;
    state.inlineDraft.dirtyDomains = false;
    state.inlineDraft.dirtyNotes = false;

    installAudioUnlock();
    bindEvents();
    try {
      await refreshState();
    } catch (error) {
      setInlineStatus("STATUS: INIT ERROR");
      console.error("holmeta popup bootstrap failed", error);
    }

    setInterval(() => {
      renderLiveCountersOnly();
    }, 1000);

    setInterval(() => {
      refreshState().catch(() => {});
    }, 30 * 1000);
  }

  bootstrap();
})();
