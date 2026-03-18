(() => {
  if (globalThis.HolmetaAppearanceDomScanner) return;

  const colorEngine = globalThis.HolmetaAppearanceColor;
  const SHOW_ELEMENT = globalThis.NodeFilter?.SHOW_ELEMENT || 0x1;
  const IGNORE_TAGS = new Set(["script", "style", "noscript", "meta", "link", "template"]);
  const MEDIA_SELECTOR = "img, picture, video, canvas, svg, iframe, embed, object, model-viewer, lottie-player";

  function getBase(root) {
    if (root instanceof Document) return root.documentElement;
    if (root instanceof Element || root instanceof ShadowRoot) return root;
    return null;
  }

  function getView(root) {
    return root?.ownerDocument?.defaultView || globalThis;
  }

  function isVisible(node, style, rect) {
    if (!node || !style || !rect) return false;
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity || 1) <= 0.02) return false;
    if (rect.width < 2 || rect.height < 2) return false;
    if (node.hasAttribute?.("hidden") || node.getAttribute?.("aria-hidden") === "true") return false;
    return true;
  }

  function classList(node) {
    if (!(node instanceof Element)) return [];
    return String(node.className || "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 14);
  }

  function extractCssVars(style, limit = 10) {
    if (!style) return [];
    const vars = [];
    for (let index = 0; index < style.length; index += 1) {
      if (vars.length >= limit) break;
      const key = String(style[index] || "");
      if (!key.startsWith("--")) continue;
      const value = String(style.getPropertyValue(key) || "").trim();
      if (!value || !colorEngine?.parseColor?.(value)) continue;
      vars.push({ name: key, value });
    }
    return vars;
  }

  function containsMedia(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches(MEDIA_SELECTOR)) return true;
    if (node.childElementCount === 0) return false;
    return Boolean(node.querySelector(MEDIA_SELECTOR));
  }

  function isInteractive(node) {
    if (!(node instanceof Element)) return false;
    const tag = node.tagName.toLowerCase();
    const role = String(node.getAttribute("role") || "").toLowerCase();
    if (["button", "input", "textarea", "select", "summary", "option"].includes(tag)) return true;
    if (tag === "a" && node.hasAttribute("href")) return true;
    if (/button|link|tab|menuitem|option|switch|slider|textbox|searchbox/.test(role)) return true;
    if (node.hasAttribute("contenteditable")) return true;
    if (Number(node.getAttribute("tabindex")) >= 0) return true;
    return false;
  }

  function depthFromBase(node, base) {
    let depth = 0;
    let current = node;
    while (current && current !== base) {
      current = current.parentElement || current.parentNode?.host || null;
      depth += 1;
      if (depth > 64) break;
    }
    return depth;
  }

  function createRecord(node, base) {
    const view = getView(node);
    const style = view.getComputedStyle?.(node);
    if (!style) return null;
    const rect = node.getBoundingClientRect?.();
    if (!rect || !isVisible(node, style, rect)) return null;

    const backgroundColor = String(style.backgroundColor || "transparent");
    const textColor = String(style.color || "");
    const borderColor = String(style.borderTopColor || style.borderColor || "");
    const outlineColor = String(style.outlineColor || "");
    const boxShadow = String(style.boxShadow || "none");
    const fontSize = Number.parseFloat(String(style.fontSize || "0")) || 0;
    const fontWeight = Number.parseFloat(String(style.fontWeight || "0")) || 0;
    const role = String(node.getAttribute("role") || "");
    const ariaLabel = String(node.getAttribute("aria-label") || node.getAttribute("aria-labelledby") || "");
    const classes = classList(node);
    const textContent = String(node.textContent || "").replace(/\s+/g, " ").trim();

    return {
      node,
      tag: node.tagName.toLowerCase(),
      id: String(node.id || ""),
      classes,
      className: classes.join(" "),
      role,
      ariaLabel,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      area: Math.round(rect.width * rect.height),
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      depth: depthFromBase(node, base),
      interactive: isInteractive(node),
      backgroundColor,
      backgroundLuminance: colorEngine?.luminance?.(backgroundColor) ?? 1,
      textColor,
      textLuminance: colorEngine?.luminance?.(textColor) ?? 1,
      borderColor,
      outlineColor,
      boxShadow,
      opacity: Number(style.opacity || 1),
      display: String(style.display || "block"),
      position: String(style.position || "static"),
      zIndex: String(style.zIndex || "auto"),
      backgroundImage: String(style.backgroundImage || "none"),
      hasBackgroundImage: String(style.backgroundImage || "none") !== "none",
      cssVars: extractCssVars(style),
      containsMedia: containsMedia(node),
      isMonospace: /mono|code|menlo|consolas|monaco|sfmono/i.test(String(style.fontFamily || "")),
      fontSize,
      fontWeight,
      textLength: textContent.length,
      textSample: textContent.slice(0, 180)
    };
  }

  function scan(root = document, options = {}) {
    const base = getBase(root);
    if (!base) return [];
    const maxNodes = Math.max(120, Math.min(6000, Number(options.maxNodes || 1800)));
    const doc = base.ownerDocument || document;
    const walker = doc.createTreeWalker(base, SHOW_ELEMENT);
    const records = [];

    const pushRecord = (node) => {
      if (!(node instanceof Element)) return;
      if (IGNORE_TAGS.has(node.tagName.toLowerCase())) return;
      const record = createRecord(node, base);
      if (!record) return;
      records.push(record);
    };

    pushRecord(base);
    while (records.length < maxNodes && walker.nextNode()) {
      pushRecord(walker.currentNode);
    }

    return records;
  }

  function summarize(records = []) {
    const summary = {
      nodes: records.length,
      interactive: 0,
      mediaContainers: 0,
      monospaceBlocks: 0,
      largeLightSurfaces: 0,
      largeDarkSurfaces: 0,
      headers: 0,
      tokenSignals: 0,
      averageLuminance: 0.5
    };

    if (!records.length) return summary;

    let luminanceSum = 0;
    let luminanceCount = 0;

    for (const record of records) {
      if (record.interactive) summary.interactive += 1;
      if (record.containsMedia) summary.mediaContainers += 1;
      if (record.isMonospace) summary.monospaceBlocks += 1;
      if (record.cssVars?.length) summary.tokenSignals += record.cssVars.length;
      if (record.area >= 14000 && record.backgroundLuminance >= 0.76) summary.largeLightSurfaces += 1;
      if (record.area >= 14000 && record.backgroundLuminance <= 0.22) summary.largeDarkSurfaces += 1;
      if (record.position === "fixed" || record.position === "sticky" || /header|nav|banner|topbar|appbar/i.test(`${record.role} ${record.className} ${record.id}`)) {
        summary.headers += 1;
      }
      if (Number.isFinite(record.backgroundLuminance)) {
        luminanceSum += record.backgroundLuminance;
        luminanceCount += 1;
      }
    }

    summary.averageLuminance = luminanceCount ? Number((luminanceSum / luminanceCount).toFixed(3)) : 0.5;
    return summary;
  }

  globalThis.HolmetaAppearanceDomScanner = {
    scan,
    summarize
  };
})();
