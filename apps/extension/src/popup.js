(() => {
  const HC = globalThis.HolmetaCommon;

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
    exportSource: "inbox"
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
    undo: {
      itemId: "",
      untilTs: 0
    }
  };

  let persistTimer = null;

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
    if (document.activeElement === element) {
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
      licenseKey: String(source.licenseKey || "").trim().toUpperCase(),
      customReminderAt: String(source.customReminderAt || ""),
      exportSource: String(source.exportSource || "inbox") || "inbox"
    };
  }

  function readDrafts() {
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
    return new Promise((resolve) => {
      const normalized = normalizeDrafts(nextDrafts || {});
      chrome.storage.local.set({ [DRAFT_KEY]: normalized }, () => {
        resolve({ ok: !chrome.runtime?.lastError });
      });
    });
  }

  function queueDraftPersist() {
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      writeDrafts(state.drafts);
    }, 360);
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
          <button type="button" class="item-open secondary" data-item-action="open" data-item-id="${item.id}">
            <span class="item-title">${escapeHtml(item.title || item.url)}</span>
            <span class="item-meta">${escapeHtml(item.domain || "")}</span>
          </button>
          <div class="tag-list">
            ${item.pinned ? '<span class="pill">PINNED</span>' : ""}
            ${reminderPill}
            ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="item-actions">
            <button type="button" class="secondary" data-item-action="edit" data-item-id="${item.id}">EDIT</button>
            <button type="button" class="secondary" data-item-action="remind" data-item-id="${item.id}" data-premium>REMIND</button>
            <button type="button" class="secondary" data-item-action="resume" data-item-id="${item.id}" data-premium>${resumeLabel}</button>
            <button type="button" class="secondary" data-item-action="remove" data-item-id="${item.id}">REMOVE</button>
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
    setControlValueIfIdle("licenseKeyInput", state.drafts.licenseKey || "");
    setControlValueIfIdle("customReminderAt", state.drafts.customReminderAt || "");

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
    renderResumeList();
    renderInboxList();
    renderSessionList();
    renderEditors();
    renderUndoButton();
  }

  async function refreshState() {
    const [coreResponse, stateResponse] = await Promise.all([
      send({ type: "holmeta-core-get-state" }),
      send({ type: "holmeta-request-state", domain: "" })
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

  function bindEvents() {
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
      state.drafts.licenseKey = String(target.value || "").toUpperCase();
      queueDraftPersist();
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
    bindEvents();
    await refreshState();
  }

  bootstrap();
})();
