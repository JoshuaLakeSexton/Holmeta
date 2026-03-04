"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { BROWSER_LABELS, browserFamilyForType, detectBrowser, type BrowserType } from "@/lib/browser";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/.netlify/functions";
const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "";
const EDGE_STORE_URL = process.env.NEXT_PUBLIC_EDGE_STORE_URL || "";
const FIREFOX_AMO_URL = process.env.NEXT_PUBLIC_FIREFOX_AMO_URL || "";
const SAFARI_URL = process.env.NEXT_PUBLIC_SAFARI_URL || "";

type BrowserChoice = "chromium" | "firefox" | "safari";

const choiceLabels: Record<BrowserChoice, string> = {
  chromium: "Chrome / Edge / Brave / Vivaldi / Arc",
  firefox: "Firefox",
  safari: "Safari"
};

function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/${path}`;
}

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
  return null;
}

function sessionIdFromQuery(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return String(new URLSearchParams(window.location.search).get("session_id") || "").trim();
}

function preferredStoreUrl(choice: BrowserChoice | null, detectedType: BrowserType): string {
  if (choice === "chromium") {
    if (detectedType === "edge" && EDGE_STORE_URL) {
      return EDGE_STORE_URL;
    }
    return CHROME_STORE_URL || EDGE_STORE_URL || "";
  }
  if (choice === "firefox") {
    return FIREFOX_AMO_URL;
  }
  if (choice === "safari") {
    return SAFARI_URL;
  }
  return "";
}

export default function DownloadPage() {
  const [detectedType, setDetectedType] = useState<BrowserType>("unknown");
  const [selectedChoice, setSelectedChoice] = useState<BrowserChoice | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => sessionIdFromQuery());
  const [licenseKey, setLicenseKey] = useState("");
  const [statusLine, setStatusLine] = useState("STATUS: SUBSCRIPTION REQUIRED BEFORE DOWNLOAD");
  const [downloading, setDownloading] = useState(false);

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

  const detectedLabel = detectedType === "unknown" ? "Not detected" : BROWSER_LABELS[detectedType];
  const recommendedLabel = selectedChoice ? choiceLabels[selectedChoice] : "Choose your browser";
  const storeUrl = useMemo(
    () => preferredStoreUrl(selectedChoice, detectedType),
    [selectedChoice, detectedType]
  );

  async function downloadProtectedZip() {
    const safeSessionId = String(sessionId || "").trim();
    const safeLicenseKey = String(licenseKey || "").trim().toUpperCase();

    if (!safeSessionId && !safeLicenseKey) {
      setStatusLine("STATUS: ENTER CHECKOUT SESSION ID OR LICENSE KEY");
      return;
    }

    const params = new URLSearchParams();
    if (safeSessionId) {
      params.set("session_id", safeSessionId);
    } else {
      params.set("license", safeLicenseKey);
    }

    setDownloading(true);
    setStatusLine("STATUS: VERIFYING SUBSCRIPTION");

    try {
      const response = await fetch(`${apiUrl("download-extension")}?${params.toString()}`, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const payload = (await response.json()) as { error?: string; code?: string };
          detail = payload?.error || payload?.code || detail;
        } catch {
          // no-op
        }
        if (response.status === 401 || response.status === 403) {
          setStatusLine("STATUS: SUBSCRIPTION REQUIRED OR NOT ACTIVE");
        } else {
          setStatusLine(`STATUS: DOWNLOAD FAILED (${detail})`);
        }
        return;
      }

      const blob = await response.blob();
      if (!blob.size) {
        setStatusLine("STATUS: EMPTY DOWNLOAD RESPONSE");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "holmeta-extension.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatusLine("STATUS: DOWNLOAD STARTED");
    } catch (error) {
      setStatusLine(`STATUS: DOWNLOAD FAILED (${error instanceof Error ? error.message : "UNKNOWN"})`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">DOWNLOAD EXTENSION</p>
        <h1 className="hm-title">holmeta install console</h1>
        <p className="hm-meta">DETECTED: {detectedLabel}</p>
        <p className="hm-meta">RECOMMENDED: {recommendedLabel}</p>
      </Panel>

      <Panel>
        <p className="hm-kicker">SUBSCRIBE FIRST</p>
        <p className="hm-meta">
          Download is paywalled. Complete Stripe checkout, then use your checkout session id or license key to download.
        </p>
        <div className="hm-cta-row">
          <Button href="/dashboard/subscribe" variant="primary">START SUBSCRIPTION</Button>
          <Button href="/billing/success">I ALREADY CHECKED OUT</Button>
          <Button href="/billing/help">BILLING HELP</Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">CHOOSE YOUR BROWSER</p>
        <div className="hm-cta-row">
          <Button variant={selectedChoice === "chromium" ? "primary" : "secondary"} onClick={() => setSelectedChoice("chromium")}>
            Chrome / Edge
          </Button>
          <Button variant={selectedChoice === "firefox" ? "primary" : "secondary"} onClick={() => setSelectedChoice("firefox")}>
            Firefox
          </Button>
          <Button variant={selectedChoice === "safari" ? "primary" : "secondary"} onClick={() => setSelectedChoice("safari")}>
            Safari
          </Button>
        </div>
        <div className="hm-cta-row">
          <Button
            href={storeUrl || "#"}
            disabled={!storeUrl}
            target={storeUrl ? "_blank" : undefined}
            rel={storeUrl ? "noreferrer" : undefined}
          >
            {storeUrl ? "INSTALL FROM STORE" : "STORE LINK NOT CONFIGURED"}
          </Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">PROTECTED ZIP DOWNLOAD</p>
        <div className="hm-field-row">
          <label htmlFor="sessionId" className="hm-label">CHECKOUT SESSION ID</label>
          <input
            id="sessionId"
            className="hm-field"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="cs_live_..."
          />
        </div>
        <div className="hm-field-row">
          <label htmlFor="licenseKey" className="hm-label">LICENSE KEY (ALTERNATE)</label>
          <input
            id="licenseKey"
            className="hm-field"
            value={licenseKey}
            onChange={(event) => setLicenseKey(event.target.value.toUpperCase())}
            placeholder="HOLMETA-XXXX-XXXX-XXXX-XXXX"
          />
        </div>
        <p className="hm-meta">{statusLine}</p>
        <div className="hm-cta-row">
          <Button onClick={downloadProtectedZip} variant="primary" disabled={downloading}>
            {downloading ? "VERIFYING…" : "DOWNLOAD EXTENSION"}
          </Button>
          <Button href="/billing/success">OPEN SUCCESS PAGE</Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">MANUAL INSTALL (CHROMIUM)</p>
        <p className="hm-meta">
          After download: extract zip → open <span className="hm-mono">chrome://extensions</span> → enable Developer mode →
          Load unpacked → select extracted folder containing <span className="hm-mono">manifest.json</span>.
        </p>
      </Panel>
    </main>
  );
}

