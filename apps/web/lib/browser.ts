export type BrowserType =
  | "chrome"
  | "edge"
  | "brave"
  | "vivaldi"
  | "opera"
  | "arc"
  | "firefox"
  | "safari"
  | "unknown";

export type BrowserFamily = "chromium" | "firefox" | "safari" | "unknown";

export type BrowserInfo = {
  type: BrowserType;
  family: BrowserFamily;
  label: string;
};

type BraveNavigator = Navigator & {
  brave?: {
    isBrave?: () => Promise<boolean>;
  };
};

export const BROWSER_LABELS: Record<BrowserType, string> = {
  chrome: "Chrome",
  edge: "Edge",
  brave: "Brave",
  vivaldi: "Vivaldi",
  opera: "Opera",
  arc: "Arc",
  firefox: "Firefox",
  safari: "Safari",
  unknown: "Unknown"
};

export function browserFamilyForType(type: BrowserType): BrowserFamily {
  if (type === "firefox") return "firefox";
  if (type === "safari") return "safari";
  if (["chrome", "edge", "brave", "vivaldi", "opera", "arc"].includes(type)) {
    return "chromium";
  }
  return "unknown";
}

export function detectBrowserFromUserAgent(userAgent: string): BrowserType {
  const ua = userAgent.toLowerCase();

  if (ua.includes("edg/")) return "edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "opera";
  if (ua.includes("vivaldi")) return "vivaldi";
  if (ua.includes("arc/")) return "arc";
  if (ua.includes("firefox/")) return "firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/") && !ua.includes("chromium")) {
    return "safari";
  }
  if (ua.includes("chrome/") || ua.includes("chromium")) return "chrome";
  return "unknown";
}

export async function detectBrowser(): Promise<BrowserInfo> {
  if (typeof navigator === "undefined") {
    return {
      type: "unknown",
      family: "unknown",
      label: BROWSER_LABELS.unknown
    };
  }

  let type = detectBrowserFromUserAgent(navigator.userAgent || "");
  const nav = navigator as BraveNavigator;

  if (type === "chrome" && nav.brave && typeof nav.brave.isBrave === "function") {
    try {
      const isBrave = await nav.brave.isBrave();
      if (isBrave) {
        type = "brave";
      }
    } catch {
      // Keep chrome classification when Brave API is unavailable.
    }
  }

  return {
    type,
    family: browserFamilyForType(type),
    label: BROWSER_LABELS[type]
  };
}
