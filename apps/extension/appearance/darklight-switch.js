(() => {
  if (globalThis.HolmetaDarklightSwitch) return;

  const settingsStore = globalThis.HolmetaDarklightSettings;
  const ID = "hm-dl-widget-root";
  const Z_INDEX = 2147483647;

  const state = {
    host: "",
    visible: true,
    minimized: false,
    mode: "auto",
    enabled: false,
    mount: null,
    shadow: null,
    refs: {},
    drag: null
  };

  const uiCss = `
:host{all:initial}
.hm-dl-wrap{position:fixed;top:18px;right:18px;z-index:${Z_INDEX};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#f3f3f4;user-select:none}
.hm-dl-shell{display:flex;align-items:center;gap:8px;background:rgba(20,17,15,0.96);border:1px solid rgba(243,243,244,0.20);box-shadow:0 6px 18px rgba(0,0,0,0.34);border-radius:2px;padding:7px 9px}
.hm-dl-shell[data-min='1'] .hm-dl-body{display:none}
.hm-dl-badge{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid rgba(196,32,33,0.72);background:rgba(196,32,33,0.14);color:#f3f3f4;font-weight:700;font-size:11px;border-radius:2px}
.hm-dl-body{display:flex;align-items:center;gap:6px}
.hm-dl-btn{appearance:none;border:1px solid rgba(243,243,244,0.24);background:rgba(20,17,15,0.88);color:#f3f3f4;border-radius:2px;padding:6px 8px;font-size:11px;line-height:1;cursor:pointer;transition:background-color .16s ease,color .16s ease,border-color .16s ease,transform .16s ease}
.hm-dl-btn:hover{background:rgba(52,49,45,0.84);border-color:rgba(243,243,244,0.36)}
.hm-dl-btn:active{transform:translateY(1px)}
.hm-dl-btn[data-mode='dark']{background:rgba(16,18,20,0.94);color:#f8f9fb;border-color:rgba(243,243,244,0.44)}
.hm-dl-btn[data-mode='light']{background:#e8eaef;color:#13161b;border-color:rgba(13,16,21,0.42)}
.hm-dl-btn[data-mode='auto']{background:rgba(52,49,45,0.86);color:#f3f3f4;border-color:rgba(255,179,0,0.54)}
.hm-dl-toggle[data-enabled='0']{background:rgba(196,32,33,0.12);color:#ffd7d8;border-color:rgba(196,32,33,0.58)}
.hm-dl-toggle[data-enabled='1']{background:rgba(255,179,0,0.14);color:#ffe8b8;border-color:rgba(255,179,0,0.64)}
.hm-dl-handle{cursor:grab;opacity:.9}
.hm-dl-handle:active{cursor:grabbing}
.hm-dl-text{font-size:10px;color:#d9c5b2;min-width:76px;text-align:left}
@media (prefers-reduced-motion:reduce){.hm-dl-btn{transition:none}}
`;

  function normalizeHost(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function ensureMount() {
    if (state.mount && document.contains(state.mount)) return;
    const mount = document.createElement("div");
    mount.id = ID;
    mount.style.all = "initial";
    mount.style.position = "fixed";
    mount.style.zIndex = String(Z_INDEX);
    const shadow = mount.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = uiCss;
    shadow.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "hm-dl-wrap";
    wrap.innerHTML = `
      <div class="hm-dl-shell" data-min="0">
        <button type="button" class="hm-dl-btn hm-dl-handle" aria-label="Drag appearance widget">::</button>
        <span class="hm-dl-badge">HM</span>
        <div class="hm-dl-body">
          <button type="button" class="hm-dl-btn hm-dl-mode" data-mode="auto" aria-label="Cycle appearance mode">Auto</button>
          <button type="button" class="hm-dl-btn hm-dl-toggle" data-enabled="0" aria-label="Toggle day/night appearance">Off</button>
          <button type="button" class="hm-dl-btn hm-dl-min" aria-label="Minimize appearance widget">_</button>
          <div class="hm-dl-text">Appearance</div>
        </div>
      </div>
    `;
    shadow.appendChild(wrap);

    const shell = wrap.querySelector(".hm-dl-shell");
    const handle = wrap.querySelector(".hm-dl-handle");
    const mode = wrap.querySelector(".hm-dl-mode");
    const toggle = wrap.querySelector(".hm-dl-toggle");
    const min = wrap.querySelector(".hm-dl-min");
    const text = wrap.querySelector(".hm-dl-text");

    handle?.addEventListener("pointerdown", onDragStart);
    mode?.addEventListener("click", cycleMode);
    toggle?.addEventListener("click", toggleEnabled);
    min?.addEventListener("click", () => {
      state.minimized = !state.minimized;
      shell?.setAttribute("data-min", state.minimized ? "1" : "0");
    });

    state.mount = mount;
    state.shadow = shadow;
    state.refs = { wrap, shell, mode, toggle, text };

    (document.documentElement || document.body || document).appendChild(mount);
  }

  async function refreshState() {
    const res = await globalThis.HolmetaDarklightEngine?.getState?.();
    if (!res?.ok) return;
    state.mode = ["dark", "light", "auto"].includes(String(res.mode || "")) ? String(res.mode) : "auto";
    state.enabled = Boolean(res.enabled);
    const { mode, toggle, text } = state.refs;
    if (mode) {
      mode.dataset.mode = state.mode;
      mode.textContent = state.mode === "dark" ? "Dark" : state.mode === "light" ? "Light" : "Auto";
    }
    if (toggle) {
      toggle.dataset.enabled = state.enabled ? "1" : "0";
      toggle.textContent = state.enabled ? "On" : "Off";
    }
    if (text) {
      const scope = res.excluded ? "Excluded" : (res.usingOverride ? "Site override" : "Global");
      text.textContent = `${scope} · ${state.mode}`;
    }
  }

  function onDragStart(event) {
    if (!state.refs.wrap) return;
    event.preventDefault();
    const rect = state.refs.wrap.getBoundingClientRect();
    state.drag = {
      startX: event.clientX,
      startY: event.clientY,
      baseLeft: rect.left,
      baseTop: rect.top
    };
    globalThis.addEventListener("pointermove", onDragMove, true);
    globalThis.addEventListener("pointerup", onDragEnd, true);
  }

  function onDragMove(event) {
    if (!state.drag || !state.refs.wrap) return;
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;
    const nextX = clamp(state.drag.baseLeft + dx, 6, Math.max(6, globalThis.innerWidth - 190));
    const nextY = clamp(state.drag.baseTop + dy, 6, Math.max(6, globalThis.innerHeight - 80));
    state.refs.wrap.style.left = `${nextX}px`;
    state.refs.wrap.style.top = `${nextY}px`;
    state.refs.wrap.style.right = "auto";
  }

  async function onDragEnd() {
    if (!state.drag || !state.refs.wrap) return;
    globalThis.removeEventListener("pointermove", onDragMove, true);
    globalThis.removeEventListener("pointerup", onDragEnd, true);
    state.drag = null;

    const rect = state.refs.wrap.getBoundingClientRect();
    await settingsStore?.setWidgetState?.(state.host, {
      position: { x: Math.round(rect.left), y: Math.round(rect.top) }
    });
  }

  async function cycleMode() {
    const order = ["light", "dark", "auto"];
    const index = Math.max(0, order.indexOf(state.mode));
    const next = order[(index + 1) % order.length];
    if (next === "dark") await globalThis.HolmetaDarklightEngine?.applyAction?.("setDark");
    else if (next === "light") await globalThis.HolmetaDarklightEngine?.applyAction?.("setLight");
    else await globalThis.HolmetaDarklightEngine?.applyAction?.("setAuto");
    refreshState();
  }

  async function toggleEnabled() {
    await globalThis.HolmetaDarklightEngine?.applyAction?.("toggle");
    refreshState();
  }

  async function applyStoredPosition() {
    if (!state.refs.wrap) return;
    const widgetState = await settingsStore?.getWidgetState?.(state.host);
    if (!widgetState) return;
    state.visible = widgetState.visible !== false;
    const x = clamp(Number(widgetState.position?.x ?? 18), 6, Math.max(6, globalThis.innerWidth - 190));
    const y = clamp(Number(widgetState.position?.y ?? 18), 6, Math.max(6, globalThis.innerHeight - 80));
    state.refs.wrap.style.left = `${x}px`;
    state.refs.wrap.style.top = `${y}px`;
    state.refs.wrap.style.right = "auto";
    setVisible(state.visible);
  }

  function setVisible(visible) {
    state.visible = Boolean(visible);
    if (!state.mount) return;
    state.mount.style.display = state.visible ? "block" : "none";
  }

  async function init() {
    if (!/^https?:$/i.test(String(globalThis.location?.protocol || ""))) return;
    if (globalThis.top !== globalThis.self) return;
    state.host = normalizeHost(globalThis.location?.hostname || "");
    ensureMount();
    await applyStoredPosition();
    await refreshState();
  }

  globalThis.HolmetaDarklightSwitch = {
    init,
    refreshState,
    setVisible
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { init(); }, { once: true });
  } else {
    init();
  }
})();
