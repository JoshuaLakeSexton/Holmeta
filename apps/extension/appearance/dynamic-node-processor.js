(() => {
  if (globalThis.HolmetaAppearanceDynamicProcessor) return;

  function createProcessor(callback, options = {}) {
    let observer = null;
    let timer = null;
    let pendingRoots = new Set();
    const debounceMs = Math.max(80, Number(options.debounceMs || 160));

    const flush = () => {
      if (!pendingRoots.size) return;
      const roots = [...pendingRoots];
      pendingRoots = new Set();
      callback(roots);
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, debounceMs);
    };

    const enqueue = (node) => {
      if (!(node instanceof Element)) return;
      pendingRoots.add(node);
      schedule();
    };

    const start = (root = document.documentElement) => {
      if (observer || !root) return;
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            for (const node of mutation.addedNodes || []) {
              if (node instanceof Element) enqueue(node);
            }
            if (mutation.target instanceof Element) enqueue(mutation.target);
          } else if (mutation.type === "attributes") {
            if (mutation.target instanceof Element) enqueue(mutation.target);
          }
        }
      });

      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "data-theme",
          "data-color-mode",
          "data-testid",
          "aria-label",
          "role"
        ]
      });
    };

    const stop = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      pendingRoots.clear();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const trigger = (root = document.documentElement) => {
      if (root instanceof Element) enqueue(root);
    };

    return {
      start,
      stop,
      trigger
    };
  }

  globalThis.HolmetaAppearanceDynamicProcessor = {
    createProcessor
  };
})();
