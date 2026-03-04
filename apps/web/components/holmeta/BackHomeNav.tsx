"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/holmeta/Button";

export function BackHomeNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setCanGoBack(window.history.length > 1);
  }, [pathname]);

  const isHome = pathname === "/";
  if (isHome) {
    return null;
  }

  function onBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  function onHome() {
    if (!isHome) {
      router.push("/");
    }
  }

  return (
    <div className="hm-web-nav hm-web-nav-box" role="navigation" aria-label="Quick navigation">
      <Button onClick={onBack} className="hm-web-nav-btn hm-web-nav-btn--mini" disabled={!canGoBack && isHome}>
        Back
      </Button>
      <Button onClick={onHome} className="hm-web-nav-btn hm-web-nav-btn--mini" disabled={isHome}>
        Home
      </Button>
    </div>
  );
}
