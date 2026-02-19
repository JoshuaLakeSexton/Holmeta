(() => {
  const HC = globalThis.HolmetaCommon;
  const HA = globalThis.HolmetaAudio;

  const REMINDER_ORDER = ["eye", "movement", "posture", "hydration", "breathwork", "dailyAudit"];

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
    auth: { paired: false, pairedAt: null },
    trends: { dailyLogs: [], hydration: {}, calm: {} },
    auditPhotoDataUrl: "",
    selectedLog: {
      energy: 3,
      mood: 3,
      sleepQuality: 3
    },
    cameraStream: null,
    postureTimer: null,
    faceDetector: null,
    filterPayload: null
  };

  const $ = (id) => document.getElementById(id);

  function debounce(fn, wait = 180) {
    let timer = null;
    return (...args) => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => fn(...args), wait);
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

  function getActiveTabContext() {
    return new Promise((resolve) => {
      if (!chrome.tabs?.query) {
        resolve({ ok: false, error: "TABS_API_UNAVAILABLE" });
        return;
      }

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

  function isPremium() {
    return Boolean(state.settings.devBypassPremium || state.entitlement.active);
  }

  function hasFeature(feature) {
    if (state.settings.devBypassPremium || state.entitlement.active) {
      if (!state.entitlement.features) return true;
      return Boolean(state.entitlement.features[feature] ?? true);
    }
    return false;
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

  function setStatus(text) {
    $("statusLine").textContent = text;
  }

  function setAccountStatus(text, tone = "info") {
    const line = $("accountStatus");
    if (!line) {
      return;
    }

    line.textContent = String(text || "").startsWith("STATUS:") ? String(text) : "STATUS: " + String(text || "");

    if (tone === "error") {
      line.className = "meta-line status-error";
      return;
    }

    if (tone === "success") {
      line.className = "meta-line status-ok";
      return;
    }

    line.className = "meta-line";
  }

  function currentSfxVolume(scale = 1) {
    return HC.clamp(Number(state.settings.masterVolume || 0.35) * Number(scale || 1), 0, 1);
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

    const key = options.key || HC.resolveSfxKeyForEvent(state.settings, eventId);
    if (!key) {
      return;
    }

    const volume = HC.clamp(Number(options.volume ?? currentSfxVolume(options.scale || 1)), 0, 1);
    if (volume <= 0) {
      return;
    }

    HA.playSfx(key, { volume });
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

  function accountSettingsDraft() {
    const apiBaseInput = $("apiBaseUrl");
    const dashboardInput = $("dashboardUrl");

    return {
      ...state.settings,
      apiBaseUrl: apiBaseInput ? String(apiBaseInput.value || "").trim() : state.settings.apiBaseUrl || "",
      dashboardUrl: dashboardInput ? String(dashboardInput.value || "").trim() : state.settings.dashboardUrl || ""
    };
  }

  function updateDashboardHint() {
    const hint = $("dashboardHint");
    if (!hint) {
      return;
    }

    const dashboardRaw = $("dashboardUrl")?.value?.trim?.() || "";
    const resolved = HC.resolveDashboardUrl(accountSettingsDraft(), dashboardRaw);

    if (resolved.ok) {
      hint.textContent = resolved.source === "derived"
        ? "Default target: " + resolved.url
        : "Override target: " + resolved.url;
      hint.className = "field-help";
      return;
    }

    if (resolved.error === "INVALID_URL") {
      hint.textContent = "Dashboard override invalid. Use a full http(s) URL.";
      hint.className = "field-help status-error";
      return;
    }

    hint.textContent = "Default requires API BASE URL. Derived target is API_BASE + /dashboard.";
    hint.className = "field-help";
  }

  function validateUrlField(value, label, allowEmpty = true) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      return allowEmpty
        ? { ok: true, value: "" }
        : { ok: false, error: label + " REQUIRED" };
    }

    const normalized = HC.normalizeHttpUrl(trimmed);
    if (!normalized) {
      return { ok: false, error: label + " INVALID URL" };
    }

    return { ok: true, value: normalized };
  }

  function validateAccountUrls() {
    const apiBase = validateUrlField($("apiBaseUrl").value, "API BASE URL");
    if (!apiBase.ok) return apiBase;

    const entitlement = validateUrlField($("entitlementUrl").value, "ENTITLEMENT URL");
    if (!entitlement.ok) return entitlement;

    const pairingExchange = validateUrlField($("pairingExchangeUrl").value, "PAIRING EXCHANGE URL");
    if (!pairingExchange.ok) return pairingExchange;

    const checkout = validateUrlField($("checkoutUrl").value, "CHECKOUT URL");
    if (!checkout.ok) return checkout;

    const dashboard = validateUrlField($("dashboardUrl").value, "DASHBOARD URL");
    if (!dashboard.ok) return dashboard;

    return {
      ok: true,
      values: {
        apiBaseUrl: apiBase.value,
        entitlementUrl: entitlement.value,
        pairingExchangeUrl: pairingExchange.value,
        checkoutUrl: checkout.value,
        dashboardUrl: dashboard.value
      }
    };
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

  async function openDashboardFromAccount() {
    const dashboardRaw = $("dashboardUrl").value.trim();
    const resolved = HC.resolveDashboardUrl(accountSettingsDraft(), dashboardRaw);
    updateDashboardHint();

    if (!resolved.ok) {
      setAccountStatus("DASHBOARD URL INVALID", "error");
      setStatus("STATUS: DASHBOARD URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: resolved.error || "INVALID_URL" };
    }

    const opened = await HC.openExternal(resolved.url);
    if (!opened.ok) {
      setAccountStatus("DASHBOARD OPEN FAILED (" + (opened.message || opened.error || "UNKNOWN") + ")", "error");
      setStatus("STATUS: DASHBOARD OPEN FAILED");
      playUiSfx("uiError", { force: true });
      return opened;
    }

    setAccountStatus("DASHBOARD OPENED (" + String(resolved.source || "derived").toUpperCase() + ")", "success");
    setStatus("STATUS: DASHBOARD OPENED");
    playUiSfx("uiSuccess", { force: true });
    return { ok: true };
  }

  async function openSubscribeFromAccount() {
    const dashboardRaw = $("dashboardUrl").value.trim();
    const resolved = HC.resolveDashboardUrl(accountSettingsDraft(), dashboardRaw);
    updateDashboardHint();

    if (!resolved.ok) {
      setAccountStatus("DASHBOARD URL INVALID", "error");
      setStatus("STATUS: DASHBOARD URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: resolved.error || "INVALID_URL" };
    }

    let subscribeUrl = "";
    try {
      const parsed = new URL(resolved.url);
      const basePath = String(parsed.pathname || "").replace(/\/+$/, "");
      parsed.pathname = (basePath + "/subscribe").replace(/\/{2,}/g, "/");
      parsed.search = "";
      parsed.hash = "";
      subscribeUrl = parsed.toString();
    } catch (_) {
      setAccountStatus("SUBSCRIBE URL INVALID", "error");
      setStatus("STATUS: SUBSCRIBE URL INVALID");
      playUiSfx("uiError", { force: true });
      return { ok: false, error: "INVALID_SUBSCRIBE_URL" };
    }

    const opened = await createTab(subscribeUrl);
    if (!opened.ok) {
      setAccountStatus("SUBSCRIBE OPEN FAILED (" + (opened.message || opened.error || "UNKNOWN") + ")", "error");
      setStatus("STATUS: SUBSCRIBE OPEN FAILED");
      playUiSfx("uiError", { force: true });
      return opened;
    }

    setAccountStatus("SUBSCRIBE PAGE OPENED", "success");
    setStatus("STATUS: SUBSCRIBE PAGE OPENED");
    playUiSfx("uiSuccess", { force: true });
    return opened;
  }

  function setRangeValue(rangeId, valueId, percent) {
    $(rangeId).value = String(percent);
    $(valueId).textContent = `${Math.round(percent)}%`;
  }

  function parseWindowsText(value) {
    const lines = String(value || "")
      .split(/\n|,/) 
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = [];
    lines.forEach((line) => {
      const match = line.match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
      if (!match) {
        return;
      }
      parsed.push({
        start: `${match[1]}:${match[2]}`,
        end: `${match[3]}:${match[4]}`
      });
    });

    return parsed;
  }

  function windowsToText(windows) {
    const safe = Array.isArray(windows) ? windows : [];
    return safe.map((item) => `${item.start}-${item.end}`).join("\n");
  }

  function parseSnoozeList(value, fallback) {
    const parsed = String(value || "")
      .split(/,|\n/) 
      .map((part) => Number(part.trim()))
      .filter((num) => Number.isFinite(num) && num > 0)
      .map((num) => Math.round(HC.clamp(num, 1, 180)));

    return parsed.length ? parsed : fallback;
  }

  function styleForStatus() {
    if (state.runtime.focusSession) return "FOCUS";
    if (state.settings.cadence.global.meetingModeManual) return "MEETING";
    if (Number(state.settings.cadence.global.panicUntilTs || 0) > Date.now()) return "PANIC";
    if (!state.settings.filterEnabled || state.settings.colorAccurate) return "IDLE";
    return "ACTIVE";
  }

  function bindRatingRows() {
    document.querySelectorAll(".rating-row").forEach((row) => {
      const metric = row.dataset.metric;
      row.innerHTML = "";

      for (let value = 1; value <= 5; value += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(value);
        button.dataset.value = String(value);
        if (value === state.selectedLog[metric]) {
          button.classList.add("active");
        }
        button.addEventListener("click", () => {
          state.selectedLog[metric] = value;
          row.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
          button.classList.add("active");
        });
        row.appendChild(button);
      }
    });
  }

  function renderReminderCard(reminderType, config) {
    const premiumLocked = !isPremium();
    const modeLocked = premiumLocked && !hasFeature("advancedCadence");
    const windowsValue = windowsToText(config.schedule.windows || []);

    const modeOptions = [
      { id: "interval", label: "Interval" },
      { id: "workBlocks", label: "Work Blocks" },
      { id: "timeWindows", label: "Time Windows" }
    ]
      .map((option) => {
        const disabled = premiumLocked && option.id !== "interval";
        return `<option value="${option.id}" ${config.schedule.mode === option.id ? "selected" : ""} ${disabled ? "disabled" : ""}>${option.label}</option>`;
      })
      .join("");

    const customFields = {
      eye: `
        <div>
          <label for="cad-${reminderType}-exerciseDuration">EXERCISE SEC</label>
          <input id="cad-${reminderType}-exerciseDuration" type="number" min="10" max="120" value="${config.exerciseDurationSec || 20}" />
        </div>
        <div>
          <label for="cad-${reminderType}-exerciseSet">EXERCISE SET</label>
          <select id="cad-${reminderType}-exerciseSet">
            <option value="classic" ${config.exerciseSet === "classic" ? "selected" : ""}>Classic 20-20-20</option>
            <option value="palming" ${config.exerciseSet === "palming" ? "selected" : ""}>Palming</option>
            <option value="blink-reset" ${config.exerciseSet === "blink-reset" ? "selected" : ""}>Blink Reset</option>
            <option value="focus-shift" ${config.exerciseSet === "focus-shift" ? "selected" : ""}>Focus Shift</option>
            <option value="mixed" ${config.exerciseSet === "mixed" ? "selected" : ""}>Mixed</option>
          </select>
        </div>
      `,
      movement: `
        <div>
          <label for="cad-${reminderType}-promptType">PROMPT TYPE</label>
          <select id="cad-${reminderType}-promptType">
            <option value="stand" ${config.promptType === "stand" ? "selected" : ""}>Stand</option>
            <option value="walk" ${config.promptType === "walk" ? "selected" : ""}>Walk</option>
            <option value="mixed" ${config.promptType === "mixed" ? "selected" : ""}>Mixed</option>
          </select>
        </div>
        <div class="small-toggle">
          <input id="cad-${reminderType}-suggestionRotation" type="checkbox" ${config.suggestionRotation ? "checked" : ""} />
          <label for="cad-${reminderType}-suggestionRotation">ROTATE SUGGESTIONS</label>
        </div>
      `,
      posture: `
        <div>
          <label for="cad-${reminderType}-stillnessMinutes">STILLNESS THRESHOLD (MIN)</label>
          <input id="cad-${reminderType}-stillnessMinutes" type="number" min="10" max="240" value="${config.stillnessMinutes || 50}" />
        </div>
        <div>
          <label for="cad-${reminderType}-slouchSensitivity">SLOUCH SENSITIVITY (0.1-1)</label>
          <input id="cad-${reminderType}-slouchSensitivity" type="number" min="0.1" max="1" step="0.05" value="${config.slouchSensitivity || 0.45}" />
        </div>
      `,
      hydration: `
        <div>
          <label for="cad-${reminderType}-dailyGoal">DAILY GOAL (GLASSES)</label>
          <input id="cad-${reminderType}-dailyGoal" type="number" min="1" max="24" value="${config.dailyGoalGlasses || 8}" />
        </div>
        <div class="small-toggle">
          <input id="cad-${reminderType}-quietOverride" type="checkbox" ${config.quietHoursOverride ? "checked" : ""} />
          <label for="cad-${reminderType}-quietOverride">IGNORE QUIET HOURS</label>
        </div>
      `,
      breathwork: `
        <div class="full">
          <label for="cad-${reminderType}-presets">ON-DEMAND PRESETS (CSV)</label>
          <input id="cad-${reminderType}-presets" type="text" value="${(config.onDemandPresets || ["box", "478", "sigh"]).join(",")}" />
        </div>
      `,
      dailyAudit: `
        <div>
          <label for="cad-${reminderType}-nudgeTime">NUDGE TIME</label>
          <input id="cad-${reminderType}-nudgeTime" type="time" value="${config.nudgeTime || "18:00"}" />
        </div>
        <div>
          <label for="cad-${reminderType}-fallback">MISSED-DAY FALLBACK</label>
          <select id="cad-${reminderType}-fallback">
            <option value="nextMorning" ${config.missedDayFallback === "nextMorning" ? "selected" : ""}>Next Morning</option>
            <option value="nextWorkWindow" ${config.missedDayFallback === "nextWorkWindow" ? "selected" : ""}>Next Work Window</option>
            <option value="skip" ${config.missedDayFallback === "skip" ? "selected" : ""}>Skip</option>
          </select>
        </div>
      `
    };

    return `
      <article class="cadence-card" data-reminder="${reminderType}">
        <h3>${(HC.REMINDER_LABELS[reminderType] || reminderType).toUpperCase()}</h3>
        <div class="mini-grid">
          <div class="small-toggle full">
            <input id="cad-${reminderType}-enabled" type="checkbox" ${config.enabled ? "checked" : ""} />
            <label for="cad-${reminderType}-enabled">ENABLED</label>
          </div>

          <div>
            <label for="cad-${reminderType}-mode">MODE</label>
            <select id="cad-${reminderType}-mode" ${modeLocked ? "disabled" : ""}>${modeOptions}</select>
          </div>

          <div>
            <label for="cad-${reminderType}-interval">INTERVAL MIN</label>
            <input id="cad-${reminderType}-interval" type="number" min="5" max="360" value="${config.schedule.intervalMin}" />
          </div>

          <div>
            <label for="cad-${reminderType}-jitter">JITTER (0-3)</label>
            <input id="cad-${reminderType}-jitter" type="number" min="0" max="3" value="${config.schedule.jitterMin}" />
          </div>

          <div>
            <label for="cad-${reminderType}-work">WORK MIN</label>
            <input id="cad-${reminderType}-work" type="number" min="15" max="120" value="${config.schedule.workMin}" />
          </div>

          <div>
            <label for="cad-${reminderType}-break">BREAK MIN</label>
            <input id="cad-${reminderType}-break" type="number" min="5" max="60" value="${config.schedule.breakMin}" />
          </div>

          <div>
            <label for="cad-${reminderType}-anchor">ANCHOR TIME</label>
            <input id="cad-${reminderType}-anchor" type="time" value="${config.schedule.anchorTime}" />
          </div>

          <div class="full">
            <label for="cad-${reminderType}-windows">TIME WINDOWS (HH:MM-HH:MM)</label>
            <textarea id="cad-${reminderType}-windows" rows="2">${windowsValue}</textarea>
          </div>

          <div class="small-toggle">
            <input id="cad-${reminderType}-overlay" type="checkbox" ${config.delivery.overlay ? "checked" : ""} />
            <label for="cad-${reminderType}-overlay">OVERLAY</label>
          </div>
          <div class="small-toggle">
            <input id="cad-${reminderType}-notification" type="checkbox" ${config.delivery.notification ? "checked" : ""} />
            <label for="cad-${reminderType}-notification">NOTIFICATION</label>
          </div>
          <div class="small-toggle">
            <input id="cad-${reminderType}-popupOnly" type="checkbox" ${config.delivery.popupOnly ? "checked" : ""} />
            <label for="cad-${reminderType}-popupOnly">POPUP-ONLY</label>
          </div>
          <div class="small-toggle">
            <input id="cad-${reminderType}-gentle" type="checkbox" ${config.delivery.gentle ? "checked" : ""} />
            <label for="cad-${reminderType}-gentle">GENTLE MODE</label>
          </div>
          <div class="small-toggle">
            <input id="cad-${reminderType}-sound" type="checkbox" ${config.delivery.sound ? "checked" : ""} />
            <label for="cad-${reminderType}-sound">SOUND CUE</label>
          </div>
          <div>
            <label for="cad-${reminderType}-volume">SOUND VOL (0-1)</label>
            <input id="cad-${reminderType}-volume" type="number" min="0" max="1" step="0.05" value="${config.delivery.soundVolume}" />
          </div>

          <div class="full">
            <label for="cad-${reminderType}-snoozeList">SNOOZE OPTIONS (CSV)</label>
            <input id="cad-${reminderType}-snoozeList" type="text" value="${(config.snoozeMinutes || []).join(",")}" />
          </div>

          <div>
            <label for="cad-${reminderType}-snoozeCustom">CUSTOM SNOOZE (MIN)</label>
            <input id="cad-${reminderType}-snoozeCustom" type="number" min="1" max="180" value="${config.snoozeCustomMin || 15}" />
          </div>
          <div>
            <label for="cad-${reminderType}-escalateAfter">ESCALATE AFTER IGNORES</label>
            <input id="cad-${reminderType}-escalateAfter" type="number" min="1" max="10" value="${config.escalateAfterIgnores || 3}" />
          </div>
          <div class="small-toggle full">
            <input id="cad-${reminderType}-escalate" type="checkbox" ${config.escalateIfIgnored ? "checked" : ""} />
            <label for="cad-${reminderType}-escalate">ESCALATE IF IGNORED</label>
          </div>

          ${customFields[reminderType] || ""}
        </div>

        <div class="card-actions">
          <button type="button" data-test-reminder="${reminderType}">TEST REMINDER</button>
        </div>
      </article>
    `;
  }

  function renderCadenceCards() {
    const cards = $("cadenceCards");
    cards.innerHTML = REMINDER_ORDER
      .map((type) => renderReminderCard(type, state.settings.cadence.reminders[type]))
      .join("");
  }

  function collectPerEventMappingFromForm() {
    const mapping = {};
    HC.SFX_EVENT_OPTIONS.forEach((eventDef) => {
      const select = $("sfx-map-" + eventDef.id);
      mapping[eventDef.id] = select?.value || HC.DEFAULT_SFX_EVENT_MAPPING[eventDef.id];
    });
    return mapping;
  }

  function renderSoundMappings() {
    const host = $("soundMappings");
    if (!host) {
      return;
    }

    const optionsHtml = HC.SFX_SOUND_OPTIONS
      .map((sound) => '<option value="' + sound.key + '">' + sound.label + '</option>')
      .join("");

    host.innerHTML = HC.SFX_EVENT_OPTIONS
      .map((eventDef) => {
        return '<div class="sound-row" data-event-id="' + eventDef.id + '">' +
          '<label class="meta-label" for="sfx-map-' + eventDef.id + '">' + String(eventDef.label || eventDef.id).toUpperCase() + '</label>' +
          '<select id="sfx-map-' + eventDef.id + '">' + optionsHtml + '</select>' +
          '<button type="button" data-sfx-test="' + eventDef.id + '">TEST</button>' +
          '</div>';
      })
      .join("");

    HC.SFX_EVENT_OPTIONS.forEach((eventDef) => {
      const select = $("sfx-map-" + eventDef.id);
      if (!select) {
        return;
      }
      const selected = state.settings.perEventMapping?.[eventDef.id] || HC.DEFAULT_SFX_EVENT_MAPPING[eventDef.id];
      select.value = HC.SFX_SOUND_KEYS.includes(selected) ? selected : HC.DEFAULT_SFX_EVENT_MAPPING[eventDef.id];
    });
  }

  function applyPremiumPresetLocks() {
    const select = $("filterPreset");
    if (!select) {
      return;
    }

    const freePresetIds = Array.isArray(HC.FREE_FILTER_PRESET_IDS) && HC.FREE_FILTER_PRESET_IDS.length
      ? HC.FREE_FILTER_PRESET_IDS
      : ["blueShieldMild", "nightWarmMild", "contrastGuard"];

    const premium = isPremium();
    [...select.options].forEach((option) => {
      const allowed = premium || freePresetIds.includes(option.value);
      option.disabled = !allowed;
    });

    if (!premium && !freePresetIds.includes(select.value)) {
      const fallback = freePresetIds.find((id) => [...select.options].some((opt) => opt.value === id && !opt.disabled));
      if (fallback) {
        select.value = fallback;
      }
    }
  }

  function applyStateToForm() {
    $("filterPreset").value = state.settings.filterPreset;
    setRangeValue("filterIntensity", "filterIntensityValue", Number(state.settings.filterIntensity) * 100);
    setRangeValue("overlayStrength", "overlayStrengthValue", Number(state.settings.overlayStrength) * 100);
    setRangeValue("filterDimming", "filterDimmingValue", Number(state.settings.filterDimming) * 100);
    setRangeValue("filterContrast", "filterContrastValue", Number(state.settings.filterContrast) * 100);
    setRangeValue("filterSaturation", "filterSaturationValue", Number(state.settings.filterSaturation) * 100);
    setRangeValue("filterGamma", "filterGammaValue", Number(state.settings.filterGamma) * 100);

    $("overlayColorPreset").value = state.settings.overlayColorPreset;
    $("overlayBlendMode").value = state.settings.overlayBlendMode;
    $("overlayCustomR").value = String(state.settings.overlayCustomColor.r);
    $("overlayCustomG").value = String(state.settings.overlayCustomColor.g);
    $("overlayCustomB").value = String(state.settings.overlayCustomColor.b);

    const customVisible = state.settings.overlayColorPreset === "custom";
    $("overlayCustomGrid").style.display = customVisible ? "grid" : "none";
    $("overlayCustomLabel").style.display = customVisible ? "block" : "none";

    $("filterEnabled").checked = Boolean(state.settings.filterEnabled);
    $("colorAccurate").checked = Boolean(state.settings.colorAccurate);
    $("showHud").checked = Boolean(state.settings.ui?.showHud);
    $("applyToMedia").checked = Boolean(state.settings.applyToMedia);
    $("excludeMedia").checked = Boolean(state.settings.excludeMedia);
    $("excludeMedia").disabled = Boolean(state.settings.applyToMedia);
    $("designMode").checked = Boolean(state.settings.designMode);
    $("preserveLuminance").checked = Boolean(state.settings.preserveLuminance);

    $("debugPanel").checked = Boolean(state.settings.debugPanel);
    $("debugBlock").style.display = state.settings.debugPanel ? "grid" : "none";

    $("soundEnabled").checked = Boolean(state.settings.soundEnabled);
    $("hoverEnabled").checked = Boolean(state.settings.hoverEnabled);
    $("hoverEnabled").disabled = !state.settings.soundEnabled;
    $("reminderSoundsEnabled").checked = Boolean(state.settings.reminderSoundsEnabled);
    $("reminderSoundsEnabled").disabled = !state.settings.soundEnabled;
    setRangeValue("masterVolume", "masterVolumeValue", Number(state.settings.masterVolume || 0.35) * 100);
    $("soundStatus").textContent = state.settings.soundEnabled ? "STATUS: SOUND ACTIVE" : "STATUS: SOUND DISABLED";

    $("cadenceProfile").value = state.settings.cadence.activeProfile || "balanced";
    $("onboardingProfile").value = state.settings.cadence.activeProfile || "balanced";
    $("quietHoursStart").value = state.settings.cadence.global.quietHoursStart;
    $("quietHoursEnd").value = state.settings.cadence.global.quietHoursEnd;
    $("suppressDuringFocus").checked = Boolean(state.settings.cadence.global.suppressDuringFocus);
    $("suppressWhenIdle").checked = Boolean(state.settings.cadence.global.suppressWhenIdle);
    $("meetingModeManual").checked = Boolean(state.settings.cadence.global.meetingModeManual);
    $("meetingModeAuto").checked = Boolean(state.settings.cadence.global.meetingModeAuto);
    $("meetingDomains").value = (state.settings.cadence.global.meetingDomains || []).join(", ");

    $("apiBaseUrl").value = state.settings.apiBaseUrl || "";
    $("entitlementUrl").value = state.settings.entitlementUrl || "";
    $("pairingExchangeUrl").value = state.settings.pairingExchangeUrl || "";
    $("checkoutUrl").value = state.settings.checkoutUrl || "";
    $("dashboardUrl").value = state.settings.dashboardUrl || "";
    $("devBypassPremium").checked = Boolean(state.settings.devBypassPremium);

    $("webcamPostureOptIn").checked = Boolean(state.settings.webcamPostureOptIn);

    const hydrationToday = state.trends.hydration[HC.todayKey()] || 0;
    const calmToday = state.trends.calm[HC.todayKey()] || 0;
    $("hydrationStats").textContent = `HYDRATION: ${hydrationToday} / ${state.settings.cadence.reminders.hydration.dailyGoalGlasses}`;
    $("calmStats").textContent = `CALM MINUTES: ${calmToday}`;

    const premiumStatus = $("premiumStatus");
    const trialStatus = $("trialStatus");
    const premiumBanner = $("premiumBanner");
    const entitlementStatus = String(state.entitlement.status || "inactive").toLowerCase();
    const trialDays = daysRemaining(state.entitlement.trialEndsAt);

    if (state.settings.devBypassPremium) {
      premiumStatus.className = "status-chip status-active";
      premiumStatus.textContent = "STATUS: DEV BYPASS";
      if (trialStatus) {
        trialStatus.className = "status-chip status-idle";
        trialStatus.textContent = "STATUS: DEV MODE";
      }
      if (premiumBanner) {
        premiumBanner.hidden = true;
      }
    } else if (state.entitlement.active) {
      premiumStatus.className = "status-chip status-active";
      premiumStatus.textContent = entitlementStatus === "trialing"
        ? "STATUS: TRIAL ACTIVE"
        : "STATUS: PREMIUM ACTIVE";

      if (trialStatus) {
        if (entitlementStatus === "trialing") {
          trialStatus.className = "status-chip status-warning";
          trialStatus.textContent = trialDays === null ? "STATUS: TRIAL" : `STATUS: TRIAL ${Math.max(0, trialDays)}D LEFT`;
        } else if (state.entitlement.stale) {
          trialStatus.className = "status-chip status-warning";
          trialStatus.textContent = "STATUS: OFFLINE GRACE";
        } else {
          trialStatus.className = "status-chip status-active";
          trialStatus.textContent = "STATUS: PREMIUM";
        }
      }

      if (premiumBanner) {
        premiumBanner.hidden = true;
      }
    } else {
      premiumStatus.className = "status-chip status-locked";
      premiumStatus.textContent = "STATUS: LOCKED";

      const trialEnded = entitlementStatus === "trialing" && trialDays === 0;
      if (trialStatus) {
        trialStatus.className = trialEnded ? "status-chip status-locked" : "status-chip status-idle";
        trialStatus.textContent = trialEnded ? "STATUS: TRIAL ENDED" : "STATUS: FREE MODE";
      }

      if (premiumBanner) {
        premiumBanner.hidden = false;
        premiumBanner.classList.toggle("is-trial", trialEnded);
        premiumBanner.textContent = trialEnded
          ? "TRIAL ENDED - SUBSCRIBE TO CONTINUE PREMIUM CONTROLS."
          : "SUBSCRIBE TO UNLOCK PREMIUM CONTROLS.";
      }
    }

    $("pairingStatus").textContent = state.auth.paired
      ? `STATUS: PAIRED ${state.auth.pairedAt ? new Date(state.auth.pairedAt).toLocaleString() : ""}`
      : "STATUS: NOT PAIRED";

    updateDashboardHint();
    if (!$("accountStatus").textContent.trim()) {
      setAccountStatus("READY");
    }

    document.querySelectorAll("[data-premium]").forEach((el) => {
      el.disabled = !isPremium();
      if (!isPremium()) {
        el.title = "Premium required";
      } else {
        el.removeAttribute("title");
      }
    });

    applyPremiumPresetLocks();
    renderSoundMappings();
    renderCadenceCards();
  }

  function collectGlobalPatch() {
    return {
      filterPreset: $("filterPreset").value,
      filterIntensity: Number($("filterIntensity").value) / 100,
      overlayStrength: Number($("overlayStrength").value) / 100,
      filterDimming: Number($("filterDimming").value) / 100,
      filterContrast: Number($("filterContrast").value) / 100,
      filterSaturation: Number($("filterSaturation").value) / 100,
      filterGamma: Number($("filterGamma").value) / 100,
      overlayColorPreset: $("overlayColorPreset").value,
      overlayBlendMode: $("overlayBlendMode").value,
      overlayCustomColor: {
        r: Number($("overlayCustomR").value || 0),
        g: Number($("overlayCustomG").value || 0),
        b: Number($("overlayCustomB").value || 0)
      },
      filterEnabled: Boolean($("filterEnabled").checked),
      colorAccurate: Boolean($("colorAccurate").checked),
      ui: {
        showHud: Boolean($("showHud").checked)
      },
      applyToMedia: Boolean($("applyToMedia").checked),
      excludeMedia: Boolean($("excludeMedia").checked),
      designMode: Boolean($("designMode").checked),
      preserveLuminance: Boolean($("preserveLuminance").checked),
      debugPanel: Boolean($("debugPanel").checked),
      soundEnabled: Boolean($("soundEnabled").checked),
      masterVolume: Number($("masterVolume").value) / 100,
      hoverEnabled: Boolean($("hoverEnabled").checked),
      reminderSoundsEnabled: Boolean($("reminderSoundsEnabled").checked),
      perEventMapping: collectPerEventMappingFromForm(),
      webcamPostureOptIn: Boolean($("webcamPostureOptIn").checked),
      apiBaseUrl: $("apiBaseUrl").value.trim(),
      entitlementUrl: $("entitlementUrl").value.trim(),
      pairingExchangeUrl: $("pairingExchangeUrl").value.trim(),
      checkoutUrl: $("checkoutUrl").value.trim(),
      dashboardUrl: $("dashboardUrl").value.trim(),
      devBypassPremium: Boolean($("devBypassPremium").checked)
    };
  }

  function collectCadencePatch() {
    const cadence = JSON.parse(JSON.stringify(state.settings.cadence));

    cadence.activeProfile = $("cadenceProfile").value;
    cadence.global.quietHoursStart = $("quietHoursStart").value;
    cadence.global.quietHoursEnd = $("quietHoursEnd").value;
    cadence.global.suppressDuringFocus = Boolean($("suppressDuringFocus").checked);
    cadence.global.suppressWhenIdle = Boolean($("suppressWhenIdle").checked);
    cadence.global.meetingModeManual = Boolean($("meetingModeManual").checked);
    cadence.global.meetingModeAuto = Boolean($("meetingModeAuto").checked);
    cadence.global.meetingDomains = HC.parseDomainList($("meetingDomains").value);

    REMINDER_ORDER.forEach((type) => {
      const prefix = `cad-${type}`;
      const current = cadence.reminders[type];
      const windows = parseWindowsText($(prefix + "-windows").value);

      current.enabled = Boolean($(prefix + "-enabled").checked);
      current.schedule.mode = $(prefix + "-mode").value;
      current.schedule.intervalMin = Number($(prefix + "-interval").value || current.schedule.intervalMin);
      current.schedule.jitterMin = Number($(prefix + "-jitter").value || current.schedule.jitterMin);
      current.schedule.workMin = Number($(prefix + "-work").value || current.schedule.workMin);
      current.schedule.breakMin = Number($(prefix + "-break").value || current.schedule.breakMin);
      current.schedule.anchorTime = $(prefix + "-anchor").value || current.schedule.anchorTime;
      current.schedule.windows = windows.length ? windows : current.schedule.windows;

      current.delivery.overlay = Boolean($(prefix + "-overlay").checked);
      current.delivery.notification = Boolean($(prefix + "-notification").checked);
      current.delivery.popupOnly = Boolean($(prefix + "-popupOnly").checked);
      current.delivery.gentle = Boolean($(prefix + "-gentle").checked);
      current.delivery.sound = Boolean($(prefix + "-sound").checked);
      current.delivery.soundVolume = Number($(prefix + "-volume").value || current.delivery.soundVolume);

      current.snoozeMinutes = parseSnoozeList($(prefix + "-snoozeList").value, current.snoozeMinutes);
      current.snoozeCustomMin = Number($(prefix + "-snoozeCustom").value || current.snoozeCustomMin);
      current.escalateIfIgnored = Boolean($(prefix + "-escalate").checked);
      current.escalateAfterIgnores = Number($(prefix + "-escalateAfter").value || current.escalateAfterIgnores);

      if (type === "eye") {
        current.exerciseDurationSec = Number($(prefix + "-exerciseDuration").value || current.exerciseDurationSec);
        current.exerciseSet = $(prefix + "-exerciseSet").value;
      }

      if (type === "movement") {
        current.promptType = $(prefix + "-promptType").value;
        current.suggestionRotation = Boolean($(prefix + "-suggestionRotation").checked);
      }

      if (type === "posture") {
        current.stillnessMinutes = Number($(prefix + "-stillnessMinutes").value || current.stillnessMinutes);
        current.slouchSensitivity = Number($(prefix + "-slouchSensitivity").value || current.slouchSensitivity);
      }

      if (type === "hydration") {
        current.dailyGoalGlasses = Number($(prefix + "-dailyGoal").value || current.dailyGoalGlasses);
        current.quietHoursOverride = Boolean($(prefix + "-quietOverride").checked);
      }

      if (type === "breathwork") {
        current.onDemandPresets = HC.parseDomainList($(prefix + "-presets").value)
          .map((entry) => entry.toLowerCase())
          .filter((entry) => ["box", "478", "sigh"].includes(entry));
        if (!current.onDemandPresets.length) {
          current.onDemandPresets = ["box", "478", "sigh"];
        }
      }

      if (type === "dailyAudit") {
        current.nudgeTime = $(prefix + "-nudgeTime").value || current.nudgeTime;
        current.missedDayFallback = $(prefix + "-fallback").value;
      }
    });

    return cadence;
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

  async function saveAllSettings() {
    const urlValidation = validateAccountUrls();
    if (!urlValidation.ok) {
      setStatus(`STATUS: ${urlValidation.error}`);
      setAccountStatus(urlValidation.error || "INVALID URL", "error");
      updateDashboardHint();
      playUiSfx("uiError", { force: true });
      return;
    }

    const patch = collectGlobalPatch();
    patch.cadence = collectCadencePatch();
    Object.assign(patch, urlValidation.values || {});

    await patchSettings(patch);

    setAccountStatus("CONFIG SAVED", "success");
    setStatus(
      `STATUS: ${styleForStatus()} · CONFIG SAVED · ${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}`
    );
    playUiSfx("uiSuccess");
  }

  async function applyOnboarding() {
    const profile = $("onboardingProfile").value;
    const workStart = $("onboardingWorkStart").value || "09:00";
    const workEnd = $("onboardingWorkEnd").value || "17:30";
    const deliveryMode = $("onboardingDelivery").value;
    const designMode = Boolean($("onboardingDesignMode").checked);

    await send({ type: "holmeta-apply-cadence-preset", presetId: profile });
    await refreshState();

    const cadence = JSON.parse(JSON.stringify(state.settings.cadence));
    cadence.activeProfile = profile;

    REMINDER_ORDER.forEach((type) => {
      cadence.reminders[type].schedule.windows = [{ start: workStart, end: workEnd }];

      if (deliveryMode === "balanced") {
        cadence.reminders[type].delivery.overlay = true;
        cadence.reminders[type].delivery.notification = true;
        cadence.reminders[type].delivery.popupOnly = false;
        cadence.reminders[type].delivery.gentle = false;
      }

      if (deliveryMode === "gentle") {
        cadence.reminders[type].delivery.overlay = true;
        cadence.reminders[type].delivery.notification = false;
        cadence.reminders[type].delivery.popupOnly = false;
        cadence.reminders[type].delivery.gentle = true;
      }

      if (deliveryMode === "popup") {
        cadence.reminders[type].delivery.overlay = false;
        cadence.reminders[type].delivery.notification = false;
        cadence.reminders[type].delivery.popupOnly = true;
        cadence.reminders[type].delivery.gentle = true;
      }
    });

    await patchSettings({
      cadence,
      designMode,
      onboardingCompleted: true
    });

    const onboardingChip = $("onboardingStatus");
    onboardingChip.textContent = "STATUS: APPLIED";
    onboardingChip.className = "status-chip status-active";
    playUiSfx("uiSuccess");
  }

  async function updateDebugPanel() {
    const response = await send({
      type: "holmeta-get-filter-debug",
      domain: ""
    });

    if (!response.ok) {
      return;
    }

    state.filterPayload = response.filterPayload || null;

    const payload = state.filterPayload;
    if (!payload) {
      $("debugMode").textContent = "MODE: --";
      $("debugIntensity").textContent = "INTENSITY: --";
      $("debugOverlay").textContent = "OVERLAY: --";
      $("debugBlend").textContent = "BLEND: --";
      $("debugMedia").textContent = "MEDIA EXCLUDED: --";
      $("matrixReadout").value = "";
      return;
    }

    $("debugMode").textContent = `MODE: ${payload.presetLabel} (${payload.reason})`;
    $("debugIntensity").textContent = `INTENSITY: ${Math.round(Number(payload.effectiveIntensity) * 100)}%`;
    $("debugOverlay").textContent = `OVERLAY: ${payload.overlay?.rgba || "none"}`;
    $("debugBlend").textContent = `BLEND: ${(payload.overlay?.blendMode || "normal").toUpperCase()}`;
    $("debugMedia").textContent = `MEDIA EXCLUDED: ${payload.media?.excludeMedia ? "YES" : "NO"}`;
    $("matrixReadout").value = payload.matrixString || "";
  }

  async function refreshTimeline() {
    const response = await send({
      type: "holmeta-get-cadence-preview",
      start: $("timelineStart").value,
      end: $("timelineEnd").value
    });

    const target = $("timelinePreview");
    target.innerHTML = "";

    const timeline = response.timeline || [];
    if (!timeline.length) {
      target.innerHTML = `<p class="meta-line">No reminders scheduled in this window.</p>`;
      return;
    }

    timeline.slice(0, 40).forEach((event) => {
      const row = document.createElement("div");
      row.className = "timeline-row";
      row.innerHTML = `<strong>${new Date(event.at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}</strong><span>${event.label}</span>`;
      target.appendChild(row);
    });
  }

  function drawTrends() {
    const canvas = $("trendsCanvas");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#D9C5B2";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(20,17,15,0.22)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i += 1) {
      const y = 24 + (height - 50) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(44, y);
      ctx.lineTo(width - 18, y);
      ctx.stroke();
    }

    const logs = [...state.trends.dailyLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    if (!logs.length) {
      ctx.fillStyle = "#14110F";
      ctx.font = "14px ui-monospace";
      ctx.fillText("NO TREND DATA YET", 52, height / 2);
      return;
    }

    const xStart = 58;
    const xEnd = width - 30;
    const yTop = 26;
    const yBottom = height - 24;

    function xForIndex(index) {
      if (logs.length === 1) return (xStart + xEnd) / 2;
      return xStart + ((xEnd - xStart) * index) / (logs.length - 1);
    }

    function yForValue(value) {
      const normalized = (Number(value) - 1) / 4;
      return yBottom - normalized * (yBottom - yTop);
    }

    function drawSeries(key, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      logs.forEach((log, index) => {
        const x = xForIndex(index);
        const y = yForValue(log[key]);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
    }

    drawSeries("energy", "#C42021");
    drawSeries("mood", "#FFB300");
    drawSeries("sleepQuality", "#34312D");
  }

  function attachPhotoReader() {
    $("auditPhoto").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        state.auditPhotoDataUrl = "";
        $("auditPreview").style.display = "none";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        state.auditPhotoDataUrl = String(reader.result || "");
        if (state.auditPhotoDataUrl) {
          $("auditPreview").src = state.auditPhotoDataUrl;
          $("auditPreview").style.display = "block";
        }
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadAudit() {
    const response = await send({ type: "holmeta-get-audit" });
    const audit = response.audit;
    if (!audit) {
      return;
    }

    $("monitorHeight").value = audit.monitorHeight || "aligned";
    $("monitorDistance").value = audit.monitorDistance || "arm";
    $("chairSupport").value = audit.chairSupport || "good";
    $("wristNeutral").value = audit.wristNeutral || "neutral";
    $("lighting").value = audit.lighting || "balanced";

    if (audit.photoDataUrl) {
      state.auditPhotoDataUrl = audit.photoDataUrl;
      $("auditPreview").src = audit.photoDataUrl;
      $("auditPreview").style.display = "block";
    }
  }

  async function saveAudit() {
    const payload = {
      savedAt: new Date().toISOString(),
      monitorHeight: $("monitorHeight").value,
      monitorDistance: $("monitorDistance").value,
      chairSupport: $("chairSupport").value,
      wristNeutral: $("wristNeutral").value,
      lighting: $("lighting").value,
      photoDataUrl: state.auditPhotoDataUrl || ""
    };

    await send({ type: "holmeta-save-audit", payload });
    const auditChip = $("auditStatus");
    auditChip.textContent = `STATUS: SAVED ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    auditChip.className = "status-chip status-active";
  }

  async function requestVideoPermission() {
    return new Promise((resolve) => {
      chrome.permissions.request({ permissions: ["videoCapture"] }, (granted) => {
        resolve(Boolean(granted));
      });
    });
  }

  function stopPostureMonitor() {
    if (state.postureTimer) {
      clearInterval(state.postureTimer);
      state.postureTimer = null;
    }

    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((track) => track.stop());
      state.cameraStream = null;
    }

    const video = $("postureVideo");
    video.srcObject = null;
    video.style.display = "none";
    $("postureStatus").textContent = "STATUS: IDLE";
  }

  async function startPostureMonitor() {
    if (!isPremium()) {
      $("postureStatus").textContent = "STATUS: LOCKED";
      return;
    }

    const optIn = Boolean($("webcamPostureOptIn").checked);
    if (!optIn) {
      $("postureStatus").textContent = "STATUS: ENABLE WEBCAM TO START";
      return;
    }

    const granted = await requestVideoPermission();
    if (!granted) {
      $("postureStatus").textContent = "STATUS: CAMERA PERMISSION DENIED";
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 360
        },
        audio: false
      });

      state.cameraStream = stream;
      const video = $("postureVideo");
      video.srcObject = stream;
      video.style.display = "block";
      await video.play();

      if ("FaceDetector" in window) {
        state.faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        $("postureStatus").textContent = "STATUS: FACE DETECTOR ACTIVE";

        state.postureTimer = setInterval(async () => {
          if (!state.faceDetector) return;
          try {
            const faces = await state.faceDetector.detect(video);
            if (!faces.length) {
              $("postureStatus").textContent = "STATUS: FACE LOST - RESET POSTURE";
              return;
            }

            const box = faces[0].boundingBox;
            const centerY = box.y + box.height / 2;
            const frameCenter = video.videoHeight / 2;
            const offset = Math.abs(centerY - frameCenter) / Math.max(1, frameCenter);
            if (offset > 0.18) {
              $("postureStatus").textContent = "STATUS: ADJUST MONITOR / CHAIR HEIGHT";
            } else {
              $("postureStatus").textContent = "STATUS: POSTURE STABLE";
            }
          } catch (_) {
            $("postureStatus").textContent = "STATUS: FACE DETECTION ERROR";
          }
        }, 4000);
      } else {
        $("postureStatus").textContent = "STATUS: FALLBACK MODE (MANUAL PROMPTS)";
        state.postureTimer = setInterval(() => {
          const prompts = [
            "CHECK SHOULDER TENSION",
            "ROLL SHOULDERS + RESET CHIN",
            "STAND FOR 60 SECONDS"
          ];
          const idx = Math.floor(Math.random() * prompts.length);
          $("postureStatus").textContent = `STATUS: ${prompts[idx]}`;
        }, 45000);
      }
    } catch (_) {
      $("postureStatus").textContent = "STATUS: CAMERA INIT FAILED";
    }
  }

  async function refreshState() {
    const [stateResponse, trendsResponse] = await Promise.all([
      send({ type: "holmeta-request-state", domain: "" }),
      send({ type: "holmeta-get-trends" })
    ]);

    if (stateResponse.settings) state.settings = HC.normalizeSettings(stateResponse.settings);
    if (stateResponse.runtime) state.runtime = HC.normalizeRuntime(stateResponse.runtime);
    if (stateResponse.entitlement) state.entitlement = normalizeEntitlement(stateResponse.entitlement);
    if (stateResponse.auth) state.auth = stateResponse.auth;

    state.trends.dailyLogs = trendsResponse.dailyLogs || [];
    state.trends.hydration = trendsResponse.hydration || {};
    state.trends.calm = trendsResponse.calm || {};

    applyStateToForm();
    drawTrends();
    await updateDebugPanel();
    await refreshTimeline();

    setStatus(`STATUS: ${styleForStatus()} · LOCAL TIME: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  }

  function bindEvents() {
    const autoPatchFilter = debounce((patch) => {
      patchSettings(patch);
    }, 160);

    const autoPatchSound = debounce((patch) => {
      patchSettings(patch);
    }, 120);

    bindPrimaryHoverSfx();

    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");
      if (!button) {
        return;
      }
      if (button.dataset.sfxTest || button.id === "soundTestPing") {
        return;
      }
      playUiSfx("uiClick");
    }, { capture: true });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      if (target.type !== "checkbox" || target.id === "soundEnabled") {
        return;
      }
      playUiSfx(target.checked ? "uiToggleOn" : "uiToggleOff");
    }, { capture: true });

    [
      ["filterIntensity", "filterIntensityValue", (value) => ({ filterIntensity: value / 100 })],
      ["overlayStrength", "overlayStrengthValue", (value) => ({ overlayStrength: value / 100 })],
      ["filterDimming", "filterDimmingValue", (value) => ({ filterDimming: value / 100 })],
      ["filterContrast", "filterContrastValue", (value) => ({ filterContrast: value / 100 })],
      ["filterSaturation", "filterSaturationValue", (value) => ({ filterSaturation: value / 100 })],
      ["filterGamma", "filterGammaValue", (value) => ({ filterGamma: value / 100 })]
    ].forEach(([id, labelId, toPatch]) => {
      $(id).addEventListener("input", (event) => {
        const value = Number(event.target.value || 0);
        $(labelId).textContent = `${Math.round(value)}%`;
        autoPatchFilter(toPatch(value));
      });
    });

    $("soundEnabled").addEventListener("change", async (event) => {
      const enabled = Boolean(event.target.checked);
      if (!enabled) {
        playUiSfx("uiToggleOff", { force: true });
      }
      await patchSettings({ soundEnabled: enabled });
      if (enabled) {
        playUiSfx("uiToggleOn", { force: true });
      }
    });

    $("hoverEnabled").addEventListener("change", (event) => {
      autoPatchSound({ hoverEnabled: Boolean(event.target.checked) });
    });

    $("reminderSoundsEnabled").addEventListener("change", (event) => {
      autoPatchSound({ reminderSoundsEnabled: Boolean(event.target.checked) });
    });

    $("masterVolume").addEventListener("input", (event) => {
      const value = Number(event.target.value || 0);
      $("masterVolumeValue").textContent = Math.round(value) + "%";
      autoPatchSound({ masterVolume: value / 100 });
    });

    $("soundTestPing").addEventListener("click", async () => {
      await HA?.initAudioUnlock?.();
      playUiSfx("uiTest", { force: true });
      $("soundStatus").textContent = "STATUS: TEST PING TRIGGERED";
    });

    $("soundMappings").addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || !target.id.startsWith("sfx-map-")) {
        return;
      }
      autoPatchSound({ perEventMapping: collectPerEventMappingFromForm() });
    });

    $("soundMappings").addEventListener("click", async (event) => {
      const button = event.target?.closest?.("button[data-sfx-test]");
      if (!button) {
        return;
      }
      await HA?.initAudioUnlock?.();
      const eventId = button.getAttribute("data-sfx-test") || "uiTest";
      const mapping = collectPerEventMappingFromForm();
      const key = mapping[eventId] || HC.DEFAULT_SFX_EVENT_MAPPING[eventId] || HC.DEFAULT_SFX_EVENT_MAPPING.uiTest;
      playUiSfx("uiTest", { key, force: true });
      $("soundStatus").textContent = "STATUS: TESTED " + String(eventId || "").toUpperCase();
    });

    $("filterPreset").addEventListener("change", (event) => {
      const preset = HC.getPresetById(event.target.value);
      patchSettings({
        filterPreset: event.target.value,
        overlayColorPreset: preset.overlay.color,
        overlayBlendMode: preset.overlay.blend
      });
    });

    $("overlayColorPreset").addEventListener("change", (event) => {
      patchSettings({ overlayColorPreset: event.target.value });
    });

    $("overlayBlendMode").addEventListener("change", (event) => {
      patchSettings({ overlayBlendMode: event.target.value });
    });

    ["overlayCustomR", "overlayCustomG", "overlayCustomB"].forEach((id) => {
      $(id).addEventListener("change", () => {
        patchSettings({
          overlayColorPreset: "custom",
          overlayCustomColor: {
            r: Number($("overlayCustomR").value || 0),
            g: Number($("overlayCustomG").value || 0),
            b: Number($("overlayCustomB").value || 0)
          }
        });
      });
    });

    ["filterEnabled", "colorAccurate", "applyToMedia", "excludeMedia", "designMode", "preserveLuminance", "debugPanel"].forEach((id) => {
      $(id).addEventListener("change", async () => {
        if (id === "applyToMedia") {
          await patchSettings({
            applyToMedia: Boolean($("applyToMedia").checked),
            excludeMedia: $("applyToMedia").checked ? false : Boolean($("excludeMedia").checked)
          });
          return;
        }

        await patchSettings({ [id]: Boolean($(id).checked) });
      });
    });

    $("showHud").addEventListener("change", async () => {
      await patchSettings({
        ui: {
          ...(state.settings.ui || {}),
          showHud: Boolean($("showHud").checked)
        }
      });
    });

    $("saveSettings").addEventListener("click", async () => {
      await saveAllSettings();
    });

    $("apiBaseUrl").addEventListener("input", () => {
      updateDashboardHint();
    });

    $("dashboardUrl").addEventListener("input", () => {
      updateDashboardHint();
    });

    $("applyCadenceProfile").addEventListener("click", async () => {
      await send({ type: "holmeta-apply-cadence-preset", presetId: $("cadenceProfile").value });
      await refreshState();
    });

    $("completeOnboarding").addEventListener("click", async () => {
      await applyOnboarding();
    });

    $("refreshTimeline").addEventListener("click", async () => {
      await refreshTimeline();
    });

    $("reapplyFilterNow").addEventListener("click", async () => {
      await send({ type: "holmeta-reapply-filter" });
      await updateDebugPanel();
    });

    $("colorAccurateButton").addEventListener("click", async () => {
      await send({ type: "holmeta-toggle-color-accurate" });
      await refreshState();
    });

    $("focus25").addEventListener("click", async () => {
      await send({ type: "holmeta-start-focus", payload: { durationMin: 25, closeExistingTabs: true } });
      await refreshState();
    });

    $("focus50").addEventListener("click", async () => {
      await send({ type: "holmeta-start-focus", payload: { durationMin: 50, closeExistingTabs: true } });
      await refreshState();
    });

    $("focusStop").addEventListener("click", async () => {
      await send({ type: "holmeta-panic-focus" });
      await refreshState();
    });

    $("snoozeAllButton").addEventListener("click", async () => {
      await send({ type: "holmeta-snooze-all", minutes: 15 });
      await refreshState();
    });

    $("panicOffButton").addEventListener("click", async () => {
      await send({ type: "holmeta-panic-off", minutes: 30 });
      await refreshState();
    });

    $("meetingModeQuick").addEventListener("click", async () => {
      await send({
        type: "holmeta-toggle-meeting-mode",
        enabled: !state.settings.cadence.global.meetingModeManual
      });
      await refreshState();
    });
    const openSidePanelQuickBtn = $("openSidePanelQuick");
    const closeSidePanelQuickBtn = $("closeSidePanelQuick");
    const sidePanelSupported = Boolean(chrome.sidePanel && typeof chrome.sidePanel.setOptions === "function");

    if (sidePanelSupported) {
      openSidePanelQuickBtn.addEventListener("click", async () => {
        const response = await sendPanelCommand("HOLMETA_PANEL_OPEN");
        if (!response?.ok) {
          setStatus("STATUS: SIDE PANEL OPEN FAILED (" + String(response?.error || "UNKNOWN") + ")");
          return;
        }

        setStatus("STATUS: SIDE PANEL OPENED");
      });

      closeSidePanelQuickBtn.addEventListener("click", async () => {
        const response = await sendPanelCommand("HOLMETA_PANEL_CLOSE");
        if (!response?.ok) {
          setStatus("STATUS: SIDE PANEL CLOSE FAILED (" + String(response?.error || "UNKNOWN") + ")");
          return;
        }

        setStatus("STATUS: SIDE PANEL CLOSED");
      });
    } else {
      [openSidePanelQuickBtn, closeSidePanelQuickBtn].forEach((button) => {
        if (!button) {
          return;
        }

        button.disabled = true;
        button.hidden = true;
      });
    }

    $("cadenceCards").addEventListener("click", async (event) => {
      const target = event.target;
      const reminderType = target?.getAttribute?.("data-test-reminder");
      if (!reminderType) return;
      await send({ type: "holmeta-test-reminder", reminderType });
      setStatus(`STATUS: TEST REMINDER DISPATCHED (${reminderType.toUpperCase()})`);
    });

    $("saveDailyLog").addEventListener("click", async () => {
      await send({
        type: "holmeta-save-daily-log",
        payload: {
          date: HC.todayKey(),
          energy: state.selectedLog.energy,
          mood: state.selectedLog.mood,
          sleepQuality: state.selectedLog.sleepQuality
        }
      });

      $("dailyLogStatus").textContent = "LOG SAVED.";
      await refreshState();
    });

    $("saveAudit").addEventListener("click", async () => {
      await saveAudit();
    });

    $("startPostureMonitor").addEventListener("click", async () => {
      await startPostureMonitor();
    });

    $("stopPostureMonitor").addEventListener("click", () => {
      stopPostureMonitor();
    });

        $("pairExtension").addEventListener("click", async () => {
      const code = String($("pairingCodeInput").value || "").trim().toUpperCase();
      if (!code) {
        $("pairingStatus").textContent = "STATUS: ENTER A PAIRING CODE";
        setAccountStatus("PAIRING CODE REQUIRED", "error");
        return;
      }
      const response = await send({ type: "holmeta-exchange-pairing-code", code });
      if (!response.ok) {
        $("pairingStatus").textContent = `STATUS: PAIRING FAILED (${response.error || "UNKNOWN"})`;
        setAccountStatus("PAIRING FAILED", "error");
        return;
      }
      $("pairingStatus").textContent = "STATUS: PAIRED";
      setAccountStatus("PAIRING SUCCEEDED", "success");
      await refreshState();
    });

        $("clearPairing").addEventListener("click", async () => {
      await send({ type: "holmeta-clear-extension-token" });
      setAccountStatus("PAIRING CLEARED", "success");
      await refreshState();
    });

        $("refreshEntitlement").addEventListener("click", async () => {
      const response = await send({ type: "holmeta-refresh-entitlement" });
      if (!response?.ok) {
        setAccountStatus("ENTITLEMENT REFRESH FAILED", "error");
      } else {
        setAccountStatus("ENTITLEMENT REFRESHED", "success");
      }
      await refreshState();
    });

        $("openDashboard").addEventListener("click", async () => {
      await openDashboardFromAccount();
    });
    $("testDashboardUrl").addEventListener("click", async () => {
      await openDashboardFromAccount();
    });
    $("subscribeNow").addEventListener("click", async () => {
      await openSubscribeFromAccount();
    });

    $("testEntitlementFetch").addEventListener("click", async () => {
      setAccountStatus("ENTITLEMENT FETCH TEST RUNNING");

      const response = await send({ type: "holmeta-test-entitlement-fetch" });
      if (!response?.ok) {
        const suffix = response?.corsLikely ? " (CORS)" : "";
        const detail = response?.error || (response?.status ? `HTTP ${response.status}` : "UNKNOWN");
        setAccountStatus(`ENTITLEMENT FETCH FAILED${suffix}: ${detail}`, "error");
        setStatus(`STATUS: ENTITLEMENT FETCH FAILED${suffix}`);
        return;
      }

      const active = Boolean(response.entitlement?.active);
      const plan = response.entitlement?.plan ? String(response.entitlement.plan).toUpperCase() : "FREE";
      setAccountStatus(`ENTITLEMENT ${response.status || 200}: ${active ? "ACTIVE" : "INACTIVE"} (${plan})`, active ? "success" : "info");
      setStatus("STATUS: ENTITLEMENT FETCH OK");
      await refreshState();
    });

    window.addEventListener("beforeunload", () => {
      stopPostureMonitor();
    });
  }

  async function bootstrap() {
    installAudioUnlock();
    bindRatingRows();
    bindEvents();
    attachPhotoReader();
    await loadAudit();
    await refreshState();
  }

  bootstrap();
})();
