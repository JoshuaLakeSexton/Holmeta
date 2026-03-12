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
    if (bgLum <= 0.45) return "light";
    if (bgLum >= 0.62) return "dark";
    return null;
  }

  function shouldForceContrast(fgLum, preferred) {
    if (!Number.isFinite(fgLum) || !preferred) return false;
    if (preferred === "light") return fgLum < 0.50;
    if (preferred === "dark") return fgLum > 0.62;
    return false;
  }

  function isLogoElement(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches("img[alt*='logo' i], [class*='logo' i], [id*='logo' i], [data-testid*='logo' i], [aria-label*='logo' i]")) return true;
    const text = String(node.textContent || "").trim();
    if (text.length > 0 && text.length < 26 && /(logo|brand|wordmark|home)/i.test(String(node.className || ""))) return true;
    return false;
  }

  function classifySurfaceNode(node) {
    if (!(node instanceof Element)) return "surface";
    const tag = node.tagName.toLowerCase();
    const classText = String(node.className || "").toLowerCase();
    if (tag === "header" || node.getAttribute("role") === "banner" || /header|topbar|appbar|navbar|menu-bar/.test(classText)) return "header";
    if (tag === "nav" || node.getAttribute("role") === "navigation" || /nav|menu|sidebar|toolbar/.test(classText)) return "nav";
    if (tag === "footer" || node.getAttribute("role") === "contentinfo" || /footer|legal-links/.test(classText)) return "footer";
    if (tag === "details" || tag === "summary" || /accordion|collapse|expand/.test(classText)) return "accordion";
    return "surface";
  }

  function hasUrlBackgroundImage(style) {
    if (!style) return false;
    const raw = String(style.backgroundImage || "").toLowerCase();
    return raw.includes("url(");
  }

  function shouldPromoteInnerSurface(node, rootRect) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 12 || rect.height < 10) return false;
    if (rootRect?.width && rect.width > rootRect.width * 0.995 && rect.height > rootRect.height * 0.995) return false;
    const style = getComputedStyle(node);
    const bgLum = parseBackgroundLuminance(style);
    const hasBrightBg = Number.isFinite(bgLum) && bgLum > 0.78;
    const hasMidBg = Number.isFinite(bgLum) && bgLum > 0.58;
    const hasBorder = style.borderStyle !== "none" && Number.parseFloat(String(style.borderTopWidth || "0")) > 0;
    const hasShadow = style.boxShadow !== "none";
    const hasBgImage = style.backgroundImage && style.backgroundImage !== "none";
    const hasUrlBgImage = hasUrlBackgroundImage(style);
    const classText = String(node.className || "").toLowerCase();
    const semantic = /(surface|container|wrapper|panel|card|chip|badge|input|field|search|row|cell|button|accordion|summary|footer|checkout|buy|payment|installment|toolbar|filter)/.test(classText);
    if (hasUrlBgImage && !semantic && !hasBorder) return false;
    return Boolean(hasBrightBg || hasBorder || semantic || hasShadow || (hasMidBg && hasBgImage));
  }

  function chromaFromRgb(rgb) {
    if (!rgb) return 0;
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    return Math.max(r, g, b) - Math.min(r, g, b);
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
    return /(success|warning|danger|error|alert|info|primary|secondary|accent|badge|tag|chip|pill|status|highlight|marker|label|progress|notification|toast|positive|negative)/.test(text);
  }

  function hasAccentTone(style) {
    if (!style) return false;
    const samples = [
      parseRgba(style.color),
      parseRgba(style.backgroundColor),
      parseRgba(style.borderTopColor)
    ];
    for (const rgb of samples) {
      if (!rgb || rgb.a < 0.35) continue;
      const lum = luminanceFromRgb(rgb);
      const chroma = chromaFromRgb(rgb);
      if (chroma >= 0.16 && lum >= 0.08 && lum <= 0.92) return true;
    }
    return false;
  }

  function shouldPreserveAccent(node) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 6 || rect.height < 6) return false;
    const area = rect.width * rect.height;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const style = getComputedStyle(node);
    const interactive = node.matches(
      "button, a, [role='button'], [role='tab'], [role='status'], [aria-live], [data-state], [class*='chip' i], [class*='badge' i], [class*='pill' i], [class*='tag' i]"
    );
    if (!interactive && area > (viewportArea * 0.08)) return false;
    if (area > 140000) return false;
    return hasAccentSemantic(node) || hasAccentTone(style);
  }

  function markAccentSafe(node) {
    if (!(node instanceof Element)) return;
    node.setAttribute(ATTR.ACCENT_SAFE, "1");
    node.removeAttribute(ATTR.SURFACE);
    node.removeAttribute(ATTR.COMPONENT);
    node.removeAttribute(ATTR.INNER);
    node.removeAttribute(ATTR.FORCE_TEXT);
    classifier.markOwned(node);
  }

  function normalizeRoot(root = document.documentElement, options = {}) {
    if (!classifier || !mediaGuard) return { components: 0, wrappers: 0, media: 0 };

    const maxComponents = Number.isFinite(Number(options.maxComponents))
      ? Math.max(80, Number(options.maxComponents))
      : 2600;

    const mediaCount = mediaGuard.markMediaNodes(root);
    const components = classifier.collectCandidates(root, maxComponents);
    let wrappers = 0;
    const host = String(options.host || location.hostname || "").toLowerCase();

    for (const componentRoot of components) {
      if (!(componentRoot instanceof Element)) continue;
      if (componentRoot.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
      if (shouldPreserveAccent(componentRoot)) {
        markAccentSafe(componentRoot);
        continue;
      }
      const componentStyle = getComputedStyle(componentRoot);
      if (hasUrlBackgroundImage(componentStyle)) {
        componentRoot.setAttribute(ATTR.MEDIA_SAFE, "1");
        classifier.markOwned(componentRoot);
        continue;
      }

      const componentType = classifier.classifyComponent(componentRoot);
      componentRoot.setAttribute(ATTR.SURFACE, "1");
      componentRoot.setAttribute(ATTR.COMPONENT, componentType);
      classifier.markOwned(componentRoot);

      const maxWrappers = componentType === "button" || componentType === "input"
        ? 72
        : (componentType === "accordion" || componentType === "table" || componentType === "footer" || componentType === "buy_panel" ? 48 : 32);
      const componentRect = componentRoot.getBoundingClientRect?.() || { width: 0, height: 0 };
      const componentWrappers = classifier.collectInnerWrappers(componentRoot, maxWrappers, {
        aggressive: componentType === "button"
          || componentType === "input"
          || componentType === "nav"
          || componentType === "accordion"
          || componentType === "footer"
          || componentType === "buy_panel"
      });

      for (const inner of componentWrappers) {
        if (!(inner instanceof Element)) continue;
        if (inner.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        if (shouldPreserveAccent(inner)) {
          markAccentSafe(inner);
          continue;
        }
        const innerStyle = getComputedStyle(inner);
        if (hasUrlBackgroundImage(innerStyle)) {
          inner.setAttribute(ATTR.MEDIA_SAFE, "1");
          classifier.markOwned(inner);
          continue;
        }
        if (shouldPromoteInnerSurface(inner, componentRect)) {
          inner.setAttribute(ATTR.SURFACE, "1");
          inner.setAttribute(ATTR.COMPONENT, componentType === "separator" ? "separator" : "surface");
        } else {
          inner.setAttribute(ATTR.INNER, "1");
        }
        classifier.markOwned(inner);
        wrappers += 1;
      }

      // Normalize common split-control anatomy (button + nested wrappers + pseudo wrappers).
      if (
        componentType === "button"
        || componentType === "input"
        || componentType === "accordion"
        || componentType === "buy_panel"
        || componentType === "footer"
        || componentType === "toolbar"
      ) {
        const anatomy = componentRoot.querySelectorAll(
          ":scope > div, :scope > span, :scope > label, :scope > p, :scope > strong, :scope > em, :scope > i, :scope > b"
        );
        for (const node of anatomy) {
          if (!(node instanceof Element)) continue;
          if (node.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
          if (shouldPreserveAccent(node)) {
            markAccentSafe(node);
            continue;
          }
          const nodeStyle = getComputedStyle(node);
          if (hasUrlBackgroundImage(nodeStyle)) {
            node.setAttribute(ATTR.MEDIA_SAFE, "1");
            classifier.markOwned(node);
            continue;
          }
          if (shouldPromoteInnerSurface(node, componentRect)) {
            node.setAttribute(ATTR.SURFACE, "1");
            node.setAttribute(ATTR.COMPONENT, componentType === "input" ? "input" : "button");
          } else {
            node.setAttribute(ATTR.INNER, "1");
          }
          classifier.markOwned(node);
          wrappers += 1;
        }
      }
    }

    const residualCandidates = root.querySelectorAll("section, article, aside, footer, header, div, li, td, th, summary");
    let residualCount = 0;
    for (const node of residualCandidates) {
      if (residualCount >= 140) break;
      if (!(node instanceof Element)) continue;
      if (node.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
      if (shouldPreserveAccent(node)) {
        markAccentSafe(node);
        continue;
      }
      if (node.hasAttribute(ATTR.SURFACE)) continue;
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 32 || rect.height < 18) continue;
      if ((rect.width * rect.height) < 7200) continue;
      if (rect.width > window.innerWidth * 0.995 && rect.height > window.innerHeight * 0.995) continue;
      const style = getComputedStyle(node);
      if (hasUrlBackgroundImage(style)) continue;
      const lum = parseBackgroundLuminance(style);
      if (!Number.isFinite(lum) || lum < 0.74) continue;
      node.setAttribute(ATTR.SURFACE, "1");
      node.setAttribute(ATTR.COMPONENT, "surface");
      classifier.markOwned(node);
      residualCount += 1;
    }

    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      const xTargets = document.querySelectorAll([
        "[data-testid='SearchBox_Search_Input']",
        "[data-testid='tweetTextarea_0']",
        "[data-testid='tweetButtonInline']",
        "[data-testid='tweetButton']",
        "[data-testid='SideNav_NewTweet_Button']",
        "[data-testid='reply']",
        "[data-testid='retweet']",
        "[data-testid='unretweet']",
        "[data-testid='like']",
        "[data-testid='unlike']",
        "[data-testid='bookmark']",
        "[data-testid='removeBookmark']",
        "[data-testid='share']",
        "[data-testid='UserCell'] [role='button']",
        "[data-testid='primaryColumn'] [role='button']",
        "[data-testid='placementTracking'] [role='button']",
        "[data-testid='cellInnerDiv'] [role='button']"
      ].join(","));

      for (const target of xTargets) {
        if (!(target instanceof Element)) continue;
        if (target.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        target.setAttribute(ATTR.SURFACE, "1");
        target.setAttribute(
          ATTR.COMPONENT,
          (
            target.matches("[data-testid='SearchBox_Search_Input']")
            || target.matches("[data-testid='tweetTextarea_0']")
          )
            ? "input"
            : "button"
        );
        classifier.markOwned(target);

        const innerNodes = target.querySelectorAll("div, span, label, strong, em, b, i, p");
        for (const inner of innerNodes) {
          if (!(inner instanceof Element)) continue;
          if (inner.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
          inner.setAttribute(ATTR.INNER, "1");
          classifier.markOwned(inner);
          wrappers += 1;
        }
      }
    }

    if (host.includes("youtube.com")) {
      const ytTargets = document.querySelectorAll([
        "ytd-searchbox",
        ".ytSearchboxComponentHost",
        ".ytSearchboxComponentInputBox",
        ".ytSearchboxComponentSearchButton",
        "#search-form",
        "#search-icon-legacy"
      ].join(","));

      for (const target of ytTargets) {
        if (!(target instanceof Element)) continue;
        if (target.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        target.setAttribute(ATTR.SURFACE, "1");
        target.setAttribute(ATTR.COMPONENT, "input");
        classifier.markOwned(target);
        const inners = target.querySelectorAll("div, span, label, strong, em, b, i");
        for (const inner of inners) {
          if (!(inner instanceof Element)) continue;
          inner.setAttribute(ATTR.INNER, "1");
          classifier.markOwned(inner);
          wrappers += 1;
        }
      }
    }

    if (/(\.|^)amazon\./.test(host)) {
      const amazonStructural = document.querySelectorAll([
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

      for (const block of amazonStructural) {
        if (!(block instanceof Element)) continue;
        if (block.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        block.setAttribute(ATTR.SURFACE, "1");
        block.setAttribute(
          ATTR.COMPONENT,
          block.matches("#nav-search, #nav-search-bar-form") ? "input" : classifySurfaceNode(block)
        );
        classifier.markOwned(block);

        const inners = block.querySelectorAll("div, span, label, strong, em, b, i");
        for (const inner of inners) {
          if (!(inner instanceof Element)) continue;
          if (inner.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
          const innerStyle = getComputedStyle(inner);
          if (hasUrlBackgroundImage(innerStyle)) {
            inner.setAttribute(ATTR.MEDIA_SAFE, "1");
            classifier.markOwned(inner);
            continue;
          }
          inner.setAttribute(ATTR.INNER, "1");
          classifier.markOwned(inner);
          wrappers += 1;
        }
      }

      const amazonControls = document.querySelectorAll([
        "#twotabsearchtextbox",
        "#searchDropdownBox",
        "#nav-search-submit-button",
        "#nav-hamburger-menu",
        "#nav-cart",
        "#nav-link-accountList",
        "#nav-orders",
        "#icp-nav-flyout"
      ].join(","));

      for (const control of amazonControls) {
        if (!(control instanceof Element)) continue;
        if (control.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        control.setAttribute(ATTR.SURFACE, "1");
        control.setAttribute(
          ATTR.COMPONENT,
          control.matches("#twotabsearchtextbox, #searchDropdownBox, #nav-search-submit-button")
            ? "input"
            : "button"
        );
        classifier.markOwned(control);
      }

      const amazonLogos = document.querySelectorAll([
        "#nav-logo",
        "#nav-logo-sprites",
        "#nav-logo .nav-logo-link",
        "#nav-logo .nav-logo-base",
        "#nav-logo .nav-logo-tagline",
        "#nav-logo .nav-logo-ext",
        "#nav-logo .nav-logo-locale"
      ].join(","));
      for (const logo of amazonLogos) {
        if (!(logo instanceof Element)) continue;
        logo.setAttribute(ATTR.MEDIA_SAFE, "1");
        classifier.markOwned(logo);
      }
    }

    return {
      components: components.length,
      wrappers: wrappers + residualCount,
      media: mediaCount
    };
  }

  function coherencePass(root = document.documentElement, options = {}) {
    if (!(root instanceof Element)) return { forcedSurfaces: 0, forcedText: 0, logos: 0 };

    const mode = String(options.mode || "dark");
    const maxNodes = Number.isFinite(Number(options.maxNodes)) ? Math.max(80, Number(options.maxNodes)) : 360;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const candidates = root.querySelectorAll("body, main, [role='main'], header, nav, footer, section, article, aside, div, li, td, th, summary");

    let forcedSurfaces = 0;
    let forcedText = 0;
    let logos = 0;

    for (const node of candidates) {
      if (forcedSurfaces >= maxNodes) break;
      if (!(node instanceof Element)) continue;
      if (node.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
      if (node.closest(`[${ATTR.ACCENT_SAFE}]`)) continue;
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 24 || rect.height < 18) continue;
      if ((rect.width * rect.height) < 6000) continue;

      const area = rect.width * rect.height;
      const style = getComputedStyle(node);
      if (hasUrlBackgroundImage(style)) continue;
      const bgLum = parseBackgroundLuminance(style);
      if (!Number.isFinite(bgLum)) continue;
      const classText = String(node.className || "").toLowerCase();
      const semanticBlock = /(product|deal|offer|promo|recommend|carousel|widget|listing|result|buybox|checkout|cart|module|card|panel)/.test(classText);
      const hasVisualSignal = (
        style.boxShadow !== "none"
        || (style.borderStyle !== "none" && Number.parseFloat(String(style.borderTopWidth || "0")) > 0)
      );
      const isMidSurface = area > 1200 && (semanticBlock || hasVisualSignal);

      if (mode === "dark") {
        const isLargeStructural = area > (viewportArea * 0.012) || (rect.width > window.innerWidth * 0.55 && rect.height > 22);
        if ((isLargeStructural || isMidSurface) && bgLum > 0.54) {
          node.setAttribute(ATTR.SURFACE, "1");
          node.setAttribute(ATTR.COMPONENT, classifySurfaceNode(node));
          classifier.markOwned(node);
          forcedSurfaces += 1;
        }
      } else {
        const isLargeStructural = area > (viewportArea * 0.03);
        if ((isLargeStructural || isMidSurface) && bgLum < 0.24) {
          node.setAttribute(ATTR.SURFACE, "1");
          node.setAttribute(ATTR.COMPONENT, classifySurfaceNode(node));
          classifier.markOwned(node);
          forcedSurfaces += 1;
        }
      }
    }

    const headerBlocks = root.querySelectorAll(
      "header, nav, [role='banner'], [role='navigation'], [class*='header' i], [class*='navbar' i], [class*='topbar' i], [class*='menu-bar' i], [class*='appbar' i]"
    );
    for (const block of headerBlocks) {
      if (forcedText >= maxNodes) break;
      if (!(block instanceof Element)) continue;
      if (block.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
      if (block.closest(`[${ATTR.ACCENT_SAFE}]`)) continue;
      const bgLum = resolveEffectiveBackgroundLuminance(block, root);
      const preferred = preferredContrastByBackground(bgLum);
      if (!preferred) continue;
      block.setAttribute(ATTR.FORCE_TEXT, preferred);
      classifier.markOwned(block);
      forcedText += 1;
    }

    const textNodes = root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,span,label,a,button,small,li,td,th,strong,em,i,b,[role='button'],[role='tab'],svg,[class*='icon' i]");
    for (const node of textNodes) {
      if (forcedText >= maxNodes) break;
      if (!(node instanceof Element)) continue;
      if (node.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
      if (node.closest(`[${ATTR.ACCENT_SAFE}]`)) continue;
      const nodeStyle = getComputedStyle(node);
      const textLum = node.tagName.toLowerCase() === "svg"
        ? (parseColorLuminance(nodeStyle, "fill") ?? parseColorLuminance(nodeStyle, "color"))
        : parseColorLuminance(nodeStyle, "color");
      const bgLum = resolveEffectiveBackgroundLuminance(node, root);
      const preferred = preferredContrastByBackground(bgLum);
      if (!preferred) continue;
      if (shouldForceContrast(textLum, preferred)) {
        node.setAttribute(ATTR.FORCE_TEXT, preferred);
        classifier.markOwned(node);
        forcedText += 1;
      }
    }

    const logoCandidates = root.querySelectorAll("[class*='logo' i], [id*='logo' i], [data-testid*='logo' i], [aria-label*='logo' i], img[alt*='logo' i], svg[class*='logo' i], [class*='brand' i]");
    for (const node of logoCandidates) {
      if (logos >= 120) break;
      if (!(node instanceof Element)) continue;
      if (!isLogoElement(node)) continue;
      if (node.closest(`[${ATTR.MEDIA_SAFE}]`) && node.tagName.toLowerCase() !== "svg") continue;

      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 28 || rect.height < 10 || rect.width > 460 || rect.height > 140) continue;

      const hostSurface = node.closest("header, nav, [role='banner'], [class*='header'], [class*='nav'], [class*='topbar']") || node.parentElement;
      const style = getComputedStyle(node);
      const textLum = parseColorLuminance(style, "color");
      const surfaceLum = hostSurface ? resolveEffectiveBackgroundLuminance(hostSurface, root) : resolveEffectiveBackgroundLuminance(node, root);
      const preferred = preferredContrastByBackground(surfaceLum);
      if (!preferred) continue;

      if (node.tagName.toLowerCase() === "svg") {
        if (shouldForceContrast(textLum, preferred)) {
          node.setAttribute(ATTR.LOGO_SVG, preferred);
          classifier.markOwned(node);
          logos += 1;
        }
        continue;
      }

      if (node.tagName.toLowerCase() === "img") {
        if (hostSurface instanceof Element && (surfaceLum <= 0.34 || surfaceLum >= 0.72)) {
          // Last-resort container when logo image cannot be recolored safely.
          hostSurface.setAttribute(ATTR.LOGO_SAFE_BG, preferred === "light" ? "light" : "dark");
          hostSurface.setAttribute(ATTR.FORCE_TEXT, preferred);
          classifier.markOwned(hostSurface);
          logos += 1;
        }
        continue;
      }

      if (shouldForceContrast(textLum, preferred)) {
        node.setAttribute(ATTR.LOGO_WORDMARK, preferred);
        classifier.markOwned(node);
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
