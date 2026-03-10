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
    INSIGHT_HOST: "holmeta-site-insight-host-v3",
    BLOCKER_STYLE: "holmeta-blocker-style-v3",
    PICKER_HUD: "holmeta-color-picker-hud-v3",
    SCREENSHOT_HOST: "holmeta-screenshot-host-v3"
  };

  const SITE_INSIGHT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const SITE_INSIGHT_LOCAL_THROTTLE_MS = 10000;
  const SITE_INSIGHT_MODEL_VERSION = 5;
  const SITE_INSIGHT_SEEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const SITE_INSIGHT_SEEN_KEY_PREFIX = "holmeta.siteInsight.seen.v2.";

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
    morphObserver: null,
    morphDebounce: null,
    biofeedbackTimer: null,
    siteInsight: {
      hostNode: null,
      shadow: null,
      lastShownAt: 0,
      lastRenderUrl: "",
      lastRequestedUrl: "",
      seenHosts: {},
      navHooked: false,
      autoMinimizeTimer: null,
      minimized: false,
      config: null,
      summaryData: null
    },
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

  function siteInsightSeenKey(host) {
    const safeHost = normalizeHost(host);
    if (!safeHost) return "";
    return `${SITE_INSIGHT_SEEN_KEY_PREFIX}${safeHost}`;
  }

  function hasSeenSiteInsightHost(host) {
    const safeHost = normalizeHost(host);
    if (!safeHost) return false;
    const inMemoryTs = Number(state.siteInsight.seenHosts?.[safeHost] || 0);
    if (inMemoryTs > 0 && Date.now() - inMemoryTs <= SITE_INSIGHT_SEEN_TTL_MS) {
      return true;
    }
    const key = siteInsightSeenKey(safeHost);
    if (!key) return false;
    try {
      const raw = window.localStorage?.getItem(key);
      const ts = Number(raw || 0);
      if (!Number.isFinite(ts) || ts <= 0) return false;
      if (Date.now() - ts > SITE_INSIGHT_SEEN_TTL_MS) {
        window.localStorage?.removeItem(key);
        return false;
      }
      state.siteInsight.seenHosts[safeHost] = ts;
      return true;
    } catch {
      return false;
    }
  }

  function markSeenSiteInsightHost(host) {
    const safeHost = normalizeHost(host);
    if (!safeHost) return;
    state.siteInsight.seenHosts[safeHost] = Date.now();
    const key = siteInsightSeenKey(safeHost);
    if (!key) return;
    try {
      window.localStorage?.setItem(key, String(state.siteInsight.seenHosts[safeHost]));
    } catch {
      // localStorage may be unavailable in strict contexts; non-fatal.
    }
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
        min-width: 240px;
        max-width: min(360px, 90vw);
        border: 1px solid rgba(255, 179, 0, 0.36);
        background: rgba(20, 17, 15, 0.94);
        color: #f3f3f4;
        padding: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        pointer-events: auto;
      }

      .holmeta-toast .title {
        font-weight: 700;
        margin-bottom: 4px;
      }

      .holmeta-toast .kicker {
        font-size: 10px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: #d9c5b2;
        margin-bottom: 6px;
      }

      .holmeta-toast .actions {
        margin-top: 8px;
        display: flex;
        gap: 8px;
      }

      .holmeta-toast button {
        border: 1px solid rgba(243, 243, 244, 0.2);
        background: rgba(20, 17, 15, 0.92);
        color: #f3f3f4;
        font-size: 11px;
        min-height: 28px;
        padding: 0 8px;
        cursor: pointer;
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

    const toast = document.createElement("article");
    toast.className = "holmeta-toast";
    toast.innerHTML = `
      <div class="title">${String(payload.title || "HOLMETA")}</div>
      ${kindLabel ? `<div class="kicker">${kindLabel}</div>` : ""}
      <div>${String(payload.body || "")}</div>
      <div class="actions">
        <button data-action="dismiss">Dismiss</button>
        <button data-action="snooze">Snooze ${snoozeMinutes}m</button>
      </div>
    `;

    toast.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.getAttribute("data-action");
      if (action === "snooze") {
        sendRuntimeMessage({ type: "holmeta:snooze-alerts", minutes: snoozeMinutes });
      }
      toast.remove();
    });

    host.appendChild(toast);
    setTimeout(() => toast.remove(), durationMs);
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

      const highlight = document.createElement("div");
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

      const onMove = (event) => {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        if (!target || target === highlight) return;
        const rect = target.getBoundingClientRect();
        highlight.style.left = `${Math.max(0, rect.left)}px`;
        highlight.style.top = `${Math.max(0, rect.top)}px`;
        highlight.style.width = `${Math.max(0, rect.width)}px`;
        highlight.style.height = `${Math.max(0, rect.height)}px`;
      };

      const onClick = async (event) => {
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

      const onKeyDown = (event) => {
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

  async function playAlertSound(kind = "eye", volume = 0.25, pattern = "double") {
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      return false;
    }

    const frequencies = {
      eye: 540,
      posture: 460,
      burnout: 300
    };

    const hz = frequencies[kind] || 520;
    const pulses = pattern === "triple" ? 3 : pattern === "single" ? 1 : 2;
    const gap = 0.16;
    const pulseLength = 0.24;
    const baseGain = Math.max(0.04, Math.min(0.5, Number(volume || 0.25)));
    const startAt = ctx.currentTime;

    for (let i = 0; i < pulses; i += 1) {
      const t = startAt + i * (pulseLength + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(hz + i * 12, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(baseGain, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + pulseLength);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + pulseLength + 0.02);
    }

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

  function sampleNodes(selector, maxCount = 30) {
    try {
      return [...document.querySelectorAll(selector)].slice(0, maxCount);
    } catch {
      return [];
    }
  }

  function safeText(input, max = 180) {
    return String(input || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function escapeSelectorValue(value) {
    const text = String(value || "");
    if (!text) return "";
    if (globalThis.CSS && typeof globalThis.CSS.escape === "function") {
      return globalThis.CSS.escape(text);
    }
    return text.replace(/["\\#.:;,[\]()=+*>~'`]/g, "\\$&");
  }

  function buildPageTextSample() {
    const chunks = [];
    const push = (value) => {
      const text = safeText(value, 220);
      if (!text) return;
      if (chunks.join(" ").length > 5000) return;
      chunks.push(text);
    };

    push(document.title);
    push(document.querySelector("meta[name='description']")?.getAttribute("content"));
    push(document.querySelector("meta[property='og:description']")?.getAttribute("content"));
    sampleNodes("h1,h2,h3,[role='heading'],p,a,button,[aria-label]", 90).forEach((node) => {
      push(node.textContent || node.getAttribute("aria-label") || "");
    });
    return chunks.join(" ").toLowerCase();
  }

  function isDynamicFeedHost(host) {
    return /(youtube\.com|x\.com|twitter\.com|reddit\.com|google\.[a-z.]+|bing\.com|duckduckgo\.com)/.test(host);
  }

  function feedBucket(host, pathName, searchPart) {
    const path = String(pathName || "").toLowerCase();
    const search = String(searchPart || "").toLowerCase();

    if (/youtube\.com/.test(host)) {
      if (/\/feed\/subscriptions/.test(path)) return "yt_subscriptions";
      if (/\/feed\/trending/.test(path)) return "yt_trending";
      if (/\/results/.test(path) || /[?&]search_query=/.test(search)) return "yt_search";
      if (/\/shorts/.test(path)) return "yt_shorts";
      if (/\/watch/.test(path)) return "yt_watch";
      return "yt_home";
    }

    if (/x\.com|twitter\.com/.test(host)) {
      if (/for_you/.test(path + search)) return "x_for_you";
      if (/following/.test(path + search) || /[?&]f=live/.test(search)) return "x_following";
      if (/\/explore/.test(path)) return "x_explore";
      return "x_home";
    }

    if (/reddit\.com/.test(host)) {
      if (/\/new/.test(path)) return "reddit_new";
      if (/\/top|\/hot|\/best/.test(path)) return "reddit_ranked";
      if (/\/search/.test(path) || /[?&]q=/.test(search)) return "reddit_search";
      return "reddit_home";
    }

    if (/google\.[a-z.]+|bing\.com|duckduckgo\.com/.test(host)) {
      if (/[?&]q=/.test(search) || /\/search/.test(path)) return "search_results";
      return "search_home";
    }

    if (/github\.com/.test(host)) {
      if (/\/notifications/.test(path)) return "gh_notifications";
      if (/\/pulls|\/issues/.test(path)) return "gh_work_queue";
      if (/\/search/.test(path) || /[?&]q=/.test(search)) return "gh_search";
      return "gh_home";
    }

    if (/figma\.com/.test(host)) {
      if (/\/file|\/design|\/proto/.test(path)) return "figma_canvas";
      return "figma_home";
    }

    return "generic";
  }

  function titleCaseWord(input) {
    const value = String(input || "").trim();
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  function collectSchemaTypes() {
    const types = [];
    const scripts = sampleNodes("script[type='application/ld+json']", 8);
    const addType = (value) => {
      if (!value) return;
      const arr = Array.isArray(value) ? value : [value];
      arr.forEach((item) => {
        const text = safeText(item, 48);
        if (text) types.push(text);
      });
    };

    const scan = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.slice(0, 10).forEach(scan);
        return;
      }
      if (node["@type"]) addType(node["@type"]);
      if (node.mainEntity) scan(node.mainEntity);
      if (node["@graph"]) scan(node["@graph"]);
    };

    scripts.forEach((scriptNode) => {
      try {
        const parsed = JSON.parse(scriptNode.textContent || "{}");
        scan(parsed);
      } catch {
        // ignore invalid schema blocks
      }
    });

    return [...new Set(types)];
  }

  function collectStructuredEntities(maxScripts = 10) {
    const scripts = sampleNodes("script[type='application/ld+json']", maxScripts);
    const queue = [];
    const entities = [];

    scripts.forEach((scriptNode) => {
      try {
        const parsed = JSON.parse(scriptNode.textContent || "{}");
        queue.push(parsed);
      } catch {
        // ignore invalid json-ld
      }
    });

    let cursor = 0;
    while (cursor < queue.length && entities.length < 90) {
      const node = queue[cursor];
      cursor += 1;
      if (!node) continue;
      if (Array.isArray(node)) {
        node.slice(0, 20).forEach((entry) => queue.push(entry));
        continue;
      }
      if (typeof node !== "object") continue;

      const typeRaw = node["@type"];
      const types = Array.isArray(typeRaw)
        ? typeRaw.map((entry) => safeText(entry, 40)).filter(Boolean)
        : [safeText(typeRaw, 40)].filter(Boolean);

      if (types.length) {
        entities.push({
          types,
          name: safeText(node.name || node.legalName || node.alternateName || "", 120),
          jobTitle: safeText(node.jobTitle || "", 80),
          foundingDate: safeText(node.foundingDate || node.dateCreated || "", 40),
          datePublished: safeText(node.datePublished || "", 40),
          areaServed: safeText(node.areaServed?.name || node.areaServed || "", 64),
          addressCountry: safeText(
            node.address?.addressCountry || node.locationCreated?.addressCountry || node.countryOfOrigin || "",
            64
          ),
          interactionCount: safeText(
            node.interactionStatistic?.userInteractionCount ||
              node.interactionStatistic?.interactionCount ||
              node.userInteractionCount ||
              "",
            40
          )
        });
      }

      const childrenKeys = [
        "@graph",
        "mainEntity",
        "publisher",
        "author",
        "creator",
        "brand",
        "about",
        "isPartOf",
        "sourceOrganization",
        "itemReviewed"
      ];
      childrenKeys.forEach((key) => {
        const child = node[key];
        if (!child) return;
        if (Array.isArray(child)) {
          child.slice(0, 12).forEach((entry) => queue.push(entry));
          return;
        }
        queue.push(child);
      });
    }

    return entities;
  }

  function findStructuredEntity(entities, pattern) {
    return entities.find((entity) => entity.types.some((type) => pattern.test(String(type || "").toLowerCase())));
  }

  function detectAudienceSizeSignal() {
    const text = safeText(document.body?.innerText || "", 180000).toLowerCase();
    const patterns = [
      /([\d.,]+(?:\s?[kmb])?)\s+(?:monthly|daily|active)?\s*(?:users|members|customers|visitors|subscribers)\b/i,
      /(?:users|members|customers|visitors|subscribers)\s*[:\-]?\s*([\d.,]+(?:\s?[kmb])?)/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match?.[1]) continue;
      const parsed = parseCompactCount(match[1].replace(/\s+/g, ""));
      if (!parsed) continue;
      return `${formatCompactCount(parsed)} (page signal)`;
    }
    return "";
  }

  function getKnownSiteIntent(host, pathName, searchPart) {
    const path = String(pathName || "").toLowerCase();
    const search = String(searchPart || "").toLowerCase();

    const rules = [
      {
        test: /(^|\.)youtube\.com$/,
        identity: "YouTube",
        type: "video",
        purpose: "Video platform for discovery and playback.",
        routes: [
          { test: () => /\/feed\/subscriptions/.test(path), purpose: "Subscriptions feed focused on channels you follow." },
          { test: () => /\/feed\/trending/.test(path), purpose: "Trending feed ranked by popularity." },
          { test: () => /\/results/.test(path) || /[?&]search_query=/.test(search), purpose: "Search results ranked by relevance and engagement." },
          { test: () => /\/watch/.test(path), purpose: "Watch page with recommendation modules and next-up queue." },
          { test: () => /\/shorts/.test(path), purpose: "Short-form recommendation stream." }
        ]
      },
      {
        test: /(^|\.)github\.com$/,
        identity: "GitHub",
        type: "developer",
        purpose: "Code hosting and collaboration for repositories.",
        routes: [
          { test: () => /\/issues/.test(path), purpose: "Issue tracking and project triage." },
          { test: () => /\/pulls|\/pull\//.test(path), purpose: "Pull request review and merge workflow." },
          { test: () => /\/actions/.test(path), purpose: "CI/CD workflow and build monitoring." },
          { test: () => /\/search/.test(path) || /[?&]q=/.test(search), purpose: "Repository and code search results." }
        ]
      },
      {
        test: /(^|\.)figma\.com$/,
        identity: "Figma",
        type: "design",
        purpose: "Collaborative UI/UX design and prototyping workspace.",
        routes: [
          { test: () => /\/file|\/design|\/proto/.test(path), purpose: "Design canvas and component editing." }
        ]
      },
      {
        test: /(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)tiktok\.com$|(^|\.)snapchat\.com$/,
        identity: "Social Platform",
        type: "social",
        purpose: "Social feed and short-form content discovery."
      },
      {
        test: /(^|\.)linkedin\.com$/,
        identity: "LinkedIn",
        type: "social",
        purpose: "Professional network feed and career platform."
      },
      {
        test: /(^|\.)notion\.so$|(^|\.)docs\.google\.com$/,
        identity: "Docs Workspace",
        type: "docs",
        purpose: "Documentation and team knowledge editing workspace."
      },
      {
        test: /(^|\.)docs\.microsoft\.com$|(^|\.)developer\.mozilla\.org$|(^|\.)readthedocs\.io$/,
        identity: "Technical Documentation",
        type: "docs",
        purpose: "Reference documentation and implementation guides."
      },
      {
        test: /(^|\.)reddit\.com$/,
        identity: "Reddit",
        type: "community",
        purpose: "Community discussion and ranked thread discovery."
      },
      {
        test: /(^|\.)x\.com$|(^|\.)twitter\.com$/,
        identity: "X",
        type: "social",
        purpose: "Social timeline and short-form post consumption."
      },
      {
        test: /(^|\.)amazon\./,
        identity: "Amazon",
        type: "commerce",
        purpose: "Ecommerce marketplace for product discovery and checkout."
      },
      {
        test: /(^|\.)walmart\.com$|(^|\.)ebay\./,
        identity: "Ecommerce Marketplace",
        type: "commerce",
        purpose: "Product listing, comparison, and purchase workflow."
      },
      {
        test: /(^|\.)etsy\.com$|(^|\.)shopify\.com$|(^|\.)target\.com$/,
        identity: "Online Storefront",
        type: "commerce",
        purpose: "Storefront for product browsing and checkout."
      },
      {
        test: /(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$/,
        identity: "Search Engine",
        type: "search",
        purpose: "Search engine for ranked information retrieval."
      },
      {
        test: /(^|\.)wikipedia\.org$/,
        identity: "Wikipedia",
        type: "education",
        purpose: "Reference encyclopedia for educational lookup."
      },
      {
        test: /(^|\.)coursera\.org$|(^|\.)udemy\.com$|(^|\.)khanacademy\.org$/,
        identity: "Learning Platform",
        type: "education",
        purpose: "Online learning platform for lessons and coursework."
      },
      {
        test: /(^|\.)jira\.atlassian\.com$|(^|\.)linear\.app$|(^|\.)asana\.com$|(^|\.)trello\.com$/,
        identity: "Work Management App",
        type: "webapp",
        purpose: "Task and project workflow management application."
      },
      {
        test: /(^|\.)salesforce\.com$|(^|\.)hubspot\.com$/,
        identity: "Business Web App",
        type: "webapp",
        purpose: "Account and workflow management web application."
      },
      {
        test: /(^|\.)stackoverflow\.com$|(^|\.)npmjs\.com$|(^|\.)dev\.to$/,
        identity: "Developer Resource",
        type: "developer",
        purpose: "Developer-focused knowledge base, package, or Q&A platform."
      },
      {
        test: /(^|\.)canva\.com$|(^|\.)dribbble\.com$|(^|\.)behance\.net$/,
        identity: "Design Platform",
        type: "design",
        purpose: "Design collaboration, asset creation, or portfolio showcase."
      },
      {
        test: /(^|\.)medium\.com$|(^|\.)substack\.com$/,
        identity: "Publishing Platform",
        type: "news",
        purpose: "Article publishing and newsletter content consumption."
      },
      {
        test: /(^|\.)nytimes\.com$|(^|\.)bbc\.com$|(^|\.)cnn\.com$|(^|\.)theguardian\.com$/,
        identity: "News Publisher",
        type: "news",
        purpose: "Editorial news publishing and article browsing."
      },
      {
        test: /(^|\.)netflix\.com$|(^|\.)hulu\.com$|(^|\.)primevideo\.com$|(^|\.)disneyplus\.com$/,
        identity: "Streaming Service",
        type: "video",
        purpose: "Subscription streaming catalog and playback platform."
      }
    ];

    const matched = rules.find((rule) => rule.test.test(host));
    if (!matched) return null;

    const route = Array.isArray(matched.routes) ? matched.routes.find((item) => item.test()) : null;
    return {
      identity: matched.identity,
      type: matched.type,
      purpose: route?.purpose || matched.purpose
    };
  }

  function parseCompactCount(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/,/g, "");
    if (!raw) return null;
    const match = raw.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
    if (!match) return null;
    const base = Number(match[1]);
    if (!Number.isFinite(base)) return null;
    const multiplier = match[2] === "b" ? 1_000_000_000 : match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1;
    return Math.round(base * multiplier);
  }

  function formatCompactCount(value) {
    if (!Number.isFinite(Number(value))) return "Unknown";
    const n = Number(value);
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(n);
  }

  function detectOnlineUsersSignal() {
    const text = safeText(document.body?.innerText || "", 120000).toLowerCase();
    const patterns = [
      /([\d.,]+(?:\s?[kmb])?)\s+(?:users?\s+)?online\b/i,
      /([\d.,]+(?:\s?[kmb])?)\s+watching\b/i,
      /([\d.,]+(?:\s?[kmb])?)\s+members?\s+online\b/i,
      /\bonline[:\s]+([\d.,]+(?:\s?[kmb])?)\b/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match?.[1]) continue;
      const parsed = parseCompactCount(match[1].replace(/\s+/g, ""));
      if (!parsed) continue;
      return `${formatCompactCount(parsed)} (page signal)`;
    }
    return "";
  }

  function getKnownOwnershipSnapshot(host) {
    const rows = [
      {
        test: /(^|\.)youtube\.com$/,
        ownerName: "Neal Mohan (CEO)",
        country: "United States",
        netWorth: "Not publicly disclosed",
        created: "2005",
        totalUsers: "2.7B+ monthly users (est.)",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)github\.com$/,
        ownerName: "Thomas Dohmke (CEO) · Microsoft (Owner)",
        country: "United States",
        netWorth: "Not publicly disclosed",
        created: "2008",
        totalUsers: "100M+ registered users (est.)",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)figma\.com$/,
        ownerName: "Dylan Field (CEO)",
        country: "United States",
        netWorth: "Not publicly disclosed",
        created: "2012",
        totalUsers: "Millions of monthly users (est.)",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)reddit\.com$/,
        ownerName: "Steve Huffman (CEO)",
        country: "United States",
        netWorth: "Not publicly disclosed",
        created: "2005",
        totalUsers: "70M+ daily active users (est.)",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)x\.com$|(^|\.)twitter\.com$/,
        ownerName: "Elon Musk (Owner) · Linda Yaccarino (CEO)",
        country: "United States",
        netWorth: "Owner net worth varies; public estimate",
        created: "2006",
        totalUsers: "Hundreds of millions of monthly users (est.)",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$/,
        ownerName: "Alphabet / Microsoft / DuckDuckGo (varies by engine)",
        country: "United States",
        netWorth: "Public-company dependent",
        created: "Varies by engine",
        totalUsers: "Large global search traffic",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)amazon\./,
        ownerName: "Andy Jassy (CEO)",
        country: "United States",
        netWorth: "Not publicly disclosed",
        created: "1994",
        totalUsers: "300M+ active customer accounts (est.)",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)linkedin\.com$/,
        ownerName: "Ryan Roslansky (CEO) · Microsoft (Owner)",
        country: "United States",
        netWorth: "Not publicly disclosed",
        created: "2003",
        totalUsers: "1B+ members (est.)",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)wikipedia\.org$/,
        ownerName: "Wikimedia Foundation (nonprofit)",
        country: "United States",
        netWorth: "N/A (nonprofit)",
        created: "2001",
        totalUsers: "Hundreds of millions of monthly users (est.)",
        onlineNow: "Unknown"
      },
      {
        test: /(^|\.)notion\.so$/,
        ownerName: "Ivan Zhao (CEO)",
        country: "United States",
        netWorth: "Not publicly disclosed",
        created: "2016",
        totalUsers: "Millions of monthly users (est.)",
        onlineNow: "Unknown"
      }
    ];
    return rows.find((row) => row.test.test(host)) || null;
  }

  function detectOwnershipSnapshot(host, siteIdentity) {
    const known = getKnownOwnershipSnapshot(host);
    const entities = collectStructuredEntities(8);
    const org = findStructuredEntity(entities, /(organization|corporation|company|newsmediaorganization|website)/);
    const person = findStructuredEntity(entities, /person/);
    const cleanKnown = {
      ownerName: /^unknown$/i.test(String(known?.ownerName || "")) ? "" : String(known?.ownerName || ""),
      country: /^unknown$/i.test(String(known?.country || "")) ? "" : String(known?.country || ""),
      netWorth: /^unknown$/i.test(String(known?.netWorth || "")) ? "" : String(known?.netWorth || ""),
      created: /^unknown$/i.test(String(known?.created || "")) ? "" : String(known?.created || ""),
      totalUsers: /^unknown$/i.test(String(known?.totalUsers || "")) ? "" : String(known?.totalUsers || ""),
      onlineNow: /^unknown$/i.test(String(known?.onlineNow || "")) ? "" : String(known?.onlineNow || "")
    };

    const onlineSignal = detectOnlineUsersSignal();
    const audienceSignal = detectAudienceSizeSignal();
    const authorMeta = safeText(
      document.querySelector("meta[name='author']")?.getAttribute("content") ||
        document.querySelector("[rel='author']")?.textContent ||
        "",
      90
    );
    const locale =
      safeText(document.documentElement?.getAttribute("lang") || "", 20) ||
      safeText(document.querySelector("meta[property='og:locale']")?.getAttribute("content") || "", 20);
    const countrySignal = safeText(
      org?.addressCountry || org?.areaServed || person?.addressCountry || person?.areaServed || "",
      80
    );
    const createdSignal = safeText(org?.foundingDate || person?.foundingDate || "", 40);

    const sourceTags = [];
    if (known) sourceTags.push("known-site snapshot");
    if (org || person) sourceTags.push("JSON-LD");
    if (authorMeta) sourceTags.push("meta/byline");
    if (onlineSignal || audienceSignal) sourceTags.push("on-page counters");

    const snapshot = {
      ownerName:
        cleanKnown.ownerName ||
        safeText(org?.name || person?.name || authorMeta, 110) ||
        "Operator not disclosed in page metadata",
      country: cleanKnown.country || countrySignal || (locale ? `Locale ${locale}` : "Country not disclosed on page"),
      netWorth: cleanKnown.netWorth || "No reliable public value in local signals",
      created: cleanKnown.created || createdSignal || "Creation year not disclosed on page",
      totalUsers: cleanKnown.totalUsers || audienceSignal || "No public user count detected on page",
      onlineNow: onlineSignal || cleanKnown.onlineNow || "No live user counter detected",
      source: sourceTags.length ? `Signals: ${sourceTags.join(" + ")}` : "Signals: page heuristics",
      identity: siteIdentity || host
    };
    return snapshot;
  }

  function detectSiteIdentity(host, knownIntent = null) {
    if (knownIntent?.identity) return knownIntent.identity;
    const siteName =
      safeText(
        document.querySelector("meta[property='og:site_name']")?.getAttribute("content") ||
          document.querySelector("meta[name='application-name']")?.getAttribute("content") ||
          "",
        64
      );
    if (siteName) return siteName;

    const title = safeText(document.title, 90);
    if (title) {
      const token = title.split("|")[0].split(" - ")[0].trim();
      if (token && token.length >= 2 && token.length <= 40) return token;
    }

    const hostToken = host.split(".")[0].replace(/[-_]/g, " ");
    return hostToken
      .split(" ")
      .map((word) => titleCaseWord(word))
      .join(" ");
  }

  function inferTypeFromDomain(host) {
    const checks = [
      { pattern: /(shop|store|cart|checkout|deals|market|mall|coupon|sale)/, type: "commerce", reason: "domain commerce keyword" },
      { pattern: /(news|press|journal|times|post|herald|gazette|blog)/, type: "news", reason: "domain publishing keyword" },
      { pattern: /(docs|wiki|help|support|kb|manual|readme)/, type: "docs", reason: "domain docs keyword" },
      { pattern: /(forum|community|discuss|threads|board)/, type: "community", reason: "domain community keyword" },
      { pattern: /(learn|academy|course|edu|school|training)/, type: "education", reason: "domain education keyword" },
      { pattern: /(dev|code|git|repo|api|sdk)/, type: "developer", reason: "domain developer keyword" },
      { pattern: /(design|ux|ui|creative|portfolio)/, type: "design", reason: "domain design keyword" },
      { pattern: /(bank|pay|finance|invest|trade|wallet|capital)/, type: "finance", reason: "domain finance keyword" },
      { pattern: /(travel|hotel|flight|trip|air|booking|vacation)/, type: "travel", reason: "domain travel keyword" },
      { pattern: /(video|stream|watch|tv|media)/, type: "video", reason: "domain media keyword" }
    ];
    return checks.find((entry) => entry.pattern.test(host)) || null;
  }

  function detectSiteType(host) {
    const path = location.pathname.toLowerCase();
    const search = location.search.toLowerCase();
    const text = buildPageTextSample();
    const schemaTypes = collectSchemaTypes().map((entry) => entry.toLowerCase());

    const knownIntent = getKnownSiteIntent(host, path, search);
    if (knownIntent) {
      return {
        type: knownIntent.type,
        confidence: "high",
        identity: knownIntent.identity,
        purpose: knownIntent.purpose,
        reasons: [`domain mapping: ${knownIntent.identity}`]
      };
    }

    const categories = [
      "developer",
      "design",
      "docs",
      "social",
      "video",
      "search",
      "commerce",
      "news",
      "education",
      "webapp",
      "finance",
      "travel",
      "marketing",
      "community"
    ];

    const scores = Object.fromEntries(categories.map((key) => [key, 0]));
    const reasons = [];
    const bump = (key, amount, reason) => {
      if (!scores[key] && scores[key] !== 0) return;
      scores[key] += amount;
      if (reason) reasons.push(reason);
    };

    if (/github|gitlab|bitbucket|stackoverflow|vercel|netlify|npm|docker|kubernetes/.test(host + " " + text)) {
      bump("developer", 4, "developer domain/text markers");
    }
    if (/figma|dribbble|behance|prototype|wireframe|component library/.test(host + " " + text)) bump("design", 4, "design markers");
    if (/docs|documentation|knowledge base|read the docs|reference|api reference|developer guide/.test(host + " " + text)) {
      bump("docs", 3, "docs markers");
    }
    if (/youtube|vimeo|twitch|watch now|play video|playlist/.test(host + " " + text)) bump("video", 4, "video markers");
    if (/reddit|forum|community|discuss|threads|subreddit/.test(host + " " + text)) bump("community", 3, "community markers");
    if (/for you|following|timeline|feed|reels|stories|shorts/.test(text)) bump("social", 3, "feed/social markers");
    if (/cart|checkout|shop now|add to cart|buy now|price|sku|product|best seller|deal/.test(text + " " + path)) {
      bump("commerce", 4, "commerce markers");
    }
    if (/article|opinion|breaking|newsroom|published|journalist/.test(text + " " + path)) bump("news", 3, "news/article markers");
    if (/course|lesson|syllabus|classroom|learn|training/.test(text + " " + path)) bump("education", 3, "education markers");
    if (/flight|hotel|booking|itinerary|trip/.test(text + " " + host + " " + path)) bump("travel", 3, "travel markers");
    if (/bank|invest|portfolio|stocks|trade|crypto|fintech/.test(text + " " + host)) bump("finance", 3, "finance markers");
    if (/pricing|plans|request demo|get started|features/.test(text + " " + path)) bump("marketing", 2, "marketing page markers");

    if (/[?&](q|query)=/.test(search) || /\/search/.test(path)) bump("search", 5, "search route/query");
    if (document.querySelector("input[type='password'], [data-testid*='login' i], form[action*='login']")) bump("webapp", 3, "login/auth form");
    if (document.querySelector("article time, [itemprop='datePublished']")) bump("news", 2, "article timestamp");
    if (document.querySelector("[class*='feed'], [data-testid*='feed'], [aria-label*='feed' i]")) bump("social", 2, "feed container");
    if (document.querySelector("[class*='pricing'], [href*='pricing'], [data-testid*='pricing' i]")) bump("marketing", 1, "pricing module");
    if (document.querySelector("input[type='search'], [role='search']")) bump("search", 1, "search input");

    if (schemaTypes.some((type) => /newsarticle|article|blogposting/.test(type))) bump("news", 3, "schema article type");
    if (schemaTypes.some((type) => /product|offer/.test(type))) bump("commerce", 3, "schema product type");
    if (schemaTypes.some((type) => /softwareapplication|webapplication/.test(type))) bump("webapp", 2, "schema app type");
    if (schemaTypes.some((type) => /course|educational/.test(type))) bump("education", 2, "schema education type");

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let [topType, topScore] = ranked[0];
    const secondScore = ranked[1]?.[1] || 0;

    if (topScore < 2) {
      const domainGuess = inferTypeFromDomain(host);
      if (domainGuess) {
        topType = domainGuess.type;
        topScore = 3;
        reasons.push(domainGuess.reason);
      }
    }

    if (topScore < 2) {
      if (document.querySelector("form input[type='password'], [role='main'] button")) {
        topType = "webapp";
      } else if (document.querySelector("article")) {
        topType = "news";
      } else if (document.querySelector("video, [class*='video'], [data-testid*='video']")) {
        topType = "video";
      } else if (document.querySelector("[href*='cart'], [href*='checkout'], [data-testid*='price' i]")) {
        topType = "commerce";
      } else if (document.querySelector("main, nav, footer")) {
        topType = "marketing";
      } else {
        topType = "webapp";
      }
      topScore = 2;
      reasons.push("fallback classification");
    }

    const confidence = topScore >= 7 || topScore - secondScore >= 4
      ? "high"
      : topScore >= 4
        ? "medium"
        : "low";

    return {
      type: topType,
      confidence,
      identity: detectSiteIdentity(host, knownIntent),
      purpose: "",
      reasons: reasons.slice(0, 4)
    };
  }

  function detectAlgorithmContext(host, siteType = "") {
    const path = location.pathname.toLowerCase();
    const search = location.search.toLowerCase();
    const text = buildPageTextSample();
    const bucket = feedBucket(host, path, search);

    const knownBuckets = {
      yt_subscriptions: {
        label: "Subscription/following feed",
        confidence: "high",
        explanation: "Detected YouTube subscriptions feed."
      },
      yt_trending: {
        label: "Trending/popularity",
        confidence: "high",
        explanation: "Detected YouTube trending feed."
      },
      yt_search: {
        label: "Search results ranking",
        confidence: "high",
        explanation: "Detected YouTube search results."
      },
      yt_shorts: {
        label: "Recommendation feed",
        confidence: "high",
        explanation: "Detected YouTube Shorts recommendation stream."
      },
      yt_watch: {
        label: "Recommendation feed",
        confidence: "high",
        explanation: "Detected watch page with recommendation modules."
      },
      yt_home: {
        label: "Recommendation feed",
        confidence: "high",
        explanation: "Detected YouTube home recommendations."
      },
      x_for_you: {
        label: "Recommendation feed",
        confidence: "high",
        explanation: "Detected For You timeline route."
      },
      x_following: {
        label: "Chronological feed",
        confidence: "medium",
        explanation: "Detected Following/live timeline route."
      },
      x_explore: {
        label: "Trending/popularity",
        confidence: "medium",
        explanation: "Detected explore/trending discovery route."
      },
      reddit_new: {
        label: "Chronological feed",
        confidence: "medium",
        explanation: "Detected Reddit new sorting route."
      },
      reddit_ranked: {
        label: "Trending/popularity",
        confidence: "high",
        explanation: "Detected Reddit ranked sorting route."
      },
      reddit_search: {
        label: "Search results ranking",
        confidence: "high",
        explanation: "Detected Reddit search results."
      },
      search_results: {
        label: "Search results ranking",
        confidence: "high",
        explanation: "Detected search query and ranked results."
      },
      gh_notifications: {
        label: "Subscription/following feed",
        confidence: "medium",
        explanation: "Detected GitHub notifications stream."
      },
      gh_search: {
        label: "Search results ranking",
        confidence: "high",
        explanation: "Detected GitHub search results."
      }
    };
    if (knownBuckets[bucket]) {
      return { ...knownBuckets[bucket], bucket };
    }

    let scoreRecommended = 0;
    let scoreFollowing = 0;
    let scoreTrending = 0;
    let scoreSearch = 0;
    let scoreAds = 0;

    if (/[?&](q|query)=/.test(search) || /\/search/.test(path)) scoreSearch += 3;
    if (/for you|recommended|because you watched|discover/.test(text)) scoreRecommended += 2;
    if (/following|subscriptions|subscribed/.test(text)) scoreFollowing += 2;
    if (/trending|top|hot/.test(text)) scoreTrending += 2;
    if (/sponsored|promoted|ad choices|ads/.test(text)) scoreAds += 2;
    if (/(customers also bought|related products|frequently bought together|sponsored products)/.test(text)) {
      scoreRecommended += 3;
      scoreAds += 1;
    }
    if (/(best sellers|top picks|most popular)/.test(text)) scoreTrending += 2;

    if (document.querySelector("[aria-label*='For you' i], [data-testid*='for-you' i]")) scoreRecommended += 3;
    if (document.querySelector("[aria-label*='Following' i], [href*='subscriptions' i]")) scoreFollowing += 3;
    if (document.querySelector("[aria-label*='Trending' i], [href*='trending' i]")) scoreTrending += 3;
    if (document.querySelector("[aria-label*='Sponsored' i], [data-testid*='sponsored' i], [id*='ad' i], [class*='ad-' i]")) scoreAds += 2;
    if (document.querySelector("input[type='search'], [role='search']")) scoreSearch += 1;
    if (document.querySelector("[data-testid*='recommend' i], [class*='recommend' i], [aria-label*='Recommended' i]")) {
      scoreRecommended += 2;
    }

    const ranked = [
      { key: "search", score: scoreSearch, label: "Search results ranking", explanation: "Detected search route and query cues." },
      { key: "recommended", score: scoreRecommended, label: "Recommendation feed", explanation: "Detected recommendation/feed modules." },
      { key: "following", score: scoreFollowing, label: "Subscription/following feed", explanation: "Detected following/subscription cues." },
      { key: "trending", score: scoreTrending, label: "Trending/popularity", explanation: "Detected trending/top ranking cues." },
      { key: "ads", score: scoreAds, label: "Ads/auction-driven", explanation: "Detected sponsored/ad placement markers." }
    ].sort((a, b) => b.score - a.score);

    if (ranked[0].score >= 4) return { label: ranked[0].label, confidence: "high", explanation: ranked[0].explanation, bucket };
    if (ranked[0].score >= 2) return { label: ranked[0].label, confidence: "medium", explanation: ranked[0].explanation, bucket };

    if (siteType === "commerce") {
      return {
        label: "Recommendation feed",
        confidence: "medium",
        explanation: "Commerce page signals indicate merchandising and recommendation ranking.",
        bucket
      };
    }
    if (siteType === "search") {
      return {
        label: "Search results ranking",
        confidence: "medium",
        explanation: "Search-oriented site type detected.",
        bucket
      };
    }
    if (siteType === "news") {
      return {
        label: "Trending/popularity",
        confidence: "low",
        explanation: "Publisher layout suggests editorial popularity ranking.",
        bucket
      };
    }

    return { label: "Personalized home", confidence: "low", explanation: "No strong feed markers detected.", bucket };
  }

  function detectCurrentSiteContext(host) {
    const path = location.pathname.toLowerCase();
    const title = safeText(document.title, 110);

    if (/github\.com/.test(host)) {
      const match = location.pathname.match(/^\/([^/]+)\/([^/]+)/);
      if (match?.[1] && match?.[2]) {
        const scope = `${match[1]}/${match[2]}`;
        if (/\/issues/.test(path)) return `Context: issues triage in ${scope}.`;
        if (/\/pulls|\/pull\//.test(path)) return `Context: pull request workflow in ${scope}.`;
        if (/\/actions/.test(path)) return `Context: CI/CD runs in ${scope}.`;
        return `Context: repository workspace ${scope}.`;
      }
    }
    if (/youtube\.com/.test(host)) {
      if (/\/watch/.test(path)) return `Context: video detail page (${title || "watch"}).`;
      if (/\/feed\/subscriptions/.test(path)) return "Context: subscriptions feed.";
      if (/\/shorts/.test(path)) return "Context: shorts stream.";
    }
    if (/reddit\.com/.test(host)) {
      const subreddit = location.pathname.match(/\/r\/([^/]+)/)?.[1];
      if (subreddit) return `Context: subreddit r/${subreddit}.`;
    }
    if (/figma\.com/.test(host) && /\/file|\/design|\/proto/.test(path)) {
      return `Context: design file workspace (${title || "active file"}).`;
    }
    if (/docs\.google\.com|notion\.so/.test(host)) {
      return "Context: live documentation/editor view.";
    }
    return "";
  }

  function detectPurposeSummary(host, siteClassification) {
    if (siteClassification?.purpose) {
      const context = detectCurrentSiteContext(host);
      return context ? `${siteClassification.purpose} ${context}` : siteClassification.purpose;
    }

    const siteType = siteClassification?.type || "site";

    const desc =
      document.querySelector("meta[name='description']")?.getAttribute("content") ||
      document.querySelector("meta[property='og:description']")?.getAttribute("content") ||
      "";
    const heading = safeText(document.querySelector("h1, h2")?.textContent || "", 120);
    const entities = collectStructuredEntities(6);
    const websiteEntity = findStructuredEntity(entities, /(website|webpage|softwareapplication|service)/);
    const structuredName = safeText(websiteEntity?.name || "", 80);
    const siteName =
      safeText(
        document.querySelector("meta[property='og:site_name']")?.getAttribute("content") ||
          document.querySelector("meta[name='application-name']")?.getAttribute("content") ||
          structuredName ||
          host,
        64
      );

    const mainAction = (() => {
      if (document.querySelector("[href*='checkout'], [class*='checkout'], [data-testid*='buy']")) return "purchase or compare options";
      if (document.querySelector("input[type='search'], [role='search']")) return "search and navigate results";
      if (document.querySelector("video")) return "watch video content";
      if (document.querySelector("article")) return "read long-form content";
      if (document.querySelector("form input[type='password']")) return "sign in and continue workflow";
      return "navigate key sections";
    })();

    const snippet = safeText(desc || heading, 150);
    const context = detectCurrentSiteContext(host);
    if (snippet) {
      return `This site is primarily for ${siteType}. Main action: ${mainAction}. ${siteName}: ${snippet}${context ? ` ${context}` : ""}`;
    }
    return `This site is primarily for ${siteType}. Main action: ${mainAction}.${context ? ` ${context}` : ""}`;
  }

  function detectTrustSignals() {
    const hasPrivacy = Boolean(document.querySelector("a[href*='privacy']"));
    const hasTerms = Boolean(document.querySelector("a[href*='terms']"));
    const hasContact = Boolean(document.querySelector("a[href*='contact'], a[href*='about']"));
    const https = location.protocol === "https:";
    return { https, hasPrivacy, hasTerms, hasContact };
  }

  function detectNavHints() {
    return {
      hasMenu: Boolean(document.querySelector("nav, [role='navigation'], [aria-label*='menu' i]")),
      hasSearch: Boolean(document.querySelector("input[type='search'], [role='search'], form[action*='search']")),
      hasAuth: Boolean(document.querySelector("a[href*='login'], a[href*='signin'], button[aria-label*='log in' i]"))
    };
  }

  function detectAggressivePopup() {
    const fixedLarge = sampleNodes("div,section,aside", 120).filter((node) => {
      const style = window.getComputedStyle(node);
      if (style.position !== "fixed") return false;
      const rect = node.getBoundingClientRect();
      if (rect.width < 240 || rect.height < 120) return false;
      const visible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0.2;
      return visible;
    });
    return fixedLarge.length > 0;
  }

  function detectTechStack(host) {
    const scripts = [...document.querySelectorAll("script[src]")].map((node) => String(node.getAttribute("src") || ""));
    const html = document.documentElement?.outerHTML?.slice(0, 120000) || "";

    const stack = [];
    if (window.__NEXT_DATA__ || scripts.some((src) => /_next\//.test(src))) stack.push("Next.js");
    if (window.__NUXT__ || scripts.some((src) => /_nuxt\//.test(src))) stack.push("Nuxt");
    if (document.querySelector("[ng-version]")) stack.push("Angular");
    if (scripts.some((src) => /vue(\.runtime)?(\.global)?\.js|\/vue\//i.test(src))) stack.push("Vue");
    if (scripts.some((src) => /svelte|sveltekit/i.test(src))) stack.push("Svelte");
    if (/wp-content|wp-includes/.test(html) || /wordpress/i.test(host)) stack.push("WordPress");
    if (/cdn\.shopify|shopify/i.test(html + scripts.join(" "))) stack.push("Shopify");
    if (/webflow/i.test(html + scripts.join(" "))) stack.push("Webflow");
    if (/wixstatic|wix\.com/.test(html + scripts.join(" "))) stack.push("Wix");
    if (!stack.length && scripts.some((src) => /react/i.test(src))) stack.push("React (heuristic)");
    return stack.slice(0, 4);
  }

  function detectPerformanceSnapshot() {
    const nav = performance.getEntriesByType("navigation")[0];
    if (!nav) return null;
    const ttfb = Math.max(0, Math.round((nav.responseStart || 0) - (nav.requestStart || 0)));
    const dcl = Math.max(0, Math.round(nav.domContentLoadedEventEnd || 0));
    const load = Math.max(0, Math.round(nav.loadEventEnd || 0));
    const resources = performance.getEntriesByType("resource");
    return {
      ttfb,
      dcl,
      load,
      requests: resources.length
    };
  }

  function detectScriptFootprint(host) {
    const scripts = [...document.querySelectorAll("script[src]")].map((node) => String(node.src || ""));
    const thirdParty = scripts.filter((src) => {
      const scriptHost = normalizeHost(src);
      if (!scriptHost) return false;
      if (scriptHost === host) return false;
      if (scriptHost.endsWith(`.${host}`)) return false;
      return true;
    });
    return {
      totalScripts: scripts.length,
      thirdPartyScripts: thirdParty.length
    };
  }

  function detectSecurityHints() {
    const cspMeta = Boolean(document.querySelector("meta[http-equiv='Content-Security-Policy']"));
    const robotsMeta = Boolean(document.querySelector("meta[name='robots']"));
    return {
      cspMeta,
      robotsMeta
    };
  }

  function detectFontsAndColors() {
    const nodes = sampleNodes("h1,h2,h3,p,a,button,input,label,main,section", 40);
    const fontFreq = new Map();
    const colorFreq = new Map();

    nodes.forEach((node) => {
      const style = window.getComputedStyle(node);
      const family = safeText(style.fontFamily || "", 64);
      if (family) fontFreq.set(family, (fontFreq.get(family) || 0) + 1);
      const bg = safeText(style.backgroundColor || "", 48);
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        colorFreq.set(bg, (colorFreq.get(bg) || 0) + 1);
      }
    });

    const topFonts = [...fontFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);
    const topColors = [...colorFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return { topFonts, topColors };
  }

  function detectLayoutHints() {
    const sample = sampleNodes("div,section,article,main,aside", 60);
    let gridCount = 0;
    let flexCount = 0;
    sample.forEach((node) => {
      const style = window.getComputedStyle(node);
      if (style.display.includes("grid")) gridCount += 1;
      if (style.display.includes("flex")) flexCount += 1;
    });
    const transitionNodes = sampleNodes("*", 120).filter((node) => {
      const style = window.getComputedStyle(node);
      const t = String(style.transitionDuration || "0s");
      const a = String(style.animationDuration || "0s");
      return !/^0s(,\s*0s)*$/.test(t) || !/^0s(,\s*0s)*$/.test(a);
    }).length;
    return { gridCount, flexCount, transitionNodes };
  }

  function detectAnalyticsTags() {
    const html = document.documentElement?.outerHTML?.slice(0, 200000).toLowerCase() || "";
    const scripts = [...document.querySelectorAll("script[src]")].map((n) => String(n.src || "").toLowerCase()).join(" ");
    const blob = `${html} ${scripts}`;
    const checks = [
      ["Google Analytics / gtag", /googletagmanager|gtag\(/],
      ["Segment", /segment\.com|analytics\.js/],
      ["Hotjar", /hotjar/],
      ["FullStory", /fullstory/],
      ["Microsoft Clarity", /clarity\.ms|microsoft clarity/],
      ["Optimizely", /optimizely/],
      ["VWO", /\bvwo\b|visual website optimizer/]
    ];
    return checks.filter(([, pattern]) => pattern.test(blob)).map(([name]) => name);
  }

  function detectTextRepetitionSignals() {
    const text = safeText(document.body?.innerText || "", 28000).toLowerCase();
    const sentences = text
      .split(/[.!?]\s+/)
      .map((line) => line.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 34)
      .slice(0, 80);
    if (sentences.length < 8) return { duplicateCount: 0, ratio: 0 };

    const seen = new Set();
    let duplicateCount = 0;
    for (const sentence of sentences) {
      const key = sentence.split(" ").slice(0, 12).join(" ");
      if (!key) continue;
      if (seen.has(key)) duplicateCount += 1;
      else seen.add(key);
    }
    const ratio = duplicateCount / Math.max(1, sentences.length);
    return { duplicateCount, ratio };
  }

  function detectAiBotAuthorship(host) {
    const text = buildPageTextSample();
    const entities = collectStructuredEntities(8);
    const personEntity = findStructuredEntity(entities, /person/);
    const generatorMeta = safeText(
      document.querySelector("meta[name='generator']")?.getAttribute("content") ||
        document.querySelector("meta[name='application-name']")?.getAttribute("content") ||
        "",
      180
    ).toLowerCase();
    const authorSample = safeText(
      document.querySelector("[rel='author'], [itemprop='author'], [class*='author'], [data-testid*='author']")?.textContent || "",
      180
    ).toLowerCase();
    const htmlSample = safeText(document.documentElement?.innerText || "", 7000).toLowerCase();
    const repetition = detectTextRepetitionSignals();

    let score = 0;
    const reasons = [];
    const bump = (points, reason) => {
      score += Number(points || 0);
      if (reason) reasons.push(reason);
    };

    if (
      /(generated by ai|ai-generated|written with (chatgpt|claude|gemini|copilot)|synthetic media|automatically generated|this content was generated)/.test(
        text + " " + htmlSample
      )
    ) {
      bump(6, "explicit AI generation disclosure");
    }

    if (/(chatgpt|openai|claude|anthropic|gemini|copilot|midjourney|stability ai)/.test(generatorMeta)) {
      bump(4, "generator metadata references AI tooling");
    }

    if (/\b(bot|automation|autopost|autogenerated|ai assistant)\b/.test(authorSample)) {
      bump(4, "author/byline contains bot or automation marker");
    }

    if (/\b(paraphrased by ai|drafted by ai|llm)\b/.test(text)) {
      bump(3, "content contains AI drafting markers");
    }

    if (/(ai summary|auto-generated summary|generated summary)/.test(text + " " + htmlSample)) {
      bump(2, "summary labels indicate auto-generation");
    }

    if (/(reddit\.com|x\.com|twitter\.com|youtube\.com)/.test(host) && /\b(bot|automated|autopost)\b/.test(text)) {
      bump(2, "platform content includes bot/autopost markers");
    }

    if (repetition.ratio >= 0.22) {
      bump(2, "high repeated sentence pattern");
    }

    if (personEntity?.name && !/\b(bot|automation|autopost)\b/.test(authorSample)) {
      score = Math.max(0, score - 2);
      reasons.push("named human author entity detected");
    }

    if (score >= 7) {
      return {
        label: "Likely AI/Bot-authored",
        confidence: score >= 10 ? "high" : "medium",
        score,
        reasons: reasons.slice(0, 4)
      };
    }
    if (score >= 3) {
      return {
        label: "Possible AI-assisted or automated",
        confidence: score >= 5 ? "medium" : "low",
        score,
        reasons: reasons.slice(0, 4)
      };
    }

    if (score > 0) {
      return {
        label: "Low AI/Bot signal",
        confidence: "low",
        score,
        reasons: reasons.slice(0, 4)
      };
    }

    return {
      label: "No AI/Bot evidence in page signals",
      confidence: "medium",
      score,
      reasons: reasons.slice(0, 4)
    };
  }

  function detectScamTrapRisk(host) {
    const text = buildPageTextSample();
    const hostName = String(host || "").toLowerCase();
    const path = String(location.pathname || "").toLowerCase();
    const search = String(location.search || "").toLowerCase();
    const trust = detectTrustSignals();

    let score = 0;
    const reasons = [];
    const bump = (points, reason) => {
      score += Number(points || 0);
      if (reason) reasons.push(reason);
    };

    if (/xn--/.test(hostName)) bump(4, "punycode domain marker");
    if (/\d{3,}/.test(hostName) || (hostName.match(/-/g) || []).length >= 3) bump(2, "domain entropy pattern");
    if (/\.(top|xyz|click|work|zip|mov)$/.test(hostName)) bump(2, "high-risk TLD pattern");

    if (
      /(urgent|act now|limited time|final warning|account suspended|verify immediately|confirm your account|security alert|claim now|you won)/.test(
        text
      )
    ) {
      bump(4, "urgency/manipulation copy");
    }

    if (
      /(seed phrase|private key|wallet connect|crypto giveaway|gift card|wire transfer|bank transfer|send usdt|recovery phrase)/.test(
        text + " " + search + " " + path
      )
    ) {
      bump(5, "high-risk payment/credential request language");
    }

    const passwordField = Boolean(document.querySelector("input[type='password']"));
    const paymentField = Boolean(document.querySelector("input[name*='card' i], input[autocomplete='cc-number'], [data-testid*='payment' i]"));
    if (passwordField && /verify|suspend|security alert|urgent/.test(text)) {
      bump(3, "credentials requested with urgency cues");
    }
    if (paymentField && /gift card|wire|crypto|instant transfer/.test(text)) {
      bump(4, "payment form paired with risky transfer language");
    }

    const links = sampleNodes("a[href]", 180).map((node) => String(node.getAttribute("href") || node.href || ""));
    let suspiciousLinks = 0;
    links.forEach((href) => {
      const normalized = String(href || "").toLowerCase();
      if (!normalized) return;
      if (/bit\.ly|tinyurl\.com|goo\.gl|t\.co\/|rb\.gy/.test(normalized)) suspiciousLinks += 1;
      if (/xn--/.test(normalized)) suspiciousLinks += 2;
      if (/https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(normalized)) suspiciousLinks += 2;
    });
    if (suspiciousLinks >= 4) {
      bump(3, "multiple suspicious outbound links");
    }

    if (detectAggressivePopup()) {
      bump(1, "aggressive modal detected early");
    }

    const knownMajorDomain = /(^|\.)(google|youtube|github|figma|amazon|wikipedia|reddit|linkedin|microsoft|apple|netflix|bbc|nytimes|cnn|theguardian|notion|x|twitter)\./.test(
      hostName
    );
    if (knownMajorDomain) {
      score = Math.max(0, score - 3);
      reasons.push("known major domain baseline");
    }
    if (trust.https) {
      score = Math.max(0, score - 1);
    }
    if (trust.hasPrivacy && trust.hasTerms && trust.hasContact) {
      score = Math.max(0, score - 2);
      reasons.push("baseline trust/legal links detected");
    }

    if (score >= 8) {
      return {
        label: "High scam/trap risk",
        confidence: score >= 11 ? "high" : "medium",
        score,
        reasons: reasons.slice(0, 4)
      };
    }
    if (score >= 4) {
      return {
        label: "Caution: scam/trap cues",
        confidence: "medium",
        score,
        reasons: reasons.slice(0, 4)
      };
    }
    return {
      label: "Low scam/trap signal",
      confidence: score === 0 ? "medium" : "low",
      score,
      reasons: reasons.slice(0, 4)
    };
  }

  function detectIntegritySignals(host) {
    return {
      aiAuthorship: detectAiBotAuthorship(host),
      scamRisk: detectScamTrapRisk(host)
    };
  }

  function detectFrictionAndA11y() {
    const popups = detectAggressivePopup() ? 1 : 0;
    const cookieBanner = Boolean(document.querySelector("[id*='cookie' i], [class*='cookie' i], [aria-label*='cookie' i]"));
    const primaryForm = document.querySelector("main form, form[action*='checkout'], form[action*='signup'], form[action*='login']") || document.querySelector("form");
    const formInputs = primaryForm ? primaryForm.querySelectorAll("input, select, textarea").length : 0;

    const images = sampleNodes("img", 120);
    const missingAlt = images.filter((img) => !img.hasAttribute("alt") || !safeText(img.getAttribute("alt"), 10)).length;

    const controls = sampleNodes("input,button,select,textarea", 120);
    const missingLabel = controls.filter((el) => {
      const id = el.id;
      if (id && document.querySelector(`label[for="${escapeSelectorValue(id)}"]`)) return false;
      if (el.closest("label")) return false;
      if (el.getAttribute("aria-label")) return false;
      return true;
    }).length;

    return {
      popups,
      cookieBanner,
      formInputs,
      missingAlt,
      missingLabel
    };
  }

  function guessSsrCsr() {
    const htmlLength = (document.documentElement?.innerHTML || "").length;
    const textLength = safeText(document.body?.innerText || "", 120000).length;
    const scriptCount = document.scripts.length;
    if (textLength > 1200 && htmlLength > 40000) return "SSR/Hybrid likely";
    if (scriptCount > 18 && textLength < 700) return "CSR-heavy likely";
    return "Hybrid likely";
  }

  function buildProfileBullets(summary) {
    const owner = summary.owner || {
      ownerName: "Unknown",
      country: "Unknown",
      netWorth: "Unknown",
      created: "Unknown",
      totalUsers: "Unknown",
      onlineNow: "Unknown",
      source: "Unknown"
    };

    const integrity = summary.integrity || {};
    const aiAuthorship = integrity.aiAuthorship || {};
    const scamRisk = integrity.scamRisk || {};

    const regular = [];
    regular.push(`Identity: ${summary.siteIdentity || summary.host} · Type: ${summary.siteType} (${summary.siteTypeConfidence})`);
    regular.push(`AI/Bot authorship: ${aiAuthorship.label || "No AI/Bot evidence in local signals"} (${aiAuthorship.confidence || "low"})`);
    regular.push(`Scam/Trap risk: ${scamRisk.label || "Low signal"} (${scamRisk.confidence || "low"})`);
    if (aiAuthorship.reasons?.length) regular.push(`AI/Bot cues: ${aiAuthorship.reasons.join("; ")}`);
    if (scamRisk.reasons?.length) regular.push(`Risk cues: ${scamRisk.reasons.join("; ")}`);
    regular.push(summary.purposeSummary);
    regular.push(`CEO/Owner: ${owner.ownerName} · Country: ${owner.country}`);
    regular.push(`Net worth: ${owner.netWorth} · Created: ${owner.created}`);
    regular.push(`Users: ${owner.totalUsers} · Online now: ${owner.onlineNow}`);
    regular.push(`Main value: ${summary.metaSnippet || "Clear user action and navigation flow."}`);
    regular.push(
      `Trust signals: HTTPS ${summary.trustSignals.https ? "yes" : "no"} · Privacy ${
        summary.trustSignals.hasPrivacy ? "link found" : "not found"
      } · Contact/About ${summary.trustSignals.hasContact ? "visible" : "not obvious"}`
    );
    regular.push(
      `Navigation hints: menu ${summary.navHints.hasMenu ? "found" : "not obvious"} · search ${
        summary.navHints.hasSearch ? "found" : "not obvious"
      } · login ${summary.navHints.hasAuth ? "found" : "not obvious"}`
    );
    if (summary.aggressivePopup) {
      regular.push("Warning: large modal/overlay detected early in session.");
    }
    if (summary.classificationReasons?.length) {
      regular.push(`Classification cues: ${summary.classificationReasons.join("; ")}`);
    }

    const dev = [];
    dev.push(`Identity: ${summary.siteIdentity || summary.host} · ${summary.siteType} (${summary.siteTypeConfidence})`);
    dev.push(`AI/Bot authorship: ${aiAuthorship.label || "No AI/Bot evidence in local signals"} (${aiAuthorship.confidence || "low"})`);
    dev.push(`Scam/Trap risk: ${scamRisk.label || "Low signal"} (${scamRisk.confidence || "low"})`);
    dev.push(`Ownership: ${owner.ownerName} · Created ${owner.created}`);
    dev.push(`Audience scale: ${owner.totalUsers} · Online now ${owner.onlineNow}`);
    dev.push(`Stack hints: ${summary.stack.length ? summary.stack.join(", ") : "No strong framework signature detected"}`);
    if (summary.performance) {
      dev.push(
        `Performance snapshot: TTFB ${summary.performance.ttfb}ms · DCL ${summary.performance.dcl}ms · Load ${summary.performance.load}ms · Requests ${summary.performance.requests}`
      );
    }
    dev.push(
      `Script footprint: ${summary.scriptFootprint.thirdPartyScripts} third-party of ${summary.scriptFootprint.totalScripts} scripts`
    );
    dev.push(`Security hints: CSP meta ${summary.security.cspMeta ? "present" : "not in DOM"} · robots meta ${summary.security.robotsMeta ? "present" : "not in DOM"}`);
    dev.push(`Rendering model guess: ${summary.renderModel}`);
    dev.push(`Quick links: ${location.origin}/robots.txt · ${location.origin}/sitemap.xml`);
    dev.push(
      `Feed model: ${summary.algorithm.label} (${summary.algorithm.confidence}) — ${summary.algorithm.explanation}`
    );

    const design = [];
    design.push(`Brand operator: ${owner.ownerName} (${owner.country})`);
    design.push(`AI/Bot authorship: ${aiAuthorship.label || "No AI/Bot evidence in local signals"} (${aiAuthorship.confidence || "low"})`);
    design.push(`Scam/Trap risk: ${scamRisk.label || "Low signal"} (${scamRisk.confidence || "low"})`);
    design.push(`Scale signal: ${owner.totalUsers} · Live now ${owner.onlineNow}`);
    design.push(`Fonts sampled: ${summary.design.topFonts.length ? summary.design.topFonts.join(" | ") : "No stable font sample yet"}`);
    design.push(`Palette sample: ${summary.design.topColors.length ? summary.design.topColors.join(" · ") : "No dominant colors sampled"}`);
    design.push(`Layout pattern: grid ${summary.layout.gridCount} · flex ${summary.layout.flexCount}`);
    design.push(`Motion signals: ${summary.layout.transitionNodes} elements with transitions/animations`);
    design.push(
      `Whitespace density: ${summary.layout.flexCount + summary.layout.gridCount > 18 ? "structured/dense" : "open/simple"}`
    );
    design.push(
      `A11y quick checks: missing alt ${summary.friction.missingAlt} · unlabeled controls ${summary.friction.missingLabel}`
    );

    const uxr = [];
    uxr.push(`Site owner context: ${owner.ownerName} · Net worth ${owner.netWorth}`);
    uxr.push(`AI/Bot authorship: ${aiAuthorship.label || "No AI/Bot evidence in local signals"} (${aiAuthorship.confidence || "low"})`);
    uxr.push(`Scam/Trap risk: ${scamRisk.label || "Low signal"} (${scamRisk.confidence || "low"})`);
    uxr.push(`Scale context: users ${owner.totalUsers} · online now ${owner.onlineNow}`);
    uxr.push(`Analytics tags: ${summary.analytics.length ? summary.analytics.join(", ") : "No common analytics tags detected"}`);
    uxr.push(`Friction cues: popups ${summary.friction.popups} · cookie banner ${summary.friction.cookieBanner ? "present" : "not detected"}`);
    uxr.push(`Form complexity: ${summary.friction.formInputs} controls in primary form`);
    uxr.push(`CTA density (above fold): ${summary.ctaCount}`);
    uxr.push(`Accessibility sample: missing alt ${summary.friction.missingAlt} · unlabeled controls ${summary.friction.missingLabel}`);
    uxr.push("Suggested question: What is the primary user goal on this page?");
    uxr.push("Suggested question: Is the CTA clear above the fold?");
    uxr.push("Suggested question: Is there friction before user value appears?");

    return { regular, dev, design, uxr };
  }

  function computeSiteInsightSummary(host) {
    const siteClassification = detectSiteType(host);
    const siteType = siteClassification.type;
    const algorithm = detectAlgorithmContext(host, siteType);
    const integrity = detectIntegritySignals(host);
    const purposeSummary = detectPurposeSummary(host, siteClassification);
    const owner = detectOwnershipSnapshot(host, siteClassification.identity || host);
    const trustSignals = detectTrustSignals();
    const navHints = detectNavHints();
    const aggressivePopup = detectAggressivePopup();
    const stack = detectTechStack(host);
    const performance = detectPerformanceSnapshot();
    const scriptFootprint = detectScriptFootprint(host);
    const security = detectSecurityHints();
    const design = detectFontsAndColors();
    const layout = detectLayoutHints();
    const analytics = detectAnalyticsTags();
    const friction = detectFrictionAndA11y();
    const renderModel = guessSsrCsr();
    const ctaCount = sampleNodes("button, a[role='button'], input[type='submit']", 80).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top <= Math.max(window.innerHeight, 1);
    }).length;

    const metaSnippet = safeText(
      document.querySelector("meta[name='description']")?.getAttribute("content") ||
        document.querySelector("meta[property='og:description']")?.getAttribute("content") ||
        document.querySelector("h1,h2")?.textContent ||
        "",
      120
    );

    const summary = {
      modelVersion: SITE_INSIGHT_MODEL_VERSION,
      computedAt: Date.now(),
      host,
      url: location.href,
      bucket: feedBucket(host, location.pathname, location.search),
      siteType,
      siteTypeConfidence: siteClassification.confidence || "low",
      siteIdentity: siteClassification.identity || host,
      classificationReasons: siteClassification.reasons || [],
      algorithm,
      integrity,
      owner,
      purposeSummary,
      metaSnippet,
      trustSignals,
      navHints,
      aggressivePopup,
      stack,
      performance,
      scriptFootprint,
      security,
      design,
      layout,
      analytics,
      friction,
      renderModel,
      ctaCount
    };

    summary.profiles = buildProfileBullets(summary);
    return summary;
  }

  function shouldUseCachedSummary(host, cachedSummary) {
    if (!cachedSummary || typeof cachedSummary !== "object") return false;
    if (Number(cachedSummary.modelVersion || 0) !== SITE_INSIGHT_MODEL_VERSION) return false;
    if (normalizeHost(cachedSummary.host || "") !== host) return false;
    if (!isDynamicFeedHost(host)) return true;
    const currentBucket = feedBucket(host, location.pathname, location.search);
    const cachedBucket = String(cachedSummary.algorithm?.bucket || cachedSummary.bucket || "");
    return Boolean(currentBucket && cachedBucket && currentBucket === cachedBucket);
  }

  function ensureInsightUi() {
    if (state.siteInsight.hostNode?.isConnected && state.siteInsight.shadow) return state.siteInsight;

    let host = document.getElementById(IDS.INSIGHT_HOST);
    if (!host) {
      host = document.createElement("div");
      host.id = IDS.INSIGHT_HOST;
      host.style.position = "fixed";
      host.style.right = "12px";
      host.style.bottom = "12px";
      host.style.zIndex = "2147483645";
      host.style.pointerEvents = "auto";
      host.style.maxWidth = "min(392px, calc(100vw - 24px))";
      host.style.minWidth = "280px";
      host.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif";
      document.documentElement.appendChild(host);
    }

    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          --hm-bg: #14110f;
          --hm-panel: #34312d;
          --hm-text: #f3f3f4;
          --hm-muted: #d9c5b2;
          --hm-red: #c42021;
          --hm-amber: #ffb300;
          --hm-border: rgba(243, 243, 244, 0.2);
          --hm-radius: 2px;
          --hm-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Arial, sans-serif;
        }

        .hm-wrap {
          all: initial;
          display: grid;
          gap: 8px;
          width: min(392px, calc(100vw - 24px));
          max-height: min(60vh, 520px);
          font-family: var(--hm-font);
        }

        .hm-panel {
          box-sizing: border-box;
          border: 1px solid var(--hm-border);
          border-radius: var(--hm-radius);
          background: linear-gradient(180deg, rgba(20, 17, 15, 0.97) 0%, rgba(52, 49, 45, 0.95) 100%);
          color: var(--hm-text);
          padding: 12px;
          display: grid;
          gap: 10px;
          box-shadow: 0 8px 24px rgba(20, 17, 15, 0.45);
          overflow: auto;
          max-height: min(60vh, 520px);
        }

        .hm-panel.minimized {
          display: none;
        }

        .hm-pill {
          border: 1px solid rgba(255, 179, 0, 0.9);
          border-radius: var(--hm-radius);
          background: rgba(20, 17, 15, 0.96);
          color: var(--hm-text);
          position: fixed;
          right: 12px;
          bottom: 12px;
          z-index: 2147483646;
          width: 34px;
          min-width: 34px;
          max-width: 34px;
          min-height: 34px;
          max-height: 34px;
          padding: 0;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(255, 179, 0, 0.24);
        }

        .hm-pill.show {
          display: inline-flex;
        }

        .hm-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .hm-header {
          justify-content: space-between;
          gap: 10px;
        }

        .hm-host {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .hm-host strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hm-controls button,
        .hm-controls select {
          border: 1px solid var(--hm-border);
          border-radius: var(--hm-radius);
          background: rgba(20, 17, 15, 0.9);
          color: var(--hm-text);
          min-height: 30px;
          font-size: 11px;
          padding: 0 8px;
          font-family: var(--hm-font);
        }

        .hm-controls button {
          min-width: 30px;
          cursor: pointer;
        }

        .hm-controls select {
          letter-spacing: 0.05em;
        }

        .hm-btn-red {
          border-color: rgba(196, 32, 33, 0.95) !important;
          background: rgba(196, 32, 33, 0.2) !important;
          box-shadow: 0 0 10px rgba(196, 32, 33, 0.22);
        }

        .hm-btn-amber {
          border-color: rgba(255, 179, 0, 0.92) !important;
          background: rgba(255, 179, 0, 0.14) !important;
          box-shadow: 0 0 10px rgba(255, 179, 0, 0.2);
        }

        .hm-controls button:hover,
        .hm-controls button:focus-visible,
        .hm-foot button:hover,
        .hm-foot button:focus-visible,
        .hm-pill:hover,
        .hm-pill:focus-visible {
          outline: none;
          filter: brightness(1.08);
          box-shadow: 0 0 12px rgba(255, 179, 0, 0.3);
        }

        .hm-controls {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .hm-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 11px;
          color: var(--hm-muted);
        }

        .hm-chip {
          border: 1px solid var(--hm-border);
          border-radius: var(--hm-radius);
          padding: 2px 7px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 10px;
          background: rgba(20, 17, 15, 0.72);
        }

        .hm-summary {
          margin: 0;
          color: var(--hm-text);
          font-size: 12px;
          line-height: 1.45;
        }

        .hm-integrity {
          border: 1px solid rgba(243, 243, 244, 0.18);
          border-radius: var(--hm-radius);
          background: rgba(20, 17, 15, 0.62);
          padding: 8px;
          display: grid;
          gap: 6px;
        }

        .hm-integrity-row {
          display: grid;
          grid-template-columns: 112px 1fr;
          gap: 8px;
          align-items: center;
        }

        .hm-integrity-row span {
          color: var(--hm-muted);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .hm-integrity-row strong {
          color: var(--hm-text);
          font-size: 11px;
          font-weight: 700;
          line-height: 1.35;
          word-break: break-word;
        }

        .hm-integrity-note {
          margin: 0;
          color: var(--hm-muted);
          font-size: 10px;
          line-height: 1.35;
        }

        .hm-owner {
          border: 1px solid rgba(243, 243, 244, 0.18);
          border-radius: var(--hm-radius);
          background: rgba(20, 17, 15, 0.62);
          padding: 8px;
          display: grid;
          gap: 5px;
        }

        .hm-owner-row {
          display: grid;
          grid-template-columns: 112px 1fr;
          gap: 8px;
          align-items: center;
        }

        .hm-owner-row span {
          color: var(--hm-muted);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .hm-owner-row strong {
          color: var(--hm-text);
          font-size: 11px;
          font-weight: 600;
          line-height: 1.35;
          word-break: break-word;
        }

        .hm-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }

        .hm-list li {
          border: 1px solid rgba(243, 243, 244, 0.18);
          border-radius: var(--hm-radius);
          background: rgba(20, 17, 15, 0.58);
          padding: 8px;
          font-size: 11px;
          line-height: 1.4;
          color: var(--hm-muted);
        }

        .hm-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .hm-foot button {
          border: 1px solid rgba(255, 179, 0, 0.92);
          border-radius: var(--hm-radius);
          background: rgba(255, 179, 0, 0.12);
          color: var(--hm-text);
          min-height: 30px;
          font-size: 11px;
          padding: 0 10px;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(255, 179, 0, 0.2);
        }

        .hm-foot small {
          color: var(--hm-muted);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        @media (prefers-reduced-motion: no-preference) {
          .hm-panel {
            transition: opacity 180ms ease, transform 180ms ease;
          }
          .hm-panel.minimized {
            opacity: 0;
            transform: translateY(4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hm-panel {
            transition: none;
          }
        }
      </style>
      <div class="hm-wrap" role="dialog" aria-label="Holmeta Site Insight">
        <section class="hm-panel" id="hmInsightPanel">
          <div class="hm-row hm-header">
            <div class="hm-host">
              <img id="hmInsightFavicon" width="16" height="16" alt="" />
              <strong id="hmInsightHost">site</strong>
            </div>
            <div class="hm-controls">
              <select id="hmInsightProfile" aria-label="Insight profile">
                <option value="regular">Regular</option>
                <option value="dev">Dev</option>
                <option value="design">Design</option>
                <option value="uxr">UXR</option>
              </select>
              <button id="hmInsightClose" class="hm-btn-red" title="Close" aria-label="Close">X</button>
            </div>
          </div>
          <div class="hm-meta">
            <span class="hm-chip" id="hmInsightType">site</span>
            <span class="hm-chip" id="hmInsightAlgo">algorithm</span>
            <span class="hm-chip" id="hmInsightConfidence">confidence</span>
          </div>
          <p class="hm-summary" id="hmInsightSummary"></p>
          <div class="hm-integrity" id="hmInsightIntegrity">
            <div class="hm-integrity-row"><span>AI/Bot</span><strong id="hmIntegrityAi">Loading…</strong></div>
            <div class="hm-integrity-row"><span>Scam Risk</span><strong id="hmIntegrityScam">Loading…</strong></div>
            <p class="hm-integrity-note" id="hmInsightIntegrityNote">Cues: collecting local signals</p>
          </div>
          <div class="hm-owner" id="hmInsightOwner">
            <div class="hm-owner-row"><span>CEO / Owner</span><strong id="hmOwnerName">Loading…</strong></div>
            <div class="hm-owner-row"><span>Country</span><strong id="hmOwnerCountry">Loading…</strong></div>
            <div class="hm-owner-row"><span>Net Worth</span><strong id="hmOwnerNetWorth">Loading…</strong></div>
            <div class="hm-owner-row"><span>Created</span><strong id="hmOwnerCreated">Loading…</strong></div>
            <div class="hm-owner-row"><span>Total Users</span><strong id="hmOwnerUsers">Loading…</strong></div>
            <div class="hm-owner-row"><span>Online Now</span><strong id="hmOwnerOnline">Loading…</strong></div>
          </div>
          <ul class="hm-list" id="hmInsightBullets"></ul>
          <div class="hm-foot">
            <small id="hmInsightStatus">Holmeta Insight</small>
            <button id="hmInsightDisableSite">Disable on this site</button>
          </div>
        </section>
        <button class="hm-pill" id="hmInsightPill" title="Open Holmeta Insight" aria-label="Open Holmeta Insight">H</button>
      </div>
    `;

    const panel = shadow.getElementById("hmInsightPanel");
    const pill = shadow.getElementById("hmInsightPill");
    const profile = shadow.getElementById("hmInsightProfile");
    const closeBtn = shadow.getElementById("hmInsightClose");
    const disableBtn = shadow.getElementById("hmInsightDisableSite");

    closeBtn?.addEventListener("click", () => {
      minimizeInsight(true);
    });

    pill?.addEventListener("click", () => {
      restoreInsight();
    });

    disableBtn?.addEventListener("click", async () => {
      const hostName = currentHost();
      if (!hostName) return;
      const response = await sendRuntimeMessage({ type: "holmeta:disable-site-insight-host", host: hostName });
      if (!response?.ok) {
        log("error", "site_insight_disable_failed", response);
        return;
      }
      minimizeInsight(false);
    });

    profile?.addEventListener("change", async () => {
      const selectedProfile = String(profile.value || "regular");
      const response = await sendRuntimeMessage({
        type: "holmeta:update-settings",
        patch: { siteInsight: { selectedProfile } }
      });
      if (response?.ok) {
        state.settings = response.state.settings;
        if (state.siteInsight.summaryData) {
          renderInsightPanel(state.siteInsight.summaryData, state.settings.siteInsight);
        }
      }
    });

    state.siteInsight.hostNode = host;
    state.siteInsight.shadow = shadow;
    return state.siteInsight;
  }

  function minimizeInsight(showPill) {
    const shadow = state.siteInsight.shadow;
    if (!shadow) return;
    const panel = shadow.getElementById("hmInsightPanel");
    const pill = shadow.getElementById("hmInsightPill");
    if (!panel || !pill) return;
    panel.classList.add("minimized");
    state.siteInsight.minimized = true;
    const canShowPill = Boolean(showPill && state.siteInsight.config?.minimizedPill);
    pill.classList.toggle("show", canShowPill);
  }

  function restoreInsight() {
    const shadow = state.siteInsight.shadow;
    if (!shadow) return;
    const panel = shadow.getElementById("hmInsightPanel");
    const pill = shadow.getElementById("hmInsightPill");
    if (!panel || !pill) return;
    panel.classList.remove("minimized");
    pill.classList.remove("show");
    state.siteInsight.minimized = false;
    scheduleInsightAutoMinimize();
  }

  function scheduleInsightAutoMinimize() {
    const cfg = state.siteInsight.config || {};
    if (state.siteInsight.autoMinimizeTimer) {
      clearTimeout(state.siteInsight.autoMinimizeTimer);
      state.siteInsight.autoMinimizeTimer = null;
    }
    if (!cfg.autoMinimize) return;
    const duration = Math.max(6000, Math.min(10000, Number(cfg.durationMs || 8000)));
    state.siteInsight.autoMinimizeTimer = setTimeout(() => {
      minimizeInsight(true);
      state.siteInsight.autoMinimizeTimer = null;
    }, duration);
  }

  function profileLabel(profile) {
    if (profile === "dev") return "Developers";
    if (profile === "design") return "Designers";
    if (profile === "uxr") return "UX Research / CRO";
    return "Regular / Visitor";
  }

  function resolveProfile(settings) {
    const profiles = settings?.enabledProfiles || {};
    const selected = String(settings?.selectedProfile || "regular");
    if (profiles[selected]) return selected;
    return ["regular", "dev", "design", "uxr"].find((key) => profiles[key]) || "regular";
  }

  function renderInsightPanel(summaryData, settings, viewOptions = {}) {
    ensureInsightUi();
    const shadow = state.siteInsight.shadow;
    if (!shadow) return;

    const selected = resolveProfile(settings);
    const host = summaryData.host || currentHost();
    const algo = summaryData.algorithm || { label: "Unknown", confidence: "low", explanation: "" };
    const owner = summaryData.owner || {};
    const integrity = summaryData.integrity || {};
    const aiAuthorship = integrity.aiAuthorship || {};
    const scamRisk = integrity.scamRisk || {};
    const bullets = (summaryData.profiles?.[selected] || []).slice(0, selected === "regular" ? 6 : 10);

    shadow.getElementById("hmInsightHost").textContent = host;
    const fav = shadow.getElementById("hmInsightFavicon");
    fav.src = `${location.origin}/favicon.ico`;
    fav.onerror = () => {
      fav.style.display = "none";
    };

    const profileSelect = shadow.getElementById("hmInsightProfile");
    profileSelect.value = selected;
    [...profileSelect.options].forEach((opt) => {
      const key = String(opt.value || "");
      opt.disabled = !Boolean(settings?.enabledProfiles?.[key]);
    });

    shadow.getElementById("hmInsightType").textContent = `${String(summaryData.siteType || "site")} (${String(summaryData.siteTypeConfidence || "low")})`;
    shadow.getElementById("hmInsightAlgo").textContent = settings?.showAlgorithmLabel
      ? safeText(algo.label, 32)
      : "algorithm hidden";
    shadow.getElementById("hmInsightConfidence").textContent = safeText(algo.confidence || "low", 12);
    shadow.getElementById("hmInsightSummary").textContent = settings?.showPurposeSummary
      ? safeText(summaryData.purposeSummary || "", 220)
      : `Profile: ${profileLabel(selected)}`;
    shadow.getElementById("hmIntegrityAi").textContent = safeText(
      `${aiAuthorship.label || "No AI/Bot evidence in local signals"} · ${aiAuthorship.confidence || "low"}`,
      90
    );
    shadow.getElementById("hmIntegrityScam").textContent = safeText(
      `${scamRisk.label || "Low scam/trap signal"} · ${scamRisk.confidence || "low"}`,
      90
    );
    const integrityCues = [
      ...(aiAuthorship.reasons || []).slice(0, 1),
      ...(scamRisk.reasons || []).slice(0, 2)
    ];
    shadow.getElementById("hmInsightIntegrityNote").textContent = integrityCues.length
      ? safeText(`Cues: ${integrityCues.join(" · ")}`, 190)
      : "Cues: no strong risk markers detected";
    shadow.getElementById("hmOwnerName").textContent = safeText(owner.ownerName || "Not disclosed on page", 110);
    shadow.getElementById("hmOwnerCountry").textContent = safeText(owner.country || "Not disclosed on page", 90);
    shadow.getElementById("hmOwnerNetWorth").textContent = safeText(owner.netWorth || "Not disclosed publicly", 90);
    shadow.getElementById("hmOwnerCreated").textContent = safeText(owner.created || "Not found in local signals", 80);
    shadow.getElementById("hmOwnerUsers").textContent = safeText(owner.totalUsers || "No public count detected", 100);
    shadow.getElementById("hmOwnerOnline").textContent = safeText(owner.onlineNow || "No live counter detected", 100);
    shadow.getElementById("hmInsightStatus").textContent =
      `${summaryData.siteIdentity || host} · ${profileLabel(selected)} · ${safeText(owner.source || "Local snapshot", 32)}`;

    const list = shadow.getElementById("hmInsightBullets");
    list.innerHTML = bullets.map((line) => `<li>${safeText(line, 220)}</li>`).join("");

    const disableBtn = shadow.getElementById("hmInsightDisableSite");
    disableBtn.textContent = `Disable on ${host}`;

    const panel = shadow.getElementById("hmInsightPanel");
    const pill = shadow.getElementById("hmInsightPill");
    if (state.siteInsight.autoMinimizeTimer) {
      clearTimeout(state.siteInsight.autoMinimizeTimer);
      state.siteInsight.autoMinimizeTimer = null;
    }
    const openMinimized = Boolean(viewOptions.startMinimized);
    if (openMinimized) {
      panel.classList.add("minimized");
      pill.classList.add("show");
      state.siteInsight.minimized = true;
    } else {
      panel.classList.remove("minimized");
      pill.classList.remove("show");
      state.siteInsight.minimized = false;
    }
    state.siteInsight.summaryData = summaryData;
    state.siteInsight.config = settings;
    state.siteInsight.lastShownAt = Date.now();
    state.siteInsight.lastRenderUrl = location.href;
    if (!openMinimized) {
      scheduleInsightAutoMinimize();
    }
  }

  async function showSiteInsight(payload = {}) {
    if (document.visibilityState !== "visible") return;
    if (!/^https?:$/.test(location.protocol)) return;

    const nowTs = Date.now();
    const throttleMs = Math.max(SITE_INSIGHT_LOCAL_THROTTLE_MS, Number(payload.throttleMs || SITE_INSIGHT_LOCAL_THROTTLE_MS));
    if (nowTs - state.siteInsight.lastShownAt < throttleMs && state.siteInsight.lastRenderUrl === location.href) {
      return;
    }

    const settings = payload.settings || state.settings?.siteInsight || null;
    if (!settings?.enabled || !settings?.showOnEverySite) return;

    const host = normalizeHost(payload.host || location.href);
    if (!host) return;
    if (settings.perSiteDisabled?.[host]) return;

    let summaryData = null;
    const cachedAt = Math.max(0, Number(payload.cachedAt || 0));
    if (
      payload.cachedSummary &&
      cachedAt > 0 &&
      nowTs - cachedAt < SITE_INSIGHT_CACHE_TTL_MS &&
      shouldUseCachedSummary(host, payload.cachedSummary)
    ) {
      summaryData = payload.cachedSummary;
    }

    if (!summaryData || !summaryData.profiles) {
      summaryData = computeSiteInsightSummary(host);
      sendRuntimeMessage({
        type: "holmeta:site-insight-cache-set",
        host,
        summaryData
      }).catch(() => {});
    }

    const seenBefore = Boolean(payload.seenBefore) || hasSeenSiteInsightHost(host);
    renderInsightPanel(summaryData, settings, { startMinimized: seenBefore });
    if (!seenBefore) {
      markSeenSiteInsightHost(host);
    }
  }

  async function refreshSiteInsightFromBackground(reason = "navigation") {
    const url = location.href;
    if (!/^https?:/.test(url)) return;

    const nowTs = Date.now();
    if (state.siteInsight.lastRequestedUrl === url && nowTs - state.siteInsight.lastShownAt < SITE_INSIGHT_LOCAL_THROTTLE_MS) {
      return;
    }

    state.siteInsight.lastRequestedUrl = url;
    const response = await sendRuntimeMessage({
      type: "holmeta:get-site-insight-config",
      host: currentHost()
    });
    if (!response?.ok) return;

    await showSiteInsight({
      host: response.host || currentHost(),
      url,
      settings: response.settings,
      cachedSummary: response.cached?.summaryData || null,
      cachedAt: Number(response.cached?.computedAt || 0),
      throttleMs: SITE_INSIGHT_LOCAL_THROTTLE_MS,
      source: reason
    });
  }

  function bindSpaNavigationHooks() {
    if (state.siteInsight.navHooked) return;
    state.siteInsight.navHooked = true;

    const dispatch = () => {
      window.dispatchEvent(new CustomEvent("holmeta:spa-url-change"));
    };

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function pushStateProxy(...args) {
      const result = originalPush.apply(this, args);
      dispatch();
      return result;
    };

    history.replaceState = function replaceStateProxy(...args) {
      const result = originalReplace.apply(this, args);
      dispatch();
      return result;
    };

    let navTimer = null;
    const onChange = () => {
      if (navTimer) clearTimeout(navTimer);
      navTimer = setTimeout(() => {
        refreshSiteInsightFromBackground("spa");
        navTimer = null;
      }, 550);
    };

    window.addEventListener("holmeta:spa-url-change", onChange, { passive: true });
    window.addEventListener("popstate", onChange, { passive: true });
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
    applyCosmeticFiltering();
    applyMorphing(Boolean(state.licensePremium && state.settings.advanced?.morphing));

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

    if (type === "holmeta:ping") {
      sendResponse({ ok: true, ready: true });
      return false;
    }

    if (type === "holmeta:apply-state") {
      applyState(message.payload || {});
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:show-site-insight") {
      showSiteInsight(message.payload || {}).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (type === "holmeta:toast") {
      showToast(message.payload || {});
      sendResponse({ ok: true });
      return false;
    }

    if (type === "holmeta:sound") {
      const payload = message.payload || {};
      playAlertSound(payload.kind, payload.volume, payload.pattern).then((ok) => sendResponse({ ok }));
      return true;
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

    bindSpaNavigationHooks();
    setTimeout(() => {
      refreshSiteInsightFromBackground("boot");
    }, 950);
  });

  globalThis.__HOLMETA_CONTENT_TEST__ = {
    normalizeHost: globalThis.HolmetaLightEngine?.normalizeHost || normalizeHost
  };
})();
