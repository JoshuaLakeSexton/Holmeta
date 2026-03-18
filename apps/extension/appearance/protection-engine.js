(() => {
  if (globalThis.HolmetaAppearanceProtectionEngine) return;

  const stateRef = globalThis.HolmetaAppearanceState;
  const colorEngine = globalThis.HolmetaAppearanceColor;
  const mediaGuard = globalThis.HolmetaAppearanceMediaGuard;

  const ATTR = stateRef?.ATTR || {
    MEDIA_SAFE: "data-holmeta-media-safe",
    ACCENT_SAFE: "data-holmeta-accent-safe",
    OWNED: "data-holmeta-appearance-owned",
    LOGO_WORDMARK: "data-holmeta-logo-wordmark",
    LOGO_SAFE_BG: "data-holmeta-logo-safe-bg",
    LOGO_SVG: "data-holmeta-logo-svg"
  };

  const STATUS_RE = /(success|warning|danger|error|alert|positive|negative|status|badge|chip|tag|pill|approved|failed|pending|active)/i;
  const CHART_RE = /(chart|graph|sparkline|plot|apex|echart|rechart|highchart|analytics|metric|trend|heatmap)/i;
  const LOGO_RE = /(logo|brand|wordmark|home)/i;
  const AVATAR_RE = /(avatar|profile|author|user|account)/i;
  const PHOTO_RE = /(hero|cover|poster|thumbnail|product|gallery|image|photo|media)/i;

  function getBase(root) {
    if (root instanceof Document) return root.documentElement;
    if (root instanceof Element || root instanceof ShadowRoot) return root;
    return null;
  }

  function getMetaText(node) {
    if (!(node instanceof Element)) return "";
    return [
      String(node.className || ""),
      String(node.id || ""),
      String(node.getAttribute("role") || ""),
      String(node.getAttribute("aria-label") || ""),
      String(node.getAttribute("data-testid") || ""),
      String(node.getAttribute("alt") || ""),
      String(node.getAttribute("src") || ""),
      String(node.getAttribute("title") || "")
    ].join(" ").trim();
  }

  function markOwned(node) {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR.OWNED, "1");
  }

  function markMediaSafe(node) {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR.MEDIA_SAFE, "1");
    markOwned(node);
  }

  function markAccentSafe(node) {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR.ACCENT_SAFE, "1");
    node.removeAttribute(ATTR.MEDIA_SAFE);
    markOwned(node);
  }

  function backgroundLuminance(node, maxDepth = 8) {
    let current = node instanceof Element ? node : null;
    let depth = 0;
    while (current && depth <= maxDepth) {
      const style = current.ownerDocument?.defaultView?.getComputedStyle?.(current);
      const lum = colorEngine?.luminance?.(style?.backgroundColor);
      if (Number.isFinite(lum) && lum < 0.999) return lum;
      current = current.parentElement || current.getRootNode?.().host || null;
      depth += 1;
    }
    return 0.5;
  }

  function isChartCandidate(node) {
    if (!(node instanceof Element)) return false;
    const meta = getMetaText(node);
    if (CHART_RE.test(meta)) return true;
    if (node.matches("canvas, svg") && /chart|graph|plot|sparkline/i.test(meta)) return true;
    if (node.matches("[data-testid*='chart' i], [class*='chart' i], [class*='graph' i]")) return true;
    return Boolean(node.querySelector?.("canvas, svg") && CHART_RE.test(meta));
  }

  function isLogoCandidate(node) {
    if (!(node instanceof Element)) return false;
    const meta = getMetaText(node);
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 14 || rect.height < 14) return false;
    const nearHeader = Boolean(node.closest("header, nav, [role='banner'], [role='navigation'], [class*='header' i], [class*='nav' i], [class*='topbar' i], [class*='appbar' i]"));
    if (LOGO_RE.test(meta)) return true;
    if (nearHeader && rect.width <= 340 && rect.height <= 140 && (node.matches("img, svg") || node.querySelector?.("svg"))) return true;
    return false;
  }

  function isAvatarCandidate(node) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 18 || rect.height < 18 || rect.width > 160 || rect.height > 160) return false;
    const ratio = rect.width / Math.max(rect.height, 1);
    if (ratio < 0.7 || ratio > 1.3) return false;
    return AVATAR_RE.test(getMetaText(node));
  }

  function isPhotoWrapper(node, record) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 48 || rect.height < 48) return false;
    const style = node.ownerDocument?.defaultView?.getComputedStyle?.(node);
    const hasUrlBg = String(style?.backgroundImage || "").includes("url(");
    if (!hasUrlBg) return false;
    return PHOTO_RE.test(getMetaText(node)) || (record?.area || 0) >= 12000;
  }

  function isStatusCandidate(node, record) {
    if (!(node instanceof Element)) return false;
    const meta = getMetaText(node);
    const style = node.ownerDocument?.defaultView?.getComputedStyle?.(node);
    const bg = style?.backgroundColor;
    const fg = style?.color;
    const area = record?.area || (node.getBoundingClientRect?.().width || 0) * (node.getBoundingClientRect?.().height || 0);
    const shortText = Number(record?.textLength || String(node.textContent || "").trim().length) <= 42;
    if (STATUS_RE.test(meta) && shortText) return true;
    if (area > 0 && area <= 42000 && shortText && (colorEngine?.isLikelyAccent?.(bg) || colorEngine?.isLikelyAccent?.(fg))) return true;
    return false;
  }

  function isCodeLike(node) {
    if (!(node instanceof Element)) return false;
    return node.matches("pre, code, .hljs, .token, .prismjs, .monaco-editor, .CodeMirror, [class*='syntax' i], [class*='editor' i]");
  }

  function countSvgColors(svg) {
    if (!(svg instanceof SVGElement)) return 0;
    const colors = new Set();
    for (const node of svg.querySelectorAll("[fill], [stroke], linearGradient stop, radialGradient stop")) {
      const fill = String(node.getAttribute("fill") || "").trim();
      const stroke = String(node.getAttribute("stroke") || "").trim();
      const stopColor = String(node.getAttribute("stop-color") || "").trim();
      for (const raw of [fill, stroke, stopColor]) {
        if (!raw || raw === "none") continue;
        const parsed = colorEngine?.parseColor?.(raw);
        if (!parsed) continue;
        colors.add(colorEngine.toHex(parsed));
        if (colors.size >= 4) return colors.size;
      }
    }
    return colors.size;
  }

  function protect(root = document, scanRecords = [], options = {}) {
    const base = getBase(root);
    if (!base) {
      return {
        media: 0,
        logos: 0,
        charts: 0,
        avatars: 0,
        statusColors: 0,
        codeBlocks: 0,
        backgroundImages: 0,
        preservedSelectors: 0,
        protectedTotal: 0
      };
    }

    const preserveImages = options.preserveImages !== false;
    const preserveLogos = options.preserveLogos !== false;
    const recordMap = new Map((scanRecords || []).map((record) => [record.node, record]));
    const nodes = scanRecords.length ? scanRecords.map((record) => record.node) : Array.from(base.querySelectorAll("*"));

    let media = mediaGuard?.markMediaNodes?.(base) || 0;
    let logos = 0;
    let charts = 0;
    let avatars = 0;
    let statusColors = 0;
    let codeBlocks = 0;
    let backgroundImages = 0;

    for (const node of nodes) {
      if (!(node instanceof Element)) continue;
      const record = recordMap.get(node);
      if (isCodeLike(node)) {
        markAccentSafe(node);
        codeBlocks += 1;
        continue;
      }

      if (isChartCandidate(node)) {
        markMediaSafe(node);
        charts += 1;
        continue;
      }

      if (preserveImages && isAvatarCandidate(node)) {
        markMediaSafe(node);
        avatars += 1;
        continue;
      }

      if (preserveImages && isPhotoWrapper(node, record)) {
        markMediaSafe(node);
        backgroundImages += 1;
        continue;
      }

      if (isStatusCandidate(node, record)) {
        markAccentSafe(node);
        statusColors += 1;
        continue;
      }

      if (node instanceof SVGElement && countSvgColors(node) >= 4) {
        markMediaSafe(node);
        media += 1;
        continue;
      }

      if (!preserveLogos || !isLogoCandidate(node)) continue;

      const preferred = backgroundLuminance(node) <= 0.48 ? "light" : "dark";
      if (node.matches("img")) {
        markMediaSafe(node);
      } else if (node instanceof SVGElement || node.querySelector?.("svg")) {
        node.setAttribute(ATTR.LOGO_SVG, preferred);
        markOwned(node);
      } else {
        node.setAttribute(ATTR.LOGO_WORDMARK, preferred);
        markOwned(node);
      }
      if (Math.abs(backgroundLuminance(node) - 0.5) < 0.09) {
        node.setAttribute(ATTR.LOGO_SAFE_BG, preferred === "light" ? "dark" : "light");
      }
      logos += 1;
    }

    return {
      media,
      logos,
      charts,
      avatars,
      statusColors,
      codeBlocks,
      backgroundImages,
      preservedSelectors: 0,
      protectedTotal: media + logos + charts + avatars + statusColors + codeBlocks + backgroundImages
    };
  }

  globalThis.HolmetaAppearanceProtectionEngine = {
    protect
  };
})();
