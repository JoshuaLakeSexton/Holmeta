(() => {
  if (globalThis.HolmetaAppearanceMutationManager) return;

  let historyPatched = false;

  function patchHistory() {
    if (historyPatched || !globalThis.history) return;
    historyPatched = true;
    const dispatch = () => globalThis.dispatchEvent(new CustomEvent("holmeta-appearance-routechange"));
    for (const key of ["pushState", "replaceState"]) {
      const original = history[key];
      if (typeof original !== "function") continue;
      history[key] = function patchedHistoryState(...args) {
        const result = original.apply(this, args);
        dispatch();
        return result;
      };
    }
    globalThis.addEventListener("popstate", dispatch);
    globalThis.addEventListener("hashchange", dispatch);
  }

  function normalizeObservationRoot(root) {
    if (root instanceof Document) return root;
    if (root instanceof Element || root instanceof ShadowRoot) return root;
    return null;
  }

  function createManager(callback, options = {}) {
    const debounceMs = Math.max(80, Number(options.debounceMs || 150));
    const observers = new Map();
    let pending = new Set();
    let timer = null;
    let routeHandlerBound = false;

    function flush() {
      if (!pending.size) return;
      const roots = [...pending];
      pending = new Set();
      callback(roots);
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, debounceMs);
    }

    function enqueue(root) {
      const normalized = normalizeObservationRoot(root);
      if (!normalized) return;
      pending.add(normalized);
      schedule();
    }

    function observe(root) {
      const normalized = normalizeObservationRoot(root);
      if (!normalized || observers.has(normalized)) return;
      const target = normalized instanceof Document ? normalized : normalized;
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            enqueue(normalized);
            for (const node of mutation.addedNodes || []) {
              if (node instanceof Element || node instanceof ShadowRoot) enqueue(node.getRootNode?.() || normalized);
            }
          } else if (mutation.type === "attributes") {
            enqueue(mutation.target?.getRootNode?.() || normalized);
          }
        }
      });

      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "hidden",
          "open",
          "aria-hidden",
          "aria-expanded",
          "role",
          "data-theme",
          "data-color-mode",
          "data-testid"
        ]
      });
      observers.set(normalized, observer);
    }

    function syncTargets(roots = []) {
      const next = new Set(roots.map(normalizeObservationRoot).filter(Boolean));
      for (const [root, observer] of observers.entries()) {
        if (next.has(root)) continue;
        observer.disconnect();
        observers.delete(root);
      }
      for (const root of next) observe(root);
      if (!routeHandlerBound && typeof options.onRouteChange === "function") {
        patchHistory();
        routeHandlerBound = true;
        globalThis.addEventListener("holmeta-appearance-routechange", options.onRouteChange);
      }
    }

    function trigger(root) {
      enqueue(root);
    }

    function stop() {
      for (const observer of observers.values()) {
        observer.disconnect();
      }
      observers.clear();
      pending.clear();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (routeHandlerBound && typeof options.onRouteChange === "function") {
        globalThis.removeEventListener("holmeta-appearance-routechange", options.onRouteChange);
        routeHandlerBound = false;
      }
    }

    return {
      syncTargets,
      trigger,
      stop
    };
  }

  globalThis.HolmetaAppearanceMutationManager = {
    createManager
  };
})();
