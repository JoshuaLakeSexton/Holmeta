(() => {
  const STATE_KEY = "holmeta_ui_state_v1";
  const VERSION = 1;

  const DEFAULT_STATE = {
    version: VERSION,
    notes: "",
    search: "",
    tagFilter: "",
    hasReminderOnly: false,
    saveTags: "",
    licenseKeyDraft: "",
    checkoutSessionDraft: "",
    domainsDraft: "",
    customReminderAt: "",
    exportSource: "inbox",
    lightIntensity: 78,
    updatedAt: 0
  };

  function normalizeState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      version: VERSION,
      notes: String(source.notes || ""),
      search: String(source.search || ""),
      tagFilter: String(source.tagFilter || ""),
      hasReminderOnly: Boolean(source.hasReminderOnly),
      saveTags: String(source.saveTags || ""),
      // Keep raw draft text untouched while typing; normalize only on activation.
      licenseKeyDraft: String(source.licenseKeyDraft || ""),
      checkoutSessionDraft: String(source.checkoutSessionDraft || "").trim(),
      domainsDraft: String(source.domainsDraft || ""),
      customReminderAt: String(source.customReminderAt || ""),
      exportSource: String(source.exportSource || "inbox") || "inbox",
      lightIntensity: Math.max(0, Math.min(100, Math.round(Number(source.lightIntensity || 78)))),
      updatedAt: Number(source.updatedAt || 0)
    };
  }

  function readUiState() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STATE_KEY], (result) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({ ...DEFAULT_STATE });
          return;
        }

        resolve(normalizeState(result?.[STATE_KEY]));
      });
    });
  }

  function writeUiState(nextState) {
    return new Promise((resolve) => {
      const payload = normalizeState({
        ...(nextState || {}),
        updatedAt: Date.now()
      });
      chrome.storage.local.set({ [STATE_KEY]: payload }, () => {
        resolve({
          ok: !chrome.runtime?.lastError,
          state: payload
        });
      });
    });
  }

  async function patchUiState(patch) {
    const current = await readUiState();
    return writeUiState({
      ...current,
      ...(patch || {})
    });
  }

  globalThis.HolmetaPopupStorage = {
    STATE_KEY,
    VERSION,
    DEFAULT_STATE,
    readUiState,
    writeUiState,
    patchUiState
  };
})();
