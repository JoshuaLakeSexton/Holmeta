(() => {
  if (globalThis.HolmetaAppearanceClassifier) return;

  const state = globalThis.HolmetaAppearanceState;
  const mediaGuard = globalThis.HolmetaAppearanceMediaGuard;

  const ATTR = state?.ATTR || {
    SURFACE: "data-holmeta-ui-surface",
    COMPONENT: "data-holmeta-ui-component",
    INNER: "data-holmeta-ui-inner",
    OWNED: "data-holmeta-appearance-owned",
    MEDIA_SAFE: "data-holmeta-media-safe"
  };

  const CANDIDATE_SELECTOR = [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "[role='button']",
    "[role='tab']",
    "[role='menuitem']",
    "[role='option']",
    "[role='textbox']",
    "[role='search']",
    "[role='listitem']",
    "header",
    "nav",
    "aside",
    "main",
    "section",
    "article",
    "dialog",
    "form",
    "table",
    "tr",
    "th",
    "td",
    "li",
    "details",
    "summary",
    "[class*='button']",
    "[class*='btn']",
    "[class*='pill']",
    "[class*='chip']",
    "[class*='card']",
    "[class*='panel']",
    "[class*='menu']",
    "[class*='input']",
    "[class*='search']",
    "[class*='toolbar']",
    "[class*='TopBar']",
    "[class*='Nav']",
    "[class*='Sidebar']",
    "[data-testid*='button']",
    "[data-testid*='Button']",
    "[data-testid*='card']",
    "[data-testid*='Card']",
    "[data-testid*='pill']",
    "[data-testid*='Pill']",
    "[data-testid*='SearchBox']",
    "[data-testid*='search']",
    "[data-testid*='tweetButton']",
    "[data-testid*='SideNav']",
    "[data-testid*='cellInnerDiv']"
  ].join(",");

  const WRAPPER_SELECTOR = "div, span, label, strong, em, small, b, i";

  function looksHidden(el, style) {
    if (!el || !style) return true;
    if (style.display === "none" || style.visibility === "hidden") return true;
    if (Number(style.opacity || 1) <= 0.02) return true;
    const rect = el.getBoundingClientRect?.();
    if (!rect) return true;
    if (rect.width < 2 || rect.height < 2) return true;
    return false;
  }

  function isThemeable(el) {
    if (!(el instanceof Element)) return false;
    if (el.hasAttribute(ATTR.MEDIA_SAFE)) return false;
    if (mediaGuard?.isProtectedMediaElement?.(el)) return false;

    const tag = el.tagName.toLowerCase();
    if (["script", "style", "meta", "link", "noscript", "template"].includes(tag)) return false;

    const style = getComputedStyle(el);
    if (looksHidden(el, style)) return false;

    if (style.position === "fixed" && el.id && /holmeta/i.test(el.id)) return false;

    return true;
  }

  function hasVisualSurface(style) {
    if (!style) return false;
    const hasBg = style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent";
    const hasBorder = style.borderStyle !== "none" && Number(style.borderTopWidth || 0) > 0;
    const hasRadius = Number(String(style.borderRadius || "0").replace("px", "")) > 0;
    const hasShadow = style.boxShadow !== "none";
    return Boolean(hasBg || hasBorder || hasRadius || hasShadow);
  }

  function classifyComponent(el) {
    if (!(el instanceof Element)) return "surface";
    const tag = el.tagName.toLowerCase();
    const role = String(el.getAttribute("role") || "").toLowerCase();
    const className = String(el.className || "").toLowerCase();

    if (tag === "input" || tag === "textarea" || tag === "select" || role === "textbox" || role === "search" || /search|input|field/.test(className)) {
      return "input";
    }
    if (tag === "button" || role === "button" || /button|btn|pill|chip|toggle/.test(className)) {
      return "button";
    }
    if (tag === "a" && /btn|button|pill|chip/.test(className)) {
      return "button";
    }
    if (tag === "nav" || role === "navigation" || /nav|menu|toolbar/.test(className)) {
      return "nav";
    }
    if (tag === "article" || /card|panel|modal|dialog|drawer/.test(className)) {
      return "card";
    }
    if (tag === "li" || role === "listitem") {
      return "listitem";
    }
    return "surface";
  }

  function isComponentRootCandidate(el) {
    if (!(el instanceof Element)) return false;
    if (!isThemeable(el)) return false;

    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect?.();
    if (!rect) return false;

    const sizeOk = rect.width >= 20 && rect.height >= 14;
    const structured =
      style.display.includes("flex")
      || style.display.includes("grid")
      || style.display === "block"
      || style.display === "inline-flex"
      || style.display === "inline-block";

    if (!sizeOk || !structured) return false;

    const interactiveTag = /^(button|a|input|textarea|select)$/i.test(el.tagName);
    const interactiveRole = /button|tab|menuitem|option|switch|textbox|search/.test(String(el.getAttribute("role") || ""));
    const classText = String(el.className || "").toLowerCase();
    const semanticClass = /(button|btn|card|panel|input|field|chip|pill|menu|nav|toolbar|header|footer|modal|dialog|search)/.test(classText);

    const styleSignal = hasVisualSurface(style);

    return interactiveTag || interactiveRole || semanticClass || styleSignal;
  }

  function resolveComponentRoot(startNode) {
    if (!(startNode instanceof Element)) return null;
    let node = startNode;
    let best = isComponentRootCandidate(node) ? node : null;
    for (let depth = 0; depth < 5; depth += 1) {
      const parent = node.parentElement;
      if (!parent || parent === document.documentElement || parent === document.body) break;
      if (!isThemeable(parent)) {
        node = parent;
        continue;
      }
      const rect = parent.getBoundingClientRect?.();
      if (!rect || rect.width < 20 || rect.height < 14) break;
      if (rect.width > window.innerWidth * 0.95 && rect.height > window.innerHeight * 0.95) break;
      if (isComponentRootCandidate(parent)) best = parent;
      node = parent;
    }
    return best || (isThemeable(startNode) ? startNode : null);
  }

  function collectCandidates(root = document.documentElement, limit = 2800) {
    if (!(root instanceof Element || root instanceof Document)) return [];
    const base = root instanceof Document ? root.documentElement : root;
    if (!base) return [];

    const raw = base.querySelectorAll(CANDIDATE_SELECTOR);
    const seen = new Set();
    const out = [];

    for (const node of raw) {
      if (out.length >= limit) break;
      if (!(node instanceof Element)) continue;
      if (!isThemeable(node)) continue;
      const rootNode = resolveComponentRoot(node);
      if (!rootNode) continue;
      if (seen.has(rootNode)) continue;
      seen.add(rootNode);
      out.push(rootNode);
    }

    return out;
  }

  function collectInnerWrappers(componentRoot, max = 28, options = {}) {
    if (!(componentRoot instanceof Element)) return [];
    const wrappers = [];
    const aggressive = Boolean(options.aggressive);
    const rootRect = componentRoot.getBoundingClientRect?.() || { width: 0, height: 0 };
    const nodes = componentRoot.querySelectorAll(WRAPPER_SELECTOR);
    for (const node of nodes) {
      if (wrappers.length >= max) break;
      if (!(node instanceof Element)) continue;
      if (node.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 2 || rect.height < 2) continue;
      const style = getComputedStyle(node);
      const classText = String(node.className || "").toLowerCase();
      const semantic = /(inner|label|content|text|icon|button|btn|pill|chip|search|input|field|control|surface)/.test(classText);
      if (!aggressive && !semantic && !hasVisualSurface(style)) continue;
      if (aggressive && style.position === "absolute" && rootRect.width > 0 && rect.width > rootRect.width * 0.95) continue;
      wrappers.push(node);
    }
    return wrappers;
  }

  function markOwned(node) {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR.OWNED, "1");
  }

  function clearOwned(root = document.documentElement) {
    if (!(root instanceof Element || root instanceof Document)) return;
    const base = root instanceof Document ? root.documentElement : root;
    if (!base) return;
    const nodes = base.querySelectorAll(`[${ATTR.OWNED}]`);
    for (const node of nodes) {
      node.removeAttribute(ATTR.OWNED);
      node.removeAttribute(ATTR.SURFACE);
      node.removeAttribute(ATTR.COMPONENT);
      node.removeAttribute(ATTR.INNER);
    }
  }

  globalThis.HolmetaAppearanceClassifier = {
    ATTR,
    isThemeable,
    classifyComponent,
    collectCandidates,
    collectInnerWrappers,
    markOwned,
    clearOwned
  };
})();
