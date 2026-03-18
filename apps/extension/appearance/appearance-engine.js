(() => {
  if (globalThis.HolmetaAppearanceEngine) return;

  const stateRef = globalThis.HolmetaAppearanceState;
  const detector = globalThis.HolmetaAppearanceThemeDetector;
  const remapper = globalThis.HolmetaAppearanceTokenRemapper;
  const normalizer = globalThis.HolmetaAppearanceNormalizer;
  const compat = globalThis.HolmetaAppearanceCompatibility;
  const mediaGuard = globalThis.HolmetaAppearanceMediaGuard;
  const siteRules = globalThis.HolmetaAppearanceSiteRules;
  const siteClassifier = globalThis.HolmetaAppearanceSiteClassifier;
  const colorEngine = globalThis.HolmetaAppearanceColor;
  const domScanner = globalThis.HolmetaAppearanceDomScanner;
  const tokenEngine = globalThis.HolmetaAppearanceTokenEngine;
  const protectionEngine = globalThis.HolmetaAppearanceProtectionEngine;
  const siteProfileLib = globalThis.HolmetaAppearanceSiteProfile;
  const repairMemory = globalThis.HolmetaAppearanceRepairMemory;
  const shadowDom = globalThis.HolmetaAppearanceShadowDom;
  const iframeHandler = globalThis.HolmetaAppearanceIframeHandler;
  const mutationManagerLib = globalThis.HolmetaAppearanceMutationManager;

  if (
    !stateRef || !detector || !remapper || !normalizer || !compat || !mediaGuard || !siteRules || !siteClassifier
    || !colorEngine || !domScanner || !tokenEngine || !protectionEngine || !siteProfileLib || !repairMemory
    || !shadowDom || !iframeHandler || !mutationManagerLib
  ) {
    console.error("[Holmeta appearance] dependency_missing");
    return;
  }

  const IDS = stateRef.IDS;
  const ATTR = stateRef.ATTR;
  const BOOT_STYLE_ID = "holmeta-appearance-boot-style-v1";
  const BOOT_ATTR = "data-holmeta-appearance-boot";
  const DOCUMENT_STYLE_ID = IDS.STYLE;

  const state = {
    enabled: false,
    appearance: "off",
    mode: "off",
    compatibilityMode: "normal",
    tokens: null,
    debug: false,
    manager: null,
    lastProfile: null,
    lastOptions: null,
    repairHost: "",
    repairProfile: null,
    repairFingerprintSynced: "",
    processedDocs: [],
    processedShadowRoots: [],
    diagnostics: createDiagnostics({ reason: "idle" })
  };

  function createDiagnostics(overrides = {}) {
    return {
      active: false,
      appearance: "off",
      mode: "off",
      host: "",
      pageTone: "mixed",
      luminance: 0.5,
      siteType: "general",
      siteClass: "general",
      compatibilityMode: "normal",
      tokenStrategy: "semantic-only",
      tokenConfidence: 0,
      tokenVariables: 0,
      tokenOverridesApplied: 0,
      scannedNodes: 0,
      components: 0,
      wrappers: 0,
      media: 0,
      protectedTotal: 0,
      protectedLogos: 0,
      protectedCharts: 0,
      protectedAvatars: 0,
      protectedStatusColors: 0,
      forcedSurfaces: 0,
      forcedText: 0,
      logoFixes: 0,
      shadowRoots: 0,
      sameOriginIframes: 0,
      repairProfileApplied: false,
      repairRules: 0,
      fingerprint: "",
      reason: "idle",
      ...overrides
    };
  }

  function getHost() {
    return String(location.hostname || "")
      .toLowerCase()
      .replace(/^www\./, "")
      .trim();
  }

  function siteKeyFromHost(host) {
    const safeHost = String(host || "").toLowerCase();
    if (!safeHost) return "";
    if (safeHost === "x.com" || safeHost.endsWith(".x.com") || safeHost === "twitter.com" || safeHost.endsWith(".twitter.com")) return "x";
    if (safeHost === "youtube.com" || safeHost.endsWith(".youtube.com")) return "youtube";
    if (safeHost === "github.com" || safeHost.endsWith(".github.com")) return "github";
    if (safeHost === "notion.so" || safeHost.endsWith(".notion.so")) return "notion";
    if (safeHost === "figma.com" || safeHost.endsWith(".figma.com")) return "figma";
    if (/((\.|^)amazon\.)/.test(safeHost)) return "amazon";
    if (safeHost === "claude.ai" || safeHost.endsWith(".claude.ai")) return "claude";
    if (safeHost === "stripe.com" || safeHost.endsWith(".stripe.com")) return "stripe";
    return "generic";
  }

  function clamp(value, min, max) {
    return colorEngine.clamp(value, min, max);
  }

  function normalizeAppearance(value) {
    const raw = String(value || "off").toLowerCase();
    if (raw === "auto") return "adaptive";
    if (["dark", "light", "adaptive"].includes(raw)) return raw;
    return "off";
  }

  function chooseAdaptiveMode(profile, context = {}) {
    const hinted = ["dark", "light"].includes(String(profile.mode || "").toLowerCase())
      ? String(profile.mode).toLowerCase()
      : "";
    const pageTone = String(context.pageTone?.tone || context.pageTone || "mixed");
    const siteType = String(context.siteType || "general");
    const scanSummary = context.scanSummary || {};

    if (pageTone === "dark") return "dark";
    if (pageTone === "light") return "light";
    if (hinted) return hinted;
    if (["dashboard_app", "social", "media", "ecommerce"].includes(siteType)) return "dark";
    if (["docs_code", "article"].includes(siteType)) return "light";
    return Number(scanSummary.averageLuminance || 0.5) < 0.5 ? "dark" : "light";
  }

  function resolveMode(profile, context = {}) {
    const appearance = normalizeAppearance(profile.appearance || profile.mode);
    if (appearance === "dark") return { appearance, mode: "dark" };
    if (appearance === "light") return { appearance, mode: "light" };
    if (appearance === "adaptive") {
      return {
        appearance,
        mode: chooseAdaptiveMode(profile, context)
      };
    }
    return { appearance: "off", mode: "off" };
  }

  function tuneIntensity(profile, mode, context = {}) {
    let intensity = clamp(Number(profile.intensity ?? 46), 18, 86);
    const pageTone = String(context.pageTone?.tone || context.pageTone || "mixed");
    const compatibilityMode = String(context.compatibilityMode || "normal");
    const summary = context.scanSummary || {};
    const adaptive = normalizeAppearance(profile.appearance || profile.mode) === "adaptive";

    if (compatibilityMode === "media-safe") intensity = Math.min(intensity, 38);
    if (compatibilityMode === "app-safe") intensity = Math.min(intensity, 54);
    if (compatibilityMode === "minimal") intensity = Math.min(intensity, 42);
    if (compatibilityMode === "code-safe") intensity = Math.min(intensity, 52);

    if (adaptive) {
      if ((mode === "dark" && pageTone === "dark") || (mode === "light" && pageTone === "light")) {
        intensity -= 12;
      }
      if (mode === "dark" && Number(summary.largeLightSurfaces || 0) >= 5) intensity += 8;
      if (mode === "light" && Number(summary.largeDarkSurfaces || 0) >= 5) intensity += 8;
      if (Number(summary.tokenSignals || 0) >= 10) intensity -= 4;
    }

    return Math.round(clamp(intensity, 18, 86));
  }

  function calibrateTokens(tokens, profile = {}, mode = "dark") {
    const next = { ...(tokens || {}) };
    const contrastStrength = clamp(
      Number(profile.contrastStrength ?? 52)
      + (profile.higherContrast ? 14 : 0)
      - (profile.softerSurfaces ? 4 : 0),
      0,
      100
    ) / 100;
    const surfaceStrength = clamp(
      Number(profile.surfaceStrength ?? 54)
      + (profile.higherContrast ? 6 : 0)
      - (profile.softerSurfaces ? 18 : 0),
      0,
      100
    ) / 100;

    if (mode === "dark") {
      const page = colorEngine.mix(next.pageBackground, "#0b0e12", 0.10 + (surfaceStrength * 0.06));
      next.pageBackground = page;
      next.pageBackgroundAlt = colorEngine.mix(page, "#ffffff", 0.024 + (surfaceStrength * 0.024));
      next.sidebarBackground = colorEngine.mix(page, "#ffffff", 0.034 + (surfaceStrength * 0.032));
      next.sectionBackground = colorEngine.mix(page, "#ffffff", 0.040 + (surfaceStrength * 0.038));
      next.panelBackground = colorEngine.mix(page, "#ffffff", 0.050 + (surfaceStrength * 0.046));
      next.cardBackground = colorEngine.mix(page, "#ffffff", 0.064 + (surfaceStrength * 0.056));
      next.elevatedBackground = colorEngine.mix(page, "#ffffff", 0.082 + (surfaceStrength * 0.064));
      next.modalBackground = colorEngine.mix(next.elevatedBackground, "#000000", 0.10);
      next.dropdownBackground = colorEngine.mix(next.panelBackground, "#000000", 0.06);
      next.inputBackground = colorEngine.mix(next.cardBackground, "#ffffff", 0.04 + (surfaceStrength * 0.028));
      next.buttonBackground = colorEngine.mix(next.elevatedBackground, "#ffffff", 0.03 + (surfaceStrength * 0.020));
      next.navHarmonizedBackground = colorEngine.mix(page, "#ffffff", 0.028 + (surfaceStrength * 0.030));
      next.textSecondary = colorEngine.mix(next.textSecondary, next.textPrimary, 0.06 + (contrastStrength * 0.16));
      next.textMuted = colorEngine.mix(next.textMuted, next.textPrimary, 0.03 + (contrastStrength * 0.10));
      next.lineSubtle = colorEngine.withAlpha(next.textPrimary, 0.024 + (contrastStrength * 0.020));
      next.lineStrong = colorEngine.withAlpha(next.textPrimary, 0.050 + (contrastStrength * 0.025));
      next.rowSeparator = colorEngine.withAlpha(next.textPrimary, 0.032 + (contrastStrength * 0.020));
      next.borderSubtle = colorEngine.withAlpha(next.textPrimary, 0.028 + (contrastStrength * 0.018));
      next.borderStrong = colorEngine.withAlpha(next.textPrimary, 0.058 + (contrastStrength * 0.022));
    } else {
      const page = colorEngine.mix(next.pageBackground, "#fbfaf7", 0.22);
      next.pageBackground = page;
      next.pageBackgroundAlt = colorEngine.mix(page, "#ffffff", 0.18 + (surfaceStrength * 0.12));
      next.sidebarBackground = colorEngine.mix(page, "#ffffff", 0.10 + (surfaceStrength * 0.10));
      next.sectionBackground = colorEngine.mix(page, "#ffffff", 0.12 + (surfaceStrength * 0.12));
      next.panelBackground = colorEngine.mix(page, next.accent || "#ffffff", 0.04 + (surfaceStrength * 0.05));
      next.cardBackground = colorEngine.mix(page, "#ffffff", 0.18 + (surfaceStrength * 0.16));
      next.elevatedBackground = colorEngine.mix(next.cardBackground, "#ffffff", 0.10 + (surfaceStrength * 0.12));
      next.modalBackground = colorEngine.mix(next.elevatedBackground, "#ffffff", 0.12);
      next.dropdownBackground = colorEngine.mix(next.cardBackground, "#ffffff", 0.10);
      next.inputBackground = colorEngine.mix(next.cardBackground, "#ffffff", 0.12 + (surfaceStrength * 0.10));
      next.buttonBackground = colorEngine.mix(next.elevatedBackground, next.accent || "#ffffff", 0.03 + (surfaceStrength * 0.05));
      next.navHarmonizedBackground = colorEngine.mix(page, next.accent || "#ffffff", 0.04 + (surfaceStrength * 0.04));
      next.textSecondary = colorEngine.mix(next.textSecondary, next.textPrimary, 0.04 + (contrastStrength * 0.12));
      next.textMuted = colorEngine.mix(next.textMuted, next.textPrimary, 0.02 + (contrastStrength * 0.08));
      next.lineSubtle = colorEngine.withAlpha(next.textPrimary, 0.10 + (contrastStrength * 0.06));
      next.lineStrong = colorEngine.withAlpha(next.textPrimary, 0.16 + (contrastStrength * 0.08));
      next.rowSeparator = colorEngine.withAlpha(next.textPrimary, 0.12 + (contrastStrength * 0.06));
      next.borderSubtle = colorEngine.withAlpha(next.textPrimary, 0.12 + (contrastStrength * 0.06));
      next.borderStrong = colorEngine.withAlpha(next.textPrimary, 0.18 + (contrastStrength * 0.08));
    }

    const tokenOverrides = profile.tokenOverrides && typeof profile.tokenOverrides === "object"
      ? profile.tokenOverrides
      : {};
    for (const [key, value] of Object.entries(tokenOverrides)) {
      if (!key.startsWith("--") && Object.prototype.hasOwnProperty.call(next, key)) {
        next[key] = value;
      }
    }

    return next;
  }

  function ensureDocumentStyle(doc = document) {
    const root = doc.documentElement;
    if (!root) return null;
    const nodes = doc.querySelectorAll?.(`#${DOCUMENT_STYLE_ID}`) || [];
    if (nodes.length > 1) {
      nodes.forEach((node, index) => {
        if (index > 0) node.remove();
      });
    }
    let styleNode = doc.getElementById?.(DOCUMENT_STYLE_ID);
    if (!styleNode) {
      styleNode = doc.createElement("style");
      styleNode.id = DOCUMENT_STYLE_ID;
      (doc.head || root).appendChild(styleNode);
    }
    const css = remapper.cssText();
    if (styleNode.textContent !== css) {
      styleNode.textContent = css;
    }
    return styleNode;
  }

  function buildShadowCssText() {
    return `
:host([${ATTR.ACTIVE}='1']) {
  color-scheme: var(--holmeta-appearance-scheme, dark) !important;
  color: var(--holmeta-appearance-text-primary) !important;
}

:host([${ATTR.ACTIVE}='1']) :where(*) {
  border-color: var(--holmeta-appearance-line-subtle) !important;
}

:host([${ATTR.ACTIVE}='1']) :where([${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='surface'], [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='panel'], [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='card']) {
  background-color: var(--holmeta-appearance-card-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
}

:host([${ATTR.ACTIVE}='1']) :where([${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='header'], [${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='nav']) {
  background-color: var(--holmeta-appearance-nav-harmonized-background) !important;
  color: var(--holmeta-appearance-nav-harmonized-text) !important;
}

:host([${ATTR.ACTIVE}='1']) :where(button, [role='button'], [role='tab']) {
  background-color: var(--holmeta-appearance-button-background) !important;
  color: var(--holmeta-appearance-button-text) !important;
  border-color: var(--holmeta-appearance-button-border) !important;
  box-shadow: none !important;
}

:host([${ATTR.ACTIVE}='1']) :where([${ATTR.SURFACE}='1'][${ATTR.COMPONENT}='icon_button']) {
  background-color: transparent !important;
  color: var(--holmeta-appearance-icon-primary) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

:host([${ATTR.ACTIVE}='1']) :where(input, textarea, select, [role='textbox']) {
  background-color: var(--holmeta-appearance-input-background) !important;
  color: var(--holmeta-appearance-text-primary) !important;
  border-color: var(--holmeta-appearance-input-border) !important;
}

:host([${ATTR.ACTIVE}='1']) :where([${ATTR.FORCE_TEXT}='light'], [${ATTR.FORCE_TEXT}='light'] *) {
  color: var(--holmeta-appearance-contrast-on-dark) !important;
}

:host([${ATTR.ACTIVE}='1']) :where([${ATTR.FORCE_TEXT}='dark'], [${ATTR.FORCE_TEXT}='dark'] *) {
  color: var(--holmeta-appearance-contrast-on-light) !important;
}

:host([${ATTR.ACTIVE}='1']) :where([${ATTR.MEDIA_SAFE}='1'], [${ATTR.MEDIA_SAFE}='1'] *) {
  filter: none !important;
  mix-blend-mode: normal !important;
}
`;
  }

  function clearBootStyle(doc = document) {
    const node = doc.getElementById?.(BOOT_STYLE_ID);
    if (node) node.remove();
    doc.documentElement?.removeAttribute(BOOT_ATTR);
  }

  function collectTargets() {
    const documents = [document, ...iframeHandler.collectSameOriginDocuments(document)];
    const uniqueDocs = [...new Set(documents.filter((doc) => doc instanceof Document && doc.documentElement))];
    const shadowRoots = [];
    const seenShadowRoots = new Set();
    for (const doc of uniqueDocs) {
      for (const root of shadowDom.collectOpenRoots(doc)) {
        if (!(root instanceof ShadowRoot) || seenShadowRoots.has(root)) continue;
        seenShadowRoots.add(root);
        shadowRoots.push(root);
      }
    }
    return { documents: uniqueDocs, shadowRoots };
  }

  function clearProcessedRoots() {
    for (const shadowRoot of state.processedShadowRoots || []) {
      shadowDom.clearStyle(shadowRoot);
      normalizer.clearRoot(shadowRoot);
      if (shadowRoot.host instanceof Element) {
        remapper.clearRootTokens(shadowRoot.host);
      }
    }

    for (const doc of state.processedDocs || []) {
      normalizer.clearRoot(doc);
      tokenEngine.clear(doc.documentElement);
      remapper.clearRootTokens(doc.documentElement);
      clearBootStyle(doc);
    }

    state.processedDocs = [];
    state.processedShadowRoots = [];
  }

  function applySelectorGuards(root, profile = {}) {
    const base = root instanceof Document ? root.documentElement : root;
    if (!(base instanceof Element || base instanceof ShadowRoot)) return 0;

    const selectors = [
      ...(Array.isArray(profile.preservedSelectors) ? profile.preservedSelectors : []),
      ...(Array.isArray(profile.excludedSelectors) ? profile.excludedSelectors : [])
    ];

    let count = 0;
    for (const selector of selectors) {
      if (!selector) continue;
      let nodes = [];
      try {
        nodes = base.querySelectorAll(selector);
      } catch {
        continue;
      }
      for (const node of nodes) {
        if (!(node instanceof Element)) continue;
        node.setAttribute(ATTR.MEDIA_SAFE, "1");
        node.setAttribute(ATTR.OWNED, "1");
        count += 1;
      }
    }
    return count;
  }

  function applyTargetStyles(documents, shadowRoots, context) {
    const siteKey = siteKeyFromHost(context.host);
    const documentReports = [];

    for (const doc of documents) {
      ensureDocumentStyle(doc);
      clearBootStyle(doc);
      remapper.applyRootTokens(doc.documentElement, context.tokens, context.compatibility.mode, siteKey, context.siteClass, context.rootOptions);
      const detection = tokenEngine.detect(doc, context.tokens, {
        siteType: context.siteType,
        siteClass: context.siteClass
      });
      const cssVarOverrides = Object.fromEntries(
        Object.entries(context.effectiveProfile.tokenOverrides || {})
          .filter(([key, value]) => key.startsWith("--") && String(value || "").trim())
      );
      const applyResult = tokenEngine.apply(doc.documentElement, detection, cssVarOverrides);
      documentReports.push({ detection, applyResult });
    }

    const shadowCss = buildShadowCssText();
    for (const shadowRoot of shadowRoots) {
      if (!(shadowRoot.host instanceof Element)) continue;
      shadowDom.injectStyle(shadowRoot, shadowCss);
      remapper.applyRootTokens(shadowRoot.host, context.tokens, context.compatibility.mode, siteKey, context.siteClass, context.rootOptions);
    }

    return documentReports;
  }

  function processRoot(root, context) {
    const scanLimitByMode = {
      "media-safe": 900,
      minimal: 1800,
      "app-safe": 2600,
      "code-safe": 2200,
      normal: 3200
    };
    const coherenceLimitByMode = {
      "media-safe": 180,
      minimal: 240,
      "app-safe": 340,
      "code-safe": 280,
      normal: 420
    };

    const scanRecords = domScanner.scan(root, {
      maxNodes: scanLimitByMode[context.compatibility.mode] || 2800
    });
    const manualGuards = applySelectorGuards(root, context.effectiveProfile);
    const protection = protectionEngine.protect(root, scanRecords, {
      preserveImages: context.effectiveProfile.preserveImages,
      preserveLogos: context.effectiveProfile.preserveLogos
    });
    protection.preservedSelectors = manualGuards;
    protection.protectedTotal += manualGuards;

    const normalized = normalizer.normalizeRoot(root, {
      maxComponents: scanLimitByMode[context.compatibility.mode] || 2800,
      host: context.host
    });
    const coherence = normalizer.coherencePass(root, {
      mode: context.mode,
      tokens: context.tokens,
      maxNodes: coherenceLimitByMode[context.compatibility.mode] || 360
    }) || { forcedSurfaces: 0, forcedText: 0, logos: 0 };

    return {
      scanSummary: domScanner.summarize(scanRecords),
      scannedNodes: scanRecords.length,
      protection,
      normalized,
      coherence
    };
  }

  function accumulateReports(reports = []) {
    return reports.reduce((acc, report) => {
      acc.scannedNodes += Number(report.scannedNodes || 0);
      acc.components += Number(report.normalized?.components || 0);
      acc.wrappers += Number(report.normalized?.wrappers || 0);
      acc.media += Number(report.normalized?.media || 0);
      acc.protectedTotal += Number(report.protection?.protectedTotal || 0);
      acc.protectedLogos += Number(report.protection?.logos || 0);
      acc.protectedCharts += Number(report.protection?.charts || 0);
      acc.protectedAvatars += Number(report.protection?.avatars || 0);
      acc.protectedStatusColors += Number(report.protection?.statusColors || 0);
      acc.repairRules += Number(report.protection?.preservedSelectors || 0);
      acc.forcedSurfaces += Number(report.coherence?.forcedSurfaces || 0);
      acc.forcedText += Number(report.coherence?.forcedText || 0);
      acc.logoFixes += Number(report.coherence?.logos || 0);
      return acc;
    }, {
      scannedNodes: 0,
      components: 0,
      wrappers: 0,
      media: 0,
      protectedTotal: 0,
      protectedLogos: 0,
      protectedCharts: 0,
      protectedAvatars: 0,
      protectedStatusColors: 0,
      repairRules: 0,
      forcedSurfaces: 0,
      forcedText: 0,
      logoFixes: 0
    });
  }

  function ensureManager() {
    if (state.manager) return state.manager;
    const routeRefresh = () => {
      if (!state.enabled || !state.lastProfile) return;
      apply(state.lastProfile, { ...(state.lastOptions || {}), routeRefresh: true });
    };
    state.manager = mutationManagerLib.createManager((roots) => {
      if (!state.enabled) return;
      const targets = collectTargets();
      const knownRoots = new Set([...state.processedDocs, ...state.processedShadowRoots]);
      const nextObservedRoots = [...targets.documents, ...targets.shadowRoots];
      state.manager.syncTargets(nextObservedRoots);
      const toProcess = [...new Set([
        ...roots,
        ...nextObservedRoots.filter((root) => !knownRoots.has(root))
      ])];
      for (const root of toProcess) {
        if (root instanceof Document) ensureDocumentStyle(root);
        if (root instanceof ShadowRoot) shadowDom.injectStyle(root, buildShadowCssText());
        processRoot(root, {
          host: state.diagnostics.host,
          mode: state.mode,
          tokens: state.tokens,
          compatibility: { mode: state.compatibilityMode },
          effectiveProfile: state.lastResolvedProfile || {}
        });
      }
      state.processedDocs = targets.documents;
      state.processedShadowRoots = targets.shadowRoots;
    }, {
      debounceMs: 170,
      onRouteChange: routeRefresh
    });
    return state.manager;
  }

  function syncRepairMemory(host, siteProfile, effectiveProfile) {
    if (!host || effectiveProfile.repairMemory?.enabled === false) return;
    const fingerprint = String(siteProfile?.fingerprint || "");
    if (!fingerprint || fingerprint === state.repairFingerprintSynced) return;
    state.repairFingerprintSynced = fingerprint;
    repairMemory.update(host, { fingerprint }).catch(() => {
      // Ignore storage failures in release mode.
    });
  }

  function apply(profile = {}, options = {}) {
    state.lastProfile = profile;
    state.lastOptions = options;

    const host = getHost();
    const resolved = siteRules.resolveProfile(profile, host);
    if (resolved.excluded) {
      clear();
      state.diagnostics = createDiagnostics({ host, reason: "site-excluded" });
      return { ...state.diagnostics };
    }

    const baseProfile = resolved.profile || {};
    if (!Boolean(baseProfile.enabled)) {
      clear();
      return { ...state.diagnostics };
    }

    const media = mediaGuard.countMedia(document);
    const pageTone = detector.detectTone();
    const siteType = detector.detectSiteType(host, media);
    const previewRecords = domScanner.scan(document, { maxNodes: 320 });
    const previewSummary = domScanner.summarize(previewRecords);
    const classification = siteClassifier.classify({ host, siteType, pageTone });
    const siteClass = classification.siteClass || "general";
    const compatibility = compat.resolveCompatibility({ host, siteType, media, pageTone });

    if (baseProfile.repairMemory?.enabled !== false && host) {
      if (state.repairHost !== host) {
        state.repairHost = host;
        repairMemory.prime(host, {
          seed: baseProfile,
          onReady: (loadedProfile) => {
            state.repairProfile = loadedProfile;
            if (state.enabled && state.lastProfile && getHost() === host) {
              apply(state.lastProfile, { ...(state.lastOptions || {}), repairHydrated: true });
            }
          }
        }).catch(() => {
          state.repairProfile = null;
        });
      }
    } else {
      state.repairHost = "";
      state.repairProfile = null;
    }

    const cachedRepair = baseProfile.repairMemory?.enabled === false
      ? null
      : (repairMemory.getCached(host) || state.repairProfile);
    const effectiveProfile = cachedRepair
      ? repairMemory.mergeProfile(baseProfile, cachedRepair)
      : baseProfile;
    state.lastResolvedProfile = effectiveProfile;

    const resolvedMode = resolveMode(effectiveProfile, {
      pageTone,
      siteType,
      scanSummary: previewSummary
    });
    if (resolvedMode.mode === "off") {
      clear();
      return { ...state.diagnostics };
    }

    const tunedIntensity = tuneIntensity(effectiveProfile, resolvedMode.mode, {
      pageTone,
      scanSummary: previewSummary,
      compatibilityMode: compatibility.mode
    });

    let tokens = stateRef.toTokens({
      mode: resolvedMode.mode,
      darkVariant: stateRef.normalizeDarkVariant(effectiveProfile.darkVariant || effectiveProfile.darkThemeVariant || "coal"),
      lightVariant: stateRef.normalizeLightVariant(effectiveProfile.lightVariant || effectiveProfile.lightThemeVariant || "white"),
      intensity: tunedIntensity,
      siteClass,
      pageTone: pageTone.tone,
      compatibilityMode: compatibility.mode
    });
    tokens = calibrateTokens(tokens, effectiveProfile, resolvedMode.mode);

    clearProcessedRoots();

    const targets = collectTargets();
    const documentReports = applyTargetStyles(targets.documents, targets.shadowRoots, {
      host,
      siteClass,
      siteType,
      compatibility,
      tokens,
      effectiveProfile,
      rootOptions: {
        opaqueBackground: Boolean(effectiveProfile.opaqueBackground),
        pointerCursors: Boolean(effectiveProfile.pointerCursors),
        sansFontSize: Number(effectiveProfile.sansFontSize),
        sansFontFamily: String(effectiveProfile.sansFontFamily || ""),
        codeFontSize: Number(effectiveProfile.codeFontSize),
        codeFontFamily: String(effectiveProfile.codeFontFamily || "")
      }
    });

    const rootReports = [
      ...targets.documents.map((doc) => processRoot(doc, {
        host,
        mode: resolvedMode.mode,
        tokens,
        compatibility,
        effectiveProfile
      })),
      ...targets.shadowRoots.map((root) => processRoot(root, {
        host,
        mode: resolvedMode.mode,
        tokens,
        compatibility,
        effectiveProfile
      }))
    ];

    const totals = accumulateReports(rootReports);
    const mainTokenDetection = documentReports[0]?.detection || { confidence: 0, variableCount: 0, strategy: "semantic-only" };
    const tokenOverridesApplied = documentReports.reduce((sum, entry) => sum + Number(entry.applyResult?.applied || 0), 0);
    const siteProfile = siteProfileLib.build({
      host,
      pageTone: pageTone.tone,
      siteType,
      siteClass,
      scanSummary: previewSummary,
      tokenDetection: mainTokenDetection,
      media
    });
    syncRepairMemory(host, siteProfile, effectiveProfile);

    state.enabled = true;
    state.appearance = resolvedMode.appearance;
    state.mode = resolvedMode.mode;
    state.compatibilityMode = compatibility.mode;
    state.tokens = tokens;
    state.processedDocs = targets.documents;
    state.processedShadowRoots = targets.shadowRoots;

    const manager = ensureManager();
    manager.syncTargets([...targets.documents, ...targets.shadowRoots]);

    state.diagnostics = createDiagnostics({
      active: true,
      appearance: resolvedMode.appearance,
      mode: resolvedMode.mode,
      host,
      pageTone: pageTone.tone,
      luminance: pageTone.luminance,
      siteType,
      siteClass,
      compatibilityMode: compatibility.mode,
      tokenStrategy: mainTokenDetection.strategy || "semantic-only",
      tokenConfidence: Number(mainTokenDetection.confidence || 0),
      tokenVariables: Number(mainTokenDetection.variableCount || 0),
      tokenOverridesApplied,
      scannedNodes: totals.scannedNodes,
      components: totals.components,
      wrappers: totals.wrappers,
      media: totals.media,
      protectedTotal: totals.protectedTotal,
      protectedLogos: totals.protectedLogos,
      protectedCharts: totals.protectedCharts,
      protectedAvatars: totals.protectedAvatars,
      protectedStatusColors: totals.protectedStatusColors,
      forcedSurfaces: totals.forcedSurfaces,
      forcedText: totals.forcedText,
      logoFixes: totals.logoFixes,
      shadowRoots: targets.shadowRoots.length,
      sameOriginIframes: Math.max(0, targets.documents.length - 1),
      repairProfileApplied: Boolean(cachedRepair),
      repairRules: totals.repairRules + Number((cachedRepair?.preservedSelectors || []).length) + Number((cachedRepair?.excludedSelectors || []).length),
      fingerprint: siteProfile.fingerprint,
      reason: resolved.usingSiteOverride ? "site-override" : (compatibility.reason || "applied")
    });

    if (state.debug || options.debug) {
      console.info("[Holmeta appearance]", {
        appearance: state.appearance,
        mode: state.mode,
        host,
        pageTone,
        siteType,
        siteClass,
        compatibility,
        previewSummary,
        tokenDetection: mainTokenDetection,
        diagnostics: state.diagnostics
      });
    }

    return { ...state.diagnostics };
  }

  function clear() {
    if (state.manager) {
      state.manager.stop();
      state.manager = null;
    }
    clearProcessedRoots();
    clearBootStyle(document);
    state.enabled = false;
    state.appearance = "off";
    state.mode = "off";
    state.compatibilityMode = "normal";
    state.tokens = null;
    state.lastResolvedProfile = null;
    state.diagnostics = createDiagnostics({ host: getHost(), reason: "cleared" });
    return { ...state.diagnostics };
  }

  function triggerRefresh() {
    if (!state.manager) return;
    state.manager.trigger(document);
  }

  function setDebug(value) {
    state.debug = Boolean(value);
  }

  function getDiagnostics() {
    return { ...state.diagnostics };
  }

  globalThis.HolmetaAppearanceEngine = {
    apply,
    clear,
    triggerRefresh,
    setDebug,
    getDiagnostics
  };
})();
