(() => {
  const NARROW_WIDTH = 260;
  const $ = (id) => document.getElementById(id);

  function setStatus(message) {
    const line = $("statusLine");
    if (!line) {
      return;
    }
    line.textContent = String(message || "STATUS: READY").startsWith("STATUS:")
      ? String(message)
      : `STATUS: ${String(message)}`;
  }

  function send(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        resolve(response || {});
      });
    });
  }

  function queryActiveTabContext() {
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
    const context = await queryActiveTabContext();
    if (!context.ok) {
      return context;
    }

    const response = await send({
      type,
      tabId: context.tabId,
      windowId: context.windowId
    });

    if (!response?.ok) {
      return {
        ok: false,
        error: response?.error || "PANEL_COMMAND_FAILED",
        message: response?.message || null
      };
    }

    return { ok: true, response };
  }

  async function runQuickAction(type, payload = null) {
    const response = await send(payload ? { type, payload } : { type });
    if (!response?.ok) {
      setStatus(`STATUS: ${String(response?.error || "ACTION FAILED")}`);
      return;
    }

    setStatus("STATUS: COMMAND SENT");
  }

  function updateNarrowState(width) {
    const isNarrow = Number(width) < NARROW_WIDTH;
    document.body.classList.toggle("is-narrow", isNarrow);
  }

  function installResizeWatcher() {
    const root = $("panelRoot") || document.body;

    const applyMeasure = () => {
      const width = root.getBoundingClientRect().width || window.innerWidth || 0;
      updateNarrowState(width);
    };

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        const width = entry?.contentRect?.width || root.getBoundingClientRect().width;
        updateNarrowState(width);
      });
      observer.observe(root);
    }

    window.addEventListener("resize", applyMeasure);
    applyMeasure();
  }

  function bindEvents() {
    $("closePanel")?.addEventListener("click", async () => {
      setStatus("STATUS: CLOSING PANEL");
      const result = await sendPanelCommand("HOLMETA_PANEL_CLOSE");
      if (!result.ok) {
        setStatus(`STATUS: CLOSE FAILED (${String(result.error || "UNKNOWN")})`);
        return;
      }

      setStatus("STATUS: PANEL CLOSED");
    });

    $("openOptions")?.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
      setStatus("STATUS: OPS CONSOLE OPENED");
    });

    $("focus25")?.addEventListener("click", async () => {
      await runQuickAction("holmeta-start-focus", {
        durationMin: 25,
        closeExistingTabs: true
      });
    });

    $("focus50")?.addEventListener("click", async () => {
      await runQuickAction("holmeta-start-focus", {
        durationMin: 50,
        closeExistingTabs: true
      });
    });

    $("snoozeAll")?.addEventListener("click", async () => {
      await runQuickAction("holmeta-snooze-all", { minutes: 15 });
    });

    $("panicOff")?.addEventListener("click", async () => {
      await runQuickAction("holmeta-panic-off", { minutes: 30 });
    });
  }

  function bootstrap() {
    installResizeWatcher();
    bindEvents();
    setStatus("STATUS: READY");
  }

  bootstrap();
})();
