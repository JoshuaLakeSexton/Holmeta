// HOLMETA v3.0 content runtime
// - Light engine orchestration
// - Health toasts/sound helpers
// - Site Insight popup (local-only heuristics, no external API calls)

(() => {
  if (window.__HOLMETA_V3__) return;
  window.__HOLMETA_V3__ = true;

  if (!/^https?:$/.test(location.protocol)) return;

  const IDS = {
    STYLE: "holmeta-content-style-v3",
    TOAST_HOST: "holmeta-toast-host-v3",
    BLOCKER_STYLE: "holmeta-blocker-style-v3",
    PICKER_HUD: "holmeta-color-picker-hud-v3",
    SCREENSHOT_HOST: "holmeta-screenshot-host-v3"
  };

  const COSMETIC_SELECTORS = {
    ads: [
      "ins.adsbygoogle",
      "iframe[src*='doubleclick.net']",
      "iframe[src*='googlesyndication.com']",
      "[class*='adsbygoogle']",
      ".ad-banner",
      ".ad-container",
      ".adsbox",
      "[id^='google_ads']",
      "[id*='adslot']",
      "[class*='sponsored']",
      "[aria-label*='advertisement' i]",
      "[data-ad]"
    ],
    annoyances: [
      "#onetrust-banner-sdk",
      ".onetrust-pc-dark-filter",
      ".cookie-banner",
      ".cookie-consent",
      ".cc-window",
      ".qc-cmp2-container",
      ".didomi-popup-open",
      ".newsletter-popup",
      ".modal-newsletter",
      ".subscribe-modal"
    ],
    videoAds: [
      ".ytp-ad-module",
      ".ytp-ad-overlay-container",
      ".ytp-ad-player-overlay",
      ".video-ads",
      ".ad-showing",
      "[class*='ad-slot-renderer']"
    ],
    antiDetectBait: [
      ".adsbox",
      ".ad-placement",
      ".ad_unit",
      "#adsbox",
      ".text-ad-links"
    ]
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
    meditationAudio: null,
    morphObserver: null,
    morphDebounce: null,
    biofeedbackTimer: null,
    blocker: {
      observer: null,
      scanTimer: null,
      pickerActive: false,
      pickerCleanup: null,
      hiddenCountSent: 0,
      antiDetectInjected: false
    },
    eyeDropper: {
      active: false,
      lastHex: "#FFB300",
      rafId: 0,
      pendingPoint: null,
      cleanup: null,
      hudNode: null,
      previousCursor: ""
    },
    screenshot: {
      active: false,
      host: null,
      targetEl: null,
      targetRect: null,
      pointer: { x: 0, y: 0, alt: false, shift: false },
      rafId: 0,
      listeners: null,
      previewVisible: false,
      captureInFlight: false,
      lastSwitchAt: 0
    }
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

  function normalizeHost(input) {
    try {
      const parsed = new URL(String(input || location.href));
      if (!/^https?:$/.test(parsed.protocol)) return "";
      return parsed.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      const raw = String(input || "")
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .trim()
        .toLowerCase();
      return raw || "";
    }
  }

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function normalizeHexColor(value, fallback = "") {
    const raw = String(value || "").trim().toUpperCase();
    const short = raw.match(/^#([0-9A-F]{3})$/);
    if (short) {
      const [r, g, b] = short[1].split("");
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    if (/^#[0-9A-F]{6}$/.test(raw)) return raw;
    return fallback;
  }

  function rgbToHex(r, g, b) {
    const toByte = (n) => Math.max(0, Math.min(255, Number(n || 0)));
    const toHex = (n) => toByte(n).toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function parseCssColorToHex(value) {
    const normalized = normalizeHexColor(value, "");
    if (normalized) return normalized;
    const rgb = String(value || "").match(/^rgba?\(([^)]+)\)$/i);
    if (!rgb) return "";
    const parts = rgb[1].split(",").map((part) => Number(String(part).trim()));
    if (parts.length < 3 || parts.some((n, idx) => idx < 3 && !Number.isFinite(n))) return "";
    if (parts.length >= 4 && Number(parts[3]) <= 0) return "";
    return rgbToHex(parts[0], parts[1], parts[2]);
  }

  function pickColorFromPoint(x, y) {
    const element = document.elementFromPoint(Number(x || 0), Number(y || 0));
    if (!element) return "";
    const style = window.getComputedStyle(element);
    const candidates = [
      style.backgroundColor,
      style.color,
      style.borderColor
    ];
    for (const color of candidates) {
      const hex = parseCssColorToHex(color);
      if (hex) return hex;
    }
    return "";
  }

  function ensurePickerHud() {
    if (state.eyeDropper.hudNode && document.contains(state.eyeDropper.hudNode)) {
      return state.eyeDropper.hudNode;
    }
    ensureStyle();
    const hud = document.createElement("div");
    hud.id = IDS.PICKER_HUD;
    hud.innerHTML = `
      <div class="kicker">HOLMETA Eye Dropper</div>
      <div class="top">
        <span class="swatch" data-role="swatch"></span>
        <span class="hex" data-role="hex">${state.eyeDropper.lastHex}</span>
        <button type="button" data-role="close" aria-label="Close eye dropper">×</button>
      </div>
      <p class="hint">Move cursor for live swatch. Click to save color. Press ESC to cancel.</p>
    `;
    const close = hud.querySelector('[data-role="close"]');
    close?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      stopPersistentColorPicker({ reason: "cancelled" });
    });
    document.documentElement.appendChild(hud);
    state.eyeDropper.hudNode = hud;
    return hud;
  }

  function updatePickerHud(hex) {
    const hud = ensurePickerHud();
    const swatch = hud.querySelector('[data-role="swatch"]');
    const label = hud.querySelector('[data-role="hex"]');
    if (swatch) swatch.style.background = hex;
    if (label) label.textContent = hex;
  }

  function stopPersistentColorPicker({ reason = "cancelled", silent = false } = {}) {
    if (state.eyeDropper.cleanup) {
      try {
        state.eyeDropper.cleanup();
      } catch (error) {
        log("error", "picker_cleanup_failed", { reason: String(error?.message || error) });
      }
    }
    state.eyeDropper.cleanup = null;

    if (state.eyeDropper.rafId) {
      cancelAnimationFrame(state.eyeDropper.rafId);
      state.eyeDropper.rafId = 0;
    }
    state.eyeDropper.pendingPoint = null;
    state.eyeDropper.active = false;

    const hud = state.eyeDropper.hudNode || document.getElementById(IDS.PICKER_HUD);
    if (hud?.remove) hud.remove();
    state.eyeDropper.hudNode = null;

    document.documentElement.style.cursor = state.eyeDropper.previousCursor || "";
    state.eyeDropper.previousCursor = "";

    if (!silent && reason === "cancelled") {
      showToast({
        title: "Color Picker Closed",
        body: "Pick was cancelled."
      });
    }
  }

  async function finalizePersistentColorPick(hex, method = "element_sample") {
    const normalized = normalizeHexColor(hex, "");
    if (!normalized) {
      showToast({
        title: "No color detected",
        body: "Try hovering over a different area and click again."
      });
      return;
    }

    state.eyeDropper.lastHex = normalized;
    updatePickerHud(normalized);
    await sendRuntimeMessage({
      type: "holmeta:color-picked",
      hex: normalized,
      method
    });

    showToast({
      title: "Color captured",
      body: `${normalized} saved to Eye Dropper.`
    });
    stopPersistentColorPicker({ reason: "picked", silent: true });
  }

  function processLivePickerPoint() {
    state.eyeDropper.rafId = 0;
    if (!state.eyeDropper.active || !state.eyeDropper.pendingPoint) return;
    const { x, y } = state.eyeDropper.pendingPoint;
    state.eyeDropper.pendingPoint = null;
    const hex = normalizeHexColor(pickColorFromPoint(x, y), "");
    if (!hex) return;
    state.eyeDropper.lastHex = hex;
    updatePickerHud(hex);
  }

  function queueLivePickerPoint(x, y) {
    state.eyeDropper.pendingPoint = { x: Number(x || 0), y: Number(y || 0) };
    if (state.eyeDropper.rafId) return;
    state.eyeDropper.rafId = requestAnimationFrame(processLivePickerPoint);
  }

  function startPersistentColorPicker() {
    if (state.eyeDropper.active) {
      return { ok: true, active: true, method: "persistent" };
    }

    state.eyeDropper.active = true;
    state.eyeDropper.previousCursor = document.documentElement.style.cursor || "";
    document.documentElement.style.cursor = "crosshair";
    updatePickerHud(state.eyeDropper.lastHex);

    const onMove = (event) => {
      queueLivePickerPoint(event.clientX, event.clientY);
    };

    const onClick = (event) => {
      if (typeof event.button === "number" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const hex = normalizeHexColor(pickColorFromPoint(event.clientX, event.clientY), state.eyeDropper.lastHex || "");
      void finalizePersistentColorPick(hex, "live_sample");
    };

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      stopPersistentColorPicker({ reason: "cancelled" });
    };

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);

    state.eyeDropper.cleanup = () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };

    showToast({
      title: "Color Picker Active",
      body: "Live swatch enabled. Move cursor and click to save."
    });

    return { ok: true, active: true, method: "persistent" };
  }

  function screenshotSettings() {
    const raw = state.settings?.screenshotTool || {};
    const aspect = ["none", "square", "4:3", "16:9", "custom"].includes(String(raw.aspectRatio || ""))
      ? String(raw.aspectRatio)
      : "none";
    return {
      enabled: Boolean(raw.enabled ?? true),
      padding: Math.max(0, Math.min(24, Number(raw.padding || 8))),
      targetMode: ["smart", "exact", "parent"].includes(String(raw.targetMode || ""))
        ? String(raw.targetMode)
        : "smart",
      aspectRatio: aspect,
      customAspectWidth: Math.max(1, Math.min(999, Number(raw.customAspectWidth || 16))),
      customAspectHeight: Math.max(1, Math.min(999, Number(raw.customAspectHeight || 9))),
      minTargetWidth: Math.max(12, Math.min(2400, Number(raw.minTargetWidth || 40))),
      minTargetHeight: Math.max(12, Math.min(1800, Number(raw.minTargetHeight || 24))),
      outputScale: Number(raw.outputScale || 1) >= 2 ? 2 : 1,
      backgroundMode: ["original", "white", "transparent"].includes(String(raw.backgroundMode || ""))
        ? String(raw.backgroundMode)
        : "original",
      showTooltip: Boolean(raw.showTooltip ?? true),
      autoCopy: Boolean(raw.autoCopy),
      previewRounded: Boolean(raw.previewRounded)
    };
  }

  function isScreenshotHostNode(node) {
    if (!node || typeof node.closest !== "function") return false;
    return Boolean(node.closest(`#${IDS.SCREENSHOT_HOST}`));
  }

  function ensureScreenshotHost() {
    ensureStyle();
    let host = document.getElementById(IDS.SCREENSHOT_HOST);
    if (!host) {
      host = document.createElement("div");
      host.id = IDS.SCREENSHOT_HOST;
      host.innerHTML = `
        <div class="hm-shot-mask" data-role="mask" hidden></div>
        <div class="hm-shot-hole" data-role="hole" hidden></div>
        <div class="hm-shot-tip" data-role="tip" hidden></div>
      `;
      document.documentElement.appendChild(host);
    }
    state.screenshot.host = host;
    return host;
  }

  function getScreenshotOverlayRefs() {
    const host = ensureScreenshotHost();
    return {
      host,
      mask: host.querySelector('[data-role="mask"]'),
      hole: host.querySelector('[data-role="hole"]'),
      tip: host.querySelector('[data-role="tip"]'),
      preview: host.querySelector('.hm-shot-preview')
    };
  }

  function elementVisualScore(element, rect, settings) {
    if (!element || !rect) return -9999;
    const tag = String(element.tagName || "").toLowerCase();
    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity || 1) <= 0.02) return -9999;
    if (style.pointerEvents === "none") return -9999;

    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width < settings.minTargetWidth || height < settings.minTargetHeight) return -9999;

    const area = width * height;
    const viewportArea = Math.max(window.innerWidth * window.innerHeight, 1);
    const coverage = area / viewportArea;
    if (coverage >= 0.96) return -9000;

    const semanticScore = {
      article: 48,
      section: 36,
      main: 40,
      nav: 32,
      figure: 46,
      img: 50,
      picture: 48,
      video: 52,
      canvas: 44,
      button: 40,
      form: 34,
      pre: 42,
      code: 28,
      table: 34,
      aside: 20,
      div: 10
    }[tag] || 6;

    let score = semanticScore;
    score += Math.min(42, Math.log10(Math.max(area, 1)) * 16);
    score -= Math.max(0, coverage - 0.72) * 220;

    if (/(block|flex|grid|table)/.test(style.display)) score += 14;
    if (parseFloat(style.borderWidth || "0") > 0) score += 8;
    if (style.backgroundColor && !/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)/i.test(style.backgroundColor)) score += 10;
    if (style.boxShadow && style.boxShadow !== "none") score += 6;

    if (/^(span|small|b|i|u|strong|em|label|path|svg|use)$/.test(tag)) score -= 26;
    if (["html", "body"].includes(tag)) score -= 60;

    const idClass = `${element.id || ""} ${element.className || ""}`.toLowerCase();
    if (/(card|panel|modal|dialog|content|result|product|item|tile|post|comment|entry)/.test(idClass)) score += 14;
    if (/(icon|badge|avatar|chip|tag|tiny)/.test(idClass)) score -= 12;

    return score;
  }

  function pickScreenshotTargetFromEvent(pointer) {
    const settings = screenshotSettings();
    const x = Number(pointer?.x || 0);
    const y = Number(pointer?.y || 0);
    const initial = document.elementFromPoint(x, y);
    if (!initial || isScreenshotHostNode(initial)) return null;

    const forceExact = settings.targetMode === "exact" || Boolean(pointer?.alt);
    const preferParent = settings.targetMode === "parent" || Boolean(pointer?.shift);
    const chain = [];
    let node = initial;
    let depth = 0;
    while (node && depth < 10) {
      if (node.nodeType === Node.ELEMENT_NODE && !isScreenshotHostNode(node)) {
        chain.push(node);
      }
      node = node.parentElement;
      depth += 1;
    }
    if (!chain.length) return null;

    if (forceExact) {
      const rect = chain[0].getBoundingClientRect();
      if (elementVisualScore(chain[0], rect, settings) > -9000) {
        return { element: chain[0], rect };
      }
    }

    const scored = chain
      .map((element, idx) => {
        const rect = element.getBoundingClientRect();
        const score = elementVisualScore(element, rect, settings) - idx * 5;
        return { element, rect, score, idx };
      })
      .filter((row) => row.score > -9000)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;
    let best = scored[0];
    if (preferParent && scored[1]) {
      best = scored[1];
    }

    if (state.screenshot.targetEl && state.screenshot.targetEl !== best.element) {
      const nowTs = Date.now();
      const prev = state.screenshot.targetEl;
      if (
        nowTs - state.screenshot.lastSwitchAt < 120 &&
        prev.contains(best.element) &&
        state.screenshot.targetRect?.width > best.rect.width &&
        state.screenshot.targetRect?.height > best.rect.height
      ) {
        return { element: prev, rect: state.screenshot.targetRect };
      }
      state.screenshot.lastSwitchAt = nowTs;
    }
    return { element: best.element, rect: best.rect };
  }

  function updateScreenshotOverlayFromState() {
    if (!state.screenshot.active) return;
    const refs = getScreenshotOverlayRefs();
    if (!refs.mask || !refs.hole || !refs.tip) return;
    refs.mask.hidden = false;

    const target = state.screenshot.targetEl;
    if (!target || !document.contains(target)) {
      refs.hole.hidden = true;
      refs.tip.hidden = true;
      return;
    }

    const rect = target.getBoundingClientRect();
    const settings = screenshotSettings();
    if (rect.width < settings.minTargetWidth || rect.height < settings.minTargetHeight) {
      refs.hole.hidden = true;
      refs.tip.hidden = true;
      return;
    }

    state.screenshot.targetRect = rect;
    refs.hole.hidden = false;
    refs.hole.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
    refs.hole.style.width = `${Math.round(rect.width)}px`;
    refs.hole.style.height = `${Math.round(rect.height)}px`;

    if (settings.showTooltip) {
      const tag = String(target.tagName || "element").toLowerCase();
      refs.tip.hidden = false;
      refs.tip.textContent = `${tag} · ${Math.round(rect.width)}×${Math.round(rect.height)}`;
      const tipLeft = clamp(rect.left, 8, Math.max(8, window.innerWidth - 220));
      const tipTop = rect.top > 36 ? rect.top - 30 : rect.bottom + 8;
      refs.tip.style.transform = `translate(${Math.round(tipLeft)}px, ${Math.round(tipTop)}px)`;
    } else {
      refs.tip.hidden = true;
    }
  }

  function queueScreenshotOverlayUpdate(pointerEvent = null) {
    if (pointerEvent) {
      state.screenshot.pointer = {
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
        alt: Boolean(pointerEvent.altKey),
        shift: Boolean(pointerEvent.shiftKey)
      };
    }
    if (state.screenshot.rafId) return;
    state.screenshot.rafId = requestAnimationFrame(() => {
      state.screenshot.rafId = 0;
      if (!state.screenshot.active) return;
      const picked = pickScreenshotTargetFromEvent(state.screenshot.pointer);
      if (picked?.element) {
        state.screenshot.targetEl = picked.element;
        state.screenshot.targetRect = picked.rect;
      }
      updateScreenshotOverlayFromState();
    });
  }

  async function copyImageDataUrl(dataUrl) {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
      const blob = await fetch(dataUrl).then((res) => res.blob());
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      return true;
    } catch {
      return false;
    }
  }

  function downloadImageDataUrl(dataUrl) {
    const anchor = document.createElement("a");
    const stamp = new Date();
    const id = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}-${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}${String(stamp.getSeconds()).padStart(2, "0")}`;
    anchor.href = dataUrl;
    anchor.download = `holmeta-element-${id}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function removeScreenshotPreview() {
    const host = state.screenshot.host || document.getElementById(IDS.SCREENSHOT_HOST);
    if (!host) return;
    host.querySelector(".hm-shot-preview")?.remove();
    state.screenshot.previewVisible = false;
  }

  function renderScreenshotPreview(result) {
    const host = ensureScreenshotHost();
    removeScreenshotPreview();
    const settings = screenshotSettings();
    const panel = document.createElement("section");
    panel.className = `hm-shot-preview${settings.previewRounded ? " rounded" : ""}`;
    panel.innerHTML = `
      <p class="kicker">HOLMETA Element Screenshot</p>
      <p class="meta">${Math.round(result.width)}×${Math.round(result.height)} px</p>
      <img src="${result.imageDataUrl}" alt="Captured element screenshot preview" />
      <div class="hm-shot-actions">
        <button type="button" data-action="copy">Copy</button>
        <button type="button" data-action="download">Download</button>
        <button type="button" data-action="retry">Retry</button>
        <button type="button" data-action="close">Close</button>
      </div>
    `;

    panel.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.getAttribute("data-action");
      if (action === "copy") {
        const ok = await copyImageDataUrl(result.imageDataUrl);
        showToast({ title: ok ? "Screenshot copied" : "Copy blocked", body: ok ? "Image copied to clipboard." : "Clipboard permission is blocked on this page." });
        return;
      }
      if (action === "download") {
        downloadImageDataUrl(result.imageDataUrl);
        showToast({ title: "Download started", body: "PNG saved from preview." });
        return;
      }
      if (action === "retry") {
        removeScreenshotPreview();
        startScreenshotTool({ settings });
        return;
      }
      if (action === "close") {
        removeScreenshotPreview();
      }
    });

    host.appendChild(panel);
    state.screenshot.previewVisible = true;
  }

  async function runElementCapture() {
    if (state.screenshot.captureInFlight) return;
    if (!state.screenshot.targetRect) {
      showToast({ title: "No target selected", body: "Hover a valid element, then click once." });
      return;
    }

    state.screenshot.captureInFlight = true;
    const settings = screenshotSettings();
    const rect = state.screenshot.targetRect;
    const payload = {
      type: "holmeta:screenshot-capture",
      rect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      dpr: window.devicePixelRatio || 1,
      settings
    };

    // Hide selection chrome before capture so the crop is clean.
    const refs = getScreenshotOverlayRefs();
    refs.mask?.setAttribute("hidden", "true");
    refs.hole?.setAttribute("hidden", "true");
    refs.tip?.setAttribute("hidden", "true");
    await new Promise((resolve) => setTimeout(resolve, 32));

    const response = await sendRuntimeMessage(payload);
    state.screenshot.captureInFlight = false;
    if (!response?.ok || !response.imageDataUrl) {
      if (state.screenshot.active) {
        queueScreenshotOverlayUpdate();
      }
      showToast({ title: "Capture failed", body: String(response?.error || "Unable to capture screenshot.") });
      return;
    }

    stopScreenshotTool({ silent: true, keepPreview: true });
    renderScreenshotPreview(response);
    if (settings.autoCopy) {
      const copied = await copyImageDataUrl(response.imageDataUrl);
      if (copied) showToast({ title: "Screenshot copied", body: "Image copied automatically." });
    }
  }

  function stopScreenshotTool({ silent = false, keepPreview = false } = {}) {
    if (state.screenshot.listeners) {
      const { onMove, onScroll, onResize, onClick, onKeyDown } = state.screenshot.listeners;
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      state.screenshot.listeners = null;
    }
    if (state.screenshot.rafId) {
      cancelAnimationFrame(state.screenshot.rafId);
      state.screenshot.rafId = 0;
    }
    state.screenshot.active = false;
    state.screenshot.captureInFlight = false;
    state.screenshot.targetEl = null;
    state.screenshot.targetRect = null;
    const refs = getScreenshotOverlayRefs();
    refs.mask?.setAttribute("hidden", "true");
    refs.hole?.setAttribute("hidden", "true");
    refs.tip?.setAttribute("hidden", "true");
    if (!keepPreview) removeScreenshotPreview();
    if (!silent) {
      showToast({ title: "Screenshot mode stopped", body: "Element capture has been disabled." });
    }
  }

  function startScreenshotTool(payload = {}) {
    const settings = screenshotSettings();
    if (!settings.enabled) {
      return { ok: false, error: "disabled_in_settings" };
    }

    if (state.screenshot.active) {
      queueScreenshotOverlayUpdate();
      return { ok: true, active: true };
    }

    ensureScreenshotHost();
    removeScreenshotPreview();
    const refs = getScreenshotOverlayRefs();
    refs.mask?.removeAttribute("hidden");
    const onMove = (event) => {
      if (isScreenshotHostNode(event.target)) return;
      queueScreenshotOverlayUpdate(event);
    };
    const onScroll = () => queueScreenshotOverlayUpdate();
    const onResize = () => queueScreenshotOverlayUpdate();
    const onClick = (event) => {
      if (!state.screenshot.active) return;
      if (isScreenshotHostNode(event.target)) return;
      if (typeof event.button === "number" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void runElementCapture();
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      stopScreenshotTool({ silent: false });
    };

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);

    state.screenshot.listeners = { onMove, onScroll, onResize, onClick, onKeyDown };
    state.screenshot.active = true;
    state.screenshot.lastSwitchAt = Date.now();

    if (payload?.pointer) {
      state.screenshot.pointer = {
        x: Number(payload.pointer.x || 0),
        y: Number(payload.pointer.y || 0),
        alt: false,
        shift: false
      };
    } else {
      state.screenshot.pointer = {
        x: Math.round(window.innerWidth * 0.5),
        y: Math.round(window.innerHeight * 0.4),
        alt: false,
        shift: false
      };
    }
    queueScreenshotOverlayUpdate();
    showToast({ title: "Element Screenshot active", body: "Hover target element, click once to capture." });
    return { ok: true, active: true };
  }

  function currentHost() {
    return normalizeHost(location.href);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            resolve({ ok: false, error: err.message || "runtime_error" });
            return;
          }
          resolve(response || { ok: false, error: "empty_response" });
        });
      } catch (error) {
        resolve({ ok: false, error: String(error?.message || "runtime_throw") });
      }
    });
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
        position: relative;
        min-width: 252px;
        max-width: min(380px, 90vw);
        border: 1px solid rgba(255, 179, 0, 0.28);
        border-radius: 4px;
        background:
          linear-gradient(180deg, rgba(27, 23, 19, 0.98) 0%, rgba(18, 15, 13, 0.96) 100%);
        color: #f3f3f4;
        padding: 12px 12px 10px;
        box-shadow:
          0 18px 36px rgba(0, 0, 0, 0.42),
          0 0 0 1px rgba(255, 179, 0, 0.08);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        pointer-events: auto;
        display: grid;
        gap: 8px;
        overflow: hidden;
        animation: holmeta-toast-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .holmeta-toast.is-health {
        position: fixed;
        left: 50%;
        top: 50%;
        width: min(620px, calc(100vw - 28px));
        max-width: min(620px, calc(100vw - 28px));
        min-width: min(320px, calc(100vw - 32px));
        transform: translate(-50%, -50%);
        padding: 20px 22px 20px;
        gap: 12px;
        border-color: rgba(201, 132, 92, 0.64);
        border-radius: 2px;
        background:
          linear-gradient(180deg, rgba(54, 36, 24, 0.26) 0%, rgba(28, 20, 16, 0.18) 22%, rgba(18, 14, 12, 0) 45%),
          linear-gradient(180deg, rgba(31, 22, 17, 0.99) 0%, rgba(17, 13, 11, 0.985) 100%);
        box-shadow:
          0 30px 80px rgba(0, 0, 0, 0.6),
          inset 0 1px 0 rgba(214, 163, 126, 0.15),
          0 0 0 1px rgba(201, 132, 92, 0.12),
          0 0 0 9999px rgba(11, 8, 7, 0.58);
      }

      .holmeta-toast.is-meditation {
        position: fixed;
        left: 50%;
        top: 50%;
        width: min(680px, calc(100vw - 28px));
        max-width: min(680px, calc(100vw - 28px));
        min-width: min(340px, calc(100vw - 32px));
        transform: translate(-50%, -50%);
        padding: 24px 24px 22px;
        gap: 14px;
        border-color: rgba(201, 132, 92, 0.56);
        border-radius: 2px;
        background:
          linear-gradient(180deg, rgba(118, 78, 48, 0.18) 0%, rgba(37, 25, 19, 0.14) 22%, rgba(17, 13, 11, 0) 46%),
          linear-gradient(180deg, rgba(26, 19, 15, 0.995) 0%, rgba(14, 11, 10, 0.99) 100%);
        box-shadow:
          0 30px 90px rgba(0, 0, 0, 0.62),
          inset 0 1px 0 rgba(230, 188, 144, 0.1),
          0 0 0 1px rgba(201, 132, 92, 0.1),
          0 0 0 9999px rgba(9, 7, 6, 0.62);
      }

      .holmeta-toast::before {
        content: "";
        position: absolute;
        inset: 0 0 auto 0;
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 179, 0, 0), rgba(255, 179, 0, 0.72), rgba(255, 179, 0, 0));
        opacity: 0.85;
      }

      .holmeta-toast.is-exit {
        opacity: 0;
        transform: translateY(-6px) scale(0.985);
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .holmeta-toast.is-health.is-exit {
        transform: translate(-50%, calc(-50% - 6px)) scale(0.985);
      }

      .holmeta-toast.is-meditation.is-exit {
        transform: translate(-50%, calc(-50% - 6px)) scale(0.985);
      }

      .holmeta-toast .meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .holmeta-toast .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .holmeta-toast .brand-mark {
        width: 9px;
        height: 9px;
        border-radius: 2px;
        background: linear-gradient(180deg, rgba(216, 162, 117, 1) 0%, rgba(138, 79, 48, 1) 100%);
        box-shadow: 0 0 10px rgba(201, 132, 92, 0.24);
        flex: 0 0 auto;
      }

      .holmeta-toast .brand-label {
        font: 600 10px/1.1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #d9c5b2;
      }

      .holmeta-toast .pill {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        padding: 0 8px;
        border-radius: 2px;
        border: 1px solid rgba(201, 132, 92, 0.28);
        background: rgba(201, 132, 92, 0.1);
        color: #d9b189;
        font: 600 9px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .holmeta-toast .copy {
        display: grid;
        gap: 4px;
      }

      .holmeta-toast .title {
        font-weight: 700;
        font-size: 13px;
        line-height: 1.25;
        color: #f7f1e8;
      }

      .holmeta-toast.is-health .title {
        font-size: 28px;
        line-height: 1.04;
        letter-spacing: 0.01em;
      }

      .holmeta-toast.is-meditation .title {
        font-size: 32px;
        line-height: 1.02;
        letter-spacing: 0.01em;
      }

      .holmeta-toast .kicker {
        font: 500 10px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: #d9c5b2;
      }

      .holmeta-toast.is-health .kicker {
        font-size: 11px;
        letter-spacing: 0.14em;
      }

      .holmeta-toast .body {
        color: rgba(243, 243, 244, 0.86);
      }

      .holmeta-toast.is-health .body {
        font-size: 15px;
        line-height: 1.55;
        color: rgba(243, 243, 244, 0.9);
      }

      .holmeta-toast.is-meditation .body {
        font-size: 15px;
        line-height: 1.62;
        color: rgba(243, 243, 244, 0.9);
      }

      .holmeta-toast .session-meta {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .holmeta-toast .session-meta span {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 10px;
        border: 1px solid rgba(201, 132, 92, 0.22);
        background: rgba(201, 132, 92, 0.08);
        color: #e2c0a0;
        font: 500 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .holmeta-toast .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .holmeta-toast.is-health .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 4px;
      }

      .holmeta-toast.is-meditation .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 6px;
      }

      .holmeta-toast button {
        width: auto;
        min-width: 0;
        border: 1px solid rgba(243, 243, 244, 0.16);
        border-radius: 2px;
        background: rgba(243, 243, 244, 0.04);
        color: #f3f3f4;
        font-size: 11px;
        min-height: 28px;
        padding: 0 10px;
        cursor: pointer;
        transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
      }

      .holmeta-toast button:hover {
        border-color: rgba(243, 243, 244, 0.28);
        background: rgba(243, 243, 244, 0.08);
      }

      .holmeta-toast.is-health button {
        width: 100%;
        min-height: 42px;
        border-radius: 2px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
      }

      .holmeta-toast.is-meditation button {
        width: 100%;
        min-height: 42px;
        border-radius: 2px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
      }

      .holmeta-toast button:active {
        transform: translateY(1px);
      }

      .holmeta-toast button[data-action="snooze"] {
        border-color: rgba(201, 132, 92, 0.46);
        background: rgba(201, 132, 92, 0.14);
        color: #e2c0a0;
      }

      .holmeta-toast button[data-action="stop-meditation"] {
        border-color: rgba(201, 132, 92, 0.48);
        background: rgba(201, 132, 92, 0.14);
        color: #e2c0a0;
      }

      @keyframes holmeta-toast-enter {
        from {
          opacity: 0;
          transform: translateY(-8px) scale(0.985);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      #${IDS.PICKER_HUD} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483646;
        min-width: 220px;
        max-width: min(320px, 86vw);
        border: 1px solid rgba(255, 179, 0, 0.72);
        background: rgba(20, 17, 15, 0.95);
        box-shadow: 0 0 0 1px rgba(255, 179, 0, 0.16), 0 0 16px rgba(255, 179, 0, 0.28);
        padding: 10px;
        display: grid;
        gap: 8px;
        pointer-events: auto;
        color: #f3f3f4;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      }

      #${IDS.PICKER_HUD} .top {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 8px;
        align-items: center;
      }

      #${IDS.PICKER_HUD} .swatch {
        width: 28px;
        height: 28px;
        border: 1px solid rgba(243, 243, 244, 0.42);
        background: #FFB300;
      }

      #${IDS.PICKER_HUD} .hex {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        letter-spacing: 0.05em;
      }

      #${IDS.PICKER_HUD} .kicker {
        margin: 0;
        font-size: 10px;
        letter-spacing: 0.1em;
        color: #d9c5b2;
        text-transform: uppercase;
      }

      #${IDS.PICKER_HUD} .hint {
        margin: 0;
        font-size: 11px;
        color: #d9c5b2;
      }

      #${IDS.PICKER_HUD} button {
        border: 1px solid rgba(196, 32, 33, 0.84);
        background: rgba(196, 32, 33, 0.18);
        color: #f3f3f4;
        min-height: 30px;
        min-width: 30px;
        padding: 0;
        cursor: pointer;
      }

      #${IDS.SCREENSHOT_HOST} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        pointer-events: none;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-mask {
        position: fixed;
        inset: 0;
        background: rgba(20, 17, 15, 0.44);
        pointer-events: none;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-hole {
        position: fixed;
        border: 1px solid rgba(255, 179, 0, 0.94);
        box-shadow:
          inset 0 0 0 1px rgba(255, 179, 0, 0.44),
          0 0 0 9999px rgba(20, 17, 15, 0.42),
          0 0 14px rgba(255, 179, 0, 0.36);
        pointer-events: none;
        transition: transform 90ms linear, width 90ms linear, height 90ms linear;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-tip {
        position: fixed;
        min-height: 24px;
        padding: 4px 8px;
        border: 1px solid rgba(255, 179, 0, 0.72);
        background: rgba(20, 17, 15, 0.96);
        color: #F3F3F4;
        font: 600 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.04em;
        white-space: nowrap;
        pointer-events: none;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-preview {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: min(360px, calc(100vw - 24px));
        border: 1px solid rgba(243, 243, 244, 0.22);
        background: rgba(20, 17, 15, 0.97);
        color: #F3F3F4;
        padding: 10px;
        display: grid;
        gap: 8px;
        pointer-events: auto;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-preview.rounded img {
        border-radius: 12px;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-preview .kicker {
        margin: 0;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #D9C5B2;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-preview .meta {
        margin: 0;
        font-size: 11px;
        color: #D9C5B2;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-preview img {
        width: 100%;
        max-height: 220px;
        object-fit: contain;
        border: 1px solid rgba(243, 243, 244, 0.2);
        background: #14110F;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #${IDS.SCREENSHOT_HOST} .hm-shot-actions button {
        min-height: 34px;
        border: 1px solid rgba(196, 32, 33, 0.84);
        background: rgba(196, 32, 33, 0.16);
        color: #F3F3F4;
        font: 600 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
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

  function dismissToast(toast) {
    if (!toast || toast.dataset.closing === "1") return;
    toast.dataset.closing = "1";
    toast.classList.add("is-exit");
    window.setTimeout(() => toast.remove(), 180);
  }

  function showToast(payload = {}) {
    const host = ensureToastHost();
    const snoozeMinutes = Math.max(1, Number(payload.snoozeMinutes || 10));
    const durationMs = Math.max(4000, Math.min(16000, Number(payload.durationMs || 9000)));
    const kindLabel = {
      eye: "Eye Relief",
      posture: "Posture",
      burnout: "Burnout Reset",
      hydration: "Hydration",
      blink: "Blink Reset",
      movement: "Movement"
    }[String(payload.kind || "")];
    const isMeditation = Boolean(payload.meditation);
    const isHealthAlert = Boolean(payload.kind);
    if (isHealthAlert || isMeditation) {
      host.querySelectorAll(".holmeta-toast.is-health, .holmeta-toast.is-meditation").forEach((node) => node.remove());
    }
    const pillLabel = isMeditation
      ? (payload.test ? "Preview" : "Meditation")
      : payload.test
        ? "Live Preview"
        : kindLabel
          ? "Health Alert"
          : "Notice";
    const toast = document.createElement("article");
    toast.className = "holmeta-toast";
    if (isHealthAlert) toast.classList.add("is-health");
    if (isMeditation) toast.classList.add("is-meditation");
    if (payload.test) toast.dataset.test = "1";

    const meta = document.createElement("div");
    meta.className = "meta";

    const brand = document.createElement("div");
    brand.className = "brand";

    const brandMark = document.createElement("span");
    brandMark.className = "brand-mark";

    const brandLabel = document.createElement("span");
    brandLabel.className = "brand-label";
    brandLabel.textContent = "Holmeta";

    brand.append(brandMark, brandLabel);

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = pillLabel;

    meta.append(brand, pill);

    const copy = document.createElement("div");
    copy.className = "copy";

    if (kindLabel || isMeditation) {
      const kicker = document.createElement("div");
      kicker.className = "kicker";
      kicker.textContent = isMeditation ? "Meditation Session" : kindLabel;
      copy.appendChild(kicker);
    }

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = String(payload.title || "Holmeta");
    copy.appendChild(title);

    if (payload.body) {
      const body = document.createElement("div");
      body.className = "body";
      body.textContent = String(payload.body || "");
      copy.appendChild(body);
    }

    if (isMeditation) {
      const sessionMeta = document.createElement("div");
      sessionMeta.className = "session-meta";

      const lengthChip = document.createElement("span");
      lengthChip.textContent = `${Math.max(3, Number(payload.durationMin || 10))} min`;

      const ambientChip = document.createElement("span");
      ambientChip.textContent = String(payload.ambientLabel || "Brown Hush");

      sessionMeta.append(lengthChip, ambientChip);
      copy.appendChild(sessionMeta);
    }

    toast.append(meta, copy);

    if (isHealthAlert || isMeditation) {
      const actions = document.createElement("div");
      actions.className = "actions";

      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.setAttribute("data-action", "dismiss");
      dismiss.textContent = isMeditation ? "Close" : "Acknowledge";

      if (isMeditation) {
        const stop = document.createElement("button");
        stop.type = "button";
        stop.setAttribute("data-action", "stop-meditation");
        stop.textContent = payload.test ? "Stop Preview" : "Stop Session";
        actions.append(dismiss, stop);
      } else {
        const snooze = document.createElement("button");
        snooze.type = "button";
        snooze.setAttribute("data-action", "snooze");
        snooze.textContent = `Snooze ${snoozeMinutes}m`;
        actions.append(dismiss, snooze);
      }
      toast.appendChild(actions);
    }

    toast.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.getAttribute("data-action");
      if (action === "snooze") {
        sendRuntimeMessage({ type: "holmeta:snooze-alerts", minutes: snoozeMinutes });
      }
      if (action === "stop-meditation") {
        sendRuntimeMessage({ type: "holmeta:stop-meditation" });
      }
      dismissToast(toast);
    });

    host.appendChild(toast);
    if (!isHealthAlert && !isMeditation) {
      setTimeout(() => dismissToast(toast), durationMs);
    }
  }

  function getBlockerSettings() {
    return state.settings?.blocker || null;
  }

  function isCosmeticDisabledForCurrentHost(blocker) {
    const host = currentHost();
    if (!host) return false;
    return Boolean(blocker?.disableCosmeticOnSite?.[host]);
  }

  function getCustomCosmeticSelectors(blocker) {
    const host = currentHost();
    if (!host) return [];
    const map = blocker?.customCosmeticSelectors;
    const list = map && typeof map === "object" ? map[host] : [];
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => String(entry || "").trim())
      .filter((entry) => entry.length > 0 && entry.length <= 220)
      .slice(0, 120);
  }

  function buildCosmeticSelectorList(blocker) {
    const categories = blocker?.categories || {};
    const selectors = [];
    if (categories.ads) selectors.push(...COSMETIC_SELECTORS.ads);
    if (categories.annoyances) selectors.push(...COSMETIC_SELECTORS.annoyances);
    if (categories.videoAds) selectors.push(...COSMETIC_SELECTORS.videoAds);
    selectors.push(...getCustomCosmeticSelectors(blocker));
    return [...new Set(selectors)];
  }

  function ensureBlockerStyleNode() {
    let style = document.getElementById(IDS.BLOCKER_STYLE);
    if (style) return style;
    style = document.createElement("style");
    style.id = IDS.BLOCKER_STYLE;
    document.documentElement.appendChild(style);
    return style;
  }

  async function reportBlockEvents(count, category = "cosmetic") {
    const n = Math.max(0, Number(count || 0));
    if (!n) return;
    await sendRuntimeMessage({
      type: "holmeta:block-events",
      count: n,
      category
    });
  }

  async function scanForHiddenAdNodes(selectors) {
    if (!selectors?.length) return;
    const max = Math.min(280, selectors.length);
    let hidden = 0;
    for (let i = 0; i < max; i += 1) {
      const selector = selectors[i];
      let nodes = [];
      try {
        nodes = [...document.querySelectorAll(selector)].slice(0, 16);
      } catch {
        nodes = [];
      }
      for (const node of nodes) {
        if (!node || node.nodeType !== 1) continue;
        const key = node.getAttribute("data-holmeta-hidden");
        if (key === "1") continue;
        node.setAttribute("data-holmeta-hidden", "1");
        hidden += 1;
      }
    }
    if (hidden > 0) {
      state.blocker.hiddenCountSent += hidden;
      await reportBlockEvents(hidden, "cosmetic");
    }
  }

  function disconnectBlockerObserver() {
    if (state.blocker.observer) {
      state.blocker.observer.disconnect();
      state.blocker.observer = null;
    }
    if (state.blocker.scanTimer) {
      clearTimeout(state.blocker.scanTimer);
      state.blocker.scanTimer = null;
    }
  }

  function scheduleCosmeticRescan(selectors) {
    if (state.blocker.scanTimer) clearTimeout(state.blocker.scanTimer);
    state.blocker.scanTimer = setTimeout(async () => {
      state.blocker.scanTimer = null;
      await scanForHiddenAdNodes(selectors);
    }, 900);
  }

  function applyCosmeticFiltering() {
    const blocker = getBlockerSettings();
    const style = document.getElementById(IDS.BLOCKER_STYLE);
    const blockerActive = Boolean(state.effective?.blockerActive);
    const enabled = blockerActive && Boolean(blocker?.cosmeticFiltering);
    if (!enabled || isCosmeticDisabledForCurrentHost(blocker)) {
      disconnectBlockerObserver();
      if (style) style.textContent = "";
      return;
    }

    const selectors = buildCosmeticSelectorList(blocker);
    const antiDetect = Boolean(blocker?.antiDetection);
    const hideRules = selectors.length
      ? `${selectors.join(",\n")} {\n  display: none !important;\n  visibility: hidden !important;\n  pointer-events: none !important;\n}`
      : "";
    const antiDetectRules = antiDetect
      ? `${COSMETIC_SELECTORS.antiDetectBait.join(",\n")} {\n  display: block !important;\n  min-height: 1px !important;\n  max-height: 1px !important;\n  opacity: 0.01 !important;\n}`
      : "";

    if (antiDetect && !state.blocker.antiDetectInjected) {
      try {
        const script = document.createElement("script");
        script.setAttribute("data-holmeta-anti-detect", "1");
        script.textContent = `(() => {
          try {
            const safeDef = (obj, key, value) => {
              try { Object.defineProperty(obj, key, { configurable: true, get: () => value }); } catch {}
            };
            safeDef(window, "canRunAds", true);
            safeDef(window, "adBlockDetected", false);
            safeDef(window, "adblock", false);
            if (window.navigator) {
              safeDef(window.navigator, "webdriver", false);
            }
            const noop = function() { return { on: () => {}, check: () => {} }; };
            if (!window.BlockAdBlock) window.BlockAdBlock = noop;
            if (!window.FuckAdBlock) window.FuckAdBlock = noop;
          } catch {}
        })();`;
        (document.documentElement || document.head || document.body).appendChild(script);
        script.remove();
        state.blocker.antiDetectInjected = true;
      } catch {}
    }

    const node = ensureBlockerStyleNode();
    node.textContent = `${hideRules}\n${antiDetectRules}\n`;

    if (!state.blocker.observer) {
      state.blocker.observer = new MutationObserver(() => {
        scheduleCosmeticRescan(selectors);
      });
      state.blocker.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    const jitter = antiDetect ? Math.round(Math.random() * 140) + 40 : 35;
    setTimeout(() => {
      scanForHiddenAdNodes(selectors);
    }, jitter);
  }

  function buildElementSelector(element) {
    if (!element || element.nodeType !== 1) return "";
    const el = element;
    const id = String(el.id || "").trim();
    if (id) return `#${escapeSelectorValue(id)}`;

    const classes = String(el.className || "")
      .split(/\s+/g)
      .map((cls) => cls.trim())
      .filter((cls) => cls && !/[0-9]{6,}/.test(cls))
      .slice(0, 2)
      .map((cls) => `.${escapeSelectorValue(cls)}`)
      .join("");
    const tag = String(el.tagName || "div").toLowerCase();
    if (classes) return `${tag}${classes}`;

    const parent = el.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((node) => node.tagName === el.tagName);
      const idx = Math.max(1, siblings.indexOf(el) + 1);
      const parentTag = String(parent.tagName || "body").toLowerCase();
      return `${parentTag} > ${tag}:nth-of-type(${idx})`;
    }
    return tag;
  }

  function startBlockElementPicker() {
    if (state.blocker.pickerActive) return Promise.resolve({ ok: true, reused: true });
    state.blocker.pickerActive = true;

    return new Promise((resolve) => {
      const previousCursor = document.documentElement.style.cursor;
      let highlight = null;
      let onMove = null;
      let onClick = null;
      let onKeyDown = null;
      document.documentElement.style.cursor = "crosshair";
      showToast({
        title: "Block Element Picker",
        body: "Click any page element to hide it on this site. Press ESC to cancel.",
        durationMs: 8000
      });

      const cleanup = () => {
        document.documentElement.style.cursor = previousCursor;
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("click", onClick, true);
        window.removeEventListener("keydown", onKeyDown, true);
        state.blocker.pickerActive = false;
        state.blocker.pickerCleanup = null;
        if (highlight) highlight.remove();
      };

      const done = (payload) => {
        cleanup();
        resolve(payload);
      };

      highlight = document.createElement("div");
      highlight.style.cssText = [
        "position:fixed",
        "left:0",
        "top:0",
        "width:0",
        "height:0",
        "border:2px solid rgba(255,179,0,.95)",
        "background:rgba(255,179,0,.12)",
        "z-index:2147483647",
        "pointer-events:none"
      ].join(";");
      document.documentElement.appendChild(highlight);

      onMove = (event) => {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        if (!target || target === highlight) return;
        const rect = target.getBoundingClientRect();
        highlight.style.left = `${Math.max(0, rect.left)}px`;
        highlight.style.top = `${Math.max(0, rect.top)}px`;
        highlight.style.width = `${Math.max(0, rect.width)}px`;
        highlight.style.height = `${Math.max(0, rect.height)}px`;
      };

      onClick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const selector = buildElementSelector(target);
        if (!selector) {
          done({ ok: false, error: "selector_failed" });
          return;
        }
        const response = await sendRuntimeMessage({
          type: "holmeta:add-cosmetic-selector",
          host: currentHost(),
          selector
        });
        if (!response.ok) {
          done({ ok: false, error: response.error || "save_failed" });
          return;
        }
        applyCosmeticFiltering();
        done({ ok: true, selector, host: currentHost() });
      };

      onKeyDown = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        done({ ok: false, error: "cancelled" });
      };

      state.blocker.pickerCleanup = cleanup;
      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("click", onClick, true);
      window.addEventListener("keydown", onKeyDown, true);
    });
  }

  function getAudioContext() {
    if (state.audioCtx) return state.audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    state.audioCtx = new Ctx();
    return state.audioCtx;
  }

  function ensureMeditationNoiseBuffer(ctx) {
    if (state.meditationNoiseBuffer) return state.meditationNoiseBuffer;
    const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastBrown = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      lastBrown = (lastBrown + (0.02 * white)) / 1.02;
      data[index] = lastBrown * 3.4;
    }
    state.meditationNoiseBuffer = buffer;
    return buffer;
  }

  function meditationAmbientProfile(ambient) {
    const profiles = {
      brown_hush: {
        drones: [96, 144],
        shimmer: 288,
        filter: 840,
        noise: 0.34,
        lfoRate: 0.042,
        lfoDepth: 120
      },
      rain_atrium: {
        drones: [132, 198],
        shimmer: 396,
        filter: 1260,
        noise: 0.5,
        lfoRate: 0.06,
        lfoDepth: 160
      },
      cloud_drift: {
        drones: [174, 261],
        shimmer: 522,
        filter: 1520,
        noise: 0.22,
        lfoRate: 0.08,
        lfoDepth: 180
      },
      night_tide: {
        drones: [108, 162],
        shimmer: 324,
        filter: 940,
        noise: 0.42,
        lfoRate: 0.05,
        lfoDepth: 140
      }
    };
    return profiles[String(ambient || "brown_hush")] || profiles.brown_hush;
  }

  function stopMeditationSound() {
    const session = state.meditationAudio;
    if (!session) return true;
    if (session.stopTimer) window.clearTimeout(session.stopTimer);
    if (session.master) {
      try {
        const nowTime = session.ctx?.currentTime || 0;
        session.master.gain.cancelScheduledValues(nowTime);
        session.master.gain.setTargetAtTime(0.0001, nowTime, 0.18);
      } catch {}
    }
    window.setTimeout(() => {
      (session.cleanup || []).forEach((entry) => {
        try {
          if (typeof entry.stop === "function") entry.stop();
        } catch {}
        try {
          if (typeof entry.disconnect === "function") entry.disconnect();
        } catch {}
      });
    }, 260);
    state.meditationAudio = null;
    return true;
  }

  async function startMeditationSound(ambient = "brown_hush", volume = 0.48, durationMs = 10 * 60 * 1000) {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      return false;
    }

    stopMeditationSound();

    const profile = meditationAmbientProfile(ambient);
    const targetGain = Math.max(0.04, Math.min(0.38, Number(volume || 0.48) * 0.42));
    const nowTime = ctx.currentTime;
    const cleanup = [];

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, nowTime);
    master.gain.linearRampToValueAtTime(targetGain, nowTime + 1.8);
    master.connect(ctx.destination);
    cleanup.push(master);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(profile.filter, nowTime);
    filter.Q.setValueAtTime(0.42, nowTime);
    filter.connect(master);
    cleanup.push(filter);

    profile.drones.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(frequency, nowTime);
      gain.gain.setValueAtTime(index === 0 ? 0.42 : 0.24, nowTime);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(nowTime);
      cleanup.push(gain, osc);
    });

    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(profile.shimmer, nowTime);
    shimmerGain.gain.setValueAtTime(0.035, nowTime);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(filter);
    shimmer.start(nowTime);
    cleanup.push(shimmerGain, shimmer);

    const noise = ctx.createBufferSource();
    noise.buffer = ensureMeditationNoiseBuffer(ctx);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(profile.filter * 0.84, nowTime);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(profile.noise * 0.12, nowTime);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(nowTime);
    cleanup.push(noiseGain, noiseFilter, noise);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(profile.lfoRate, nowTime);
    lfoGain.gain.setValueAtTime(profile.lfoDepth, nowTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(nowTime);
    cleanup.push(lfoGain, lfo);

    state.meditationAudio = {
      ctx,
      master,
      cleanup,
      stopTimer: window.setTimeout(() => {
        stopMeditationSound();
      }, Math.max(8000, Number(durationMs || 0)))
    };

    return true;
  }

  async function playAlertSound(kind = "eye", volume = 0.25, pattern = "double") {
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      return false;
    }

    const profiles = {
      eye: { base: 612, overtone: 918, accent: 1236, waveform: "sine", overtoneWaveform: "triangle", pulseLength: 0.2, glide: 10 },
      posture: { base: 432, overtone: 648, accent: 864, waveform: "triangle", overtoneWaveform: "sine", pulseLength: 0.22, glide: 8 },
      burnout: { base: 288, overtone: 432, accent: 576, waveform: "triangle", overtoneWaveform: "sine", pulseLength: 0.26, glide: 5 },
      hydration: { base: 516, overtone: 774, accent: 1032, waveform: "sine", overtoneWaveform: "triangle", pulseLength: 0.19, glide: 9 },
      blink: { base: 684, overtone: 1026, accent: 1368, waveform: "sine", overtoneWaveform: "triangle", pulseLength: 0.16, glide: 11 },
      movement: { base: 384, overtone: 576, accent: 768, waveform: "triangle", overtoneWaveform: "triangle", pulseLength: 0.2, glide: 7 }
    };
    const profile = profiles[String(kind || "eye")] || profiles.eye;
    const plan = pattern === "single"
      ? [{ offset: 0, accent: true, gain: 0.94 }]
      : pattern === "triple"
        ? [
            { offset: 0, gain: 0.7 },
            { offset: 0.22, gain: 0.74, detune: 10 },
            { offset: 0.5, accent: true, gain: 0.98, detune: -8 }
          ]
        : pattern === "beacon"
          ? [
              { offset: 0, gain: 0.76 },
              { offset: 0.34, accent: true, gain: 1, detune: -16, lengthMult: 1.45 }
            ]
          : pattern === "watchtower"
            ? [
                { offset: 0, gain: 0.7 },
                { offset: 0.2, gain: 0.72, detune: 12 },
                { offset: 0.58, accent: true, gain: 0.96, detune: -10, lengthMult: 1.28 }
              ]
            : pattern === "relay"
              ? [
                  { offset: 0, gain: 0.64 },
                  { offset: 0.16, gain: 0.68, detune: 10 },
                  { offset: 0.32, gain: 0.72, detune: 18 },
                  { offset: 0.62, accent: true, gain: 0.96, detune: -8, lengthMult: 1.18 }
                ]
              : pattern === "klaxon"
                ? [
                    { offset: 0, accent: true, gain: 1, detune: -18, lengthMult: 1.45 },
                    { offset: 0.44, accent: true, gain: 1, detune: 16, lengthMult: 1.45 }
                  ]
                : [
                    { offset: 0, gain: 0.82 },
                    { offset: 0.26, accent: true, gain: 0.96, detune: 8 }
                  ];
    const baseGain = Math.max(0.08, Math.min(0.56, Number(volume || 0.25) * 1.28));
    const startAt = ctx.currentTime;

    plan.forEach((step) => {
      const t = startAt + step.offset;
      const pulseLength = (Boolean(step.accent) ? profile.pulseLength * 1.08 : profile.pulseLength) * Math.max(0.8, Number(step.lengthMult || 1));
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Boolean(step.accent) ? 2550 : 2250, t);
      filter.Q.setValueAtTime(0.8, t);

      const master = ctx.createGain();
      const peak = baseGain * (Boolean(step.accent) ? 1.08 : 0.94) * Math.max(0.45, Number(step.gain || 1));
      master.gain.setValueAtTime(0.0001, t);
      master.gain.linearRampToValueAtTime(peak, t + 0.014);
      master.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.58), t + pulseLength * 0.48);
      master.gain.exponentialRampToValueAtTime(0.0001, t + pulseLength);

      filter.connect(master);
      master.connect(ctx.destination);

      [
        { frequency: profile.base, gain: 1, type: profile.waveform },
        { frequency: profile.overtone, gain: 0.28, type: profile.overtoneWaveform },
        { frequency: profile.accent, gain: Boolean(step.accent) ? 0.14 : 0.08, type: "sine" }
      ].forEach((layer, layerIndex) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = layer.type;
        const detune = Number(step.detune || 0);
        osc.frequency.setValueAtTime(Math.max(80, layer.frequency + detune), t);
        osc.frequency.linearRampToValueAtTime(
          Math.max(80, layer.frequency + detune - profile.glide * (layerIndex + 1)),
          t + pulseLength
        );
        gain.gain.setValueAtTime(layer.gain, t);
        osc.connect(gain);
        gain.connect(filter);
        osc.start(t);
        osc.stop(t + pulseLength + 0.03);
      });
    });

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

  function escapeSelectorValue(value) {
    const text = String(value || "");
    if (!text) return "";
    if (globalThis.CSS && typeof globalThis.CSS.escape === "function") {
      return globalThis.CSS.escape(text);
    }
    return text.replace(/["\\#.:;,[\]()=+*>~'`]/g, "\\$&");
  }


  function normalizeInsightList(rows, limit) {
    if (!Array.isArray(rows)) return [];
    const out = [];
    for (const row of rows) {
      const text = String(row || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      out.push(text);
      if (out.length >= limit) break;
    }
    return out;
  }

  function fallbackPageInsight(reason = "analysis_unavailable") {
    const fallback = globalThis.HolmetaPageInsightEngine?.fallbackPayload?.(reason);
    if (fallback && typeof fallback === "object") {
      return fallback;
    }

    const host = normalizeHost(location.href) || "unknown";
    return {
      pageType: "Unknown / Mixed Page",
      appearsToBe: "Mixed or unclear intent",
      intent: "Mixed or unclear intent",
      summary: "Signals are limited right now, so insight is intentionally conservative.",
      signals: ["Limited page data was available."],
      securityNote: "",
      essentials: [
        `Title: ${String(document.title || "Untitled page").slice(0, 180)}`,
        `Domain: ${host}`,
        `Path: ${String(location.pathname || "/").slice(0, 160) || "/"}`,
        `Language: ${String(document.documentElement?.lang || "und").slice(0, 24) || "und"}`
      ],
      confidence: 0,
      copyText: [
        "Page Type: Unknown / Mixed Page",
        "Appears To Be: Mixed or unclear intent",
        "Summary: Signals are limited right now, so insight is intentionally conservative."
      ].join("\n")
    };
  }

  function collectPageInsight() {
    const engine = globalThis.HolmetaPageInsightEngine;
    if (!engine || typeof engine.collect !== "function") {
      return fallbackPageInsight("engine_unavailable");
    }

    const result = engine.collect(document, location);
    if (!result || typeof result !== "object") {
      return fallbackPageInsight("empty_payload");
    }

    const pageType = String(result.pageType || "Unknown / Mixed Page").slice(0, 96);
    const appearsToBe = String(result.appearsToBe || result.intent || "Mixed or unclear intent").slice(0, 140);
    const summary = String(result.summary || "").replace(/\s+/g, " ").trim().slice(0, 320)
      || "Signals are limited right now, so insight is intentionally conservative.";
    const signals = normalizeInsightList(result.signals, 5);
    const essentials = normalizeInsightList(result.essentials, 8);
    const securityNote = String(result.securityNote || "").replace(/\s+/g, " ").trim().slice(0, 220);
    const confidenceRaw = Number(result.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, Number(confidenceRaw.toFixed(2))))
      : 0;
    const copyText = String(result.copyText || "").trim();

    return {
      pageType,
      appearsToBe,
      intent: appearsToBe,
      summary,
      signals: signals.length ? signals : ["Limited page data was available."],
      securityNote,
      essentials: essentials.length ? essentials : [
        `Title: ${String(document.title || "Untitled page").slice(0, 180)}`,
        `Domain: ${normalizeHost(location.href) || "unknown"}`
      ],
      confidence,
      copyText: copyText || [
        `Page Type: ${pageType}`,
        `Appears To Be: ${appearsToBe}`,
        `Summary: ${summary}`
      ].join("\n")
    };
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
    globalThis.HolmetaDarklightSwitch?.refreshState?.();
    applyCosmeticFiltering();
    applyMorphing(Boolean(state.licensePremium && state.settings.advanced?.morphing));
    globalThis.HolmetaTranslateEngine?.applyState?.({ settings: state.settings.translate || {} });

    if (state.licensePremium && state.settings.advanced?.biofeedback) {
      runBiofeedbackFallback();
    } else {
      stopBiofeedbackFallback();
    }

    if (!state.settings.screenshotTool?.enabled && state.screenshot.active) {
      stopScreenshotTool({ silent: true });
    } else if (state.screenshot.active) {
      queueScreenshotOverlayUpdate();
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = String(message?.type || "");
    const actionOnly = !type && String(message?.action || "").trim();

    if (type === "holmeta:ping") {
      sendResponse({
        ok: true,
        ready: true,
        appearanceEngine: Boolean(globalThis.HolmetaAppearanceEngine?.apply)
      });
      return false;
    }

    if (type === "holmeta:apply-state") {
      applyState(message.payload || {});
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:collect-page-insight") {
      sendResponse({ ok: true, insight: collectPageInsight() });
      return false;
    }

    if (type === "holmeta:toast") {
      showToast(message.payload || {});
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:close-meditation-toast") {
      ensureToastHost()
        .querySelectorAll(".holmeta-toast.is-meditation")
        .forEach((node) => dismissToast(node));
      sendResponse({ ok: true });
      return false;
    }

    if (type.startsWith("holmeta:translate")) {
      const handler = globalThis.HolmetaTranslateEngine?.handleMessage;
      if (typeof handler !== "function") {
        sendResponse({ ok: false, error: "translate_engine_unavailable" });
        return false;
      }
      Promise.resolve(handler(message))
        .then((result) => sendResponse(result || { ok: false, error: "translate_empty_response" }))
        .catch((error) => sendResponse({ ok: false, error: String(error?.message || "translate_handler_failed") }));
      return true;
    }

    if (type === "holmeta:darklight-action" || actionOnly) {
      const handler = globalThis.HolmetaDarklightEngine?.handleAction;
      if (typeof handler !== "function") {
        sendResponse({ ok: false, error: "darklight_engine_unavailable" });
        return false;
      }
      const action = String(message?.action || "").trim();
      Promise.resolve(handler({ action, payload: message?.payload || {} }))
        .then((result) => sendResponse(result || { ok: false, error: "darklight_action_empty_response" }))
        .catch((error) => sendResponse({ ok: false, error: String(error?.message || "darklight_action_failed") }));
      return true;
    }

    if (type === "holmeta:sound") {
      const payload = message.payload || {};
      playAlertSound(payload.kind, payload.volume, payload.pattern).then((ok) => sendResponse({ ok }));
      return true;
    }

    if (type === "holmeta:meditation-sound") {
      const payload = message.payload || {};
      startMeditationSound(payload.ambient, payload.volume, payload.durationMs).then((ok) => sendResponse({ ok }));
      return true;
    }

    if (type === "holmeta:stop-meditation-sound") {
      sendResponse({ ok: stopMeditationSound() });
      return false;
    }

    if (type === "holmeta:start-color-pick") {
      sendResponse(startPersistentColorPicker());
      return false;
    }

    if (type === "holmeta:stop-color-pick") {
      stopPersistentColorPicker({ reason: "cancelled", silent: true });
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:pick-color") {
      sendResponse(startPersistentColorPicker());
      return false;
    }

    if (type === "holmeta:screenshot-start" || type === "SCREENSHOT_START") {
      sendResponse(startScreenshotTool(message.payload || {}));
      return false;
    }

    if (type === "holmeta:screenshot-stop" || type === "SCREENSHOT_CANCEL") {
      stopScreenshotTool({ silent: true });
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:block-element-picker") {
      startBlockElementPicker().then((result) => sendResponse(result));
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
    normalizeHost: globalThis.HolmetaLightEngine?.normalizeHost || normalizeHost
  };
})();
