(() => {
  if (globalThis.HolmetaAppearanceIframeHandler) return;

  function collectSameOriginDocuments(root = document) {
    const base = root instanceof Document ? root : root?.ownerDocument || document;
    const out = [];
    const seen = new Set();
    const source = base.querySelectorAll ? base : base.documentElement;
    if (!source?.querySelectorAll) return out;

    for (const frame of source.querySelectorAll("iframe")) {
      try {
        const doc = frame.contentDocument;
        if (!doc?.documentElement) continue;
        if (doc.location?.origin && doc.location.origin !== location.origin) continue;
        if (seen.has(doc)) continue;
        seen.add(doc);
        out.push(doc);
      } catch {
        // Cross-origin or inaccessible frame.
      }
    }
    return out;
  }

  globalThis.HolmetaAppearanceIframeHandler = {
    collectSameOriginDocuments
  };
})();
