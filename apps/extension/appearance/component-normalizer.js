(() => {
  if (globalThis.HolmetaAppearanceNormalizer) return;

  const classifier = globalThis.HolmetaAppearanceClassifier;
  const mediaGuard = globalThis.HolmetaAppearanceMediaGuard;

  const ATTR = classifier?.ATTR || {
    SURFACE: "data-holmeta-ui-surface",
    COMPONENT: "data-holmeta-ui-component",
    INNER: "data-holmeta-ui-inner",
    OWNED: "data-holmeta-appearance-owned",
    MEDIA_SAFE: "data-holmeta-media-safe",
    ACCENT_SAFE: "data-holmeta-accent-safe",
    FORCE_TEXT: "data-holmeta-force-text",
    LOGO_WORDMARK: "data-holmeta-logo-wordmark",
    LOGO_SAFE_BG: "data-holmeta-logo-safe-bg",
    LOGO_SVG: "data-holmeta-logo-svg"
  };

  function parseRgba(rawColor) {
    const raw = String(rawColor || "").trim();
    const match = raw.match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => Number(String(part).trim()));
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
    return {
      r: Math.max(0, Math.min(255, parts[0])),
      g: Math.max(0, Math.min(255, parts[1])),
      b: Math.max(0, Math.min(255, parts[2])),
      a: Number.isFinite(parts[3]) ? Math.max(0, Math.min(1, parts[3])) : 1
    };
  }

  function luminanceFromRgb(rgb) {
    if (!rgb) return null;
    const toLin = (value) => {
      const s = Math.max(0, Math.min(255, value)) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (0.2126 * toLin(rgb.r)) + (0.7152 * toLin(rgb.g)) + (0.0722 * toLin(rgb.b));
  }

  function parseBackgroundLuminance(style) {
    if (!style) return null;
    const rgba = parseRgba(style.backgroundColor);
    if (!rgba || rgba.a <= 0.02) return null;
    return luminanceFromRgb(rgba);
  }

  function parseColorLuminance(style, key = "color") {
    if (!style) return null;
    const rgba = parseRgba(style[key]);
    if (!rgba || rgba.a <= 0.02) return null;
    return luminanceFromRgb(rgba);
  }

  function resolveEffectiveBackgroundLuminance(node, root = document.documentElement, maxDepth = 12) {
    if (!(node instanceof Element)) return null;
    let depth = 0;
    let current = node;
    while (current && depth <= maxDepth) {
      const style = getComputedStyle(current);
      const lum = parseBackgroundLuminance(style);
      if (Number.isFinite(lum)) return lum;
      current = current.parentElement;
      depth += 1;
    }
    const body = document.body instanceof Element ? document.body : null;
    const bodyLum = body ? parseBackgroundLuminance(getComputedStyle(body)) : null;
    if (Number.isFinite(bodyLum)) return bodyLum;
    const rootLum = root instanceof Element ? parseBackgroundLuminance(getComputedStyle(root)) : null;
    return Number.isFinite(rootLum) ? rootLum : null;
  }

  function preferredContrastByBackground(bgLum) {
    if (!Number.isFinite(bgLum)) return null;
    if (bgLum <= 0.46) return "light";
    if (bgLum >= 0.62) return "dark";
    return null;
  }

  function shouldForceContrast(fgLum, preferred) {
    if (!Number.isFinite(fgLum) || !preferred) return false;
    if (preferred === "light") return fgLum < 0.50;
    if (preferred === "dark") return fgLum > 0.62;
    return false;
  }

  function hasUrlBackgroundImage(style) {
    if (!style) return false;
    const raw = String(style.backgroundImage || "").toLowerCase();
    return raw.includes("url(");
  }

  function isLogoElement(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches("img[alt*='logo' i], [class*='logo' i], [id*='logo' i], [data-testid*='logo' i], [aria-label*='logo' i]")) return true;
    const text = String(node.textContent || "").trim();
    if (text.length > 0 && text.length < 26 && /(logo|brand|wordmark|home)/i.test(String(node.className || ""))) return true;
    return false;
  }

  function markSurface(node, component = "surface") {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR.SURFACE, "1");
    node.setAttribute(ATTR.COMPONENT, component);
    classifier?.markOwned?.(node);
  }

  function markInner(node) {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR.INNER, "1");
    classifier?.markOwned?.(node);
  }

  function hasAccentSemantic(node) {
    if (!(node instanceof Element)) return false;
    const text = [
      String(node.className || ""),
      String(node.id || ""),
      String(node.getAttribute("role") || ""),
      String(node.getAttribute("aria-label") || ""),
      String(node.getAttribute("data-testid") || ""),
      String(node.getAttribute("data-state") || "")
    ].join(" ").toLowerCase();
    return /(success|warning|danger|error|alert|info|badge|tag|chip|pill|status|highlight|marker|label|progress|notification|toast|positive|negative)/.test(text);
  }

  function hasAccentTone(style) {
    if (!style) return false;
    const samples = [parseRgba(style.color), parseRgba(style.backgroundColor), parseRgba(style.borderTopColor)];
    for (const rgb of samples) {
      if (!rgb || rgb.a < 0.35) continue;
      const lum = luminanceFromRgb(rgb);
      const max = Math.max(rgb.r, rgb.g, rgb.b) / 255;
      const min = Math.min(rgb.r, rgb.g, rgb.b) / 255;
      const chroma = max - min;
      if (chroma >= 0.18 && lum >= 0.08 && lum <= 0.92) return true;
    }
    return false;
  }

  function shouldPreserveAccent(node) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 6 || rect.height < 6) return false;
    const area = rect.width * rect.height;
    if (area > 45000) return false;
    const style = getComputedStyle(node);
    return hasAccentSemantic(node) || hasAccentTone(style);
  }

  function markAccentSafe(node) {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR.ACCENT_SAFE, "1");
    node.removeAttribute(ATTR.SURFACE);
    node.removeAttribute(ATTR.COMPONENT);
    node.removeAttribute(ATTR.INNER);
    classifier?.markOwned?.(node);
  }

  function normalizeRoot(root = document.documentElement, options = {}) {
    if (!classifier || !mediaGuard) return { components: 0, wrappers: 0, media: 0 };

    const host = String(options.host || location.hostname || "").toLowerCase();
    const maxComponents = Number.isFinite(Number(options.maxComponents))
      ? Math.max(120, Math.min(2400, Number(options.maxComponents)))
      : 1100;

    const mediaCount = mediaGuard.markMediaNodes(root);
    const components = classifier.collectCandidates(root, maxComponents);
    let wrappers = 0;
    let applied = 0;

    for (const componentRoot of components) {
      if (!(componentRoot instanceof Element)) continue;
      if (componentRoot.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;

      const style = getComputedStyle(componentRoot);
      if (hasUrlBackgroundImage(style) && !componentRoot.matches("header, nav, main, section, article, aside, footer, [role='dialog'], [role='region']")) {
        continue;
      }

      if (shouldPreserveAccent(componentRoot)) {
        markAccentSafe(componentRoot);
        continue;
      }

      const rect = componentRoot.getBoundingClientRect?.();
      if (!rect || rect.width < 18 || rect.height < 12) continue;

      const componentType = classifier.classifyComponent(componentRoot);
      markSurface(componentRoot, componentType);
      applied += 1;

      const shouldCollectInner = (
        componentType === "button"
        || componentType === "input"
        || componentType === "dropdown"
        || componentType === "accordion"
        || componentType === "toolbar"
        || componentType === "header"
        || componentType === "nav"
      );

      if (!shouldCollectInner) continue;
      const inners = componentRoot.querySelectorAll(":scope > div, :scope > span, :scope > label, :scope > strong, :scope > em, :scope > i, :scope > b");
      let localCount = 0;
      for (const inner of inners) {
        if (localCount >= 10) break;
        if (!(inner instanceof Element)) continue;
        if (inner.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        if (shouldPreserveAccent(inner)) {
          markAccentSafe(inner);
          continue;
        }
        markInner(inner);
        localCount += 1;
        wrappers += 1;
      }
    }

    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      const xSurfaces = document.querySelectorAll([
        "[data-testid='AppTabBar']",
        "[data-testid='TopNavBar']",
        "[data-testid='sidebarColumn']",
        "[data-testid='sidebarColumn'] > div",
        "[data-testid='primaryColumn']",
        "[data-testid='primaryColumn'] > div",
        "[data-testid='sidebarColumn'] section",
        "[data-testid='sidebarColumn'] [role='region']",
        "[data-testid='tweetTextarea_0']",
        "[data-testid='SearchBox_Search_Input']"
      ].join(","));
      for (const node of xSurfaces) {
        if (!(node instanceof Element)) continue;
        if (node.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        const t = node.matches("[data-testid='tweetTextarea_0'], [data-testid='SearchBox_Search_Input']")
          ? "input"
          : (node.matches("[data-testid='AppTabBar'], [data-testid='TopNavBar']") ? "header" : "surface");
        markSurface(node, t);
      }
    }

    if (/(\.|^)amazon\./.test(host)) {
      const amazonShells = document.querySelectorAll([
        "#a-page",
        ".a-page",
        "#pageContent",
        "#gw-layout",
        "#gw-main-container",
        "#gw-main",
        "#gw-card-layout",
        "#desktop-grid",
        "[id^='desktop-grid-']",
        "#search-main-wrapper",
        ".s-main-slot",
        ".s-desktop-content"
      ].join(","));
      for (const shell of amazonShells) {
        if (!(shell instanceof Element)) continue;
        if (shell.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        markSurface(shell, "surface");
      }

      const amazonNav = document.querySelectorAll([
        "#nav-belt",
        "#nav-main",
        "#nav-subnav",
        "#navbar",
        "#nav-tools",
        "#nav-xshop",
        "#nav-xshop-container",
        "#nav-search",
        "#nav-search-bar-form"
      ].join(","));
      for (const node of amazonNav) {
        if (!(node instanceof Element)) continue;
        markSurface(node, node.matches("#nav-search, #nav-search-bar-form") ? "input" : "nav");
      }
    }

    return {
      components: applied,
      wrappers,
      media: mediaCount
    };
  }

  function coherencePass(root = document.documentElement, options = {}) {
    if (!(root instanceof Element)) return { forcedSurfaces: 0, forcedText: 0, logos: 0 };
    const mode = String(options.mode || "dark");
    const maxNodes = Number.isFinite(Number(options.maxNodes)) ? Math.max(100, Number(options.maxNodes)) : 300;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);

    let forcedSurfaces = 0;
    let forcedText = 0;
    let logos = 0;

    const candidates = root.querySelectorAll("body, main, [role='main'], header, nav, footer, section, article, aside, div, li, td, th");
    for (const node of candidates) {
      if (forcedSurfaces >= maxNodes) break;
      if (!(node instanceof Element)) continue;
      if (node.closest(`[${ATTR.MEDIA_SAFE}]`) || node.closest(`[${ATTR.ACCENT_SAFE}]`)) continue;
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 30 || rect.height < 20) continue;
      const area = rect.width * rect.height;
      if (area < 8000) continue;
      const style = getComputedStyle(node);
      if (hasUrlBackgroundImage(style)) continue;
      const bgLum = parseBackgroundLuminance(style);
      if (!Number.isFinite(bgLum)) continue;
      const largeStructural = area > (viewportArea * 0.015) || (rect.width > window.innerWidth * 0.55 && rect.height > 22);

      if (mode === "dark" && largeStructural && bgLum > 0.66) {
        markSurface(node, "surface");
        forcedSurfaces += 1;
      } else if (mode === "light" && largeStructural && bgLum < 0.20) {
        markSurface(node, "surface");
        forcedSurfaces += 1;
      }
    }

    const textNodes = root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,span,label,a,button,small,li,td,th,strong,em,i,b,[role='button'],[role='tab'],svg,[class*='icon' i]");
    for (const node of textNodes) {
      if (forcedText >= maxNodes) break;
      if (!(node instanceof Element)) continue;
      if (node.closest(`[${ATTR.MEDIA_SAFE}]`) || node.closest(`[${ATTR.ACCENT_SAFE}]`)) continue;
      const nodeStyle = getComputedStyle(node);
      const textLum = node.tagName.toLowerCase() === "svg"
        ? (parseColorLuminance(nodeStyle, "fill") ?? parseColorLuminance(nodeStyle, "color"))
        : parseColorLuminance(nodeStyle, "color");
      const bgLum = resolveEffectiveBackgroundLuminance(node, root);
      const preferred = preferredContrastByBackground(bgLum);
      if (!preferred) continue;
      if (!shouldForceContrast(textLum, preferred)) continue;
      node.setAttribute(ATTR.FORCE_TEXT, preferred);
      classifier?.markOwned?.(node);
      forcedText += 1;
    }

    const logoCandidates = root.querySelectorAll("[class*='logo' i], [id*='logo' i], [data-testid*='logo' i], [aria-label*='logo' i], img[alt*='logo' i], svg[class*='logo' i], [class*='brand' i]");
    for (const node of logoCandidates) {
      if (logos >= 90) break;
      if (!(node instanceof Element)) continue;
      if (!isLogoElement(node)) continue;
      if (node.closest(`[${ATTR.MEDIA_SAFE}]`) && node.tagName.toLowerCase() !== "svg") continue;

      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 28 || rect.height < 10 || rect.width > 460 || rect.height > 140) continue;

      const hostSurface = node.closest("header, nav, [role='banner'], [class*='header' i], [class*='nav' i], [class*='topbar' i]") || node.parentElement;
      const style = getComputedStyle(node);
      const textLum = parseColorLuminance(style, "color");
      const surfaceLum = hostSurface ? resolveEffectiveBackgroundLuminance(hostSurface, root) : resolveEffectiveBackgroundLuminance(node, root);
      const preferred = preferredContrastByBackground(surfaceLum);
      if (!preferred) continue;

      if (node.tagName.toLowerCase() === "svg") {
        if (shouldForceContrast(textLum, preferred)) {
          node.setAttribute(ATTR.LOGO_SVG, preferred);
          classifier?.markOwned?.(node);
          logos += 1;
        }
        continue;
      }

      if (node.tagName.toLowerCase() === "img") {
        if (hostSurface instanceof Element && (surfaceLum <= 0.36 || surfaceLum >= 0.70)) {
          hostSurface.setAttribute(ATTR.LOGO_SAFE_BG, preferred === "light" ? "light" : "dark");
          hostSurface.setAttribute(ATTR.FORCE_TEXT, preferred);
          classifier?.markOwned?.(hostSurface);
          logos += 1;
        }
        continue;
      }

      if (shouldForceContrast(textLum, preferred)) {
        node.setAttribute(ATTR.LOGO_WORDMARK, preferred);
        classifier?.markOwned?.(node);
        logos += 1;
      }
    }

    return { forcedSurfaces, forcedText, logos };
  }

  function clearRoot(root = document.documentElement) {
    classifier?.clearOwned?.(root);
    mediaGuard?.clearMarks?.(root);
    if (!(root instanceof Element)) return;
    const extra = root.querySelectorAll(
      `[${ATTR.FORCE_TEXT}], [${ATTR.LOGO_WORDMARK}], [${ATTR.LOGO_SAFE_BG}], [${ATTR.LOGO_SVG}], [${ATTR.ACCENT_SAFE}]`
    );
    for (const node of extra) {
      node.removeAttribute(ATTR.FORCE_TEXT);
      node.removeAttribute(ATTR.LOGO_WORDMARK);
      node.removeAttribute(ATTR.LOGO_SAFE_BG);
      node.removeAttribute(ATTR.LOGO_SVG);
      node.removeAttribute(ATTR.ACCENT_SAFE);
    }
  }

  globalThis.HolmetaAppearanceNormalizer = {
    normalizeRoot,
    coherencePass,
    clearRoot
  };
})();
