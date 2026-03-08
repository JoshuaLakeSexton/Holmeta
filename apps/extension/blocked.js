(() => {
  const statusEl = document.getElementById("status");

  function setStatus(text, error = false) {
    statusEl.textContent = text;
    statusEl.style.color = error ? "#ffb300" : "#b6b6ba";
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

  document.getElementById("pause10").addEventListener("click", async () => {
    const response = await send({ type: "holmeta:pause-blocker", minutes: 10 });
    if (!response.ok) {
      setStatus(`Pause failed: ${response.error || "unknown"}`, true);
      return;
    }
    setStatus("Blocker paused for 10 minutes. Reload your target page.");
  });

  document.getElementById("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  send({ type: "holmeta:blocked-hit" }).catch(() => {});

  send({ type: "holmeta:get-blocked-context" }).then((res) => {
    if (!res?.ok) return;
    if (res.pausedUntil > Date.now()) {
      const mins = Math.max(1, Math.ceil((res.pausedUntil - Date.now()) / 60000));
      setStatus(`Blocker paused (${mins}m remaining).`);
    }
  });
})();
