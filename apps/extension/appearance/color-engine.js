(() => {
  if (globalThis.HolmetaAppearanceColor) return;

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function normalizeChannel(value) {
    return Math.round(clamp(value, 0, 255));
  }

  function parseHex(raw) {
    const value = String(raw || "").trim().replace(/^#/, "");
    if (value.length === 3 || value.length === 4) {
      const expanded = value.split("").map((part) => `${part}${part}`).join("");
      return parseHex(expanded);
    }
    if (value.length !== 6 && value.length !== 8) return null;
    const rgb = {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
      a: value.length === 8 ? clamp(parseInt(value.slice(6, 8), 16) / 255, 0, 1) : 1
    };
    return Number.isNaN(rgb.r) || Number.isNaN(rgb.g) || Number.isNaN(rgb.b) ? null : rgb;
  }

  function parseRgbFunction(raw) {
    const match = String(raw || "").trim().match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => part.trim());
    if (parts.length < 3) return null;
    const rgb = {
      r: normalizeChannel(parts[0]),
      g: normalizeChannel(parts[1]),
      b: normalizeChannel(parts[2]),
      a: parts.length > 3 ? clamp(parts[3], 0, 1) : 1
    };
    return rgb;
  }

  function hueToRgb(p, q, t) {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + ((q - p) * 6 * value);
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + ((q - p) * ((2 / 3) - value) * 6);
    return p;
  }

  function hslToRgb(h, s, l) {
    const hue = (((Number(h) % 360) + 360) % 360) / 360;
    const sat = clamp(Number(s), 0, 1);
    const lig = clamp(Number(l), 0, 1);
    if (sat === 0) {
      const channel = normalizeChannel(lig * 255);
      return { r: channel, g: channel, b: channel, a: 1 };
    }
    const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - (lig * sat);
    const p = (2 * lig) - q;
    return {
      r: normalizeChannel(hueToRgb(p, q, hue + (1 / 3)) * 255),
      g: normalizeChannel(hueToRgb(p, q, hue) * 255),
      b: normalizeChannel(hueToRgb(p, q, hue - (1 / 3)) * 255),
      a: 1
    };
  }

  function parseHslFunction(raw) {
    const match = String(raw || "").trim().match(/^hsla?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => part.trim().replace(/%$/, ""));
    if (parts.length < 3) return null;
    const rgb = hslToRgb(parts[0], Number(parts[1]) / 100, Number(parts[2]) / 100);
    rgb.a = parts.length > 3 ? clamp(parts[3], 0, 1) : 1;
    return rgb;
  }

  function parseColor(input) {
    if (!input && input !== 0) return null;
    if (typeof input === "object" && input) {
      if (Number.isFinite(input.r) && Number.isFinite(input.g) && Number.isFinite(input.b)) {
        return {
          r: normalizeChannel(input.r),
          g: normalizeChannel(input.g),
          b: normalizeChannel(input.b),
          a: Number.isFinite(input.a) ? clamp(input.a, 0, 1) : 1
        };
      }
      return null;
    }

    const raw = String(input).trim().toLowerCase();
    if (!raw || raw === "transparent" || raw === "currentcolor" || raw === "inherit") return null;
    return parseHex(raw) || parseRgbFunction(raw) || parseHslFunction(raw);
  }

  function toHex(input) {
    const color = parseColor(input);
    if (!color) return "#000000";
    return `#${[color.r, color.g, color.b].map((value) => normalizeChannel(value).toString(16).padStart(2, "0")).join("")}`;
  }

  function toRgbaString(input, alphaOverride = null) {
    const color = parseColor(input);
    if (!color) return "rgba(0, 0, 0, 0)";
    const alpha = Number.isFinite(alphaOverride) ? clamp(alphaOverride, 0, 1) : color.a;
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(3)})`;
  }

  function mix(colorA, colorB, ratio = 0.5) {
    const a = parseColor(colorA);
    const b = parseColor(colorB);
    if (!a && !b) return "#000000";
    if (!a) return toHex(b);
    if (!b) return toHex(a);
    const t = clamp(ratio, 0, 1);
    return toHex({
      r: (a.r * (1 - t)) + (b.r * t),
      g: (a.g * (1 - t)) + (b.g * t),
      b: (a.b * (1 - t)) + (b.b * t),
      a: (a.a * (1 - t)) + (b.a * t)
    });
  }

  function withAlpha(input, alpha) {
    return toRgbaString(input, alpha);
  }

  function luminance(input) {
    const color = parseColor(input);
    if (!color) return 1;
    const toLinear = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return (0.2126 * toLinear(color.r)) + (0.7152 * toLinear(color.g)) + (0.0722 * toLinear(color.b));
  }

  function contrast(colorA, colorB) {
    const a = luminance(colorA);
    const b = luminance(colorB);
    const light = Math.max(a, b);
    const dark = Math.min(a, b);
    return (light + 0.05) / (dark + 0.05);
  }

  function toHsl(input) {
    const color = parseColor(input);
    if (!color) return { h: 0, s: 0, l: 0, a: 1 };
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const delta = max - min;
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / delta) + (g < b ? 6 : 0);
          break;
        case g:
          h = ((b - r) / delta) + 2;
          break;
        default:
          h = ((r - g) / delta) + 4;
          break;
      }
      h /= 6;
    }
    return {
      h: h * 360,
      s,
      l,
      a: color.a
    };
  }

  function saturation(input) {
    return toHsl(input).s;
  }

  function chroma(input) {
    const color = parseColor(input);
    if (!color) return 0;
    return (Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b)) / 255;
  }

  function isNearNeutral(input, threshold = 0.12) {
    return chroma(input) <= clamp(threshold, 0, 1);
  }

  function isLikelyAccent(input, options = {}) {
    const sat = saturation(input);
    const lum = luminance(input);
    const chr = chroma(input);
    const minSat = clamp(options.minSaturation ?? 0.18, 0, 1);
    const minChroma = clamp(options.minChroma ?? 0.14, 0, 1);
    const minLum = clamp(options.minLuminance ?? 0.06, 0, 1);
    const maxLum = clamp(options.maxLuminance ?? 0.94, 0, 1);
    return sat >= minSat && chr >= minChroma && lum >= minLum && lum <= maxLum;
  }

  globalThis.HolmetaAppearanceColor = {
    clamp,
    parseColor,
    toHex,
    toRgbaString,
    withAlpha,
    mix,
    luminance,
    contrast,
    toHsl,
    saturation,
    chroma,
    isNearNeutral,
    isLikelyAccent
  };
})();
