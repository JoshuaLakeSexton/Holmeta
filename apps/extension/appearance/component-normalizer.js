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

  function normalizeRoot(root = document.documentElement, options = {}) {
    if (!classifier || !mediaGuard) return { components: 0, wrappers: 0, media: 0 };

    const maxComponents = Number.isFinite(Number(options.maxComponents))
      ? Math.max(50, Number(options.maxComponents))
      : 2800;

    const mediaCount = mediaGuard.markMediaNodes(root);
    const components = classifier.collectCandidates(root, maxComponents);
    let wrappers = 0;
    const host = String(options.host || location.hostname || "").toLowerCase();

    for (const componentRoot of components) {
      if (!(componentRoot instanceof Element)) continue;
      if (componentRoot.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;

      componentRoot.setAttribute(ATTR.SURFACE, "1");
      componentRoot.setAttribute(ATTR.COMPONENT, classifier.classifyComponent(componentRoot));
      classifier.markOwned(componentRoot);

      const componentWrappers = classifier.collectInnerWrappers(componentRoot, 40);
      for (const inner of componentWrappers) {
        if (!(inner instanceof Element)) continue;
        if (inner.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        inner.setAttribute(ATTR.INNER, "1");
        classifier.markOwned(inner);
        wrappers += 1;
      }
    }

    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      const xTargets = document.querySelectorAll([
        "[data-testid='SearchBox_Search_Input']",
        "[data-testid='tweetButtonInline']",
        "[data-testid='SideNav_NewTweet_Button']",
        "[data-testid='placementTracking'] [role='button']",
        "[data-testid='cellInnerDiv'] [role='button']"
      ].join(","));

      for (const target of xTargets) {
        if (!(target instanceof Element)) continue;
        if (target.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
        target.setAttribute(ATTR.SURFACE, "1");
        target.setAttribute(
          ATTR.COMPONENT,
          target.matches("[data-testid='SearchBox_Search_Input']") ? "input" : "button"
        );
        classifier.markOwned(target);

        const innerNodes = target.querySelectorAll("div, span, label, strong, em, b, i");
        for (const inner of innerNodes) {
          if (!(inner instanceof Element)) continue;
          if (inner.closest(`[${ATTR.MEDIA_SAFE}]`)) continue;
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
