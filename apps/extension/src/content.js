(() => {
  if (window.__HOLMETA_CONTENT_BOOTSTRAPPED__) {
    return;
  }
  window.__HOLMETA_CONTENT_BOOTSTRAPPED__ = true;

  if (location.protocol !== "http:" && location.protocol !== "https:") {
    return;
  }

  const HC = globalThis.HolmetaCommon;
  const HA = globalThis.HolmetaAudio;

  const ROOT_ID = "holmeta-modal-host";
  const LEGACY_ROOT_ID = "holmeta-overlay-root";
  const LEGACY_HOST_ID = "holmeta-root";
  const HUD_HOST_ID = "holmeta-hud-host";
  const HUD_PANEL_ID = "holmeta-hud-panel";
  const STYLE_ID = "holmeta-content-style";
  const SVG_ID = "holmeta-filter-svg";
  const FILTER_ID = "holmeta-color-filter";
  const FILTER_LAYER_ID = "holmeta-filter-layer";
  const PANEL_LAYER_ID = "holmeta-panel-layer";
  const PANIC_STORAGE_KEY = "holmeta.contentPanicUntilTs";

  const HISTORY_PATCH_FLAG = "__holmeta_history_patch__";

  let activityLastSentAt = 0;
  let focusHudInterval = null;
  let focusSession = null;
  let refreshTimer = null;
  let latestSettings = HC.normalizeSettings(HC.DEFAULT_SETTINGS);
  let audioUnlockInstalled = false;
  let panicUntilTs = 0;

  let modalHost = null;
  let modalShadow = null;
  let hudHost = null;
  let hudShadow = null;
  let hudForcedVisible = false;

  function sendMessage(message, callback) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        if (typeof callback === "function") {
          callback(response);
        }
      });
    } catch (_) {
      // no-op
    }
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(key, (result) => {
          resolve(result || {});
        });
      } catch (_) {
        resolve({});
      }
    });
  }

  function storageSet(payload) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(payload, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }

  function loadPanicUntil() {
    return storageGet(PANIC_STORAGE_KEY).then((result) => {
      const stored = Number(result[PANIC_STORAGE_KEY] || 0);
      panicUntilTs = Number.isFinite(stored) ? stored : 0;
      return panicUntilTs;
    });
  }

  function syncPanicFromSettings() {
    const settingsPanic = Number(latestSettings?.cadence?.global?.panicUntilTs || 0);
    if (Number.isFinite(settingsPanic) && settingsPanic > panicUntilTs) {
      panicUntilTs = settingsPanic;
    }
  }

  function isPanicActive() {
    syncPanicFromSettings();
    return panicUntilTs > Date.now();
  }

  function shouldShowHud() {
    return Boolean(latestSettings?.ui?.showHud || hudForcedVisible);
  }

  function cleanupLegacyNodes() {
    document.querySelectorAll(`#${LEGACY_ROOT_ID}`).forEach((node) => node.remove());
    document.querySelectorAll(`#${LEGACY_HOST_ID}`).forEach((node) => node.remove());

    const modalHosts = Array.from(document.querySelectorAll(`#${ROOT_ID}`));
    modalHosts.slice(1).forEach((node) => node.remove());

    const hudHosts = Array.from(document.querySelectorAll(`#${HUD_HOST_ID}`));
    hudHosts.slice(1).forEach((node) => node.remove());

    if (modalHost && !document.getElementById(ROOT_ID)) {
      modalHost = null;
      modalShadow = null;
    }

    if (hudHost && !document.getElementById(HUD_HOST_ID)) {
      hudHost = null;
      hudShadow = null;
    }
  }

  function removeOverlayHost() {
    if (modalHost) {
      modalHost.remove();
    }
    modalHost = null;
    modalShadow = null;
  }

  function removeHudHost() {
    if (hudHost) {
      hudHost.remove();
    }
    hudHost = null;
    hudShadow = null;
  }

  function installBaseStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }

    style.textContent = `
      html.holmeta-filter-on {
        transition: filter 220ms linear;
      }

      html.holmeta-filter-root {
        filter: url(#${FILTER_ID}) var(--holmeta-css-stack, brightness(1) contrast(1) saturate(1));
      }

      body.holmeta-filter-body {
        filter: url(#${FILTER_ID}) var(--holmeta-css-stack, brightness(1) contrast(1) saturate(1));
      }

      html.holmeta-media-exclude img,
      html.holmeta-media-exclude video,
      html.holmeta-media-exclude canvas {
        filter: none !important;
      }

      html.holmeta-design-mode img,
      html.holmeta-design-mode video,
      html.holmeta-design-mode canvas {
        image-rendering: auto;
      }
    `;
  }

  function ensureUiHost() {
    cleanupLegacyNodes();

    if (modalHost && modalShadow && document.contains(modalHost)) {
      return modalHost;
    }

    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      modalHost = existing;
      modalShadow = existing.shadowRoot || existing.attachShadow({ mode: "open" });
    } else {
      modalHost = document.createElement("div");
      modalHost.id = ROOT_ID;
      modalHost.setAttribute("aria-hidden", "true");
      modalHost.style.cssText = [
        "all: initial",
        "position: fixed",
        "inset: 0",
        "pointer-events: none",
        "z-index: 2147483647",
        "contain: layout style paint"
      ].join("; ");
      modalShadow = modalHost.attachShadow({ mode: "open" });
      document.documentElement.appendChild(modalHost);
    }

    if (modalShadow && !modalShadow.querySelector(`#${PANEL_LAYER_ID}`)) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <style>
          :host {
            all: initial;
          }

          *, *::before, *::after {
            box-sizing: border-box;
          }

          #${PANEL_LAYER_ID} {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 1;
          }

          #${PANEL_LAYER_ID} .hm-toast,
          #${PANEL_LAYER_ID} .hm-modal,
          #${PANEL_LAYER_ID} .hm-summary {
            pointer-events: auto;
            border: 1px solid rgba(234, 236, 239, 0.18);
            background: rgba(7, 8, 10, 0.96);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
            color: #EAECEF;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            line-height: 1.4;
          }

          #${PANEL_LAYER_ID} .hm-toast,
          #${PANEL_LAYER_ID} .hm-summary {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            max-width: calc(100vw - 24px);
            min-width: 280px;
            padding: 14px;
          }

          #${PANEL_LAYER_ID} .hm-toast.hm-gentle {
            width: 280px;
            max-width: calc(100vw - 24px);
            min-width: 240px;
            top: auto;
            bottom: 16px;
            right: 16px;
            background: rgba(7, 8, 10, 0.84);
          }

          #${PANEL_LAYER_ID} .hm-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(560px, calc(100vw - 24px));
            max-width: calc(100vw - 24px);
            min-width: 280px;
            max-height: calc(100vh - 24px);
            overflow: auto;
            padding: 20px;
          }

          .hm-kicker {
            font-size: 11px;
            letter-spacing: 0.09em;
            opacity: 0.8;
            text-transform: uppercase;
          }

          .hm-title {
            margin-top: 4px;
            margin-bottom: 8px;
            font-size: 14px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          .hm-body {
            font-size: 12px;
            color: #A7ADB8;
            line-height: 1.45;
          }

          .hm-timer {
            margin: 10px 0;
            font-size: 26px;
            color: #00FF66;
            font-variant-numeric: tabular-nums;
          }

          .hm-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
          }

          button {
            border: 1px solid rgba(255, 77, 26, 0.65);
            background: transparent;
            color: #EAECEF;
            min-height: 32px;
            padding: 6px 10px;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
          }

          button.hm-primary {
            background: #FF4D1A;
            color: #07080A;
            font-weight: 600;
          }

          ul {
            margin: 8px 0 0;
            padding-left: 18px;
            font-size: 11px;
          }
        </style>
        <div id="${PANEL_LAYER_ID}"></div>
      `;

      while (wrapper.firstChild) {
        modalShadow.appendChild(wrapper.firstChild);
      }
    }

    return modalHost;
  }

  function getPanelLayer(create = true) {
    if (create) {
      ensureUiHost();
    }

    if (!modalShadow) {
      return null;
    }

    return modalShadow.querySelector(`#${PANEL_LAYER_ID}`);
  }

  function ensureFilterLayer() {
    let layer = document.getElementById(FILTER_LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = FILTER_LAYER_ID;
      layer.setAttribute("aria-hidden", "true");
      layer.style.cssText = [
        "all: initial",
        "position: fixed",
        "inset: 0",
        "display: none",
        "pointer-events: none",
        "z-index: 2147483646",
        "background: transparent",
        "mix-blend-mode: normal"
      ].join("; ");
      document.documentElement.appendChild(layer);
    }

    return layer;
  }

  function injectHud() {
    if (isPanicActive()) {
      return null;
    }

    cleanupLegacyNodes();

    if (hudHost && hudShadow && document.contains(hudHost)) {
      const panel = hudShadow.getElementById(HUD_PANEL_ID);
      return panel ? { host: hudHost, panel } : null;
    }

    const existing = document.getElementById(HUD_HOST_ID);
    if (existing) {
      hudHost = existing;
      hudShadow = existing.shadowRoot || existing.attachShadow({ mode: "open" });
    } else {
      hudHost = document.createElement("div");
      hudHost.id = HUD_HOST_ID;
      hudHost.style.cssText = [
        "all: initial",
        "position: fixed",
        "top: 12px",
        "right: 12px",
        "width: 360px",
        "min-width: 300px",
        "max-width: calc(100vw - 24px)",
        "max-height: calc(100vh - 24px)",
        "z-index: 2147483647",
        "pointer-events: auto",
        "contain: layout style paint"
      ].join("; ");
      hudShadow = hudHost.attachShadow({ mode: "open" });
      document.documentElement.appendChild(hudHost);
    }

    if (hudShadow && !hudShadow.getElementById(HUD_PANEL_ID)) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <style>
          :host {
            all: initial;
            font-family: system-ui, -apple-system, "Segoe UI", Inter, sans-serif;
          }

          *, *::before, *::after {
            box-sizing: border-box;
          }

          .hud-shell {
            width: 100%;
            max-height: calc(100vh - 24px);
            overflow: auto;
            border: 1px solid rgba(234, 236, 239, 0.18);
            border-radius: 10px;
            background: rgba(7, 8, 10, 0.97);
            box-shadow: 0 10px 26px rgba(0, 0, 0, 0.38);
            color: #EAECEF;
            padding: 12px;
            line-height: 1.4;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          }

          .hm-kicker {
            font-size: 11px;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            opacity: 0.86;
          }

          .hm-title {
            margin-top: 4px;
            margin-bottom: 8px;
            font-size: 14px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          .hm-timer {
            margin: 10px 0;
            font-size: 26px;
            color: #00FF66;
            font-variant-numeric: tabular-nums;
          }

          .hm-body {
            font-size: 12px;
            color: #A7ADB8;
            line-height: 1.45;
          }

          .hm-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
          }

          button {
            border: 1px solid rgba(255, 77, 26, 0.65);
            background: transparent;
            color: #EAECEF;
            min-height: 32px;
            padding: 6px 10px;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
          }

          button.hm-primary {
            background: #FF4D1A;
            color: #07080A;
            font-weight: 600;
          }
        </style>
        <div id="${HUD_PANEL_ID}" class="hud-shell"></div>
      `;

      while (wrapper.firstChild) {
        hudShadow.appendChild(wrapper.firstChild);
      }
    }

    const width = hudHost.getBoundingClientRect().width;
    if (width > 0 && width < 260) {
      hudHost.style.width = "360px";
      console.warn("Holmeta HUD width collapsed; self-healed");
    }

    const panel = hudShadow?.getElementById(HUD_PANEL_ID) || null;
    return panel ? { host: hudHost, panel } : null;
  }

  function ensureFilterSvg() {

    let svg = document.getElementById(SVG_ID);
    if (svg) {
      return svg;
    }

    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", SVG_ID);
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "fixed";
    svg.style.left = "-9999px";

    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", FILTER_ID);

    const matrix = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix");
    matrix.setAttribute("type", "matrix");
    matrix.setAttribute("values", "1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0");
    matrix.setAttribute("id", `${FILTER_ID}-matrix`);

    filter.appendChild(matrix);
    svg.appendChild(filter);
    document.documentElement.appendChild(svg);

    return svg;
  }

  function clearFilterState() {
    document.documentElement.classList.remove("holmeta-filter-on", "holmeta-filter-root", "holmeta-media-exclude", "holmeta-design-mode");
    document.documentElement.style.removeProperty("--holmeta-css-stack");

    if (document.body) {
      document.body.classList.remove("holmeta-filter-body");
      document.body.style.removeProperty("--holmeta-css-stack");
    }

    const layer = document.getElementById(FILTER_LAYER_ID);
    if (layer) {
      layer.style.display = "none";
      layer.style.backgroundColor = "transparent";
      layer.style.mixBlendMode = "normal";
      layer.style.pointerEvents = "none";
    }
  }

  function removeModals() {
    const panelLayer = getPanelLayer(false);
    if (panelLayer) {
      panelLayer.innerHTML = "";
    }

    removeOverlayHost();
  }

  function removeHud() {
    removeHudHost();

    if (focusHudInterval) {
      clearInterval(focusHudInterval);
      focusHudInterval = null;
    }
  }

  function removeFilterLayers() {
    clearFilterState();
    const svg = document.getElementById(SVG_ID);
    if (svg) {
      svg.remove();
    }

    const layer = document.getElementById(FILTER_LAYER_ID);
    if (layer) {
      layer.remove();
    }
  }

  function removeAllInjected() {
    removeHud();
    removeModals();
    removeFilterLayers();
    removeOverlayHost();
    cleanupLegacyNodes();
  }

  async function activatePanicOff(minutes = 30) {
    const until = Date.now() + Math.max(1, Number(minutes || 30)) * 60 * 1000;
    panicUntilTs = until;
    await storageSet({ [PANIC_STORAGE_KEY]: until });

    // Escape panic disables injected UI surfaces, but does not force-disable the page filter.
    removeHud();
    removeModals();
  }

  function applyPipeline(payload) {
    if (!payload || !payload.matrixString) {
      clearFilterState();
      return;
    }

    if (!payload.active) {
      clearFilterState();
      return;
    }

    ensureFilterSvg();
    const matrix = document.getElementById(`${FILTER_ID}-matrix`);
    if (matrix) {
      matrix.setAttribute("values", payload.matrixString);
    }

    const cssStack = payload?.css?.filterString || "brightness(1) contrast(1) saturate(1)";
    const media = payload.media || { applyToMedia: false, excludeMedia: true, designMode: false };

    document.documentElement.classList.add("holmeta-filter-on");
    document.documentElement.classList.toggle("holmeta-media-exclude", Boolean(media.excludeMedia));
    document.documentElement.classList.toggle("holmeta-design-mode", Boolean(media.designMode));

    const applyOnBody = Boolean(document.body);
    if (applyOnBody && document.body) {
      document.documentElement.classList.remove("holmeta-filter-root");
      document.documentElement.style.removeProperty("--holmeta-css-stack");
      document.body.classList.add("holmeta-filter-body");
      document.body.style.setProperty("--holmeta-css-stack", cssStack);
    } else {
      if (document.body) {
        document.body.classList.remove("holmeta-filter-body");
        document.body.style.removeProperty("--holmeta-css-stack");
      }
      document.documentElement.classList.add("holmeta-filter-root");
      document.documentElement.style.setProperty("--holmeta-css-stack", cssStack);
    }

    const layer = ensureFilterLayer();
    layer.style.pointerEvents = "none";
    if (payload.overlay?.enabled) {
      layer.style.display = "block";
      layer.style.backgroundColor = payload.overlay.rgba || "transparent";
      layer.style.mixBlendMode = payload.overlay.blendMode || "multiply";
    } else {
      layer.style.display = "none";
      layer.style.backgroundColor = "transparent";
      layer.style.mixBlendMode = "normal";
    }
  }

  function renderPanel(className, html, autoClearMs) {
    if (isPanicActive()) {
      removeModals();
      return;
    }

    const panelLayer = getPanelLayer(true);
    if (!panelLayer) {
      return;
    }

    panelLayer.innerHTML = `<div class="${className}">${html}</div>`;
    if (autoClearMs) {
      window.setTimeout(() => {
        removeModals();
      }, autoClearMs);
    }
  }

  function installAudioUnlockHooks() {
    if (audioUnlockInstalled) {
      return;
    }

    audioUnlockInstalled = true;
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

  function playMappedSfx(eventId, options = {}) {
    if (!HA?.playSfx) {
      return;
    }

    const settings = latestSettings || HC.DEFAULT_SETTINGS;
    if (!options.force && !settings.soundEnabled) {
      return;
    }

    if (!options.force && options.channel === "reminder" && !settings.reminderSoundsEnabled) {
      return;
    }

    const key = options.key || HC.resolveSfxKeyForEvent(settings, eventId);
    if (!key) {
      return;
    }

    const volume = HC.clamp(Number(options.volume ?? settings.masterVolume ?? 0.35), 0, 1);
    if (volume <= 0) {
      return;
    }

    HA.playSfx(key, { volume });
  }

  function handleIncomingSfx(message = {}) {
    if (!message.key) {
      return;
    }

    const settings = latestSettings || HC.DEFAULT_SETTINGS;
    if (!settings.soundEnabled) {
      return;
    }

    if (message.channel === "reminder" && !settings.reminderSoundsEnabled) {
      return;
    }

    playMappedSfx("uiTest", {
      key: String(message.key || "").trim(),
      volume: Number(message.volume ?? settings.masterVolume ?? 0.35),
      force: true,
      channel: message.channel || "ui"
    });
  }

  function sendReminderAction(reminderType, action, extra = {}) {
    sendMessage({
      type: "holmeta-reminder-action",
      reminderType,
      action,
      ...extra
    });
  }

  function showToast({ kicker, title, body, autoClearMs = 8000, actions = [], gentle = false }) {
    const actionsHtml = actions
      .map((action) => `<button class="${action.primary ? "hm-primary" : ""}" data-action="${action.id}">${action.label}</button>`)
      .join("");

    renderPanel(
      `hm-toast${gentle ? " hm-gentle" : ""}`,
      `<div class="hm-kicker">${kicker}</div>
       <div class="hm-title">${title}</div>
       <div class="hm-body">${body}</div>
       <div class="hm-actions">${actionsHtml}</div>`,
      autoClearMs
    );

    const panelLayer = getPanelLayer(false);
    panelLayer?.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        playMappedSfx("uiClick");
        const actionId = button.getAttribute("data-action");
        const action = actions.find((entry) => entry.id === actionId);
        if (action?.onClick) {
          action.onClick();
        }
      });
    });
  }

  function showEyeReminder(payload) {
    if (isPanicActive()) {
      return;
    }

    let seconds = Math.max(10, Number(payload.exerciseDurationSec || 20));
    const guidanceList = (payload.guidance || []).map((line) => `<li>${line}</li>`).join("");
    const snoozeMin = Number(payload.defaultSnoozeMin || 5);

    renderPanel(
      "hm-modal",
      `<div class="hm-kicker">STATUS: ACTIVE</div>
       <div class="hm-title">${payload.title || "EYE RECOVERY PROTOCOL"}</div>
       <div class="hm-timer" id="hm-eye-timer">00:${String(seconds).padStart(2, "0")}</div>
       <div class="hm-body">${payload.message || "LOOK FAR AWAY FROM SCREEN."}</div>
       <ul>${guidanceList}</ul>
       <div class="hm-actions">
         <button data-action="snooze">SNOOZE ${snoozeMin}M</button>
         <button data-action="dismiss">DISMISS</button>
         <button class="hm-primary" data-action="done">COMPLETE</button>
       </div>`,
      0
    );

    const timerEl = getPanelLayer(false)?.querySelector("#hm-eye-timer");
    const interval = window.setInterval(() => {
      seconds -= 1;
      if (timerEl) {
        const safe = Math.max(0, seconds);
        timerEl.textContent = `00:${String(safe).padStart(2, "0")}`;
      }
      if (seconds <= 0) {
        window.clearInterval(interval);
      }
    }, 1000);

    const panelLayer = getPanelLayer(false);
    panelLayer?.querySelector("button[data-action='snooze']")?.addEventListener("click", () => {
      playMappedSfx("uiClick");
      sendReminderAction("eye", "snooze", { minutes: snoozeMin });
      removeModals();
    });

    panelLayer?.querySelector("button[data-action='dismiss']")?.addEventListener("click", () => {
      playMappedSfx("uiWarn");
      sendReminderAction("eye", "dismiss");
      removeModals();
    });

    panelLayer?.querySelector("button[data-action='done']")?.addEventListener("click", () => {
      playMappedSfx("uiSuccess");
      sendReminderAction("eye", "complete");
      removeModals();
    });
  }

  function showGenericReminder(payload) {
    if (isPanicActive()) {
      return;
    }

    const reminderType = payload.reminderType || "movement";
    const snoozeMin = Number(payload.defaultSnoozeMin || payload.snoozeMinutes?.[0] || 5);

    showToast({
      kicker: payload.escalated ? "STATUS: ESCALATED" : "FIELD OPERATION",
      title: payload.title || "REMINDER",
      body: payload.message || "RUN MICRO RECOVERY PROTOCOL.",
      autoClearMs: payload.delivery?.gentle ? 7000 : 11000,
      gentle: Boolean(payload.delivery?.gentle),
      actions: [
        {
          id: "snooze",
          label: `SNOOZE ${snoozeMin}M`,
          onClick: () => {
            sendReminderAction(reminderType, "snooze", { minutes: snoozeMin });
            removeModals();
          }
        },
        {
          id: "dismiss",
          label: "DISMISS",
          onClick: () => {
            sendReminderAction(reminderType, "dismiss");
            removeModals();
          }
        },
        {
          id: "done",
          label: "COMPLETE",
          primary: true,
          onClick: () => {
            if (reminderType === "hydration") {
              sendMessage({ type: "holmeta-log-hydration", amount: 1 });
            }
            sendReminderAction(reminderType, "complete");
            removeModals();
          }
        }
      ]
    });
  }

  function showSummaryCard(payload) {
    if (isPanicActive()) {
      return;
    }

    const completed = Number(payload.totalCompleted || 0);
    const scheduled = Number(payload.totalScheduled || 0);

    showToast({
      kicker: "END-OF-DAY SUMMARY",
      title: "DAILY COMPLETION",
      body: `YOU COMPLETED ${completed}/${scheduled} REMINDERS TODAY.`,
      autoClearMs: 12000,
      actions: [
        {
          id: "ack",
          label: "ACKNOWLEDGE",
          primary: true,
          onClick: () => removeModals()
        }
      ]
    });
  }

  function handleReminder(payload = {}) {
    if (isPanicActive()) {
      return;
    }

    const delivery = payload.delivery || {};

    if (delivery.popupOnly || delivery.overlay === false) {
      return;
    }

    const reminderType = payload.reminderType || "eye";
    if (reminderType === "eye" && !delivery.gentle) {
      showEyeReminder(payload);
      return;
    }

    showGenericReminder(payload);
  }

  function formatRemaining(endsAt) {
    const ms = Math.max(0, Number(endsAt) - Date.now());
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function renderFocusHud() {
    if (!shouldShowHud() || isPanicActive()) {
      removeHud();
      return;
    }

    const mounted = injectHud();
    if (!mounted || !mounted.panel) {
      removeHud();
      return;
    }

    const targetPanel = mounted.panel;
    const hasFocus = Boolean(focusSession);
    const remainingText = hasFocus ? formatRemaining(focusSession.endsAt) : "--:--";

    targetPanel.innerHTML = [
      '<div class="hm-kicker">FOCUS HUD</div>',
      '<div class="hm-title">STATUS: ' + (hasFocus ? "ACTIVE" : "IDLE") + '</div>',
      '<div class="hm-timer" id="hm-focus-remaining">' + remainingText + '</div>',
      '<div class="hm-body">' + (hasFocus ? "PANIC BUTTON ALWAYS ENABLED." : "HUD READY. START FOCUS OR CLOSE HUD.") + '</div>',
      '<div class="hm-actions">',
      hasFocus ? '<button class="hm-primary" id="hm-focus-panic">PANIC STOP</button>' : '',
      '<button id="hm-focus-close">CLOSE HUD</button>',
      '</div>'
    ].join("");

    targetPanel.querySelector("#hm-focus-panic")?.addEventListener("click", () => {
      playMappedSfx("uiWarn");
      sendMessage({ type: "holmeta-panic-focus" });
    });

    targetPanel.querySelector("#hm-focus-close")?.addEventListener("click", () => {
      hudForcedVisible = false;
      removeHud();
    });

    if (focusHudInterval) {
      clearInterval(focusHudInterval);
      focusHudInterval = null;
    }

    if (!hasFocus) {
      return;
    }

    focusHudInterval = setInterval(() => {
      if (!focusSession || isPanicActive()) {
        renderFocusHud();
        return;
      }

      if (Date.now() >= Number(focusSession.endsAt)) {
        focusSession = null;
        renderFocusHud();
        return;
      }

      const remaining = targetPanel.querySelector("#hm-focus-remaining");
      if (remaining) {
        remaining.textContent = formatRemaining(focusSession.endsAt);
      }
    }, 1000);
  }

  function handleFilterMessage(payload) {
    if (!payload) {
      clearFilterState();
      return;
    }

    if (payload.settings) {
      latestSettings = HC.normalizeSettings(payload.settings);
      syncPanicFromSettings();
      const timestamp = payload.generatedAt ? new Date(payload.generatedAt) : new Date();
      const computed = HC.computeFilterPayload(latestSettings, timestamp, window.location.hostname);
      applyPipeline(computed);
      renderFocusHud();
      return;
    }

    applyPipeline(payload);
  }

  function handleLegacyEye(payload) {
    handleReminder({
      reminderType: "eye",
      title: payload.title || "20-20-20 EYE RECOVERY",
      message: "Look far for 20 seconds.",
      guidance: payload.guidance || [],
      exerciseDurationSec: 20,
      defaultSnoozeMin: 5,
      delivery: {
        overlay: true,
        notification: false,
        popupOnly: false,
        sound: false,
        soundVolume: 0.25,
        gentle: false
      }
    });
  }

  function handleLegacyHydration(payload) {
    handleReminder({
      reminderType: "hydration",
      title: payload.title || "HYDRATION CHECK",
      message: payload.message || "Log one glass of water.",
      defaultSnoozeMin: 10,
      delivery: {
        overlay: true,
        notification: false,
        popupOnly: false,
        sound: false,
        soundVolume: 0.25,
        gentle: false
      }
    });
  }

  function handleLegacyStillness(payload) {
    handleReminder({
      reminderType: "movement",
      title: "MOVEMENT NUDGE",
      message: `Inactive ${payload.minutesInactive || "?"} min. Stand and reset.`,
      defaultSnoozeMin: 10,
      delivery: {
        overlay: true,
        notification: false,
        popupOnly: false,
        sound: false,
        soundVolume: 0.25,
        gentle: true
      }
    });
  }

  function handleMessage(message) {
    if (message.type === "holmeta-apply-filter") {
      handleFilterMessage(message.payload);
      return;
    }

    if (message.type === "holmeta-reapply-filter") {
      requestStateAndApply("message-reapply");
      return;
    }

    if (message.type === "HOLMETA_HUD_OPEN") {
      hudForcedVisible = true;
      renderFocusHud();
      return;
    }

    if (message.type === "HOLMETA_HUD_CLOSE") {
      hudForcedVisible = false;
      latestSettings = HC.normalizeSettings({
        ...latestSettings,
        ui: {
          ...(latestSettings.ui || {}),
          showHud: false
        }
      });
      removeHud();
      return;
    }

    if (message.type === "holmeta-reminder") {
      handleReminder(message.payload || {});
      return;
    }

    if (message.type === "SFX_PLAY") {
      handleIncomingSfx(message);
      return;
    }

    if (message.type === "holmeta-summary-card") {
      showSummaryCard(message.payload || {});
      return;
    }

    if (message.type === "holmeta-eye-break") {
      handleLegacyEye(message.payload || {});
      return;
    }

    if (message.type === "holmeta-hydration") {
      handleLegacyHydration(message.payload || {});
      return;
    }

    if (message.type === "holmeta-stillness") {
      handleLegacyStillness(message.payload || {});
      return;
    }

    if (message.type === "holmeta-focus-hud") {
      focusSession = message.focusSession || null;
      renderFocusHud();
    }
  }

  function pingActivity(reason) {
    const now = Date.now();
    if (now - activityLastSentAt < 20000 && reason !== "visibility") {
      return;
    }
    activityLastSentAt = now;
    sendMessage({
      type: "holmeta-activity-ping",
      reason,
      ts: now
    });
  }

  function installActivityHooks() {
    ["mousemove", "keydown", "scroll", "click"].forEach((eventName) => {
      window.addEventListener(
        eventName,
        () => {
          pingActivity(eventName);
        },
        { passive: true }
      );
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        pingActivity("visibility");
        scheduleRefresh("visibility");
      }
    });
  }

  function requestStateAndApply(reason = "manual") {
    sendMessage({ type: "holmeta-request-state", domain: window.location.hostname, reason }, (response) => {
      if (!response) {
        return;
      }

      if (response.settings) {
        latestSettings = HC.normalizeSettings(response.settings);
        syncPanicFromSettings();
      }

      if (isPanicActive()) {
        removeHud();
        removeModals();
      }

      if (response.filterPayload) {
        applyPipeline(response.filterPayload);
      }

      if (response.runtime?.focusSession) {
        focusSession = response.runtime.focusSession;
      } else {
        focusSession = null;
      }
      renderFocusHud();
    });
  }

  function scheduleRefresh(reason = "schedule") {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      requestStateAndApply(reason);
    }, 160);
  }

  function installSpaHooks() {
    if (!window[HISTORY_PATCH_FLAG]) {
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;

      history.pushState = function (...args) {
        const result = originalPush.apply(this, args);
        window.dispatchEvent(new Event("holmeta-location-change"));
        return result;
      };

      history.replaceState = function (...args) {
        const result = originalReplace.apply(this, args);
        window.dispatchEvent(new Event("holmeta-location-change"));
        return result;
      };

      window[HISTORY_PATCH_FLAG] = true;
    }

    window.addEventListener("holmeta-location-change", () => scheduleRefresh("history"));
    window.addEventListener("popstate", () => scheduleRefresh("popstate"));
    window.addEventListener("hashchange", () => scheduleRefresh("hashchange"));
    document.addEventListener("DOMContentLoaded", () => scheduleRefresh("domcontentloaded"));
  }

  function installEscapeHatch() {
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape") {
          return;
        }
        activatePanicOff(30);
      },
      true
    );
  }

  function bootstrap() {
    installBaseStyle();
    cleanupLegacyNodes();
    installAudioUnlockHooks();
    installActivityHooks();
    installSpaHooks();
    installEscapeHatch();

    loadPanicUntil().then(() => {
      if (isPanicActive()) {
        removeHud();
        removeModals();
      }

      pingActivity("boot");
      requestStateAndApply("boot");
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    handleMessage(message);
  });

  bootstrap();
})();
