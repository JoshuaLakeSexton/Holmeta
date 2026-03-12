(() => {
  if (globalThis.HolmetaAppearanceNormalizer) return;

  const classifier = globalThis.HolmetaAppearanceClassifier;
  const mediaGuard = globalThis.HolmetaAppearanceMediaGuard;

  const ATTR = classifier?.ATTR || {
    SURFACE: "data-holmeta-ui-surface",
    COMPONENT: "data-holmeta-ui-component",
    INNER: "data-holmeta-ui-inner",
    OWNED: "data-holmeta-appearance-owned",
    MEDIA_SAFE: "data-holmeta-media-safe"
  };

  function parseBackgroundLuminance(style) {
    if (!style) return null;
    const raw = String(style.backgroundColor || "");
    const match = raw.match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => Number(String(part).trim()));
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
    const alpha = Number.isFinite(parts[3]) ? parts[3] : 1;
    if (alpha <= 0.02) return null;
    const toLin = (value) => {
      const s = Math.max(0, Math.min(255, value)) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (0.2126 * toLin(parts[0])) + (0.7152 * toLin(parts[1])) + (0.0722 * toLin(parts[2]));
  }

  function shouldPromoteInnerSurface(node, rootRect) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 12 || rect.height < 10) return false;
    if (rootRect?.width && rect.width > rootRect.width * 0.995 && rect.height > rootRect.height * 0.995) return false;
    const style = getComputedStyle(node);
    const bgLum = parseBackgroundLuminance(style);
    const hasBrightBg = Number.isFinite(bgLum) && bgLum > 0.78;
    const hasBorder = style.borderStyle !== "none" && Number.parseFloat(String(style.borderTopWidth || "0")) > 0;
    const classText = String(node.className || "").toLowerCase();
    const semantic = /(surface|container|wrapper|panel|card|chip|badge|input|field|search|row|cell|button)/.test(classText);
    return Boolean(hasBrightBg || hasBorder || semantic);
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

      const componentType = classifier.classifyComponent(componentRoot);
      componentRoot.setAttribute(ATTR.SURFACE, "1");
      componentRoot.setAttribute(ATTR.COMPONENT, componentType);
      classifier.markOwned(componentRoot);

      const maxWrappers = componentType === "button" || componentType === "input" ? 72 : 32;
      const componentRect = componentRoot.getBoundingClientRect?.() || { width: 0, height: 0 };
      const componentWrappers = classifier.collectInnerWrappers(componentRoot, maxWrappers, {
        aggressive: componentType === "button" || componentType === "input" || componentType === "nav"
      });

      for (const inner of componentWrappers) {
        if (!(inner instanceof Element)) continue;
        if (inner.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
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
      if (componentType === "button" || componentType === "input") {
        const anatomy = componentRoot.querySelectorAll(
          ":scope > div, :scope > span, :scope > label, :scope > p, :scope > strong, :scope > em, :scope > i, :scope > b"
        );
        for (const node of anatomy) {
          if (!(node instanceof Element)) continue;
          if (node.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
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

    return {
      components: components.length,
      wrappers,
      media: mediaCount
    };
  }

  function clearRoot(root = document.documentElement) {
    classifier?.clearOwned?.(root);
    mediaGuard?.clearMarks?.(root);
  }

  globalThis.HolmetaAppearanceNormalizer = {
    normalizeRoot,
    clearRoot
  };
})();
