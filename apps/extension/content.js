// HOLMETA v3.0 content runtime
// Delegates rendering to Light Filters v2 engine and keeps page interaction intact.

(() => {
  if (window.__HOLMETA_V3__) return;
  window.__HOLMETA_V3__ = true;

  if (!/^https?:$/.test(location.protocol)) return;

  const IDS = {
    STYLE: "holmeta-content-style-v3",
    TOAST_HOST: "holmeta-toast-host-v3"
  };

  const state = {
    settings: null,
    licensePremium: false,
    effective: {
      lightActive: false,
      blockerActive: false,
      deepWorkActive: false
    },
    diagnostics: null,
    audioCtx: null,
    morphObserver: null,
    morphDebounce: null,
    biofeedbackTimer: null
  };

  function debug() {
    return Boolean(state.settings?.meta?.debug);
  }

  function log(level, event, data = {}) {
    if (level !== "error" && !debug()) return;
    const prefix = "[Holmeta content]";
    if (level === "error") console.error(prefix, event, data);
    else console.info(prefix, event, data);
  }

  function ensureStyle() {
    if (document.getElementById(IDS.STYLE)) return;
    const style = document.createElement("style");
    style.id = IDS.STYLE;
    style.textContent = `
      #${IDS.TOAST_HOST} {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 2147483646;
        display: grid;
        gap: 8px;
        pointer-events: none;
      }

      .holmeta-toast {
        min-width: 240px;
        max-width: min(360px, 90vw);
        border: 1px solid rgba(255, 179, 0, 0.36);
        background: rgba(20, 17, 15, 0.94);
        color: #f3f3f4;
        padding: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        pointer-events: auto;
      }

      .holmeta-toast .title {
        font-weight: 700;
        margin-bottom: 4px;
      }

      .holmeta-toast .actions {
        margin-top: 8px;
        display: flex;
        gap: 8px;
      }

      .holmeta-toast button {
        border: 1px solid rgba(243, 243, 244, 0.2);
        background: rgba(20, 17, 15, 0.92);
        color: #f3f3f4;
        font-size: 11px;
        min-height: 28px;
        padding: 0 8px;
        cursor: pointer;
      }

      html.holmeta-morph [class*="sidebar"],
      html.holmeta-morph [id*="sidebar"],
      html.holmeta-morph aside,
      html.holmeta-morph [role="complementary"] {
        display: none !important;
      }

      html.holmeta-morph [aria-label*="Shorts"],
      html.holmeta-morph ytd-reel-shelf-renderer,
      html.holmeta-morph #related,
      html.holmeta-morph [class*="recommend"],
      html.holmeta-morph [class*="reel"] {
        display: none !important;
      }

      html.holmeta-morph main {
        max-width: 920px !important;
        margin: 0 auto !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .holmeta-toast {
          transition: none !important;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureToastHost() {
    ensureStyle();
    let host = document.getElementById(IDS.TOAST_HOST);
    if (host) return host;
    host = document.createElement("div");
    host.id = IDS.TOAST_HOST;
    document.documentElement.appendChild(host);
    return host;
  }

  function showToast(payload = {}) {
    const host = ensureToastHost();
    const toast = document.createElement("article");
    toast.className = "holmeta-toast";
    toast.innerHTML = `
      <div class="title">${String(payload.title || "HOLMETA")}</div>
      <div>${String(payload.body || "")}</div>
      <div class="actions">
        <button data-action="dismiss">Dismiss</button>
        <button data-action="snooze">Snooze 10m</button>
      </div>
    `;

    toast.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.getAttribute("data-action");
      if (action === "snooze") {
        chrome.runtime.sendMessage({ type: "holmeta:snooze-alerts", minutes: 10 });
      }
      toast.remove();
    });

    host.appendChild(toast);
    setTimeout(() => toast.remove(), 9000);
  }

  function getAudioContext() {
    if (state.audioCtx) return state.audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    state.audioCtx = new Ctx();
    return state.audioCtx;
  }

  async function playAlertSound(kind = "eye", volume = 0.25) {
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      return false;
    }

    const frequencies = {
      eye: 540,
      posture: 460,
      burnout: 300
    };

    const hz = frequencies[kind] || 520;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(hz, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(Math.max(0.04, Math.min(0.5, Number(volume || 0.25))), t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.29);
    return true;
  }

  function applyMorphing(enabled) {
    const root = document.documentElement;
    root.classList.toggle("holmeta-morph", Boolean(enabled));

    if (enabled) ensureMorphObserver();
    else disconnectMorphObserver();
  }

  function ensureMorphObserver() {
    if (state.morphObserver) return;
    state.morphObserver = new MutationObserver(() => {
      if (state.morphDebounce) clearTimeout(state.morphDebounce);
      state.morphDebounce = setTimeout(() => {
        applyMorphing(Boolean(state.licensePremium && state.settings?.advanced?.morphing));
      }, 900);
    });

    state.morphObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function disconnectMorphObserver() {
    if (state.morphObserver) {
      state.morphObserver.disconnect();
      state.morphObserver = null;
    }
    if (state.morphDebounce) {
      clearTimeout(state.morphDebounce);
      state.morphDebounce = null;
    }
  }

  function runBiofeedbackFallback() {
    if (state.biofeedbackTimer) return;
    state.biofeedbackTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!state.settings?.advanced?.biofeedback || !state.licensePremium) return;
      showToast({
        title: "Biofeedback Beta",
        body: "Posture check: shoulders down, chin neutral, unclench jaw."
      });
    }, 5 * 60 * 1000);
  }

  function stopBiofeedbackFallback() {
    if (!state.biofeedbackTimer) return;
    clearInterval(state.biofeedbackTimer);
    state.biofeedbackTimer = null;
  }

  function applyLightEngine() {
    const engine = globalThis.HolmetaLightEngine;
    if (!engine || typeof engine.apply !== "function") {
      log("error", "light_engine_missing");
      return;
    }

    state.diagnostics = engine.apply({
      settings: state.settings,
      effective: state.effective,
      license: { premium: state.licensePremium }
    });
  }

  function applyState(payload = {}) {
    if (payload.settings && typeof payload.settings === "object") {
      state.settings = payload.settings;
    }

    if (payload.license && typeof payload.license === "object") {
      state.licensePremium = Boolean(payload.license.premium);
    }

    if (payload.effective && typeof payload.effective === "object") {
      state.effective = {
        ...state.effective,
        ...payload.effective
      };
    }

    if (!state.settings) return;

    applyLightEngine();
    applyMorphing(Boolean(state.licensePremium && state.settings.advanced?.morphing));

    if (state.licensePremium && state.settings.advanced?.biofeedback) {
      runBiofeedbackFallback();
    } else {
      stopBiofeedbackFallback();
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = String(message?.type || "");

    if (type === "holmeta:apply-state") {
      applyState(message.payload || {});
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:toast") {
      showToast(message.payload || {});
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:sound") {
      const payload = message.payload || {};
      playAlertSound(payload.kind, payload.volume).then((ok) => sendResponse({ ok }));
      return true;
    }

    if (type === "holmeta:get-light-diagnostics") {
      const diagnostics = globalThis.HolmetaLightEngine?.getDiagnostics?.() || state.diagnostics || null;
      sendResponse({ ok: true, diagnostics });
      return false;
    }

    if (type === "holmeta:set-spotlight-point") {
      const point = message.point || {};
      globalThis.HolmetaLightEngine?.setSpotlightPoint?.(point);
      applyLightEngine();
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:clear-spotlight-point") {
      globalThis.HolmetaLightEngine?.resetSpotlightPoint?.();
      applyLightEngine();
      sendResponse({ ok: true });
      return false;
    }

    sendResponse({ ok: false, error: "unknown_message" });
    return false;
  });

  chrome.runtime.sendMessage({ type: "holmeta:get-state" }, (response) => {
    const err = chrome.runtime.lastError;
    if (err || !response?.ok) return;

    applyState({
      settings: response.state.settings,
      license: response.state.license,
      effective: {
        lightActive: response.state.runtime.lightActive,
        blockerActive: response.state.runtime.blockerActive,
        deepWorkActive: Boolean(response.state.settings?.deepWork?.active)
      }
    });
  });

  globalThis.__HOLMETA_CONTENT_TEST__ = {
    normalizeHost: globalThis.HolmetaLightEngine?.normalizeHost || ((v) => v)
  };
})();
