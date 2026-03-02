"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { BROWSER_LABELS, browserFamilyForType, detectBrowser, type BrowserType } from "@/lib/browser";

const DOWNLOAD_ZIP_PATH = "/downloads/holmeta-extension.zip";

const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "";
const EDGE_STORE_URL = process.env.NEXT_PUBLIC_EDGE_STORE_URL || "";
const FIREFOX_AMO_URL = process.env.NEXT_PUBLIC_FIREFOX_AMO_URL || "";
const SAFARI_URL = process.env.NEXT_PUBLIC_SAFARI_URL || "";

type BrowserChoice = "chromium" | "firefox" | "safari";

type InstallPlan = {
  heading: string;
  detail: string;
  buttonLabel: string;
  href: string;
  available: boolean;
  external: boolean;
};

const choiceLabels: Record<BrowserChoice, string> = {
  chromium: "Chrome / Edge / Brave / Vivaldi / Arc",
  firefox: "Firefox",
  safari: "Safari"
};

function choiceFromType(type: BrowserType): BrowserChoice | null {
  const family = browserFamilyForType(type);
  if (family === "chromium") return "chromium";
  if (family === "firefox") return "firefox";
  if (family === "safari") return "safari";
  return null;
}

function choiceFromQuery(value: string | null): BrowserChoice | null {
  if (!value) {
    return null;
  }

  const lowered = value.toLowerCase();
  if (lowered === "chromium" || lowered === "firefox" || lowered === "safari") {
    return lowered;
  }

  const type = lowered as BrowserType;
  if (type in BROWSER_LABELS) {
    return choiceFromType(type);
  }

  return null;
}

function firstChromiumStoreUrl(detectedType: BrowserType): string {
  if (detectedType === "edge" && EDGE_STORE_URL) {
    return EDGE_STORE_URL;
  }

  if (CHROME_STORE_URL) {
    return CHROME_STORE_URL;
  }

  if (EDGE_STORE_URL) {
    return EDGE_STORE_URL;
  }

  return "";
}

function buildInstallPlan(selected: BrowserChoice | null, detectedType: BrowserType): InstallPlan {
  if (!selected) {
    return {
      heading: "Choose your browser",
      detail: "Select one option below to continue.",
      buttonLabel: "Choose Browser",
      href: "",
      available: false,
      external: false
    };
  }

  if (selected === "chromium") {
    const storeUrl = firstChromiumStoreUrl(detectedType);

    if (storeUrl) {
      return {
        heading: "Recommended for Chromium browsers",
        detail: "Install from store for automatic updates.",
        buttonLabel: "Install from Store",
        href: storeUrl,
        available: true,
        external: true
      };
    }

    return {
      heading: "Chromium manual install",
      detail: "Store URL is not configured. Download the zip package.",
      buttonLabel: "Download .zip",
      href: DOWNLOAD_ZIP_PATH,
      available: true,
      external: false
    };
  }

  if (selected === "firefox") {
    if (FIREFOX_AMO_URL) {
      return {
        heading: "Recommended for Firefox",
        detail: "Install from Firefox Add-ons.",
        buttonLabel: "Install on Firefox",
        href: FIREFOX_AMO_URL,
        available: true,
        external: true
      };
    }

    return {
      heading: "Firefox",
      detail: "Firefox version coming soon.",
      buttonLabel: "Coming Soon",
      href: "",
      available: false,
      external: false
    };
  }

  if (SAFARI_URL) {
    return {
      heading: "Recommended for Safari",
      detail: "Install from the Safari listing.",
      buttonLabel: "Open Safari Listing",
      href: SAFARI_URL,
      available: true,
      external: true
    };
  }

  return {
    heading: "Safari",
    detail: "Safari version coming soon.",
    buttonLabel: "Coming Soon",
    href: "",
    available: false,
    external: false
  };
}

export default function DownloadPage() {
  const [detectedType, setDetectedType] = useState<BrowserType>("unknown");
  const [selectedChoice, setSelectedChoice] = useState<BrowserChoice | null>(null);
  const [zipAvailable, setZipAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const queryChoice = choiceFromQuery(new URLSearchParams(window.location.search).get("browser"));

    detectBrowser()
      .then((info) => {
        if (!alive) {
          return;
        }

        setDetectedType(info.type);
        setSelectedChoice(queryChoice || choiceFromType(info.type));
      })
      .catch(() => {
        if (!alive) {
          return;
        }

        setDetectedType("unknown");
        setSelectedChoice(queryChoice);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    fetch(DOWNLOAD_ZIP_PATH, {
      method: "HEAD",
      cache: "no-store"
    })
      .then((response) => {
        if (alive) {
          setZipAvailable(response.ok);
        }
      })
      .catch(() => {
        if (alive) {
          setZipAvailable(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  const plan = useMemo(() => buildInstallPlan(selectedChoice, detectedType), [selectedChoice, detectedType]);

  const detectedLabel = detectedType === "unknown" ? "Not detected" : BROWSER_LABELS[detectedType];
  const recommendedLabel = selectedChoice ? choiceLabels[selectedChoice] : "Choose your browser";
  const manualZipEnabled = Boolean(zipAvailable);
  const primaryInstallEnabled =
    plan.available && !(plan.href === DOWNLOAD_ZIP_PATH && zipAvailable === false);

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">DOWNLOAD EXTENSION</p>
        <h1 className="hm-title">holmeta install console</h1>
        <p className="hm-meta">DETECTED: {detectedLabel}</p>
        <p className="hm-meta">RECOMMENDED: {recommendedLabel}</p>
      </Panel>

      <Panel>
        <p className="hm-kicker">CHOOSE YOUR BROWSER</p>
        <div className="hm-cta-row">
          <Button
            variant={selectedChoice === "chromium" ? "primary" : "secondary"}
            onClick={() => setSelectedChoice("chromium")}
          >
            Chrome / Edge
          </Button>
          <Button
            variant={selectedChoice === "firefox" ? "primary" : "secondary"}
            onClick={() => setSelectedChoice("firefox")}
          >
            Firefox
          </Button>
          <Button
            variant={selectedChoice === "safari" ? "primary" : "secondary"}
            onClick={() => setSelectedChoice("safari")}
          >
            Safari
          </Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">RECOMMENDED INSTALL</p>
        <h2 className="hm-subtitle">{plan.heading}</h2>
        <p className="hm-meta">{plan.detail}</p>
        <div className="hm-cta-row">
          <Button
            href={plan.href || "#"}
            variant="primary"
            disabled={!primaryInstallEnabled}
            target={plan.external ? "_blank" : undefined}
            rel={plan.external ? "noreferrer" : undefined}
          >
            {plan.buttonLabel}
          </Button>
          <Button href="/dashboard">Open Dashboard</Button>
        </div>
      </Panel>

      {selectedChoice === "chromium" ? (
        <Panel>
          <p className="hm-kicker">MANUAL INSTALL (CHROMIUM)</p>
          <p className="hm-meta">
            Download zip → extract → chrome://extensions → Developer mode → Load unpacked → select the extracted folder that contains <span className="hm-mono">manifest.json</span>.
          </p>
          <div className="hm-cta-row">
            <Button href={DOWNLOAD_ZIP_PATH} disabled={!manualZipEnabled}>
              Download .zip
            </Button>
            <Button href="https://chrome://extensions" target="_blank" rel="noreferrer">
              Open chrome://extensions
            </Button>
          </div>

          {!manualZipEnabled ? (
            <div className="hm-warning-panel">
              <p className="hm-warning-line">ZIP NOT AVAILABLE YET</p>
              <p className="hm-meta">
                Run <span className="hm-mono">npm --prefix apps/extension run build</span> then
                <span className="hm-mono"> node scripts/sync-extension-zip.mjs</span>.
              </p>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </main>
  );
}
