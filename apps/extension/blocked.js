(() => {
  const refs = {
    modeChip: document.getElementById("modeChip"),
    reasonChip: document.getElementById("reasonChip"),
    reasonDetail: document.getElementById("reasonDetail"),
    targetHost: document.getElementById("targetHost"),
    targetUrl: document.getElementById("targetUrl"),
    blockedToday: document.getElementById("blockedToday"),
    blockedTotal: document.getElementById("blockedTotal"),
    pauseState: document.getElementById("pauseState"),
    status: document.getElementById("status"),
    pause10: document.getElementById("pause10"),
    pause30: document.getElementById("pause30"),
    allowAction: document.getElementById("allowAction"),
    openOptions: document.getElementById("openOptions"),
    closeTab: document.getElementById("closeTab")
  };

  let context = {
    targetUrl: "",
    targetHost: "",
    pausedUntil: 0,
    blockedToday: 0,
    blockedTotal: 0,
    reasonLabel: "Shield rules",
    reasonDetail: "This route matched your current Holmeta shield rules.",
    modeLabel: "Shield live",
    blockerActive: true,
    directBlocked: false,
    canAllow: false
  };
  let pauseTimer = null;

  function setStatus(text, tone = "neutral") {
    refs.status.textContent = text;
    refs.status.dataset.tone = tone;
  }

  function send(message) {
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

  function getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.getCurrent((tab) => resolve(tab || null));
    });
  }

  async function navigateToTarget() {
    if (!context.targetUrl) {
      setStatus("Shield changed, but no saved target was available.", "warning");
      return;
    }
    const tab = await getCurrentTab();
    if (!tab?.id) {
      setStatus("Shield changed. Reopen the blocked site from your normal tab.", "warning");
      return;
    }
    chrome.tabs.update(tab.id, { url: context.targetUrl });
  }

  async function closeCurrentTab() {
    const tab = await getCurrentTab();
    if (!tab?.id) return;
    chrome.tabs.remove(tab.id);
  }

  function clearPauseTimer() {
    if (pauseTimer) {
      clearInterval(pauseTimer);
      pauseTimer = null;
    }
  }

  function formatPauseState() {
    const remaining = Math.max(0, Number(context.pausedUntil || 0) - Date.now());
    if (!remaining) return "Live";
    const mins = Math.max(1, Math.ceil(remaining / 60000));
    return `${mins}m pause`;
  }

  function syncPauseState() {
    refs.pauseState.textContent = formatPauseState();
    const remaining = Math.max(0, Number(context.pausedUntil || 0) - Date.now());
    if (!remaining) {
      clearPauseTimer();
      if (!context.blockerActive) {
        refs.pauseState.textContent = "Idle";
      }
    }
  }

  function updateAllowAction() {
    const label = context.directBlocked ? "Unblock Site" : "Allow Site";
    refs.allowAction.textContent = label;
    refs.allowAction.disabled = !context.canAllow;
  }

  function renderContext() {
    refs.modeChip.textContent = context.modeLabel || "Shield live";
    refs.reasonChip.textContent = context.reasonLabel || "Shield rules";
    refs.reasonDetail.textContent = context.reasonDetail || "This route matched your current Holmeta shield rules.";
    refs.targetHost.textContent = context.targetHost || "Blocked route";
    refs.targetUrl.textContent = context.targetUrl || "Holmeta can still protect this route even when the exact target is unavailable.";
    refs.blockedToday.textContent = String(Math.max(0, Number(context.blockedToday || 0)));
    refs.blockedTotal.textContent = String(Math.max(0, Number(context.blockedTotal || 0)));
    syncPauseState();
    updateAllowAction();
  }

  function startPauseCountdown() {
    clearPauseTimer();
    if (Number(context.pausedUntil || 0) <= Date.now()) {
      syncPauseState();
      return;
    }
    pauseTimer = setInterval(syncPauseState, 15000);
  }

  async function pauseShield(minutes) {
    setStatus(`Pausing shield for ${minutes} minutes…`);
    const response = await send({ type: "holmeta:pause-blocker", minutes });
    if (!response?.ok) {
      setStatus(`Pause failed: ${response?.error || "unknown"}`, "danger");
      return;
    }
    context.pausedUntil = Number(response.pausedUntil || 0);
    renderContext();
    startPauseCountdown();
    setStatus(`Shield paused for ${minutes} minutes. Returning you to the site now.`, "success");
    await navigateToTarget();
  }

  async function applySiteException() {
    if (!context.targetHost) {
      setStatus("No blocked host was available for this action.", "warning");
      return;
    }

    const message = context.directBlocked
      ? { type: "holmeta:remove-blocked-domain", host: context.targetHost }
      : { type: "holmeta:toggle-blocker-whitelist-site", host: context.targetHost };

    setStatus(context.directBlocked ? "Removing direct block…" : "Allowing this site…");
    const response = await send(message);
    if (!response?.ok) {
      setStatus(`Site action failed: ${response?.error || "unknown"}`, "danger");
      return;
    }

    setStatus(
      context.directBlocked
        ? "Direct block removed. Returning you to the site now."
        : "Allow rule saved. Returning you to the site now.",
      "success"
    );
    await navigateToTarget();
  }

  async function loadContext() {
    const res = await send({ type: "holmeta:get-blocked-context" });
    if (!res?.ok) {
      setStatus("Could not load shield context.", "danger");
      return;
    }
    context = {
      ...context,
      ...res
    };
    renderContext();
    startPauseCountdown();
    if (Number(context.pausedUntil || 0) > Date.now()) {
      setStatus("Shield is already paused. You can return to the site now.", "warning");
    } else {
      setStatus("Shield active.");
    }
  }

  refs.pause10.addEventListener("click", () => pauseShield(10));
  refs.pause30.addEventListener("click", () => pauseShield(30));
  refs.allowAction.addEventListener("click", applySiteException);
  refs.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
  refs.closeTab.addEventListener("click", closeCurrentTab);

  send({ type: "holmeta:blocked-hit" }).catch(() => {});
  loadContext().catch(() => {
    setStatus("Shield context failed to load.", "danger");
  });

  window.addEventListener("beforeunload", clearPauseTimer, { once: true });
})();
