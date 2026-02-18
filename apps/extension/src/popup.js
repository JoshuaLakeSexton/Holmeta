(() => {
  const HC = globalThis.HolmetaCommon;
  const state = {
    settings: { ...HC.DEFAULT_SETTINGS },
    runtime: { ...HC.DEFAULT_RUNTIME },
    entitlement: { active: false, plan: null, renewsAt: null },
    hydrationToday: 0,
    calmToday: 0,
    activeDomain: ""
  };

  let breathworkInterval = null;

  const $ = (id) => document.getElementById(id);

  function send(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        resolve(response || {});
      });
    });
  }

  function getActiveTabDomain() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        if (!tab?.url) {
          resolve("");
          return;
        }
        try {
          resolve(new URL(tab.url).hostname);
        } catch (_) {
          resolve("");
        }
      });
    });
  }

  function isPremium() {
    return Boolean(state.settings.devBypassPremium || state.entitlement.active);
  }

  function formatClock(date = new Date()) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatFocusRemaining() {
    const focus = state.runtime.focusSession;
    if (!focus) {
      return "IDLE";
    }

    const remainingMs = Math.max(0, Number(focus.endsAt) - Date.now());
    const totalSeconds = Math.round(remainingMs / 1000);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function updateStatusChip() {
    const chip = $("statusChip");
    const focusActive = Boolean(state.runtime.focusSession);

    chip.className = "status-chip";
    if (focusActive) {
      chip.classList.add("status-active");
      chip.textContent = "STATUS: ACTIVE";
      return;
    }

    if (!isPremium()) {
      chip.classList.add("status-warning");
      chip.textContent = "STATUS: FREE MODE";
      return;
    }

    chip.classList.add("status-active");
    chip.textContent = "STATUS: STANDBY";
  }

  function render() {
    updateStatusChip();

    $("filterReadout").textContent = `${state.settings.filterPreset} · ${Math.round(Number(state.settings.filterIntensity) * 100)}%`;
    $("localTime").textContent = `LOCAL TIME: ${formatClock()}`;

    const focusText = formatFocusRemaining();
    $("focusReadout").textContent = focusText;
    $("focusMeta").textContent = state.runtime.focusSession
      ? `ENDS: ${new Date(state.runtime.focusSession.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "MODE: READY";

    const hydrationGoal = Number(state.settings.hydrationGoalGlasses || 8);
    $("hydrationReadout").textContent = `${state.hydrationToday} / ${hydrationGoal}`;
    const streak = HC.computeHydrationStreak({ [HC.todayKey()]: state.hydrationToday });
    $("hydrationMeta").textContent = `STREAK: ${streak || (state.hydrationToday > 0 ? 1 : 0)} DAYS`;

    $("calmReadout").textContent = String(state.calmToday || 0);

    $("presetSelect").value = state.settings.filterPreset;
    $("intensityRange").value = String(Math.round(Number(state.settings.filterIntensity) * 100));
    $("intensityValue").textContent = `${Math.round(Number(state.settings.filterIntensity) * 100)}%`;

    $("focusDomains").value = (state.settings.distractorDomains || []).join(", ");

    const isDisabled = state.activeDomain
      ? (state.settings.disabledDomains || []).some((domain) => HC.domainMatches(state.activeDomain, domain))
      : false;
    $("disableSiteToggle").checked = isDisabled;

    const entitlementChip = $("entitlementStatus");
    const paywallCopy = $("paywallCopy");

    if (isPremium()) {
      entitlementChip.className = "status-chip status-active";
      entitlementChip.textContent = state.settings.devBypassPremium
        ? "STATUS: DEV BYPASS"
        : "STATUS: PREMIUM ACTIVE";
      paywallCopy.textContent = state.settings.devBypassPremium
        ? "Premium gating scaffold is active but bypassed in dev mode."
        : "Premium active. Advanced customization unlocked.";
    } else {
      entitlementChip.className = "status-chip status-locked";
      entitlementChip.textContent = "STATUS: LOCKED";
      paywallCopy.textContent = "Basic reminders stay available. Advanced controls are locked until subscription is active.";
    }
  }

  async function refreshState() {
    const response = await send({ type: "holmeta-request-state" });
    if (response.settings) state.settings = response.settings;
    if (response.runtime) state.runtime = response.runtime;
    if (response.entitlement) state.entitlement = response.entitlement;
    state.hydrationToday = Number(response.hydrationToday || 0);
    state.calmToday = Number(response.calmToday || 0);
    state.activeDomain = await getActiveTabDomain();
    render();
  }

  async function patchSettings(patch) {
    const response = await send({
      type: "holmeta-update-settings",
      patch
    });
    if (response.settings) {
      state.settings = response.settings;
      render();
    }
  }

  function playBeep() {
    if (!state.settings.audioCues) return;

    const context = new AudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.frequency.value = 880;
    gain.gain.value = 0.04;

    osc.connect(gain);
    gain.connect(context.destination);

    osc.start();
    osc.stop(context.currentTime + 0.12);
  }

  async function runBreathwork(mode) {
    if (breathworkInterval) {
      clearInterval(breathworkInterval);
      breathworkInterval = null;
    }

    const protocols = {
      box: {
        steps: ["INHALE", "HOLD", "EXHALE", "HOLD"],
        secPerStep: 4,
        durationSec: 60
      },
      "478": {
        steps: ["INHALE", "HOLD", "EXHALE"],
        secPerStep: [4, 7, 8],
        durationSec: 76
      },
      sigh: {
        steps: ["INHALE", "INHALE TOP-UP", "LONG EXHALE"],
        secPerStep: [2, 2, 6],
        durationSec: 72
      }
    };

    const protocol = protocols[mode];
    if (!protocol) return;

    let elapsed = 0;
    let stepIndex = 0;
    let stepElapsed = 0;

    $("breathStatus").textContent = `STATUS: ${protocol.steps[0]}`;

    breathworkInterval = setInterval(async () => {
      elapsed += 1;
      stepElapsed += 1;

      const durationForStep = Array.isArray(protocol.secPerStep)
        ? protocol.secPerStep[stepIndex % protocol.secPerStep.length]
        : protocol.secPerStep;

      if (stepElapsed >= durationForStep) {
        stepIndex += 1;
        stepElapsed = 0;
        const step = protocol.steps[stepIndex % protocol.steps.length];
        $("breathStatus").textContent = `STATUS: ${step}`;
        playBeep();

        if (state.settings.speechCues && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(step.toLowerCase());
          utterance.rate = 1;
          speechSynthesis.speak(utterance);
        }
      }

      if (elapsed >= protocol.durationSec) {
        clearInterval(breathworkInterval);
        breathworkInterval = null;
        $("breathStatus").textContent = "STATUS: SESSION COMPLETE";
        const minutes = Math.max(1, Math.round(protocol.durationSec / 60));
        await send({ type: "holmeta-add-calm-minutes", minutes });
        await refreshState();
      }
    }, 1000);
  }

  function bindEvents() {
    $("presetSelect").addEventListener("change", async (event) => {
      await patchSettings({ filterPreset: event.target.value });
    });

    $("intensityRange").addEventListener("input", async (event) => {
      const value = Number(event.target.value) / 100;
      $("intensityValue").textContent = `${Math.round(value * 100)}%`;
      await patchSettings({ filterIntensity: value });
    });

    $("disableSiteToggle").addEventListener("change", async (event) => {
      if (!state.activeDomain) return;
      await send({
        type: "holmeta-toggle-domain-filter",
        domain: state.activeDomain,
        enabled: event.target.checked
      });
      await refreshState();
    });

    document.querySelectorAll("[data-focus]").forEach((button) => {
      button.addEventListener("click", async () => {
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

    $("saveFocusDomains").addEventListener("click", async () => {
      const domains = HC.parseDomainList($("focusDomains").value);
      await patchSettings({ distractorDomains: domains });
    });

    $("panicButton").addEventListener("click", async () => {
      await send({ type: "holmeta-panic-focus" });
      await refreshState();
    });

    $("eyeBreakNow").addEventListener("click", async () => {
      await send({ type: "holmeta-trigger-eye-break" });
    });

    $("logHydration").addEventListener("click", async () => {
      await send({ type: "holmeta-log-hydration", amount: 1 });
      await refreshState();
    });

    document.querySelectorAll(".breath-btn").forEach((button) => {
      button.addEventListener("click", () => {
        runBreathwork(button.getAttribute("data-breath"));
      });
    });

    $("unlockPremium").addEventListener("click", async () => {
      const checkoutUrl = state.settings.checkoutUrl || "https://holmeta.app/pricing";
      await chrome.tabs.create({ url: checkoutUrl });
    });

    $("refreshEntitlement").addEventListener("click", async () => {
      await send({ type: "holmeta-refresh-entitlement" });
      await refreshState();
    });

    $("openOptions").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async function bootstrap() {
    bindEvents();
    await refreshState();

    setInterval(() => {
      render();
    }, 1000);
  }

  bootstrap();
})();
