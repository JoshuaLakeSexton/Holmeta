(() => {
  if (globalThis.HolmetaAppearanceTokenEngine) return;

  const colorEngine = globalThis.HolmetaAppearanceColor;
  const appliedVarsByRoot = new WeakMap();

  const CATEGORY_PATTERNS = [
    { category: "background", pattern: /(^|[-_])(bg|background|page|base|canvas)([-_]|$)/i },
    { category: "surface", pattern: /(^|[-_])(surface|panel|shell|container|layer)([-_]|$)/i },
    { category: "card", pattern: /(^|[-_])(card|tile|module|popover|modal)([-_]|$)/i },
    { category: "text", pattern: /(^|[-_])(text|foreground|font|copy|content)([-_]|$)/i },
    { category: "muted", pattern: /(^|[-_])(muted|subtle|secondary|tertiary|hint|placeholder)([-_]|$)/i },
    { category: "border", pattern: /(^|[-_])(border|line|stroke|separator|divider|outline)([-_]|$)/i },
    { category: "accent", pattern: /(^|[-_])(accent|primary|brand|link|interactive)([-_]|$)/i },
    { category: "ring", pattern: /(^|[-_])(ring|focus|shadow-focus)([-_]|$)/i },
    { category: "success", pattern: /(^|[-_])(success|positive|confirm|ok)([-_]|$)/i },
    { category: "warning", pattern: /(^|[-_])(warning|warn|caution|pending)([-_]|$)/i },
    { category: "danger", pattern: /(^|[-_])(danger|error|destructive|negative)([-_]|$)/i }
  ];

  function getBase(root) {
    if (root instanceof Document) return root.documentElement;
    if (root instanceof Element) return root;
    return document.documentElement;
  }

  function getDoc(root) {
    return root instanceof Document ? root : root?.ownerDocument || document;
  }

  function isColorLike(value) {
    return Boolean(colorEngine?.parseColor?.(value));
  }

  function collectScopeElements(doc) {
    const scopes = [doc.documentElement, doc.body];
    const extras = doc.querySelectorAll(
      "#app, #root, #__next, #__nuxt, [data-reactroot], [data-app-root], [class*='app-shell' i], [class*='layout' i], [role='main']"
    );
    for (const node of extras) {
      if (!(node instanceof Element)) continue;
      if (scopes.includes(node)) continue;
      scopes.push(node);
      if (scopes.length >= 8) break;
    }
    return scopes.filter(Boolean);
  }

  function collectScopeVariables(scope, limit = 220) {
    const style = scope?.ownerDocument?.defaultView?.getComputedStyle?.(scope);
    if (!style) return [];
    const out = [];
    for (let index = 0; index < style.length; index += 1) {
      if (out.length >= limit) break;
      const key = String(style[index] || "");
      if (!key.startsWith("--")) continue;
      const value = String(style.getPropertyValue(key) || "").trim();
      if (!value || !isColorLike(value)) continue;
      out.push({ name: key, value, source: scope.tagName?.toLowerCase?.() || "scope" });
    }
    return out;
  }

  function collectStylesheetVariables(doc, limit = 280) {
    const out = [];
    for (const sheet of Array.from(doc.styleSheets || [])) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (out.length >= limit) return out;
        const style = rule?.style;
        if (!style) continue;
        for (let index = 0; index < style.length; index += 1) {
          if (out.length >= limit) return out;
          const key = String(style[index] || "");
          if (!key.startsWith("--")) continue;
          const value = String(style.getPropertyValue(key) || "").trim();
          if (!value || !isColorLike(value)) continue;
          out.push({ name: key, value, source: rule.selectorText || "rule" });
        }
      }
    }
    return out;
  }

  function inferCategory(name, value) {
    const key = String(name || "").toLowerCase();
    let winner = { category: "", score: 0 };
    for (const entry of CATEGORY_PATTERNS) {
      if (!entry.pattern.test(key)) continue;
      let score = 0.58;
      if (/primary|brand|accent|background|surface|card|text/.test(key)) score += 0.08;
      if ((entry.category === "background" || entry.category === "surface" || entry.category === "card") && colorEngine?.isNearNeutral?.(value, 0.22)) score += 0.12;
      if ((entry.category === "accent" || entry.category === "success" || entry.category === "warning" || entry.category === "danger") && colorEngine?.isLikelyAccent?.(value)) score += 0.12;
      if (score > winner.score) winner = { category: entry.category, score: Math.min(0.98, score) };
    }
    return winner;
  }

  function resolveTokenValue(category, tokens) {
    switch (category) {
      case "background": return tokens.pageBackground || tokens.pageBase;
      case "surface": return tokens.panelBackground || tokens.sectionBackground || tokens.surface1;
      case "card": return tokens.cardBackground || tokens.elevatedBackground || tokens.surface2;
      case "text": return tokens.textPrimary;
      case "muted": return tokens.textMuted || tokens.textSecondary;
      case "border": return tokens.lineSubtle || tokens.borderSubtle || tokens.borderSoft;
      case "accent": return tokens.accent || tokens.link;
      case "ring": return tokens.focusRing || tokens.accentStrong || tokens.link;
      case "success": return tokens.success;
      case "warning": return tokens.warning;
      case "danger": return tokens.danger;
      default: return null;
    }
  }

  function detect(root = document.documentElement, tokens = {}, options = {}) {
    const doc = getDoc(root);
    const scopes = collectScopeElements(doc);
    const variableMap = new Map();

    for (const entry of collectStylesheetVariables(doc)) {
      if (!variableMap.has(entry.name)) variableMap.set(entry.name, entry);
    }
    for (const scope of scopes) {
      for (const entry of collectScopeVariables(scope)) {
        if (!variableMap.has(entry.name)) variableMap.set(entry.name, entry);
      }
    }

    const categories = {};
    for (const variable of variableMap.values()) {
      const inferred = inferCategory(variable.name, variable.value);
      if (!inferred.category || inferred.score < 0.58) continue;
      const current = categories[inferred.category];
      if (!current || inferred.score > current.confidence) {
        categories[inferred.category] = {
          name: variable.name,
          source: variable.source,
          value: variable.value,
          confidence: inferred.score
        };
      }
    }

    let matched = 0;
    let confidenceTotal = 0;
    const overrides = {};
    for (const [category, entry] of Object.entries(categories)) {
      const nextValue = resolveTokenValue(category, tokens);
      if (!nextValue || entry.confidence < 0.6) continue;
      overrides[entry.name] = nextValue;
      matched += 1;
      confidenceTotal += entry.confidence;
    }

    return {
      variableCount: variableMap.size,
      scopeCount: scopes.length,
      categories,
      overrides,
      confidence: matched ? Number((confidenceTotal / matched).toFixed(3)) : 0,
      strategy: matched ? "token-remap" : "semantic-only",
      siteType: String(options.siteType || "general")
    };
  }

  function apply(root = document.documentElement, detection = null, extraOverrides = null) {
    const target = getBase(root);
    if (!target) return { applied: 0 };
    clear(target);
    const merged = {
      ...(detection?.overrides || {}),
      ...(extraOverrides && typeof extraOverrides === "object" ? extraOverrides : {})
    };
    const keys = Object.keys(merged);
    for (const key of keys) {
      const value = String(merged[key] || "").trim();
      if (!key.startsWith("--") || !value) continue;
      target.style.setProperty(key, value);
    }
    appliedVarsByRoot.set(target, keys.filter((key) => key.startsWith("--")));
    return { applied: keys.length };
  }

  function clear(root = document.documentElement) {
    const target = getBase(root);
    if (!target) return;
    const keys = appliedVarsByRoot.get(target) || [];
    for (const key of keys) {
      target.style.removeProperty(key);
    }
    appliedVarsByRoot.delete(target);
  }

  globalThis.HolmetaAppearanceTokenEngine = {
    detect,
    apply,
    clear
  };
})();
