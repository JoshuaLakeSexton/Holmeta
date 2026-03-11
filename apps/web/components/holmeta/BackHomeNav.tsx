"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/holmeta/Button";
import { LocaleSwitcher } from "@/components/holmeta/LocaleSwitcher";
import { pathWithLocale, splitLocaleFromPath } from "@/lib/i18n/config";
import { getMessages, t } from "@/lib/i18n/messages";

export function BackHomeNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = splitLocaleFromPath(pathname || "/");
  const activeLocale = locale || "en";
  const messages = getMessages(activeLocale);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setCanGoBack(window.history.length > 1);
  }, [pathname]);

  const isHome = pathname === "/" || pathname === `/${activeLocale}`;
  if (isHome) {
    return null;
  }

  function onBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(pathWithLocale(activeLocale, "/"));
  }

  function onHome() {
    if (!isHome) {
      router.push(pathWithLocale(activeLocale, "/"));
    }
  }

  return (
    <div className="hm-web-nav hm-web-nav-box" role="navigation" aria-label={t(messages, "common.quickNavigation", "Quick navigation")}>
      <LocaleSwitcher compact />
      <Button onClick={onBack} className="hm-web-nav-btn hm-web-nav-btn--mini" disabled={!canGoBack && isHome}>
        {t(messages, "common.back", "Back")}
      </Button>
      <Button onClick={onHome} className="hm-web-nav-btn hm-web-nav-btn--mini" disabled={isHome}>
        {t(messages, "common.home", "Home")}
      </Button>
    </div>
  );
}
