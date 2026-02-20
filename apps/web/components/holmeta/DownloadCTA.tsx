"use client";

import { useEffect, useMemo, useState } from "react";

import { detectBrowser, type BrowserType } from "@/lib/browser";

import { Button } from "./Button";

type DownloadCTAProps = {
  className?: string;
};

export function DownloadCTA({ className = "" }: DownloadCTAProps) {
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
      Download Extension
    </Button>
  );
}
