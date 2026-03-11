(() => {
  if (globalThis.HolmetaAppearanceMediaGuard) return;

  const state = globalThis.HolmetaAppearanceState;
  const ATTR = state?.ATTR || {
    MEDIA_SAFE: "data-holmeta-media-safe",
    OWNED: "data-holmeta-appearance-owned"
  };

  const MEDIA_SELECTORS = [
    "img",
    "picture",
    "video",
    "audio",
    "canvas",
    "iframe",
    "embed",
    "object",
    "model-viewer",
    "lottie-player",
    "[data-testid*='chart'] canvas",
    "[class*='chart'] canvas",
    "[class*='map'] canvas",
    ".monaco-editor",
    ".CodeMirror",
    "[role='application'] canvas"
  ].join(",");

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function isUiIconSvg(el) {
    if (!(el instanceof SVGElement)) return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect) return false;
    const w = clamp(rect.width, 0, 9999);
    const h = clamp(rect.height, 0, 9999);
    if (w > 64 || h > 64) return false;

    const parent = el.closest("button, a, [role='button'], [role='tab'], [class*='icon'], [class*='btn']");
    return Boolean(parent);
  }

  function isProtectedMediaElement(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches("iframe, embed, object, canvas, video, picture, img, audio, model-viewer, lottie-player")) {
      return true;
    }
    if (node instanceof SVGElement && !isUiIconSvg(node)) {
      return true;
    }
    if (node.matches(".monaco-editor, .CodeMirror, .leaflet-container, .mapboxgl-canvas, [data-testid*='map']")) {
      return true;
    }
    return false;
  }

  function markNode(node, yes) {
    if (!(node instanceof Element)) return;
    if (yes) {
      node.setAttribute(ATTR.MEDIA_SAFE, "1");
      node.setAttribute(ATTR.OWNED, "1");
    } else {
      node.removeAttribute(ATTR.MEDIA_SAFE);
    }
  }

  function markMediaNodes(root = document.documentElement) {
    if (!root || !(root instanceof Element || root instanceof Document)) return 0;
    let count = 0;
    const base = root instanceof Document ? root.documentElement : root;
    if (!base) return 0;

    const nodes = base.querySelectorAll(MEDIA_SELECTORS);
    for (const node of nodes) {
      if (isProtectedMediaElement(node)) {
        markNode(node, true);
        count += 1;
      }
    }

    const svgs = base.querySelectorAll("svg");
    for (const node of svgs) {
      if (isUiIconSvg(node)) continue;
      markNode(node, true);
      count += 1;
    }

    return count;
  }

  function clearMarks(root = document.documentElement) {
    if (!root || !(root instanceof Element || root instanceof Document)) return;
    const base = root instanceof Document ? root.documentElement : root;
    if (!base) return;
    const nodes = base.querySelectorAll(`[${ATTR.MEDIA_SAFE}]`);
    for (const node of nodes) {
      node.removeAttribute(ATTR.MEDIA_SAFE);
    }
  }

  function countMedia(root = document) {
    const scope = root instanceof Document ? root : document;
    return {
      mediaCount: scope.querySelectorAll("video, img, picture, canvas").length,
      canvasCount: scope.querySelectorAll("canvas").length,
      iframeCount: scope.querySelectorAll("iframe").length
    };
  }

  globalThis.HolmetaAppearanceMediaGuard = {
    isProtectedMediaElement,
    markMediaNodes,
    clearMarks,
    countMedia
  };
})();
