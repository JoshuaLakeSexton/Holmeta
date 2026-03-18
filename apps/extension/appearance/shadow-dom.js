(() => {
  if (globalThis.HolmetaAppearanceShadowDom) return;

  const STYLE_ID = "holmeta-appearance-shadow-style-v1";

  function collectOpenRoots(root = document) {
    const base = root instanceof Document ? root.documentElement : root;
    if (!(base instanceof Element || base instanceof ShadowRoot)) return [];

    const found = [];
    const seen = new Set();
    const doc = base.ownerDocument || document;
    const walker = doc.createTreeWalker(base, globalThis.NodeFilter?.SHOW_ELEMENT || 0x1);

    const visit = (node) => {
      if (!(node instanceof Element)) return;
      const shadowRoot = node.shadowRoot;
      if (!(shadowRoot instanceof ShadowRoot) || shadowRoot.mode !== "open") return;
      if (seen.has(shadowRoot)) return;
      seen.add(shadowRoot);
      found.push(shadowRoot);
      for (const nested of collectOpenRoots(shadowRoot)) {
        if (seen.has(nested)) continue;
        seen.add(nested);
        found.push(nested);
      }
    };

    if (base instanceof Element) visit(base);
    while (walker.nextNode()) {
      visit(walker.currentNode);
    }

    return found;
  }

  function injectStyle(shadowRoot, cssText) {
    if (!(shadowRoot instanceof ShadowRoot)) return null;
    let styleNode = shadowRoot.getElementById?.(STYLE_ID) || shadowRoot.querySelector?.(`#${STYLE_ID}`);
    if (!styleNode) {
      styleNode = shadowRoot.ownerDocument.createElement("style");
      styleNode.id = STYLE_ID;
      shadowRoot.appendChild(styleNode);
    }
    if (styleNode.textContent !== cssText) {
      styleNode.textContent = cssText;
    }
    return styleNode;
  }

  function clearStyle(shadowRoot) {
    if (!(shadowRoot instanceof ShadowRoot)) return;
    const styleNode = shadowRoot.querySelector?.(`#${STYLE_ID}`);
    if (styleNode) styleNode.remove();
  }

  globalThis.HolmetaAppearanceShadowDom = {
    STYLE_ID,
    collectOpenRoots,
    injectStyle,
    clearStyle
  };
})();
