(() => {
  const HC = globalThis.HolmetaCommon;
  const HS = globalThis.HolmetaPopupStorage || null;

  const DRAFT_KEY = "holmeta.popup.drafts.v3";
  const SAVE_UNDO_WINDOW_MS = 5000;

  const DEFAULT_DRAFTS = {
    search: "",
    tagFilter: "",
    groupFilter: "",
    contextFilter: "",
    debugOnly: false,
    hasReminderOnly: false,
    saveNote: "",
    saveTags: "",
    groupName: "",
    saveSnapshot: false,
    snapshotMode: "full",
    focusDomains: "",
    licenseKey: "",
    customReminderAt: "",
    exportSource: "inbox",
    boardMode: "group",
    boardValue: "",
    lightIntensity: 78,
    snippetTitle: "",
    snippetBody: ""
  };

  const state = {
    settings: HC.normalizeSettings(HC.DEFAULT_SETTINGS),
    core: {
      schemaVersion: 1,
      items: [],
      reminders: [],
      sessions: [],
      resumeQueue: [],
      snippets: [],
      dailyWorkflow: [],
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
    runtime: {
      focusSession: null,
      blockerActive: false
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
      groupFilter: String(source.groupFilter || ""),
      contextFilter: String(source.contextFilter || ""),
      debugOnly: Boolean(source.debugOnly),
      hasReminderOnly: Boolean(source.hasReminderOnly),
      saveNote: String(source.saveNote || ""),
      saveTags: String(source.saveTags || ""),
      groupName: String(source.groupName || ""),
      saveSnapshot: Boolean(source.saveSnapshot),
      snapshotMode: String(source.snapshotMode || "full") === "focus" ? "focus" : "full",
      focusDomains: String(source.focusDomains || source.domainsDraft || ""),
      // Preserve in-progress typing/paste exactly as entered.
      licenseKey: String(source.licenseKey || ""),
      customReminderAt: String(source.customReminderAt || ""),
      exportSource: String(source.exportSource || "inbox") || "inbox",
      boardMode: String(source.boardMode || "group") || "group",
      boardValue: String(source.boardValue || ""),
      lightIntensity: Math.max(0, Math.min(100, Math.round(Number(source.lightIntensity || 78)))),
      snippetTitle: String(source.snippetTitle || ""),
      snippetBody: String(source.snippetBody || "")
    };
  }

  function readDrafts() {
    if (HS?.readUiState) {
      return HS.readUiState().then((uiState) => normalizeDrafts({
        search: uiState.search || "",
        tagFilter: uiState.tagFilter || "",
        groupFilter: uiState.groupFilter || "",
        contextFilter: uiState.contextFilter || "",
        debugOnly: Boolean(uiState.debugOnly),
        hasReminderOnly: uiState.hasReminderOnly || false,
        saveNote: uiState.notes || "",
        saveTags: uiState.saveTags || "",
        groupName: uiState.groupName || "",
        saveSnapshot: Boolean(uiState.saveSnapshot),
        snapshotMode: uiState.snapshotMode || "full",
        focusDomains: uiState.domainsDraft || "",
        licenseKey: uiState.licenseKeyDraft || "",
        customReminderAt: uiState.customReminderAt || "",
        exportSource: uiState.exportSource || "inbox",
        boardMode: uiState.boardMode || "group",
        boardValue: uiState.boardValue || "",
        lightIntensity: uiState.lightIntensity || 78,
        snippetTitle: uiState.snippetTitle || "",
        snippetBody: uiState.snippetBody || ""
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
        groupFilter: normalized.groupFilter,
        contextFilter: normalized.contextFilter,
        debugOnly: normalized.debugOnly,
        hasReminderOnly: normalized.hasReminderOnly,
        notes: normalized.saveNote,
        saveTags: normalized.saveTags,
        groupName: normalized.groupName,
        saveSnapshot: normalized.saveSnapshot,
        snapshotMode: normalized.snapshotMode,
        domainsDraft: normalized.focusDomains,
        licenseKeyDraft: normalized.licenseKey,
        customReminderAt: normalized.customReminderAt,
        exportSource: normalized.exportSource,
        boardMode: normalized.boardMode,
        boardValue: normalized.boardValue,
        lightIntensity: normalized.lightIntensity,
        snippetTitle: normalized.snippetTitle,
        snippetBody: normalized.snippetBody
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

  function normalizeGroupName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
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

  function todayLocalKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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
    const groupFilter = String(state.drafts.groupFilter || "").trim();
    const contextFilter = String(state.drafts.contextFilter || "").trim();
    const debugOnly = Boolean(state.drafts.debugOnly);
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
          item.decisionNote,
          item.visualNotes,
          item.contextKey,
          item.contextType,
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

      if (groupFilter) {
        const itemGroup = String(item.groupName || "").trim();
        if (itemGroup !== groupFilter) {
          return false;
        }
      }

      if (contextFilter) {
        if (String(item.contextType || "").trim() !== contextFilter) {
          return false;
        }
      }

      if (debugOnly && !Boolean(item.debugTrail)) {
        return false;
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
      const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

    return filtered;
  }

  function triageItems() {
    const today = todayLocalKey();
    const items = (state.core.items || [])
      .filter((item) => String(item.triageDate || "") === today);
    items.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const doneDelta = Number(a.triageDoneAt || 0) - Number(b.triageDoneAt || 0);
      if (doneDelta !== 0) {
        return doneDelta;
      }
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
    return items;
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

  function renderGroupFilterOptions() {
    const select = $("groupFilter");
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const current = String(state.drafts.groupFilter || "");
    const allGroups = [...new Set((state.core.items || [])
      .map((item) => String(item?.groupName || "").trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    select.innerHTML = "";
    const anyOption = document.createElement("option");
    anyOption.value = "";
    anyOption.textContent = "ALL GROUPS";
    select.appendChild(anyOption);

    allGroups.forEach((groupName) => {
      const option = document.createElement("option");
      option.value = groupName;
      option.textContent = groupName;
      select.appendChild(option);
    });

    if (current && allGroups.includes(current)) {
      select.value = current;
    } else {
      select.value = "";
      state.drafts.groupFilter = "";
    }
  }

  function renderContextFilterOptions() {
    const select = $("contextFilter");
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const current = String(state.drafts.contextFilter || "");
    const contexts = [...new Set((state.core.items || [])
      .map((item) => String(item?.contextType || "").trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    select.innerHTML = "";
    const anyOption = document.createElement("option");
    anyOption.value = "";
    anyOption.textContent = "ALL CONTEXTS";
    select.appendChild(anyOption);

    contexts.forEach((contextType) => {
      const option = document.createElement("option");
      option.value = contextType;
      option.textContent = contextType.toUpperCase();
      select.appendChild(option);
    });

    if (current && contexts.includes(current)) {
      select.value = current;
    } else {
      select.value = "";
      state.drafts.contextFilter = "";
    }
  }

  function currentBoardOptions(mode) {
    const items = Array.isArray(state.core.items) ? state.core.items : [];
    const safeMode = String(mode || "group").trim();
    if (safeMode === "context") {
      return [...new Set(items.map((item) => String(item?.contextKey || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value }));
    }
    if (safeMode === "client") {
      return [...new Set(items
        .flatMap((item) => Array.isArray(item.tags) ? item.tags : [])
        .filter((tag) => String(tag).startsWith("client:"))
        .map((tag) => String(tag).slice("client:".length))
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value }));
    }
    if (safeMode === "debug") {
      return [{ value: "__debug__", label: "DEBUG TRAIL" }];
    }
    return [...new Set(items.map((item) => String(item?.groupName || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }));
  }

  function renderBoardOptions() {
    const modeSelect = $("boardMode");
    const valueSelect = $("boardValue");
    if (!(modeSelect instanceof HTMLSelectElement) || !(valueSelect instanceof HTMLSelectElement)) {
      return;
    }

    const mode = String(state.drafts.boardMode || "group");
    if (modeSelect.value !== mode) {
      modeSelect.value = mode;
    }
    const options = currentBoardOptions(mode);
    const selected = String(state.drafts.boardValue || "");
    valueSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.length ? "SELECT BOARD" : "NO BOARDS";
    valueSelect.appendChild(placeholder);
    options.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.label;
      valueSelect.appendChild(option);
    });

    const valid = new Set(options.map((entry) => entry.value));
    if (selected && valid.has(selected)) {
      valueSelect.value = selected;
    } else {
      valueSelect.value = "";
      state.drafts.boardValue = "";
    }
  }

  function renderBoardPreviewList() {
    const list = $("boardPreviewList");
    if (!(list instanceof HTMLUListElement)) {
      return;
    }
    const items = Array.isArray(state.core.items) ? state.core.items : [];
    if (!items.length) {
      list.innerHTML = '<li class="small-note">NO BOARD DATA YET.</li>';
      return;
    }

    const counts = new Map();
    const pushCount = (mode, value, label) => {
      if (!value) return;
      const key = `${mode}:${value}`;
      const current = counts.get(key) || { mode, value, label, count: 0 };
      current.count += 1;
      counts.set(key, current);
    };

    items.forEach((item) => {
      if (item.groupName) {
        pushCount("group", item.groupName, `GROUP · ${item.groupName}`);
      }
      if (item.contextKey) {
        pushCount("context", item.contextKey, `CONTEXT · ${item.contextKey}`);
      }
      (Array.isArray(item.tags) ? item.tags : []).forEach((tag) => {
        if (String(tag).startsWith("client:")) {
          const client = String(tag).slice("client:".length);
          pushCount("client", client, `CLIENT · ${client}`);
        }
      });
      if (item.debugTrail) {
        pushCount("debug", "__debug__", "DEBUG TRAIL");
      }
    });

    const entries = [...counts.values()]
      .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 8);
    if (!entries.length) {
      list.innerHTML = '<li class="small-note">NO BOARD DATA YET.</li>';
      return;
    }

    list.innerHTML = entries.map((entry) => `
      <li class="item-card">
        <div class="item-main">
          <span class="item-title">${escapeHtml(entry.label)}</span>
          <span class="item-meta">${entry.count} item(s)</span>
        </div>
        <div class="item-inline-actions">
          <button type="button" class="secondary" data-board-preview-action="open" data-mode="${entry.mode}" data-value="${encodeURIComponent(String(entry.value || ""))}">OPEN</button>
          <button type="button" class="secondary" data-board-preview-action="next" data-mode="${entry.mode}" data-value="${encodeURIComponent(String(entry.value || ""))}">NEXT</button>
          <button type="button" class="secondary" data-board-preview-action="copy" data-mode="${entry.mode}" data-value="${encodeURIComponent(String(entry.value || ""))}">COPY</button>
        </div>
      </li>
    `).join("");
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
    inboxOpt.textContent = "CURRENT WORKBOARD";
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

    const workflow = Array.isArray(state.core.dailyWorkflow) ? state.core.dailyWorkflow : [];
    if (workflow.length) {
      const workflowOpt = document.createElement("option");
      workflowOpt.value = "workflow:daily";
      workflowOpt.textContent = "DAILY WORKFLOW";
      select.appendChild(workflowOpt);
    }

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
        <div class="item-inline-actions">
          <button type="button" class="secondary" data-resume-action="open" data-item-id="${item.id}">OPEN</button>
          <button type="button" class="secondary" data-resume-action="remove" data-item-id="${item.id}">REMOVE</button>
        </div>
      </li>
    `).join("");
  }

  function renderTriageList() {
    const list = $("triageList");
    if (!(list instanceof HTMLUListElement)) {
      return;
    }

    const items = triageItems();
    if (!items.length) {
      list.innerHTML = '<li class="small-note">NO ITEMS IN TODAY TRIAGE.</li>';
      return;
    }

    list.innerHTML = items.map((item) => {
      const done = Number(item.triageDoneAt || 0) > 0;
      const priority = Math.max(0, Math.min(3, Number(item.priority || 0)));
      const priorityLabel = ["NONE", "LOW", "MED", "HIGH"][priority] || "NONE";
      return `
        <li class="item-card">
          <div class="item-main">
            <span class="item-title">${escapeHtml(item.title || "Untitled")}</span>
            <span class="item-meta">${escapeHtml(item.domain || "")} · P${priority} ${priorityLabel}${done ? " · DONE" : ""}</span>
          </div>
          <div class="item-inline-actions">
            <button type="button" class="secondary" data-triage-action="open" data-item-id="${item.id}">OPEN</button>
            <button type="button" class="secondary" data-triage-action="${done ? "todo" : "done"}" data-item-id="${item.id}">${done ? "UNDO" : "DONE"}</button>
            <button type="button" class="secondary" data-triage-action="remove" data-item-id="${item.id}">REMOVE</button>
          </div>
        </li>
      `;
    }).join("");
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
        <div class="item-inline-actions">
          <button type="button" class="secondary" data-session-action="open" data-session-id="${session.id}" data-premium>OPEN</button>
          <button type="button" class="secondary" data-session-action="remove" data-session-id="${session.id}" data-premium>REMOVE</button>
        </div>
      </li>
    `).join("");
  }

  function renderWorkflowList() {
    const list = $("workflowList");
    if (!(list instanceof HTMLUListElement)) {
      return;
    }

    const entries = Array.isArray(state.core.dailyWorkflow) ? state.core.dailyWorkflow : [];
    if (!entries.length) {
      list.innerHTML = '<li class="small-note">NO DAILY WORKFLOW TABS.</li>';
      return;
    }

    list.innerHTML = entries.map((entry) => `
      <li class="item-card">
        <div class="item-main">
          <span class="item-title">${escapeHtml(entry.title || entry.url || "Untitled")}</span>
          <span class="item-meta">${escapeHtml(entry.domain || "")}${Number(entry.completedAt || 0) > 0 ? " · DONE" : ""}</span>
        </div>
        <div class="item-inline-actions">
          <button type="button" class="secondary" data-workflow-action="toggle" data-workflow-id="${entry.id}">${Number(entry.completedAt || 0) > 0 ? "UNDO" : "DONE"}</button>
          <button type="button" class="secondary" data-workflow-action="open" data-workflow-url="${encodeURIComponent(String(entry.url || ""))}">OPEN</button>
          <button type="button" class="secondary" data-workflow-action="remove" data-workflow-id="${entry.id}">REMOVE</button>
        </div>
      </li>
    `).join("");
  }

  function renderSnippetList() {
    const list = $("snippetList");
    if (!(list instanceof HTMLUListElement)) {
      return;
    }

    const snippets = Array.isArray(state.core.snippets) ? state.core.snippets : [];
    if (!snippets.length) {
      list.innerHTML = '<li class="small-note">NO SAVED SNIPPETS.</li>';
      return;
    }

    list.innerHTML = snippets.map((snippet) => `
      <li class="item-card">
        <div class="item-main">
          <span class="item-title">${escapeHtml(snippet.title || "Snippet")}</span>
          <span class="item-meta">${escapeHtml((snippet.tags || []).join(", ") || "UNTAGGED")}</span>
        </div>
        <div class="item-inline-actions">
          <button type="button" class="secondary" data-snippet-action="copy" data-snippet-id="${snippet.id}">COPY</button>
          <button type="button" class="secondary" data-snippet-action="delete" data-snippet-id="${snippet.id}">DELETE</button>
        </div>
      </li>
    `).join("");
  }

  function renderWorkboardList() {
    const list = $("workboardList");
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
      const contextType = String(item.contextType || "").trim();
      const contextKey = String(item.contextKey || "").trim();
      const contextPill = contextType
        ? `<span class="pill">${escapeHtml(contextType.toUpperCase())}${contextKey ? ` · ${escapeHtml(contextKey)}` : ""}</span>`
        : "";
      const groupPill = item.groupName
        ? `<span class="pill">GROUP · ${escapeHtml(item.groupName)}</span>`
        : "";
      const debugPill = item.debugTrail
        ? '<span class="pill warn">DEBUG TRAIL</span>'
        : "";
      const decisionPill = item.decisionNote
        ? '<span class="pill">DECISION</span>'
        : "";
      const visualPill = item.visualNotes
        ? '<span class="pill">REF</span>'
        : "";
      const preview = item.previewDataUrl
        ? `<img class="item-preview" src="${escapeHtml(item.previewDataUrl)}" alt="Saved preview" />`
        : "";
      const newPill = Number(item.lastOpenedAt || 0) > 0
        ? ""
        : '<span class="pill lock">NEW</span>';
      const previewPill = item.previewDataUrl
        ? `<span class="pill">PREVIEW · ${(item.previewMode || "full").toUpperCase()}</span>`
        : "";
      const triagePill = String(item.triageDate || "") === todayLocalKey()
        ? `<span class="pill ${Number(item.triageDoneAt || 0) > 0 ? "" : "warn"}">TODAY${Number(item.triageDoneAt || 0) > 0 ? " · DONE" : ""}</span>`
        : "";

      return `
        <li class="item-card" data-item-id="${item.id}">
          ${preview}
          <div class="item-head">
            <button type="button" class="item-open secondary" data-item-action="open" data-item-id="${item.id}">
              <span class="item-title">${escapeHtml(item.title || item.url)}</span>
              <span class="item-meta">${escapeHtml(item.domain || "")}</span>
            </button>
            <details class="item-menu">
              <summary>⋯</summary>
              <div class="item-actions">
                <button type="button" class="secondary" data-item-action="edit" data-item-id="${item.id}">EDIT NOTE</button>
                <button type="button" class="secondary" data-item-action="snippet" data-item-id="${item.id}" data-premium>SAVE SNIPPET</button>
                <button type="button" class="secondary" data-item-action="preview" data-item-id="${item.id}" data-premium>CAPTURE PREVIEW</button>
                <button type="button" class="secondary" data-item-action="context" data-item-id="${item.id}" data-premium>OPEN CONTEXT</button>
                <button type="button" class="secondary" data-item-action="triage" data-item-id="${item.id}" data-premium>${String(item.triageDate || "") === todayLocalKey() ? "REMOVE TODAY" : "ADD TODAY"}</button>
                <button type="button" class="secondary" data-item-action="remind" data-item-id="${item.id}" data-premium>REMIND</button>
                <button type="button" class="secondary" data-item-action="resume" data-item-id="${item.id}" data-premium>${resumeLabel}</button>
                <button type="button" class="secondary" data-item-action="remove" data-item-id="${item.id}">REMOVE</button>
              </div>
            </details>
          </div>
          <div class="tag-list">
            ${item.pinned ? '<span class="pill">PINNED</span>' : ""}
            ${newPill}
            ${groupPill}
            ${contextPill}
            ${debugPill}
            ${decisionPill}
            ${visualPill}
            ${previewPill}
            ${triagePill}
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
      setControlValueIfIdle("editDecisionInput", selectedItem.decisionNote || "");
      setControlValueIfIdle("editVisualInput", selectedItem.visualNotes || "");
      setControlValueIfIdle("editTagsInput", (selectedItem.tags || []).join(", "));
      setControlValueIfIdle("editPrioritySelect", Math.max(0, Math.min(3, Number(selectedItem.priority || 0))));
      const debugToggle = $("editDebugTrail");
      if (debugToggle instanceof HTMLInputElement) {
        debugToggle.checked = Boolean(selectedItem.debugTrail);
      }
      const pinnedToggle = $("editPinned");
      if (pinnedToggle instanceof HTMLInputElement) {
        pinnedToggle.checked = Boolean(selectedItem.pinned);
      }
      const triageToggle = $("editTriageToday");
      if (triageToggle instanceof HTMLInputElement) {
        triageToggle.checked = String(selectedItem.triageDate || "") === todayLocalKey();
      }
      const triageDoneToggle = $("editTriageDone");
      if (triageDoneToggle instanceof HTMLInputElement) {
        triageDoneToggle.checked = Number(selectedItem.triageDoneAt || 0) > 0;
        triageDoneToggle.disabled = String(selectedItem.triageDate || "") !== todayLocalKey();
      }
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
    setControlValueIfIdle("groupNameInput", state.drafts.groupName || "");
    setControlValueIfIdle("saveTagsInput", state.drafts.saveTags || "");
    setControlValueIfIdle("customReminderAt", state.drafts.customReminderAt || "");
    setControlValueIfIdle("lightIntensity", state.drafts.lightIntensity || 78);
    setControlValueIfIdle("snippetTitleInput", state.drafts.snippetTitle || "");
    setControlValueIfIdle("snippetBodyInput", state.drafts.snippetBody || "");

    const hasReminderOnly = $("hasReminderOnly");
    if (hasReminderOnly instanceof HTMLInputElement) {
      hasReminderOnly.checked = Boolean(state.drafts.hasReminderOnly);
    }

    const saveSnapshotToggle = $("saveSnapshotToggle");
    if (saveSnapshotToggle instanceof HTMLInputElement) {
      saveSnapshotToggle.checked = Boolean(state.drafts.saveSnapshot);
    }
    const snapshotModeSelect = $("snapshotModeSelect");
    if (snapshotModeSelect instanceof HTMLSelectElement) {
      snapshotModeSelect.value = String(state.drafts.snapshotMode || "full");
      snapshotModeSelect.disabled = !Boolean(state.drafts.saveSnapshot);
    }

    const groupFilter = $("groupFilter");
    if (groupFilter instanceof HTMLSelectElement) {
      groupFilter.value = String(state.drafts.groupFilter || "");
    }

    const contextFilter = $("contextFilter");
    if (contextFilter instanceof HTMLSelectElement) {
      contextFilter.value = String(state.drafts.contextFilter || "");
    }

    const debugOnly = $("debugOnly");
    if (debugOnly instanceof HTMLInputElement) {
      debugOnly.checked = Boolean(state.drafts.debugOnly);
    }

    const boardMode = $("boardMode");
    if (boardMode instanceof HTMLSelectElement) {
      boardMode.value = String(state.drafts.boardMode || "group");
    }

    const boardValue = $("boardValue");
    if (boardValue instanceof HTMLSelectElement) {
      boardValue.value = String(state.drafts.boardValue || "");
    }
  }

  function render() {
    renderPremiumState();
    renderTagFilterOptions();
    renderGroupFilterOptions();
    renderContextFilterOptions();
    renderBoardOptions();
    renderBoardPreviewList();
    renderExportSources();
    renderControls();
    renderLightControls();
    renderWellnessControls();
    renderFocusBlockerControls();
    renderDrawers();
    renderResumeList();
    renderTriageList();
    renderWorkboardList();
    renderWorkflowList();
    renderSessionList();
    renderSnippetList();
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
    if (stateResponse?.runtime && typeof stateResponse.runtime === "object") {
      state.runtime = stateResponse.runtime;
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
    } else if (source === "workflow:daily") {
      links = (state.core.dailyWorkflow || []).map((entry) => normalizeLink(entry));
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

  function boardPayload() {
    const mode = String(state.drafts.boardMode || "group");
    const raw = String(state.drafts.boardValue || "");
    const value = mode === "debug" ? "__debug__" : raw;
    return { mode, value };
  }

  async function copyBoardPack(modeInput = null, valueInput = null) {
    const fallback = boardPayload();
    const mode = String(modeInput || fallback.mode || "group");
    const value = String(valueInput || fallback.value || "");
    if ((mode !== "debug" && !value) || !isPremiumActive()) {
      setSaveFeedback("STATUS: BOARD SOURCE REQUIRED", true);
      return;
    }
    const response = await send({
      type: "holmeta-core-board-action",
      payload: {
        action: "inspect",
        mode,
        value
      }
    });
    if (!response?.ok || !Array.isArray(response.boardItems) || !response.boardItems.length) {
      setSaveFeedback("STATUS: BOARD EMPTY", true);
      return;
    }
    const markdown = response.boardItems
      .map((entry) => `- [${String(entry.title || "Untitled")}](${String(entry.url || "")})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(markdown);
      setSaveFeedback("STATUS: BOARD PACK COPIED ✓");
    } catch (_) {
      setSaveFeedback("STATUS: BOARD COPY FAILED", true);
    }
  }

  function normalizeLink(entry) {
    const title = String(entry?.title || entry?.url || "Untitled").trim() || "Untitled";
    const url = String(entry?.url || "").trim();
    return { title, url };
  }

  function blockerPatchFromControls(forceEnabled = null) {
    const blockerEnabledToggle = $("blockerEnabledToggle");
    const social = $("blockCategorySocial");
    const news = $("blockCategoryNews");
    const video = $("blockCategoryVideo");
    const adult = $("blockCategoryAdult");
    const domainsRaw = String($("focusDomains")?.value || state.drafts.focusDomains || "");

    const nextEnabled = forceEnabled === null
      ? Boolean(blockerEnabledToggle instanceof HTMLInputElement ? blockerEnabledToggle.checked : state.settings.blockerEnabled)
      : Boolean(forceEnabled);

    const categories = {
      social: Boolean(social instanceof HTMLInputElement ? social.checked : state.settings?.blockerCategories?.social),
      news: Boolean(news instanceof HTMLInputElement ? news.checked : state.settings?.blockerCategories?.news),
      video: Boolean(video instanceof HTMLInputElement ? video.checked : state.settings?.blockerCategories?.video),
      adult: Boolean(adult instanceof HTMLInputElement ? adult.checked : state.settings?.blockerCategories?.adult)
    };

    const domains = HC.parseDomainList(domainsRaw);
    state.drafts.focusDomains = domainsRaw;
    queueDraftPersist();

    return {
      blockerEnabled: nextEnabled,
      distractorDomains: domains,
      blockerCategories: categories
    };
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
      eyeIntervalMin: Math.max(10, Math.min(120, Math.round(Number(source.eyeIntervalMin || 20)))),
      blinkEnabled: Boolean(source.blinkEnabled),
      blinkIntervalMin: Math.max(10, Math.min(120, Math.round(Number(source.blinkIntervalMin || 25)))),
      postureEnabled: Boolean(source.postureEnabled),
      postureIntervalMin: Math.max(15, Math.min(180, Math.round(Number(source.postureIntervalMin || 45)))),
      standEnabled: Boolean(source.standEnabled),
      standIntervalMin: Math.max(15, Math.min(180, Math.round(Number(source.standIntervalMin || 60)))),
      scrollPauseEnabled: Boolean(source.scrollPauseEnabled),
      scrollPauseMin: Math.max(5, Math.min(90, Math.round(Number(source.scrollPauseMin || 15))))
    };
  }

  function getBlockerCategoriesFromSettings() {
    const source = state.settings?.blockerCategories && typeof state.settings.blockerCategories === "object"
      ? state.settings.blockerCategories
      : {};
    return {
      social: Boolean(source.social),
      news: Boolean(source.news),
      video: Boolean(source.video),
      adult: Boolean(source.adult)
    };
  }

  function getFocusStatusText() {
    const focusSession = state.runtime?.focusSession || null;
    if (!focusSession || !Number(focusSession.endsAt)) {
      return "FOCUS: IDLE";
    }
    const remainingMs = Number(focusSession.endsAt) - Date.now();
    if (remainingMs <= 0) {
      return "FOCUS: IDLE";
    }
    const totalMin = Math.max(1, Math.ceil(remainingMs / 60000));
    return `FOCUS: ${totalMin}M LEFT`;
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
    const blinkEnabled = $("blinkEnabledToggle");
    const blinkInterval = $("blinkIntervalSelect");
    const postureEnabled = $("postureEnabledToggle");
    const postureInterval = $("postureIntervalSelect");
    const standEnabled = $("standEnabledToggle");
    const standInterval = $("standIntervalSelect");
    const scrollPauseEnabled = $("scrollPauseEnabledToggle");
    const scrollPauseSelect = $("scrollPauseSelect");
    const readingModeToggle = $("readingModeToggle");
    const dopamineHygieneToggle = $("dopamineHygieneToggle");

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
    if (blinkEnabled instanceof HTMLInputElement) {
      blinkEnabled.checked = Boolean(wellness.blinkEnabled);
    }
    if (blinkInterval instanceof HTMLSelectElement) {
      blinkInterval.value = String(wellness.blinkIntervalMin || 25);
    }
    if (postureEnabled instanceof HTMLInputElement) {
      postureEnabled.checked = Boolean(wellness.postureEnabled);
    }
    if (postureInterval instanceof HTMLSelectElement) {
      postureInterval.value = String(wellness.postureIntervalMin || 45);
    }
    if (standEnabled instanceof HTMLInputElement) {
      standEnabled.checked = Boolean(wellness.standEnabled);
    }
    if (standInterval instanceof HTMLSelectElement) {
      standInterval.value = String(wellness.standIntervalMin || 60);
    }
    if (scrollPauseEnabled instanceof HTMLInputElement) {
      scrollPauseEnabled.checked = Boolean(wellness.scrollPauseEnabled);
    }
    if (scrollPauseSelect instanceof HTMLSelectElement) {
      scrollPauseSelect.value = String(wellness.scrollPauseMin || 15);
    }
    if (readingModeToggle instanceof HTMLInputElement) {
      readingModeToggle.checked = Boolean(state.settings.readingModeEnabled);
    }
    if (dopamineHygieneToggle instanceof HTMLInputElement) {
      dopamineHygieneToggle.checked = Boolean(state.settings.dopamineHygieneEnabled);
    }
  }

  function renderFocusBlockerControls() {
    const focusStatus = $("focusStatus");
    if (focusStatus) {
      focusStatus.textContent = getFocusStatusText();
    }

    const blockerEnabledToggle = $("blockerEnabledToggle");
    if (blockerEnabledToggle instanceof HTMLInputElement) {
      blockerEnabledToggle.checked = Boolean(state.settings.blockerEnabled);
    }

    const categories = getBlockerCategoriesFromSettings();
    const social = $("blockCategorySocial");
    const news = $("blockCategoryNews");
    const video = $("blockCategoryVideo");
    const adult = $("blockCategoryAdult");
    if (social instanceof HTMLInputElement) social.checked = categories.social;
    if (news instanceof HTMLInputElement) news.checked = categories.news;
    if (video instanceof HTMLInputElement) video.checked = categories.video;
    if (adult instanceof HTMLInputElement) adult.checked = categories.adult;

    const fallbackDomains = Array.isArray(state.settings?.distractorDomains)
      ? state.settings.distractorDomains.join(", ")
      : "";
    setControlValueIfIdle("focusDomains", state.drafts.focusDomains || fallbackDomains);

    const toggleButton = $("toggleBlockerActive");
    if (toggleButton instanceof HTMLButtonElement) {
      const enabled = Boolean(state.settings.blockerEnabled);
      toggleButton.textContent = enabled ? "PAUSE BLOCKER" : "ACTIVATE BLOCKER";
      toggleButton.classList.toggle("danger", enabled);
      toggleButton.classList.toggle("secondary", !enabled);
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

    $("editTriageToday")?.addEventListener("change", (event) => {
      const target = event.target;
      const doneToggle = $("editTriageDone");
      if (!(doneToggle instanceof HTMLInputElement) || !(target instanceof HTMLInputElement)) {
        return;
      }
      if (!target.checked) {
        doneToggle.checked = false;
      }
      doneToggle.disabled = !target.checked;
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
      renderWorkboardList();
    });

    $("tagFilter")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.drafts.tagFilter = String(target.value || "");
      queueDraftPersist();
      renderWorkboardList();
    });

    $("groupFilter")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.drafts.groupFilter = String(target.value || "");
      queueDraftPersist();
      renderWorkboardList();
    });

    $("contextFilter")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.drafts.contextFilter = String(target.value || "");
      queueDraftPersist();
      renderWorkboardList();
    });

    $("debugOnly")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.debugOnly = Boolean(target.checked);
      queueDraftPersist();
      renderWorkboardList();
    });

    $("hasReminderOnly")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.hasReminderOnly = Boolean(target.checked);
      queueDraftPersist();
    renderWorkboardList();
    });

    $("saveNoteInput")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) {
        return;
      }
      state.drafts.saveNote = String(target.value || "");
      queueDraftPersist();
    });

    $("groupNameInput")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.groupName = String(target.value || "");
      queueDraftPersist();
    });

    $("snippetTitleInput")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.snippetTitle = String(target.value || "");
      queueDraftPersist();
    });

    $("snippetBodyInput")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) {
        return;
      }
      state.drafts.snippetBody = String(target.value || "");
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

    $("saveSnapshotToggle")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state.drafts.saveSnapshot = Boolean(target.checked);
      const snapshotModeSelect = $("snapshotModeSelect");
      if (snapshotModeSelect instanceof HTMLSelectElement) {
        snapshotModeSelect.disabled = !state.drafts.saveSnapshot;
      }
      queueDraftPersist();
    });

    $("snapshotModeSelect")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.drafts.snapshotMode = String(target.value || "full") === "focus" ? "focus" : "full";
      queueDraftPersist();
    });

    $("focusDomains")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) {
        return;
      }
      state.drafts.focusDomains = String(target.value || "");
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

    async function saveSitePreset(profileId) {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR SITE PROFILE", true);
        return;
      }
      if (!state.activeDomain) {
        setSaveFeedback("STATUS: NO ACTIVE SITE", true);
        return;
      }
      const presetMap = {
        docs: { enabled: true, preset: "nightWarmStrong", intensity: 0.72 },
        code: { enabled: true, preset: "blueShieldStrong", intensity: 0.6 },
        video: { enabled: true, preset: "nightWarmMild", intensity: 0.42 }
      };
      const patch = presetMap[profileId];
      if (!patch) {
        return;
      }
      const response = await send({
        type: "holmeta-save-site-profile",
        domain: state.activeDomain,
        patch
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: SITE PRESET SAVE FAILED", true);
        return;
      }
      setSaveFeedback(`STATUS: ${profileId.toUpperCase()} PROFILE SAVED`);
      await refreshState();
    }

    $("sitePresetDocs")?.addEventListener("click", async () => saveSitePreset("docs"));
    $("sitePresetCode")?.addEventListener("click", async () => saveSitePreset("code"));
    $("sitePresetVideo")?.addEventListener("click", async () => saveSitePreset("video"));

    $("saveGlobalLightDefault")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR GLOBAL DEFAULT", true);
        return;
      }
      const modeSelect = $("lightModeSelect");
      const intensityInput = $("lightIntensity");
      const enabledToggle = $("lightEnabledToggle");
      const mode = modeSelect instanceof HTMLSelectElement ? modeSelect.value : "warm";
      const intensity = intensityInput instanceof HTMLInputElement
        ? Math.max(0, Math.min(100, Math.round(Number(intensityInput.value || 0))))
        : state.drafts.lightIntensity;
      const enabled = enabledToggle instanceof HTMLInputElement ? Boolean(enabledToggle.checked) : true;
      const response = await send({
        type: "holmeta-update-settings",
        patch: {
          filterEnabled: enabled,
          filterPreset: lightModeToPreset(mode),
          filterIntensity: intensity / 100
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: GLOBAL DEFAULT SAVE FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: GLOBAL DEFAULT SAVED");
      await refreshState();
    });

    $("hotkeyToggleFilters")?.addEventListener("click", async () => {
      await send({ type: "holmeta-hotkey-action", action: "toggle-filters" });
      await refreshState();
    });
    $("hotkeyToggleRed")?.addEventListener("click", async () => {
      await send({ type: "holmeta-hotkey-action", action: "toggle-red-mode" });
      await refreshState();
    });
    $("hotkeyIntensityUp")?.addEventListener("click", async () => {
      await send({ type: "holmeta-hotkey-action", action: "intensity-up" });
      await refreshState();
    });
    $("hotkeyIntensityDown")?.addEventListener("click", async () => {
      await send({ type: "holmeta-hotkey-action", action: "intensity-down" });
      await refreshState();
    });
    $("hotkeyEyeRelief")?.addEventListener("click", async () => {
      await send({ type: "holmeta-hotkey-action", action: "eye-relief" });
      setSaveFeedback("STATUS: EYE RELIEF APPLIED");
      await refreshState();
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
      const blinkEnabled = $("blinkEnabledToggle");
      const blinkInterval = $("blinkIntervalSelect");
      const postureEnabled = $("postureEnabledToggle");
      const postureInterval = $("postureIntervalSelect");
      const standEnabled = $("standEnabledToggle");
      const standInterval = $("standIntervalSelect");
      const scrollPauseEnabled = $("scrollPauseEnabledToggle");
      const scrollPauseSelect = $("scrollPauseSelect");
      const readingModeToggle = $("readingModeToggle");
      const dopamineHygieneToggle = $("dopamineHygieneToggle");
      const response = await send({
        type: "holmeta-update-settings",
        patch: {
          readingModeEnabled: readingModeToggle instanceof HTMLInputElement ? Boolean(readingModeToggle.checked) : false,
          dopamineHygieneEnabled: dopamineHygieneToggle instanceof HTMLInputElement ? Boolean(dopamineHygieneToggle.checked) : false,
          wellness: {
            ...getWellnessSettings(),
            breaksEnabled: breaksEnabled instanceof HTMLInputElement ? Boolean(breaksEnabled.checked) : false,
            breaksIntervalMin: breakInterval instanceof HTMLSelectElement ? Number(breakInterval.value || 50) : 50,
            eyeEnabled: eyeEnabled instanceof HTMLInputElement ? Boolean(eyeEnabled.checked) : false,
            eyeIntervalMin: eyeInterval instanceof HTMLSelectElement ? Number(eyeInterval.value || 20) : 20,
            blinkEnabled: blinkEnabled instanceof HTMLInputElement ? Boolean(blinkEnabled.checked) : false,
            blinkIntervalMin: blinkInterval instanceof HTMLSelectElement ? Number(blinkInterval.value || 25) : 25,
            postureEnabled: postureEnabled instanceof HTMLInputElement ? Boolean(postureEnabled.checked) : false,
            postureIntervalMin: postureInterval instanceof HTMLSelectElement ? Number(postureInterval.value || 45) : 45,
            standEnabled: standEnabled instanceof HTMLInputElement ? Boolean(standEnabled.checked) : false,
            standIntervalMin: standInterval instanceof HTMLSelectElement ? Number(standInterval.value || 60) : 60,
            scrollPauseEnabled: scrollPauseEnabled instanceof HTMLInputElement ? Boolean(scrollPauseEnabled.checked) : false,
            scrollPauseMin: scrollPauseSelect instanceof HTMLSelectElement ? Number(scrollPauseSelect.value || 15) : 15
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

    $("runBreathingReset")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR BREATH RESET", true);
        return;
      }
      await send({
        type: "holmeta-test-reminder",
        reminderType: "breathwork",
        title: "BREATH RESET",
        message: "Box breathe for 30 seconds."
      });
      setSaveFeedback("STATUS: BREATH RESET STARTED");
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

    $("boardMode")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.drafts.boardMode = String(target.value || "group");
      state.drafts.boardValue = "";
      queueDraftPersist();
      renderBoardOptions();
    });

    $("boardValue")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.drafts.boardValue = String(target.value || "");
      queueDraftPersist();
    });

    $("saveCurrentTab")?.addEventListener("click", async () => {
      const groupName = normalizeGroupName(state.drafts.groupName);
      const parsedTags = parseTagCsv(state.drafts.saveTags);
      if (groupName) {
        parsedTags.unshift(`group:${groupName}`);
      }
      const payload = {
        note: String(state.drafts.saveNote || ""),
        tags: parsedTags,
        groupName,
        captureSnapshot: Boolean(state.drafts.saveSnapshot),
        previewMode: String(state.drafts.snapshotMode || "full")
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
      state.drafts.groupName = groupName;
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

    $("saveWindowGroup")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR GROUP SAVE", true);
        return;
      }
      const groupName = normalizeGroupName(state.drafts.groupName);
      const fallback = `Group — ${new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
      const name = groupName || fallback;
      const response = await send({ type: "holmeta-core-save-session", payload: { name } });
      if (!response?.ok) {
        setSaveFeedback(`STATUS: GROUP SAVE FAILED (${String(response?.error || "UNKNOWN")})`, true);
        return;
      }
      state.drafts.groupName = name;
      queueDraftPersist();
      setSaveFeedback("STATUS: TAB GROUP SAVED");
      await refreshState();
    });

    $("saveSnippet")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR SNIPPETS", true);
        return;
      }
      const payload = {
        title: String(state.drafts.snippetTitle || "").trim(),
        body: String(state.drafts.snippetBody || ""),
        tags: parseTagCsv(state.drafts.saveTags || "")
      };
      const response = await send({ type: "holmeta-core-save-snippet", payload });
      if (!response?.ok) {
        setSaveFeedback("STATUS: SNIPPET SAVE FAILED", true);
        return;
      }
      state.drafts.snippetTitle = "";
      state.drafts.snippetBody = "";
      queueDraftPersist();
      setSaveFeedback("STATUS: SNIPPET SAVED");
      await refreshState();
    });

    $("workflowAddCurrent")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-core-workflow-action", payload: { action: "add_current" } });
      if (!response?.ok) {
        setSaveFeedback("STATUS: DAILY WORKFLOW ADD FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: ADDED TO DAILY WORKFLOW");
      await refreshState();
    });

    $("workflowOpenAll")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-core-workflow-action", payload: { action: "open_all" } });
      if (!response?.ok) {
        setSaveFeedback("STATUS: DAILY WORKFLOW EMPTY", true);
        return;
      }
      setSaveFeedback(`STATUS: OPENED ${Number(response.opened || 0)} WORKFLOW TAB(S)`);
    });

    $("workflowClear")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-core-workflow-action", payload: { action: "clear" } });
      if (!response?.ok) {
        setSaveFeedback("STATUS: WORKFLOW CLEAR FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: DAILY WORKFLOW CLEARED");
      await refreshState();
    });

    $("focusStart25")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-start-focus", minutes: 25 });
      if (!response?.ok) {
        setSaveFeedback("STATUS: FOCUS START FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: FOCUS 25M STARTED");
      await refreshState();
    });

    $("focusStart50")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-start-focus", minutes: 50 });
      if (!response?.ok) {
        setSaveFeedback("STATUS: FOCUS START FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: FOCUS 50M STARTED");
      await refreshState();
    });

    $("focusStart90")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-start-focus", minutes: 90 });
      if (!response?.ok) {
        setSaveFeedback("STATUS: FOCUS START FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: FOCUS 90M STARTED");
      await refreshState();
    });

    $("focusStop")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-panic-focus" });
      if (!response?.ok) {
        setSaveFeedback("STATUS: STOP FOCUS FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: FOCUS STOPPED");
      await refreshState();
    });

    $("applyBlockerConfig")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR BLOCKER", true);
        return;
      }
      const patch = blockerPatchFromControls(null);
      const response = await send({ type: "holmeta-update-settings", patch });
      if (!response?.ok) {
        setSaveFeedback("STATUS: BLOCKER SAVE FAILED", true);
        return;
      }
      setSaveFeedback(patch.blockerEnabled ? "STATUS: BLOCKER ACTIVE" : "STATUS: BLOCKER SAVED");
      await refreshState();
    });

    $("toggleBlockerActive")?.addEventListener("click", async () => {
      if (!isPremiumActive()) {
        setSaveFeedback("STATUS: PREMIUM REQUIRED FOR BLOCKER", true);
        return;
      }
      const nextEnabled = !Boolean(state.settings.blockerEnabled);
      const patch = blockerPatchFromControls(nextEnabled);
      const response = await send({ type: "holmeta-update-settings", patch });
      if (!response?.ok) {
        setSaveFeedback("STATUS: BLOCKER TOGGLE FAILED", true);
        return;
      }
      setSaveFeedback(nextEnabled ? "STATUS: BLOCKER ACTIVE" : "STATUS: BLOCKER PAUSED");
      await refreshState();
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

    $("triageOpenTop3")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-core-triage-action", payload: { action: "open_top3" } });
      if (!response?.ok) {
        setSaveFeedback("STATUS: TODAY TRIAGE EMPTY", true);
        return;
      }
      setSaveFeedback(`STATUS: OPENED TOP ${Number(response.opened || 0)}`);
      await refreshState();
    });

    $("triageClearDone")?.addEventListener("click", async () => {
      const response = await send({ type: "holmeta-core-triage-action", payload: { action: "clear_done" } });
      if (!response?.ok) {
        setSaveFeedback("STATUS: CLEAR DONE FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: CLEARED DONE TRIAGE ITEMS");
      await refreshState();
    });

    $("copyLinkPack")?.addEventListener("click", async () => {
      await copyLinkPack();
    });

    $("openBoard")?.addEventListener("click", async () => {
      const { mode, value } = boardPayload();
      if (mode !== "debug" && !value) {
        setSaveFeedback("STATUS: BOARD SOURCE REQUIRED", true);
        return;
      }
      const response = await send({
        type: "holmeta-core-board-action",
        payload: {
          action: "open",
          mode,
          value
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: BOARD OPEN FAILED", true);
        return;
      }
      setSaveFeedback(`STATUS: OPENED ${Number(response.opened || 0)} BOARD TAB(S)`);
    });

    $("saveBoardSession")?.addEventListener("click", async () => {
      const { mode, value } = boardPayload();
      if (mode !== "debug" && !value) {
        setSaveFeedback("STATUS: BOARD SOURCE REQUIRED", true);
        return;
      }
      const response = await send({
        type: "holmeta-core-board-action",
        payload: {
          action: "save_session",
          mode,
          value
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: BOARD SESSION SAVE FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: BOARD SAVED AS SESSION");
      await refreshState();
    });

    $("copyBoardPack")?.addEventListener("click", async () => {
      await copyBoardPack();
    });

    $("openNextBoard")?.addEventListener("click", async () => {
      const { mode, value } = boardPayload();
      if (mode !== "debug" && !value) {
        setSaveFeedback("STATUS: BOARD SOURCE REQUIRED", true);
        return;
      }
      const response = await send({
        type: "holmeta-core-board-action",
        payload: {
          action: "open_next",
          mode,
          value
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: BOARD NEXT FAILED", true);
        return;
      }
      setSaveFeedback(`STATUS: OPENED NEXT (${Number(response.currentIndex || 0) + 1})`);
      await refreshState();
    });

    $("resetBoardProgress")?.addEventListener("click", async () => {
      const { mode, value } = boardPayload();
      if (mode !== "debug" && !value) {
        setSaveFeedback("STATUS: BOARD SOURCE REQUIRED", true);
        return;
      }
      const response = await send({
        type: "holmeta-core-board-action",
        payload: {
          action: "reset_progress",
          mode,
          value
        }
      });
      if (!response?.ok) {
        setSaveFeedback("STATUS: BOARD RESET FAILED", true);
        return;
      }
      setSaveFeedback("STATUS: BOARD ORDER RESET");
      await refreshState();
    });

    $("workboardList")?.addEventListener("click", async (event) => {
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

      if (action === "snippet") {
        const item = itemById(itemId);
        if (!item) {
          return;
        }
        const response = await send({
          type: "holmeta-core-save-snippet",
          payload: {
            sourceItemId: item.id,
            title: item.title,
            body: item.note || item.url,
            tags: Array.isArray(item.tags) ? item.tags : []
          }
        });
        if (!response?.ok) {
          setSaveFeedback("STATUS: SNIPPET SAVE FAILED", true);
          return;
        }
        setSaveFeedback("STATUS: SNIPPET SAVED FROM ITEM");
        await refreshState();
        return;
      }

      if (action === "preview") {
        const response = await send({ type: "holmeta-core-capture-item-preview", itemId });
        if (!response?.ok) {
          setSaveFeedback(`STATUS: PREVIEW FAILED (${String(response?.error || "UNKNOWN")})`, true);
          return;
        }
        setSaveFeedback("STATUS: PREVIEW CAPTURED");
        await refreshState();
        return;
      }

      if (action === "context") {
        const item = itemById(itemId);
        if (!item || !item.contextKey) {
          setSaveFeedback("STATUS: NO CONTEXT KEY", true);
          return;
        }
        const response = await send({
          type: "holmeta-core-board-action",
          payload: {
            action: "open",
            mode: "context",
            value: item.contextKey
          }
        });
        if (!response?.ok) {
          setSaveFeedback("STATUS: CONTEXT OPEN FAILED", true);
          return;
        }
        setSaveFeedback(`STATUS: OPENED ${Number(response.opened || 0)} CONTEXT TAB(S)`);
        return;
      }

      if (action === "triage") {
        const item = itemById(itemId);
        if (!item) {
          return;
        }
        const inToday = String(item.triageDate || "") === todayLocalKey();
        const response = await send({
          type: "holmeta-core-triage-action",
          payload: {
            action: inToday ? "remove" : "add",
            itemId
          }
        });
        if (!response?.ok) {
          setSaveFeedback("STATUS: TRIAGE UPDATE FAILED", true);
          return;
        }
        setSaveFeedback(inToday ? "STATUS: REMOVED FROM TODAY TRIAGE" : "STATUS: ADDED TO TODAY TRIAGE");
        await refreshState();
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

    $("triageList")?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest("button[data-triage-action]") : null;
      if (!button) {
        return;
      }
      const action = button.getAttribute("data-triage-action") || "";
      const itemId = button.getAttribute("data-item-id") || "";
      if (!itemId) {
        return;
      }

      if (action === "open") {
        await send({ type: "holmeta-core-open-item", itemId });
        await refreshState();
        return;
      }
      if (action === "done") {
        await send({ type: "holmeta-core-triage-action", payload: { action: "mark_done", itemId } });
        await refreshState();
        return;
      }
      if (action === "todo") {
        await send({ type: "holmeta-core-triage-action", payload: { action: "mark_todo", itemId } });
        await refreshState();
        return;
      }
      if (action === "remove") {
        await send({ type: "holmeta-core-triage-action", payload: { action: "remove", itemId } });
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

    $("workflowList")?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest("button[data-workflow-action]") : null;
      if (!button) {
        return;
      }
      const action = button.getAttribute("data-workflow-action") || "";
      if (action === "open") {
        const encoded = button.getAttribute("data-workflow-url") || "";
        const url = encoded ? decodeURIComponent(encoded) : "";
        if (url) {
          await safeOpen(url);
        }
        return;
      }
      if (action === "remove") {
        const workflowId = button.getAttribute("data-workflow-id") || "";
        if (!workflowId) {
          return;
        }
        await send({ type: "holmeta-core-workflow-action", payload: { action: "remove", workflowId } });
        await refreshState();
        return;
      }

      if (action === "toggle") {
        const workflowId = button.getAttribute("data-workflow-id") || "";
        if (!workflowId) {
          return;
        }
        await send({ type: "holmeta-core-workflow-action", payload: { action: "toggle_done", workflowId } });
        await refreshState();
      }
    });

    $("snippetList")?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest("button[data-snippet-action]") : null;
      if (!button) {
        return;
      }
      const snippetId = button.getAttribute("data-snippet-id") || "";
      if (!snippetId) {
        return;
      }
      const action = button.getAttribute("data-snippet-action") || "";
      const snippet = (state.core.snippets || []).find((entry) => entry.id === snippetId);
      if (!snippet) {
        return;
      }

      if (action === "copy") {
        try {
          await navigator.clipboard.writeText(String(snippet.body || ""));
          setSaveFeedback("STATUS: SNIPPET COPIED");
        } catch (_) {
          setSaveFeedback("STATUS: SNIPPET COPY FAILED", true);
        }
        return;
      }

      if (action === "delete") {
        await send({ type: "holmeta-core-delete-snippet", snippetId });
        await refreshState();
      }
    });

    $("boardPreviewList")?.addEventListener("click", async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest("button[data-board-preview-action]") : null;
      if (!button) {
        return;
      }
      const action = button.getAttribute("data-board-preview-action") || "";
      const mode = String(button.getAttribute("data-mode") || "");
      const encodedValue = String(button.getAttribute("data-value") || "");
      const value = encodedValue ? decodeURIComponent(encodedValue) : "";
      if (!mode) {
        return;
      }

      if (action === "open") {
        const response = await send({
          type: "holmeta-core-board-action",
          payload: {
            action: "open",
            mode,
            value
          }
        });
        if (!response?.ok) {
          setSaveFeedback("STATUS: BOARD OPEN FAILED", true);
          return;
        }
        setSaveFeedback(`STATUS: OPENED ${Number(response.opened || 0)} BOARD TAB(S)`);
        return;
      }

      if (action === "next") {
        const response = await send({
          type: "holmeta-core-board-action",
          payload: {
            action: "open_next",
            mode,
            value
          }
        });
        if (!response?.ok) {
          setSaveFeedback("STATUS: BOARD NEXT FAILED", true);
          return;
        }
        setSaveFeedback(`STATUS: OPENED NEXT (${Number(response.currentIndex || 0) + 1})`);
        await refreshState();
        return;
      }

      if (action === "copy") {
        await copyBoardPack(mode, value);
      }
    });

    $("saveItemMeta")?.addEventListener("click", async () => {
      const itemId = state.selectedItemId;
      if (!itemId) {
        return;
      }

      const noteInput = $("editNoteInput");
      const decisionInput = $("editDecisionInput");
      const visualInput = $("editVisualInput");
      const tagsInput = $("editTagsInput");
      const priorityInput = $("editPrioritySelect");
      const pinnedInput = $("editPinned");
      const triageTodayInput = $("editTriageToday");
      const triageDoneInput = $("editTriageDone");
      const debugInput = $("editDebugTrail");
      const note = noteInput instanceof HTMLInputElement ? noteInput.value : "";
      const decisionNote = decisionInput instanceof HTMLInputElement ? decisionInput.value : "";
      const visualNotes = visualInput instanceof HTMLTextAreaElement ? visualInput.value : "";
      const tags = tagsInput instanceof HTMLInputElement ? parseTagCsv(tagsInput.value) : [];
      const priority = priorityInput instanceof HTMLSelectElement
        ? Math.max(0, Math.min(3, Number(priorityInput.value || 0)))
        : 0;
      const pinned = pinnedInput instanceof HTMLInputElement ? Boolean(pinnedInput.checked) : false;
      const triageToday = triageTodayInput instanceof HTMLInputElement ? Boolean(triageTodayInput.checked) : false;
      const triageDone = triageDoneInput instanceof HTMLInputElement ? Boolean(triageDoneInput.checked) : false;
      const debugTrail = debugInput instanceof HTMLInputElement ? Boolean(debugInput.checked) : false;
      const triageDate = triageToday ? todayLocalKey() : "";
      const triageDoneAt = triageToday && triageDone ? Date.now() : 0;

      const response = await send({
        type: "holmeta-core-update-item",
        payload: {
          itemId,
          note,
          decisionNote,
          visualNotes,
          tags,
          priority,
          pinned,
          triageDate,
          triageDoneAt,
          debugTrail
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
