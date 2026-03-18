(() => {
  if (globalThis.HolmetaAppearanceRepairMemory) return;

  const STORAGE_PREFIX = "holmeta-appearance-repair-v1:";
  const cache = new Map();
  const pending = new Map();

  function normalizeHost(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function normalizeSelectorList(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .slice(0, 64))];
  }

  function normalizeTokenOverrides(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, token]) => [String(key || "").trim(), String(token || "").trim()])
        .filter(([key, token]) => key.length > 0 && token.length > 0)
        .slice(0, 32)
    );
  }

  function normalizeProfile(input = {}) {
    const raw = input && typeof input === "object" ? input : {};
    return {
      preserveImages: raw.preserveImages !== false,
      preserveLogos: raw.preserveLogos !== false,
      higherContrast: Boolean(raw.higherContrast),
      softerSurfaces: Boolean(raw.softerSurfaces),
      contrastStrength: Math.round(clamp(raw.contrastStrength ?? 52, 0, 100)),
      surfaceStrength: Math.round(clamp(raw.surfaceStrength ?? 54, 0, 100)),
      preservedSelectors: normalizeSelectorList(raw.preservedSelectors),
      excludedSelectors: normalizeSelectorList(raw.excludedSelectors),
      tokenOverrides: normalizeTokenOverrides(raw.tokenOverrides),
      fingerprint: String(raw.fingerprint || ""),
      updatedAt: Number(raw.updatedAt || Date.now()),
      repairMemory: {
        enabled: raw.repairMemory?.enabled !== false
      }
    };
  }

  function mergeProfile(base = {}, patch = {}) {
    const left = normalizeProfile(base);
    const right = normalizeProfile(patch);
    return {
      ...left,
      ...right,
      preserveImages: right.preserveImages,
      preserveLogos: right.preserveLogos,
      higherContrast: right.higherContrast,
      softerSurfaces: right.softerSurfaces,
      contrastStrength: Number.isFinite(Number(patch.contrastStrength)) ? right.contrastStrength : left.contrastStrength,
      surfaceStrength: Number.isFinite(Number(patch.surfaceStrength)) ? right.surfaceStrength : left.surfaceStrength,
      preservedSelectors: [...new Set([...(left.preservedSelectors || []), ...(patch.preservedSelectors ? right.preservedSelectors : [])])],
      excludedSelectors: [...new Set([...(left.excludedSelectors || []), ...(patch.excludedSelectors ? right.excludedSelectors : [])])],
      tokenOverrides: {
        ...(left.tokenOverrides || {}),
        ...(patch.tokenOverrides ? right.tokenOverrides : {})
      },
      fingerprint: String(patch.fingerprint || left.fingerprint || ""),
      updatedAt: Date.now(),
      repairMemory: {
        enabled: patch.repairMemory?.enabled !== false && left.repairMemory?.enabled !== false
      }
    };
  }

  function storageKey(host) {
    return `${STORAGE_PREFIX}${normalizeHost(host)}`;
  }

  function localGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function localSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota and privacy mode errors.
    }
  }

  function readStorage(key) {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.local;
      if (!storage?.get) {
        resolve(localGet(key));
        return;
      }
      storage.get(key, (result) => {
        const error = globalThis.chrome?.runtime?.lastError;
        if (error) {
          resolve(localGet(key));
          return;
        }
        resolve(result?.[key] || null);
      });
    });
  }

  function writeStorage(key, value) {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.local;
      if (!storage?.set) {
        localSet(key, value);
        resolve();
        return;
      }
      storage.set({ [key]: value }, () => {
        const error = globalThis.chrome?.runtime?.lastError;
        if (error) {
          localSet(key, value);
        }
        resolve();
      });
    });
  }

  function removeStorage(key) {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.local;
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore.
      }
      if (!storage?.remove) {
        resolve();
        return;
      }
      storage.remove(key, () => resolve());
    });
  }

  function getCached(host) {
    const safeHost = normalizeHost(host);
    return safeHost ? (cache.get(safeHost) || null) : null;
  }

  function prime(host, options = {}) {
    const safeHost = normalizeHost(host);
    if (!safeHost) return Promise.resolve(null);
    if (cache.has(safeHost)) return Promise.resolve(cache.get(safeHost));
    if (pending.has(safeHost)) return pending.get(safeHost);

    const request = readStorage(storageKey(safeHost))
      .then((stored) => {
        const normalized = normalizeProfile(stored || options.seed || {});
        cache.set(safeHost, normalized);
        pending.delete(safeHost);
        if (typeof options.onReady === "function") {
          try {
            options.onReady(normalized);
          } catch {
            // Ignore callback errors.
          }
        }
        return normalized;
      })
      .catch(() => {
        const fallback = normalizeProfile(options.seed || {});
        cache.set(safeHost, fallback);
        pending.delete(safeHost);
        return fallback;
      });

    pending.set(safeHost, request);
    return request;
  }

  function update(host, patch = {}) {
    const safeHost = normalizeHost(host);
    if (!safeHost) return Promise.resolve(null);
    const next = mergeProfile(cache.get(safeHost) || {}, patch);
    cache.set(safeHost, next);
    return writeStorage(storageKey(safeHost), next).then(() => next);
  }

  function clear(host) {
    const safeHost = normalizeHost(host);
    if (!safeHost) return Promise.resolve();
    cache.delete(safeHost);
    pending.delete(safeHost);
    return removeStorage(storageKey(safeHost));
  }

  globalThis.HolmetaAppearanceRepairMemory = {
    normalizeProfile,
    mergeProfile,
    getCached,
    prime,
    update,
    clear
  };
})();
