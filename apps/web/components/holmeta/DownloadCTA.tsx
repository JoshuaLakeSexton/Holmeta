"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { detectBrowser, type BrowserType } from "@/lib/browser";
import { getMessages, t } from "@/lib/i18n/messages";
import { splitLocaleFromPath } from "@/lib/i18n/config";

import { Button } from "./Button";

type DownloadCTAProps = {
  className?: string;
};

export function DownloadCTA({ className = "" }: DownloadCTAProps) {
  const pathname = usePathname();
  const { locale } = splitLocaleFromPath(pathname || "/");
  const messages = useMemo(() => getMessages(locale || "en"), [locale]);
  const [detectedType, setDetectedType] = useState<BrowserType>("unknown");

  useEffect(() => {
    let alive = true;

    detectBrowser()
      .then((info) => {
        if (alive) {
          setDetectedType(info.type);
        }
      })
      .catch(() => {
        if (alive) {
          setDetectedType("unknown");
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  const href = useMemo(() => {
    if (detectedType === "unknown") {
      return "/download";
    }
    return `/download?browser=${detectedType}`;
  }, [detectedType]);

  return (
    <Button href={href} variant="primary" className={className}>
      {t(messages, "download.downloadButton", "Download Extension")}
    </Button>
  );
}
