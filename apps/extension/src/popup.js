(() => {
  const HC = globalThis.HolmetaCommon;
  const HS = globalThis.HolmetaPopupStorage || null;

  const DRAFT_KEY = "holmeta.popup.drafts.v3";
  const SAVE_UNDO_WINDOW_MS = 5000;

  const DEFAULT_DRAFTS = {
    search: "",
    tagFilter: "",
    hasReminderOnly: false,
    saveNote: "",
    saveTags: "",
    licenseKey: "",
    customReminderAt: "",
    exportSource: "inbox",
    lightIntensity: 78
  };

  const state = {
    settings: HC.normalizeSettings(HC.DEFAULT_SETTINGS),
    core: {
      schemaVersion: 1,
      items: [],
      reminders: [],
      sessions: [],
      resumeQueue: [],
      premium: {
        status: "invalid",
        statusText: "",
        planKey: "",
        lastValidatedAt: 0,
        nextCheckAt: 0
      }
    },
    premium: {
      premiumActive: false,
      status: "inactive",
      trialing: false,
      freeActive: true,
      lockReason: "UNLOCK_PREMIUM",
      plan: "free"
    },
    drafts: { ...DEFAULT_DRAFTS },
    selectedItemId: "",
    selectedReminderItemId: "",
    activeDomain: "",
    activeTabUrl: "",
    activeDrawer: "",
    undo: {
      itemId: "",
      untilTs: 0
    }
  };

  let persistTimer = null;
  let hydrationComplete = false;
  const editingIds = new Set();

  const $ = (id) => document.getElementById(id);

  function send(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({ ok: false, error: err.message || "RUNTIME_ERROR" });
          return;
        }
        resolve(response || { ok: false, error: "EMPTY_RESPONSE" });
      });
    });
  }

  function setControlValueIfIdle(id, value) {
    const element = $(id);
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      return;
    }
    if (document.activeElement === element || editingIds.has(id)) {
      return;
    }
    const safe = String(value ?? "");
    if (element.value !== safe) {
      element.value = safe;
    }
  }

  function normalizeDrafts(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      search: String(source.search || ""),
      tagFilter: String(source.tagFilter || ""),
      hasReminderOnly: Boolean(source.hasReminderOnly),
      saveNote: String(source.saveNote || ""),
      saveTags: String(source.saveTags || ""),
      // Preserve in-progress typing/paste exactly as entered.
      licenseKey: String(source.licenseKey || ""),
      customReminderAt: String(source.customReminderAt || ""),
      exportSource: String(source.exportSource || "inbox") || "inbox",
      lightIntensity: Math.max(0, Math.min(100, Math.round(Number(source.lightIntensity || 78))))
    };
  }

  function readDrafts() {
    if (HS?.readUiState) {
      return HS.readUiState().then((uiState) => normalizeDrafts({
        search: uiState.search || "",
        tagFilter: uiState.tagFilter || "",
        hasReminderOnly: uiState.hasReminderOnly || false,
        saveNote: uiState.notes || "",
        saveTags: uiState.saveTags || "",
        licenseKey: uiState.licenseKeyDraft || "",
        customReminderAt: uiState.customReminderAt || "",
        exportSource: uiState.exportSource || "inbox",
        lightIntensity: uiState.lightIntensity || 78
      }));
    }
    return new Promise((resolve) => {
      chrome.storage.local.get([DRAFT_KEY], (data) => {
        if (chrome.runtime?.lastError) {
          resolve({ ...DEFAULT_DRAFTS });
          return;
        }
        resolve(normalizeDrafts(data?.[DRAFT_KEY] || {}));
      });
    });
  }

  function writeDrafts(nextDrafts) {
    if (HS?.patchUiState) {
      const normalized = normalizeDrafts(nextDrafts || {});
      return HS.patchUiState({
        search: normalized.search,
        tagFilter: normalized.tagFilter,
        hasReminderOnly: normalized.hasReminderOnly,
        notes: normalized.saveNote,
        saveTags: normalized.saveTags,
        licenseKeyDraft: normalized.licenseKey,
        customReminderAt: normalized.customReminderAt,
        exportSource: normalized.exportSource,
        lightIntensity: normalized.lightIntensity
      }).then((result) => ({ ok: Boolean(result?.ok) }));
    }
    return new Promise((resolve) => {
      const normalized = normalizeDrafts(nextDrafts || {});
      chrome.storage.local.set({ [DRAFT_KEY]: normalized }, () => {
        resolve({ ok: !chrome.runtime?.lastError });
      });
    });
  }

  function queueDraftPersist() {
    if (!hydrationComplete) {
      return;
    }
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      writeDrafts(state.drafts);
    }, 360);
  }

  function flushDraftPersist() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    return writeDrafts(state.drafts);
  }

  function isPremiumActive() {
    return Boolean(state.premium?.premiumActive || state.settings?.devBypassPremium);
  }

  function parseTagCsv(value) {
    return [...new Set(
      String(value || "")
        .split(",")
        .map((part) => part.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )].slice(0, 12);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatWhen(ts) {
    if (!Number(ts)) {
      return "";
    }
    try {
      return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (_) {
      return "";
    }
  }

  function setSaveFeedback(text, isError = false) {
    const target = $("saveFeedback");
    if (!target) {
      return;
    }
    target.textContent = text;
    target.style.color = isError ? "var(--c-accent)" : "var(--c-muted)";
  }

  function safeOpen(url) {
    const resolved = HC.openExternal(url);
    if (resolved && typeof resolved.then === "function") {
      return resolved;
    }
    return Promise.resolve({ ok: false, error: "OPEN_FAILED" });
  }

  function reminderByItemId() {
    const active = new Map();
    const reminders = Array.isArray(state.core?.reminders) ? state.core.reminders : [];
    reminders.forEach((reminder) => {
      if (!reminder || reminder.firedAt) {
        return;
      }
      active.set(String(reminder.itemId || ""), reminder);
    });
    return active;
  }

  function filteredItems() {
    const items = Array.isArray(state.core?.items) ? [...state.core.items] : [];
    const search = String(state.drafts.search || "").trim().toLowerCase();
    const tagFilter = String(state.drafts.tagFilter || "").trim();
    const onlyReminder = Boolean(state.drafts.hasReminderOnly);
    const reminders = reminderByItemId();

    const filtered = items.filter((item) => {
      if (!item) {
        return false;
      }

      if (search) {
        const haystack = [
          item.title,
          item.url,
          item.note,
          ...(Array.isArray(item.tags) ? item.tags : [])
        ].join("\n").toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (tagFilter) {
        const tags = Array.isArray(item.tags) ? item.tags : [];
        if (!tags.includes(tagFilter)) {
          return false;
        }
      }

      if (onlyReminder && !reminders.has(String(item.id || ""))) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

    return filtered;
  }

  function itemById(itemId) {
    return (state.core.items || []).find((item) => item.id === itemId) || null;
  }

  function resumeQueueItems() {
    const ids = Array.isArray(state.core?.resumeQueue) ? state.core.resumeQueue : [];
    return ids.map((id) => itemById(id)).filter(Boolean);
  }

  function renderTagFilterOptions() {
    const select = $("tagFilter");
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const current = String(state.drafts.tagFilter || "");
    const allTags = [...new Set((state.core.items || []).flatMap((item) => Array.isArray(item.tags) ? item.tags : []))].sort((a, b) => a.localeCompare(b));

    select.innerHTML = "";
    const anyOption = document.createElement("option");
    anyOption.value = "";
    anyOption.textContent = "ALL TAGS";
    select.appendChild(anyOption);

    allTags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      select.appendChild(option);
    });

    if (current && allTags.includes(current)) {
      select.value = current;
    } else {
      select.value = "";
      state.drafts.tagFilter = "";
    }
  }

  function renderExportSources() {
    const select = $("exportSource");
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const selected = String(state.drafts.exportSource || "inbox");
    const tags = [...new Set((state.core.items || []).flatMap((item) => Array.isArray(item.tags) ? item.tags : []))].sort((a, b) => a.localeCompare(b));
    const sessions = Array.isArray(state.core.sessions) ? state.core.sessions : [];

    select.innerHTML = "";

    const inboxOpt = document.createElement("option");
    inboxOpt.value = "inbox";
    inboxOpt.textContent = "CURRENT INBOX";
    select.appendChild(inboxOpt);

    tags.forEach((tag) => {
      const opt = document.createElement("option");
      opt.value = `tag:${tag}`;
      opt.textContent = `TAG: ${tag}`;
      select.appendChild(opt);
    });

    sessions.forEach((session) => {
      const opt = document.createElement("option");
      opt.value = `session:${session.id}`;
      opt.textContent = `SESSION: ${session.name}`;
      select.appendChild(opt);
    });

    const validValues = new Set([...select.options].map((option) => option.value));
    if (validValues.has(selected)) {
      select.value = selected;
    } else {
      select.value = "inbox";
      state.drafts.exportSource = "inbox";
    }
  }

  function renderResumeList() {
    const list = $("resumeList");
    if (!(list instanceof HTMLUListElement)) {
      return;
    }

    const queueItems = resumeQueueItems();
    if (!queueItems.length) {
      list.innerHTML = '<li class="small-note">QUEUE EMPTY.</li>';
      return;
    }

    list.innerHTML = queueItems.map((item) => `
      <li class="item-card">
        <div class="item-main">
          <span class="item-title">${escapeHtml(item.title || "Untitled")}</span>
          <span class="item-meta">${escapeHtml(item.domain || "")}</span>
        </div>
        <div class="item-actions">
          <button type="button" class="secondary" data-resume-action="open" data-item-id="${item.id}">OPEN</button>
          <button type="button" class="secondary" data-resume-action="remove" data-item-id="${item.id}">REMOVE</button>
        </div>
      </li>
    `).join("");
  }

  function renderSessionList() {
    const list = $("sessionList");
    if (!(list instanceof HTMLUListElement)) {
      return;
    }

    const sessions = Array.isArray(state.core.sessions) ? state.core.sessions : [];
    if (!sessions.length) {
      list.innerHTML = '<li class="small-note">NO SAVED SESSIONS.</li>';
      return;
    }

    list.innerHTML = sessions.map((session) => `
      <li class="item-card">
        <div class="item-main">
          <span class="item-title">${escapeHtml(session.name)}</span>
          <span class="item-meta">${escapeHtml(formatWhen(session.createdAt))} · ${session.tabs.length} tabs</span>
        </div>
        <div class="item-actions">
          <button type="button" class="secondary" data-session-action="open" data-session-id="${session.id}" data-premium>OPEN</button>
          <button type="button" class="secondary" data-session-action="remove" data-session-id="${session.id}" data-premium>REMOVE</button>
        </div>
      </li>
    `).join("");
  }

  function renderInboxList() {
    const list = $("inboxList");
    if (!(list instanceof HTMLUListElement)) {
      return;
    }

    const queueSet = new Set(Array.isArray(state.core.resumeQueue) ? state.core.resumeQueue : []);
    const reminderMap = reminderByItemId();
    const items = filteredItems();

    if (!items.length) {
      list.innerHTML = '<li class="small-note">NO SAVED ITEMS. USE SAVE THIS TAB.</li>';
      return;
    }

    list.innerHTML = items.map((item) => {
      const reminder = reminderMap.get(item.id);
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const resumeLabel = queueSet.has(item.id) ? "REMOVE RESUME" : "ADD RESUME";
      const reminderPill = reminder
        ? `<span class="pill warn">REMINDER ${reminder.type === "time" ? formatWhen(reminder.when) : "NEXT VISIT"}</span>`
        : "";

      return `
        <li class="item-card" data-item-id="${item.id}">
          <div class="item-head">
            <button type="button" class="item-open secondary" data-item-action="open" data-item-id="${item.id}">
              <span class="item-title">${escapeHtml(item.title || item.url)}</span>
              <span class="item-meta">${escapeHtml(item.domain || "")}</span>
            </button>
            <details class="item-menu">
              <summary>⋯</summary>
              <div class="item-actions">
                <button type="button" class="secondary" data-item-action="edit" data-item-id="${item.id}">EDIT NOTE</button>
                <button type="button" class="secondary" data-item-action="remind" data-item-id="${item.id}" data-premium>REMIND</button>
                <button type="button" class="secondary" data-item-action="resume" data-item-id="${item.id}" data-premium>${resumeLabel}</button>
                <button type="button" class="secondary" data-item-action="remove" data-item-id="${item.id}">REMOVE</button>
              </div>
            </details>
          </div>
          <div class="tag-list">
            ${item.pinned ? '<span class="pill">PINNED</span>' : ""}
            ${reminderPill}
            ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </li>
      `;
    }).join("");
  }

  function renderPremiumState() {
    const modeChip = $("modeChip");
    const premiumChip = $("premiumChip");
    const premiumPanel = $("premiumPanel");
    const premiumCopy = $("premiumCopy");

    const premiumActive = isPremiumActive();
    if (modeChip) {
      modeChip.className = premiumActive ? "status-chip status-active" : "status-chip status-idle";
      modeChip.textContent = premiumActive ? "STATUS: ACTIVE" : "STATUS: FREE";
    }

    if (premiumChip) {
      premiumChip.className = premiumActive ? "status-chip status-active" : "status-chip status-locked";
      premiumChip.textContent = premiumActive ? "PREMIUM: ACTIVE" : "PREMIUM: LOCKED";
    }

    if (premiumPanel) {
      premiumPanel.hidden = premiumActive;
    }

    if (premiumCopy) {
      premiumCopy.textContent = premiumActive
        ? "Premium active."
        : "Unlock reminders, sessions, resume queue, export, and tags.";
    }

    document.querySelectorAll("[data-premium]").forEach((element) => {
      element.disabled = !premiumActive;
      if (!premiumActive) {
        element.title = "Premium required";
      } else {
        element.removeAttribute("title");
      }
    });

    const tagsInput = $("saveTagsInput");
    if (tagsInput instanceof HTMLInputElement) {
      tagsInput.disabled = !premiumActive;
      if (!premiumActive) {
        tagsInput.placeholder = "Premium required";
      }
    }
  }

  function renderEditors() {
    const selectedItem = itemById(state.selectedItemId);
    const itemEditor = $("itemEditor");
    if (itemEditor) {
      itemEditor.hidden = !selectedItem;
    }

    if (selectedItem) {
      setControlValueIfIdle("editNoteInput", selectedItem.note || "");
      setControlValueIfIdle("editTagsInput", (selectedItem.tags || []).join(", "));
      const title = $("itemEditorTitle");
      if (title) {
        title.textContent = `EDIT ITEM · ${String(selectedItem.domain || "").toUpperCase()}`;
      }
    }

    const reminderItem = itemById(state.selectedReminderItemId);
    const reminderEditor = $("reminderEditor");
    if (reminderEditor) {
      reminderEditor.hidden = !reminderItem;
    }

    const reminderTitle = $("reminderEditorTitle");
    if (reminderTitle && reminderItem) {
      reminderTitle.textContent = `SET REMINDER · ${String(reminderItem.domain || "").toUpperCase()}`;
    }
  }

  function renderUndoButton() {
    const undoButton = $("undoSave");
    if (!undoButton) {
      return;
    }

    const active = Boolean(state.undo.itemId) && Date.now() < Number(state.undo.untilTs || 0);
    undoButton.hidden = !active;
  }

  function renderControls() {
    setControlValueIfIdle("searchInput", state.drafts.search || "");
    setControlValueIfIdle("saveNoteInput", state.drafts.saveNote || "");
    setControlValueIfIdle("saveTagsInput", state.drafts.saveTags || "");
    setControlValueIfIdle("customReminderAt", state.drafts.customReminderAt || "");
    setControlValueIfIdle("lightIntensity", state.drafts.lightIntensity || 78);

    const hasReminderOnly = $("hasReminderOnly");
    if (hasReminderOnly instanceof HTMLInputElement) {
      hasReminderOnly.checked = Boolean(state.drafts.hasReminderOnly);
    }
  }

  function render() {
    renderPremiumState();
    renderTagFilterOptions();
    renderExportSources();
    renderControls();
    renderLightControls();
    renderWellnessControls();
    renderDrawers();
    renderResumeList();
    renderInboxList();
    renderSessionList();
    renderEditors();
    renderUndoButton();
  }

  async function refreshState() {
    const [coreResponse, stateResponse] = await Promise.all([
      send({ type: "holmeta-core-get-state" }),
      send({ type: "holmeta-request-state", domain: state.activeDomain || "" }),
      loadActiveTabContext()
    ]);

    if (!coreResponse?.ok) {
      setSaveFeedback(`STATUS: LOAD FAILED (${String(coreResponse?.error || "UNKNOWN")})`, true);
      return;
    }

    if (coreResponse.core) {
      state.core = coreResponse.core;
    }

    if (coreResponse.premium) {
      state.premium = coreResponse.premium;
    }

    if (stateResponse?.settings) {
      state.settings = HC.normalizeSettings(stateResponse.settings);
    }

    render();
  }

  function closeEditors() {
    state.selectedItemId = "";
    state.selectedReminderItemId = "";
    renderEditors();
  }

  function nextMorningTs() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
    return next.getTime();
  }

  async function setReminderPreset(itemId, preset) {
    const item = itemById(itemId);
    if (!item) {
      return;
    }

    if (preset === "30m") {
      await send({
        type: "holmeta-core-set-reminder",
        payload: {
          itemId,
          type: "time",
          when: Date.now() + 30 * 60 * 1000
        }
      });
      setSaveFeedback("STATUS: REMINDER SET (30 MIN)");
      return;
    }

    if (preset === "tomorrow") {
      await send({
        type: "holmeta-core-set-reminder",
        payload: {
          itemId,
          type: "time",
          when: nextMorningTs()
        }
      });
      setSaveFeedback("STATUS: REMINDER SET (TOMORROW)");
      return;
    }

    if (preset === "visit-domain") {
      await send({
        type: "holmeta-core-set-reminder",
        payload: {
          itemId,
          type: "next_visit",
          match: {
            domain: item.domain
          }
        }
      });
      setSaveFeedback("STATUS: REMINDER SET (NEXT DOMAIN VISIT)");
      return;
    }

    if (preset === "visit-page") {
      await send({
        type: "holmeta-core-set-reminder",
        payload: {
          itemId,
          type: "next_visit",
          match: {
            url: item.url
          }
        }
      });
      setSaveFeedback("STATUS: REMINDER SET (NEXT PAGE VISIT)");
    }
  }

  async function copyLinkPack() {
    if (!isPremiumActive()) {
      setSaveFeedback("STATUS: PREMIUM REQUIRED FOR EXPORT", true);
      return;
    }

    const source = String(state.drafts.exportSource || "inbox");
    let links = [];

    if (source.startsWith("session:")) {
      const sessionId = source.slice("session:".length);
      const session = (state.core.sessions || []).find((entry) => entry.id === sessionId);
      if (session) {
        links = session.tabs.map((tab) => normalizeLink(tab));
      }
    } else if (source.startsWith("tag:")) {
      const tag = source.slice("tag:".length);
      links = (state.core.items || [])
        .filter((item) => Array.isArray(item.tags) && item.tags.includes(tag))
        .map((item) => normalizeLink(item));
    } else {
      links = filteredItems().map((item) => normalizeLink(item));
    }

    if (!links.length) {
      setSaveFeedback("STATUS: NOTHING TO EXPORT", true);
      return;
    }

    const markdown = links
      .filter((entry) => entry.url)
      .map((entry) => `- [${entry.title}](${entry.url})`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(markdown);
      setSaveFeedback("STATUS: LINK PACK COPIED ✓");
    } catch (_) {
      setSaveFeedback("STATUS: COPY FAILED", true);
    }
  }

  function normalizeLink(entry) {
    const title = String(entry?.title || entry?.url || "Untitled").trim() || "Untitled";
    const url = String(entry?.url || "").trim();
    return { title, url };
  }

  function lightModeToPreset(mode) {
    if (mode === "red_mono") return "redNightMax";
    if (mode === "red_overlay") return "redNightStrong";
    if (mode === "dim") return "contrastGuard";
    if (mode === "grayscale") return "grayscale";
    return "nightWarmStrong";
  }

  function presetToLightMode(presetId) {
    if (presetId === "redNightMax") return "red_mono";
    if (presetId === "redNightStrong") return "red_overlay";
    if (presetId === "contrastGuard") return "dim";
    if (presetId === "grayscale") return "grayscale";
    return "warm";
  }

  function getWellnessSettings() {
    const source = state.settings?.wellness && typeof state.settings.wellness === "object"
      ? state.settings.wellness
      : {};
    return {
      breaksEnabled: Boolean(source.breaksEnabled),
      breaksIntervalMin: Math.max(15, Math.min(180, Math.round(Number(source.breaksIntervalMin || 50)))),
      eyeEnabled: Boolean(source.eyeEnabled),
      eyeIntervalMin: Math.max(10, Math.min(120, Math.round(Number(source.eyeIntervalMin || 20))))
    };
  }

  function renderDrawers() {
    const light = $("lightDrawer");
    const wellness = $("wellnessDrawer");
    const settings = $("settingsDrawer");
    if (light) light.hidden = state.activeDrawer !== "light";
    if (wellness) wellness.hidden = state.activeDrawer !== "wellness";
    if (settings) settings.hidden = state.activeDrawer !== "settings";
  }

  function renderLightControls() {
    const modeSelect = $("lightModeSelect");
    const intensity = $("lightIntensity");
    const intensityValue = $("lightIntensityValue");
    const enabledToggle = $("lightEnabledToggle");
    const siteToggle = $("lightSiteToggle");
    const domainLabel = $("activeDomainLabel");

    if (modeSelect instanceof HTMLSelectElement) {
      modeSelect.value = presetToLightMode(String(state.settings.filterPreset || ""));
    }
    if (intensity instanceof HTMLInputElement) {
      const safe = Math.max(0, Math.min(100, Math.round(Number(state.settings.filterIntensity || 0) * 100)));
      if (!editingIds.has("lightIntensity")) {
        intensity.value = String(safe);
      }
      if (intensityValue) {
        intensityValue.textContent = `${safe}%`;
      }
    }
    if (enabledToggle instanceof HTMLInputElement) {
      enabledToggle.checked = Boolean(state.settings.filterEnabled);
    }

    if (domainLabel) {
      domainLabel.textContent = state.activeDomain ? `THIS SITE: ${state.activeDomain}` : "THIS SITE: --";
    }
    if (siteToggle instanceof HTMLInputElement) {
      if (!state.activeDomain) {
        siteToggle.checked = true;
        siteToggle.disabled = true;
      } else {
        const override = state.settings.siteOverrides?.[state.activeDomain];
        siteToggle.disabled = false;
        siteToggle.checked = override?.enabled !== false;
      }
    }
  }

  function renderWellnessControls() {
    const wellness = getWellnessSettings();
    const breaksEnabled = $("breaksEnabledToggle");
    const breakInterval = $("breakIntervalSelect");
    const eyeEnabled = $("eyeEnabledToggle");
    const eyeInterval = $("eyeIntervalSelect");

    if (breaksEnabled instanceof HTMLInputElement) {
      breaksEnabled.checked = wellness.breaksEnabled;
    }
    if (breakInterval instanceof HTMLSelectElement) {
      breakInterval.value = String(wellness.breaksIntervalMin);
    }
    if (eyeEnabled instanceof HTMLInputElement) {
      eyeEnabled.checked = wellness.eyeEnabled;
    }
    if (eyeInterval instanceof HTMLSelectElement) {
      eyeInterval.value = String(wellness.eyeIntervalMin);
    }
  }

  async function loadActiveTabContext() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = Array.isArray(tabs) ? tabs[0] : null;
        const safeUrl = String(tab?.url || "");
        state.activeTabUrl = safeUrl;
        try {
          const parsed = new URL(safeUrl);
          state.activeDomain = HC.normalizeDomain(parsed.hostname);
        } catch (_) {
          state.activeDomain = "";
        }
        resolve();
      });
    });
  }

  function bindEvents() {
    document.addEventListener("focusin", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return;
      }
      if (target.id) {
        editingIds.add(target.id);
      }
    });

    document.addEventListener("focusout", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return;
      }
      if (target.id) {
        editingIds.delete(target.id);
      }
      queueDraftPersist();
    });

    window.addEventListener("beforeunload", () => {
      flushDraftPersist();
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (!target.closest(".item-menu")) {
        document.querySelectorAll(".item-menu[open]").forEach((menu) => {
          menu.removeAttribute("open");
        });
      }
    });

    $("toolLight")?.addEventListener("click", () => {
      state.activeDrawer = state.activeDrawer === "light" ? "" : "light";
      renderDrawers();
    });

    $("toolWellness")?.addEventListener("click", () => {
      state.activeDrawer = state.activeDrawer === "wellness" ? "" : "wellness";
      renderDrawers();
    });

    $("toolSettings")?.addEventListener("click", () => {
      state.activeDrawer = state.activeDrawer === "settings" ? "" : "settings";
      renderDrawers();
    });

    $("openTools")?.addEventListener("click", () => {
      state.activeDrawer = state.activeDrawer === "settings" ? "" : "settings";
      renderDrawers();
    });

    $("searchInput")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.search = String(target.value || "");
      queueDraftPersist();
      renderInboxList();
    });

    $("tagFilter")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.drafts.tagFilter = String(target.value || "");
      queueDraftPersist();
      renderInboxList();
    });

    $("hasReminderOnly")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.hasReminderOnly = Boolean(target.checked);
      queueDraftPersist();
      renderInboxList();
    });

    $("saveNoteInput")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) {
        return;
      }
      state.drafts.saveNote = String(target.value || "");
      queueDraftPersist();
    });

    $("saveTagsInput")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.saveTags = String(target.value || "");
      queueDraftPersist();
    });

    $("licenseKeyInput")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.licenseKey = String(target.value || "");
      queueDraftPersist();
    });

    $("lightIntensity")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const value = Math.max(0, Math.min(100, Math.round(Number(target.value || 0))));
      state.drafts.lightIntensity = value;
      const label = $("lightIntensityValue");
      if (label) {
        label.textContent = `${value}%`;
      }
      queueDraftPersist();
    });

    $("lightApplyNow")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR LIGHT CONTROL", true);
        return;
      }
      const modeSelect = $("lightModeSelect");
      const enabledToggle = $("lightEnabledToggle");
      const intensityInput = $("lightIntensity");
      const mode = modeSelect instanceof HTMLSelectElement ? modeSelect.value : "warm";
      const enabled = enabledToggle instanceof HTMLInputElement ? Boolean(enabledToggle.checked) : true;
      const intensity = intensityInput instanceof HTMLInputElement
        ? Math.max(0, Math.min(100, Math.round(Number(intensityInput.value || 0))))
        : state.drafts.lightIntensity;
      state.drafts.lightIntensity = intensity;
      queueDraftPersist();

      const response = await send({
        type: "holmeta-update-settings",
        patch: {
          filterEnabled: enabled,
          filterPreset: lightModeToPreset(mode),
          filterIntensity: intensity / 100
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: LIGHT APPLY FAILED", true);
        return;
      }
      await refreshState();
      setSaveFeedback("STATUS: LIGHT APPLIED");
    });

    $("lightSaveSite")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR SITE PROFILE", true);
        return;
      }
      if (!state.activeDomain) {
        setSaveFeedback("STATUS: NO ACTIVE SITE", true);
        return;
      }
      const modeSelect = $("lightModeSelect");
      const siteToggle = $("lightSiteToggle");
      const intensityInput = $("lightIntensity");
      const mode = modeSelect instanceof HTMLSelectElement ? modeSelect.value : "warm";
      const enabled = siteToggle instanceof HTMLInputElement ? Boolean(siteToggle.checked) : true;
      const intensity = intensityInput instanceof HTMLInputElement
        ? Math.max(0, Math.min(100, Math.round(Number(intensityInput.value || 0))))
        : state.drafts.lightIntensity;
      const response = await send({
        type: "holmeta-save-site-profile",
        domain: state.activeDomain,
        patch: {
          enabled,
          preset: lightModeToPreset(mode),
          intensity: intensity / 100
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: SITE PROFILE SAVE FAILED", true);
        return;
      }
      await refreshState();
      setSaveFeedback(`STATUS: SITE PROFILE SAVED (${state.activeDomain})`);
    });

    $("lightClearSite")?.addEventListener("click", async () => {
      if (!state.activeDomain) {
        setSaveFeedback("STATUS: NO ACTIVE SITE", true);
        return;
      }
      const response = await send({
        type: "holmeta-clear-site-profile",
        domain: state.activeDomain
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: CLEAR SITE PROFILE FAILED", true);
        return;
      }
      await refreshState();
      setSaveFeedback(`STATUS: SITE PROFILE CLEARED (${state.activeDomain})`);
    });

    $("saveWellness")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR WELLNESS", true);
        return;
      }
      const breaksEnabled = $("breaksEnabledToggle");
      const breakInterval = $("breakIntervalSelect");
      const eyeEnabled = $("eyeEnabledToggle");
      const eyeInterval = $("eyeIntervalSelect");
      const response = await send({
        type: "holmeta-update-settings",
        patch: {
          wellness: {
            ...getWellnessSettings(),
            breaksEnabled: breaksEnabled instanceof HTMLInputElement ? Boolean(breaksEnabled.checked) : false,
            breaksIntervalMin: breakInterval instanceof HTMLSelectElement ? Number(breakInterval.value || 50) : 50,
            eyeEnabled: eyeEnabled instanceof HTMLInputElement ? Boolean(eyeEnabled.checked) : false,
            eyeIntervalMin: eyeInterval instanceof HTMLSelectElement ? Number(eyeInterval.value || 20) : 20
          }
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: WELLNESS SAVE FAILED", true);
        return;
      }
      await refreshState();
      setSaveFeedback("STATUS: WELLNESS SAVED");
    });

    $("snoozeWellness15")?.addEventListener("click", async () => {
      await send({ type: "holmeta-snooze-wellness", minutes: 15 });
      setSaveFeedback("STATUS: WELLNESS SNOOZED 15M");
    });

    $("customReminderAt")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.customReminderAt = String(target.value || "");
      queueDraftPersist();
    });

    $("exportSource")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.drafts.exportSource = String(target.value || "inbox");
      queueDraftPersist();
    });

    $("saveCurrentTab")?.addEventListener("click", async () => {
      const payload = {
        note: String(state.drafts.saveNote || ""),
        tags: parseTagCsv(state.drafts.saveTags)
      };
      const response = await send({ type: "holmeta-core-save-current-tab", payload });
      if (!response?.ok) {
        setSaveFeedback(`STATUS: SAVE FAILED (${String(response?.error || "UNKNOWN")})`, true);
        return;
      }

      state.undo.itemId = String(response.savedItem?.id || "");
      state.undo.untilTs = Date.now() + SAVE_UNDO_WINDOW_MS;
      state.drafts.saveNote = "";
      state.drafts.saveTags = "";
      queueDraftPersist();
      setSaveFeedback("SAVED ✓");
      await refreshState();
      setTimeout(() => {
        if (Date.now() > state.undo.untilTs) {
          state.undo.itemId = "";
          renderUndoButton();
        }
      }, SAVE_UNDO_WINDOW_MS + 50);
    });

    $("undoSave")?.addEventListener("click", async () => {
      if (!state.undo.itemId || Date.now() > state.undo.untilTs) {
        return;
      }
      const response = await send({ type: "holmeta-core-undo-save", itemId: state.undo.itemId });
      if (!response?.ok) {
        setSaveFeedback("STATUS: UNDO FAILED", true);
        return;
      }
      state.undo.itemId = "";
      state.undo.untilTs = 0;
      setSaveFeedback("UNDO COMPLETE");
      await refreshState();
    });

    $("activateLicense")?.addEventListener("click", async () => {
      const licenseKey = String(state.drafts.licenseKey || "").trim().toUpperCase();
      if (!licenseKey) {
        setSaveFeedback("STATUS: LICENSE KEY REQUIRED", true);
        return;
      }
      const response = await send({ type: "holmeta-activate-license", licenseKey });
      if (!response?.ok) {
        setSaveFeedback("STATUS: LICENSE INVALID", true);
        return;
      }
      state.drafts.licenseKey = licenseKey;
      queueDraftPersist();
      setSaveFeedback("STATUS: PREMIUM UNLOCKED");
      await refreshState();
    });

    $("refreshPremium")?.addEventListener("click", async () => {
      await send({ type: "holmeta-refresh-entitlement" });
      await refreshState();
      setSaveFeedback("STATUS: PREMIUM REFRESHED");
    });

    $("openSubscribe")?.addEventListener("click", async () => {
      const checkoutUrl = String(state.settings?.checkoutUrl || HC.DEFAULT_SETTINGS.checkoutUrl || "").trim();
      if (!checkoutUrl) {
        setSaveFeedback("STATUS: CHECKOUT URL INVALID", true);
        return;
      }
      await safeOpen(checkoutUrl);
    });

    $("saveSession")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        return;
      }
      const suggested = `Session — ${new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
      const name = window.prompt("Session name", suggested) || suggested;
      const response = await send({ type: "holmeta-core-save-session", payload: { name } });
      if (!response?.ok) {
        setSaveFeedback(`STATUS: SESSION SAVE FAILED (${String(response?.error || "UNKNOWN")})`, true);
        return;
      }
      setSaveFeedback("STATUS: SESSION SAVED");
      await refreshState();
    });

    $("resumeNext")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-core-resume-action", payload: { action: "open_next" } });
      if (!response?.ok) {
        setSaveFeedback("STATUS: RESUME QUEUE EMPTY", true);
        return;
      }
      await refreshState();
    });

    $("resumeClear")?.addEventListener("click", async () => {
      await send({ type: "holmeta-core-resume-action", payload: { action: "clear" } });
      await refreshState();
    });

    $("copyLinkPack")?.addEventListener("click", async () => {
      await copyLinkPack();
    });

    $("inboxList")?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest("button[data-item-action]") : null;
      if (!button) {
        return;
      }

      const action = button.getAttribute("data-item-action") || "";
      const itemId = button.getAttribute("data-item-id") || "";
      const menu = button.closest(".item-menu");
      if (menu) {
        menu.removeAttribute("open");
      }
      if (!itemId) {
        return;
      }

      if (action === "open") {
        await send({ type: "holmeta-core-open-item", itemId });
        return;
      }

      if (action === "edit") {
        state.selectedItemId = itemId;
        renderEditors();
        return;
      }

      if (action === "remind") {
        state.selectedReminderItemId = itemId;
        renderEditors();
        return;
      }

      if (action === "remove") {
        const confirmed = window.confirm("Remove this saved item?");
        if (!confirmed) {
          return;
        }
        await send({ type: "holmeta-core-remove-item", itemId });
        await refreshState();
        return;
      }

      if (action === "resume") {
        const inQueue = (state.core.resumeQueue || []).includes(itemId);
        const response = await send({
          type: "holmeta-core-resume-action",
          payload: {
            action: inQueue ? "remove" : "add",
            itemId
          }
        });
        if (!response?.ok) {
          setSaveFeedback("STATUS: PREMIUM REQUIRED FOR RESUME", true);
          return;
        }
        await refreshState();
      }
    });

    $("resumeList")?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest("button[data-resume-action]") : null;
      if (!button) {
        return;
      }
      const action = button.getAttribute("data-resume-action") || "";
      const itemId = button.getAttribute("data-item-id") || "";
      if (!itemId) {
        return;
      }

      if (action === "open") {
        await send({ type: "holmeta-core-open-item", itemId });
        return;
      }

      if (action === "remove") {
        await send({ type: "holmeta-core-resume-action", payload: { action: "remove", itemId } });
        await refreshState();
      }
    });

    $("sessionList")?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest("button[data-session-action]") : null;
      if (!button) {
        return;
      }
      const action = button.getAttribute("data-session-action") || "";
      const sessionId = button.getAttribute("data-session-id") || "";
      if (!sessionId) {
        return;
      }

      if (action === "open") {
        await send({ type: "holmeta-core-open-session", sessionId });
        return;
      }

      if (action === "remove") {
        const confirmed = window.confirm("Delete this session?");
        if (!confirmed) {
          return;
        }
        await send({ type: "holmeta-core-delete-session", sessionId });
        await refreshState();
      }
    });

    $("saveItemMeta")?.addEventListener("click", async () => {
      const itemId = state.selectedItemId;
      if (!itemId) {
        return;
      }

      const noteInput = $("editNoteInput");
      const tagsInput = $("editTagsInput");
      const note = noteInput instanceof HTMLInputElement ? noteInput.value : "";
      const tags = tagsInput instanceof HTMLInputElement ? parseTagCsv(tagsInput.value) : [];

      const response = await send({
        type: "holmeta-core-update-item",
        payload: {
          itemId,
          note,
          tags
        }
      });

      if (!response?.ok) {
        setSaveFeedback("STATUS: SAVE META FAILED", true);
        return;
      }

      closeEditors();
      setSaveFeedback("STATUS: ITEM UPDATED");
      await refreshState();
    });

    $("cancelItemMeta")?.addEventListener("click", () => {
      state.selectedItemId = "";
      renderEditors();
    });

    document.querySelectorAll("button[data-reminder-preset]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!state.selectedReminderItemId) {
          return;
        }
        await setReminderPreset(state.selectedReminderItemId, button.getAttribute("data-reminder-preset") || "");
        state.selectedReminderItemId = "";
        await refreshState();
      });
    });

    $("applyCustomReminder")?.addEventListener("click", async () => {
      if (!state.selectedReminderItemId) {
        return;
      }
      const dateInput = $("customReminderAt");
      if (!(dateInput instanceof HTMLInputElement) || !dateInput.value) {
        setSaveFeedback("STATUS: PICK DATE/TIME", true);
        return;
      }
      const whenTs = Date.parse(dateInput.value);
      if (!Number.isFinite(whenTs) || whenTs <= Date.now()) {
        setSaveFeedback("STATUS: INVALID DATE/TIME", true);
        return;
      }
      const response = await send({
        type: "holmeta-core-set-reminder",
        payload: {
          itemId: state.selectedReminderItemId,
          type: "time",
          when: whenTs
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: REMINDER FAILED", true);
        return;
      }
      state.selectedReminderItemId = "";
      state.drafts.customReminderAt = dateInput.value;
      queueDraftPersist();
      setSaveFeedback("STATUS: CUSTOM REMINDER SET");
      await refreshState();
    });

    $("clearReminder")?.addEventListener("click", async () => {
      const itemId = state.selectedReminderItemId;
      if (!itemId) {
        return;
      }
      const reminder = reminderByItemId().get(itemId);
      if (!reminder) {
        state.selectedReminderItemId = "";
        renderEditors();
        return;
      }
      await send({ type: "holmeta-core-clear-reminder", reminderId: reminder.id });
      state.selectedReminderItemId = "";
      setSaveFeedback("STATUS: REMINDER CLEARED");
      await refreshState();
    });

    $("closeReminderEditor")?.addEventListener("click", () => {
      state.selectedReminderItemId = "";
      renderEditors();
    });
  }

  async function bootstrap() {
    state.drafts = await readDrafts();
    hydrationComplete = true;
    await loadActiveTabContext();
    bindEvents();
    // Set once on startup; avoid render-loop writes into the license field.
    setControlValueIfIdle("licenseKeyInput", state.drafts.licenseKey || "");
    await refreshState();
  }

  bootstrap();
})();
