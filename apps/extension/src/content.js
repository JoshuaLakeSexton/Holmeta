(() => {
  const HC = globalThis.HolmetaCommon;
  const OVERLAY_ID = "holmeta-overlay-root";
  const STYLE_ID = "holmeta-content-style";
  const SVG_ID = "holmeta-filter-svg";
  const FILTER_ID = "holmeta-color-filter";

  let activityLastSentAt = 0;
  let focusHudInterval = null;
  let focusSession = null;

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

  function installBaseStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.holmeta-filter-active {
        filter: url(#${FILTER_ID}) brightness(var(--holmeta-brightness, 1));
        transition: filter 1200ms linear;
      }

      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483645;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        color: #EAECEF;
      }

      #${OVERLAY_ID} .hm-toast,
      #${OVERLAY_ID} .hm-modal,
      #${OVERLAY_ID} .hm-hud {
        pointer-events: auto;
        border: 1px solid rgba(234, 236, 239, 0.18);
        background: rgba(7, 8, 10, 0.95);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
      }

      #${OVERLAY_ID} .hm-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        padding: 14px;
      }

      #${OVERLAY_ID} .hm-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        width: min(560px, calc(100vw - 24px));
        transform: translate(-50%, -50%);
        padding: 20px;
      }

      #${OVERLAY_ID} .hm-hud {
        position: fixed;
        right: 12px;
        bottom: 12px;
        width: 240px;
        padding: 10px;
      }

      #${OVERLAY_ID} .hm-kicker {
        font-size: 11px;
        letter-spacing: 0.09em;
        opacity: 0.8;
      }

      #${OVERLAY_ID} .hm-title {
        margin-top: 4px;
        margin-bottom: 8px;
        font-size: 14px;
        letter-spacing: 0.05em;
      }

      #${OVERLAY_ID} .hm-body {
        font-size: 12px;
        color: #A7ADB8;
        line-height: 1.45;
      }

      #${OVERLAY_ID} .hm-timer {
        margin: 10px 0;
        font-size: 26px;
        color: #00FF66;
      }

      #${OVERLAY_ID} .hm-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      #${OVERLAY_ID} button {
        border: 1px solid rgba(255, 77, 26, 0.65);
        background: transparent;
        color: #EAECEF;
        padding: 6px 10px;
        font-size: 11px;
        letter-spacing: 0.08em;
        cursor: pointer;
      }

      #${OVERLAY_ID} button.hm-primary {
        background: #FF4D1A;
        color: #07080A;
        font-weight: 600;
      }

      #${OVERLAY_ID} ul {
        margin: 8px 0 0;
        padding-left: 18px;
        font-size: 11px;
      }
    `;

    document.documentElement.appendChild(style);
  }

  function ensureOverlayRoot() {
    let root = document.getElementById(OVERLAY_ID);
    if (root) {
      return root;
    }

    root = document.createElement("div");
    root.id = OVERLAY_ID;
    document.documentElement.appendChild(root);
    return root;
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

  function applyFilter(payload) {
    const host = window.location.hostname;
    const disabled = (payload?.disabledDomains || []).some((domain) => HC.domainMatches(host, domain));

    if (disabled || !payload?.matrixString) {
      document.documentElement.classList.remove("holmeta-filter-active");
      return;
    }

    ensureFilterSvg();
    const matrix = document.getElementById(`${FILTER_ID}-matrix`);
    if (matrix) {
      matrix.setAttribute("values", payload.matrixString);
    }

    document.documentElement.style.setProperty("--holmeta-brightness", String(payload.brightness || 1));
    document.documentElement.classList.add("holmeta-filter-active");
  }

  function clearOverlay() {
    const root = ensureOverlayRoot();
    root.innerHTML = "";
  }

  function renderPanel(className, html, autoClearMs) {
    const root = ensureOverlayRoot();
    root.innerHTML = `<div class="${className}">${html}</div>`;
    if (autoClearMs) {
      window.setTimeout(() => {
        clearOverlay();
      }, autoClearMs);
    }
  }

  function showToast({ kicker, title, body, autoClearMs = 8000, actions = [] }) {
    const actionsHtml = actions
      .map((action) => `<button class="${action.primary ? "hm-primary" : ""}" data-action="${action.id}">${action.label}</button>`)
      .join("");

    renderPanel(
      "hm-toast",
      `<div class="hm-kicker">${kicker}</div>
       <div class="hm-title">${title}</div>
       <div class="hm-body">${body}</div>
       <div class="hm-actions">${actionsHtml}</div>`,
      autoClearMs
    );

    const root = ensureOverlayRoot();
    root.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const actionId = button.getAttribute("data-action");
        const action = actions.find((entry) => entry.id === actionId);
        if (action?.onClick) {
          action.onClick();
        }
      });
    });
  }

  function showEyeBreak(payload) {
    let seconds = 20;
    const guidanceList = (payload.guidance || []).map((line) => `<li>${line}</li>`).join("");

    renderPanel(
      "hm-modal",
      `<div class="hm-kicker">STATUS: ACTIVE</div>
       <div class="hm-title">${payload.title || "EYE RECOVERY PROTOCOL"}</div>
       <div class="hm-timer" id="hm-eye-timer">00:20</div>
       <div class="hm-body">LOOK AT A FAR OBJECT. RELAX SHOULDER TENSION. BLINK SLOWLY.</div>
       <ul>${guidanceList}</ul>
       <div class="hm-actions">
         <button data-action="snooze">SNOOZE 5M</button>
         <button class="hm-primary" data-action="done">COMPLETE</button>
       </div>`,
      0
    );

    const timerEl = document.getElementById("hm-eye-timer");
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

    const root = ensureOverlayRoot();
    root.querySelector("button[data-action='snooze']")?.addEventListener("click", () => {
      sendMessage({ type: "holmeta-snooze-eye-break", minutes: 5 });
      clearOverlay();
    });

    root.querySelector("button[data-action='done']")?.addEventListener("click", () => {
      clearOverlay();
    });
  }

  function showHydration(payload) {
    showToast({
      kicker: "FIELD OPERATION",
      title: payload.title || "HYDRATION CHECK",
      body: payload.message || "LOG WATER INTAKE.",
      autoClearMs: 9000,
      actions: [
        {
          id: "log",
          label: "LOG +1",
          primary: true,
          onClick: () => {
            sendMessage({ type: "holmeta-log-hydration", amount: 1 });
            clearOverlay();
          }
        },
        {
          id: "dismiss",
          label: "DISMISS",
          onClick: () => clearOverlay()
        }
      ]
    });
  }

  function showStillness(payload) {
    const stretches = (payload.stretches || []).map((line) => `<li>${line}</li>`).join("");
    showToast({
      kicker: "STATUS: WARNING",
      title: "MOVEMENT NUDGE",
      body: `INACTIVE ${payload.minutesInactive || "?"} MIN. RUN A 60-SECOND RESET.<ul>${stretches}</ul>`,
      autoClearMs: 12000
    });
  }

  function formatRemaining(endsAt) {
    const ms = Math.max(0, Number(endsAt) - Date.now());
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function renderFocusHud() {
    const root = ensureOverlayRoot();

    if (!focusSession) {
      const hud = root.querySelector(".hm-hud");
      if (hud) hud.remove();
      if (focusHudInterval) {
        clearInterval(focusHudInterval);
        focusHudInterval = null;
      }
      return;
    }

    let hud = root.querySelector(".hm-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.className = "hm-hud";
      root.appendChild(hud);
    }

    hud.innerHTML = `
      <div class="hm-kicker">FOCUS HUD</div>
      <div class="hm-title">STATUS: ACTIVE</div>
      <div class="hm-timer" id="hm-focus-remaining">${formatRemaining(focusSession.endsAt)}</div>
      <div class="hm-body">PANIC BUTTON ALWAYS ENABLED.</div>
      <div class="hm-actions">
        <button class="hm-primary" id="hm-focus-panic">PANIC STOP</button>
      </div>
    `;

    hud.querySelector("#hm-focus-panic")?.addEventListener("click", () => {
      sendMessage({ type: "holmeta-panic-focus" });
    });

    if (focusHudInterval) {
      clearInterval(focusHudInterval);
    }

    focusHudInterval = setInterval(() => {
      if (!focusSession) {
        return;
      }
      if (Date.now() >= Number(focusSession.endsAt)) {
        focusSession = null;
        renderFocusHud();
        return;
      }

      const remaining = hud.querySelector("#hm-focus-remaining");
      if (remaining) {
        remaining.textContent = formatRemaining(focusSession.endsAt);
      }
    }, 1000);
  }

  function handleMessage(message) {
    if (message.type === "holmeta-apply-filter") {
      applyFilter(message.payload);
      return;
    }

    if (message.type === "holmeta-eye-break") {
      showEyeBreak(message.payload || {});
      return;
    }

    if (message.type === "holmeta-hydration") {
      showHydration(message.payload || {});
      return;
    }

    if (message.type === "holmeta-stillness") {
      showStillness(message.payload || {});
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
      }
    });
  }

  function bootstrap() {
    installBaseStyle();
    installActivityHooks();
    pingActivity("boot");

    sendMessage({ type: "holmeta-request-state" }, (response) => {
      if (!response) {
        return;
      }

      if (response.filterPayload) {
        applyFilter(response.filterPayload);
      }

      if (response.runtime?.focusSession) {
        focusSession = response.runtime.focusSession;
        renderFocusHud();
      }
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    handleMessage(message);
  });

  bootstrap();
})();
