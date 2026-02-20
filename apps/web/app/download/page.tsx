"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Field } from "@/components/holmeta/Field";
import { Label } from "@/components/holmeta/Label";
import { Panel } from "@/components/holmeta/Panel";
import { BROWSER_LABELS, browserFamilyForType, detectBrowser, type BrowserType } from "@/lib/browser";

const DOWNLOAD_ZIP_PATH = "/downloads/holmeta-extension.zip";

const BROWSER_OPTIONS: BrowserType[] = ["chrome", "edge", "brave", "vivaldi", "opera", "arc", "firefox", "safari", "unknown"];

const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "";
const EDGE_STORE_URL = process.env.NEXT_PUBLIC_EDGE_STORE_URL || "";
const FIREFOX_AMO_URL = process.env.NEXT_PUBLIC_FIREFOX_AMO_URL || "";
const SAFARI_URL = process.env.NEXT_PUBLIC_SAFARI_URL || "";

type InstallPlan = {
  heading: string;
  detail: string;
  buttonLabel: string;
  href: string;
  available: boolean;
  external: boolean;
};

function parseBrowser(value: string | null): BrowserType | null {
  if (!value) {
    return null;
  }
  return BROWSER_OPTIONS.includes(value as BrowserType) ? (value as BrowserType) : null;
}

function firstChromiumStoreUrl(type: BrowserType): string {
  if (type === "edge" && EDGE_STORE_URL) {
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

function buildInstallPlan(type: BrowserType): InstallPlan {
  const family = browserFamilyForType(type);

  if (family === "chromium") {
    const storeUrl = firstChromiumStoreUrl(type);

    if (storeUrl) {
      return {
        heading: `Recommended for ${BROWSER_LABELS[type]}`,
        detail: "Install from store for automatic updates.",
        buttonLabel: "Install from Store",
        href: storeUrl,
        available: true,
        external: true
      };
    }

    return {
      heading: `Recommended for ${BROWSER_LABELS[type]}`,
      detail: "Store URL is not configured. Use manual zip install.",
      buttonLabel: "Download .zip (Manual)",
      href: DOWNLOAD_ZIP_PATH,
      available: true,
      external: false
    };
  }

  if (type === "firefox") {
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
      detail: "Coming soon on Firefox.",
      buttonLabel: "Coming Soon",
      href: "",
      available: false,
      external: false
    };
  }

  if (type === "safari") {
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
      detail: "Coming soon on Safari.",
      buttonLabel: "Coming Soon",
      href: "",
      available: false,
      external: false
    };
  }

  return {
    heading: "Select your browser",
    detail: "Choose a browser from the selector below to get the right install path.",
    buttonLabel: "Select Browser",
    href: "",
    available: false,
    external: false
  };
}

export default function DownloadPage() {
  const [detected, setDetected] = useState<BrowserType>("unknown");
  const [selected, setSelected] = useState<BrowserType>("unknown");
  const [zipAvailable, setZipAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const fromQuery = parseBrowser(new URLSearchParams(window.location.search).get("browser"));

    detectBrowser()
      .then((info) => {
        if (!alive) {
          return;
        }

        setDetected(info.type);
        setSelected(fromQuery || info.type);
      })
      .catch(() => {
        if (!alive) {
          return;
        }

        setDetected("unknown");
        setSelected(fromQuery || "unknown");
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

  const activeBrowser = selected || detected;
  const activeFamily = browserFamilyForType(activeBrowser);

  const plan = useMemo(() => buildInstallPlan(activeBrowser), [activeBrowser]);

  const showManualInstall = activeFamily === "chromium";
  const manualZipEnabled = Boolean(zipAvailable);
  const primaryInstallEnabled = plan.available && !(plan.href === DOWNLOAD_ZIP_PATH && zipAvailable === false);

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">DOWNLOAD EXTENSION</p>
        <h1 className="hm-title">holmeta install console</h1>
        <p className="hm-meta">DETECTED: {BROWSER_LABELS[detected]}</p>
        <p className="hm-meta">RECOMMENDED: {BROWSER_LABELS[activeBrowser]}</p>
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

      <Panel>
        <p className="hm-kicker">CHOOSE YOUR BROWSER</p>
        <div className="hm-field-row hm-download-row">
          <Label htmlFor="browserChoice">Browser</Label>
          <Field
            as="select"
            id="browserChoice"
            value={activeBrowser}
            onChange={(event) => setSelected(event.target.value as BrowserType)}
          >
            {BROWSER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {BROWSER_LABELS[option]}
              </option>
            ))}
          </Field>
        </div>
      </Panel>

      {showManualInstall ? (
        <Panel>
          <p className="hm-kicker">MANUAL INSTALL (CHROMIUM)</p>
          <p className="hm-meta">Use this if store install is unavailable or blocked.</p>
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
                Run <span className="hm-mono">npm --prefix apps/extension run build:zip</span> to regenerate and copy this archive automatically.
              </p>
            </div>
          ) : null}

          <ol className="hm-list hm-list--ordered">
            <li>Download the zip and extract it to a local folder.</li>
            <li>Open chrome://extensions and enable Developer Mode.</li>
            <li>Click Load unpacked and select the extracted dist/extension folder.</li>
            <li>If you install from zip only, repeat the process after each update.</li>
          </ol>
        </Panel>
      ) : null}

      {activeFamily === "firefox" && !FIREFOX_AMO_URL ? (
        <Panel>
          <p className="hm-warning-line">COMING SOON ON FIREFOX</p>
          <p className="hm-meta">Set NEXT_PUBLIC_FIREFOX_AMO_URL to enable direct install.</p>
        </Panel>
      ) : null}

      {activeFamily === "safari" && !SAFARI_URL ? (
        <Panel>
          <p className="hm-warning-line">COMING SOON ON SAFARI</p>
          <p className="hm-meta">Set NEXT_PUBLIC_SAFARI_URL to enable direct install.</p>
        </Panel>
      ) : null}
    </main>
  );
}
