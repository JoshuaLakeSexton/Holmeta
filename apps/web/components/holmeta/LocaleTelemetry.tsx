"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { trackEvent } from "@/lib/analytics/client";
import { splitLocaleFromPath } from "@/lib/i18n/config";

export function LocaleTelemetry() {
  const pathname = usePathname();

  useEffect(() => {
    const { locale } = splitLocaleFromPath(pathname || "/");
    trackEvent("locale_detected", {
      pathLocale: locale || "none",
      browserLanguage: typeof navigator !== "undefined" ? navigator.language : ""
    });
  }, [pathname]);

  return null;
}
