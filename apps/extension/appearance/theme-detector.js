(() => {
  if (globalThis.HolmetaAppearanceThemeDetector) return;

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function colorToRgb(color) {
    if (!color || color === "transparent") return null;
    const rgbaMatch = String(color).match(/rgba?\(([^)]+)\)/i);
    if (rgbaMatch) {
      const parts = rgbaMatch[1].split(",").map((part) => Number(part.trim()));
      if (parts.length >= 3) {
        return {
          r: clamp(parts[0], 0, 255),
          g: clamp(parts[1], 0, 255),
          b: clamp(parts[2], 0, 255),
          a: Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1
        };
      }
    }
    const hex = String(color).trim().replace(/^#/, "");
    if (hex.length === 3) {
      return {
        r: parseInt(`${hex[0]}${hex[0]}`, 16),
        g: parseInt(`${hex[1]}${hex[1]}`, 16),
        b: parseInt(`${hex[2]}${hex[2]}`, 16),
        a: 1
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1
      };
    }
    return null;
  }

  function luminanceFromRgb(rgb) {
    if (!rgb) return 1;
    const channels = [rgb.r, rgb.g, rgb.b].map((n) => {
      const v = n / 255;
      return v <= 0.03928
        ? v / 12.92
        : ((v + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  }

  function elementLuminance(el) {
    if (!el || typeof getComputedStyle !== "function") return 1;
    const style = getComputedStyle(el);
    const color = colorToRgb(style.backgroundColor);
    if (color && color.a > 0.02) {
      return luminanceFromRgb(color);
    }
    return null;
  }

  function detectTone(sampleRoot = document.documentElement) {
    const points = [];
    const selectors = [
      "body",
      "main",
      "article",
      "section",
      "[role='main']",
      ".app",
      ".application",
      ".layout",
      ".content"
    ];
    for (const selector of selectors) {
      const found = document.querySelectorAll(selector);
      for (const node of found) {
        if (points.length >= 24) break;
        const rect = node.getBoundingClientRect?.();
        if (!rect || rect.width < 60 || rect.height < 40) continue;
        const lum = elementLuminance(node);
        if (Number.isFinite(lum)) points.push(lum);
      }
      if (points.length >= 24) break;
    }

    if (!points.length) {
      const bodyLum = elementLuminance(document.body || sampleRoot);
      if (Number.isFinite(bodyLum)) points.push(bodyLum);
    }

    const avg = points.length
      ? points.reduce((sum, value) => sum + value, 0) / points.length
      : 0.5;

    const classText = `${document.documentElement.className || ""} ${document.body?.className || ""}`.toLowerCase();
    const darkClassSignal = /(dark|night|theme-dark|mode-dark)/.test(classText);
    const lightClassSignal = /(light|theme-light|mode-light)/.test(classText);

    let tone = "mixed";
    if (avg < 0.30 || (avg < 0.40 && darkClassSignal)) tone = "dark";
    else if (avg > 0.68 || (avg > 0.58 && lightClassSignal)) tone = "light";

    return {
      tone,
      luminance: Number(avg.toFixed(3)),
      darkClassSignal,
      lightClassSignal
    };
  }

  function detectSiteType(host = "", media = {}) {
    const safeHost = String(host || "").toLowerCase();
    const title = String(document.title || "").toLowerCase();
    const bodyText = String(document.body?.innerText || "").slice(0, 4000).toLowerCase();
    const joined = `${safeHost} ${location.pathname || ""} ${title} ${bodyText}`;
    const hasCode = document.querySelectorAll("pre, code, .hljs, .highlight, .token").length > 6;
    const hasManyInputs = document.querySelectorAll("input, textarea, select, [contenteditable='true']").length > 35;
    const hasSidebar = Boolean(document.querySelector("aside, [role='navigation'], .sidebar, .side-nav, [data-testid*='sidebar']"));

    if (/youtube|vimeo|twitch|netflix|primevideo|hulu/.test(joined) || Number(media.mediaCount || 0) >= 3) {
      return "media";
    }
    if (/github|gitlab|bitbucket|docs|developer|api|stack(over|under)flow/.test(joined) || hasCode) {
      return "docs_code";
    }
    if (/dashboard|workspace|admin|console|linear|jira|figma|notion|slack|airtable|stripe/.test(joined)
      || (hasSidebar && hasManyInputs)) {
      return "dashboard_app";
    }
    if (/shop|cart|checkout|product|buy now|add to cart|store|amazon|ebay/.test(joined)) {
      return "ecommerce";
    }
    if (/news|article|blog|press|times|magazine/.test(joined) || document.querySelectorAll("article, time").length > 0) {
      return "article";
    }
    return "general";
  }

  globalThis.HolmetaAppearanceThemeDetector = {
    detectTone,
    detectSiteType,
    luminanceFromRgb,
    colorToRgb
  };
})();
