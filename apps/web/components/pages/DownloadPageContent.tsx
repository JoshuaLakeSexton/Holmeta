"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { trackEvent } from "@/lib/analytics/client";
import { BROWSER_LABELS, browserFamilyForType, detectBrowser, type BrowserType } from "@/lib/browser";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, t } from "@/lib/i18n/messages";

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

type DownloadPageProps = {
  locale?: SupportedLocale;
};

export function DownloadPageContent({ locale = "en" }: DownloadPageProps) {
  const messages = getMessages(locale);
  const [detectedType, setDetectedType] = useState<BrowserType>("unknown");
  const [selectedChoice, setSelectedChoice] = useState<BrowserChoice | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => sessionIdFromQuery());
  const [licenseKey, setLicenseKey] = useState("");
  const [statusLine, setStatusLine] = useState(
    t(messages, "download.statusEnter", "STATUS: ENTER SESSION ID OR LICENSE TO DOWNLOAD")
  );
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

  const detectedLabel = detectedType === "unknown" ? t(messages, "download.notDetected", "Not detected") : BROWSER_LABELS[detectedType];
  const recommendedLabel = selectedChoice ? choiceLabels[selectedChoice] : t(messages, "download.chooseBrowser", "Choose your browser");
  const storeUrl = useMemo(
    () => preferredStoreUrl(selectedChoice, detectedType),
    [selectedChoice, detectedType]
  );

  async function downloadProtectedZip() {
    const safeSessionId = String(sessionId || "").trim();
    const safeLicenseKey = String(licenseKey || "").trim().toUpperCase();

    if (!safeSessionId && !safeLicenseKey) {
      setStatusLine(t(messages, "download.statusNeedInput", "STATUS: ENTER CHECKOUT SESSION ID OR LICENSE KEY"));
      return;
    }

    const params = new URLSearchParams();
    if (safeSessionId) {
      params.set("session_id", safeSessionId);
    } else {
      params.set("license", safeLicenseKey);
    }

    setDownloading(true);
    setStatusLine(t(messages, "download.statusVerifying", "STATUS: VERIFYING TRIAL OR SUBSCRIPTION"));
    trackEvent("download_zip_started", {
      locale,
      hasSessionId: Boolean(safeSessionId),
      hasLicense: Boolean(safeLicenseKey)
    });

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
          setStatusLine(t(messages, "download.statusNoEntitlement", "STATUS: NO ACTIVE TRIAL OR SUBSCRIPTION FOUND"));
        } else {
          setStatusLine(t(messages, "download.statusDownloadFailed", { message: detail }, "STATUS: DOWNLOAD FAILED ({message})"));
        }
        trackEvent("download_zip_failed", {
          locale,
          status: response.status,
          detail
        });
        return;
      }

      const blob = await response.blob();
      if (!blob.size) {
        setStatusLine(t(messages, "download.statusEmpty", "STATUS: EMPTY DOWNLOAD RESPONSE"));
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

      setStatusLine(t(messages, "download.statusStarted", "STATUS: DOWNLOAD STARTED"));
      trackEvent("download_zip_success", { locale });
    } catch (error) {
      setStatusLine(
        t(messages, "download.statusDownloadFailed", {
          message: error instanceof Error ? error.message : "UNKNOWN"
        }, "STATUS: DOWNLOAD FAILED ({message})")
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">{t(messages, "download.kicker", "DOWNLOAD AFTER TRIAL")}</p>
        <h1 className="hm-title">{t(messages, "download.title", "download holmeta extension")}</h1>
        <p className="hm-meta">{t(messages, "download.detected", "Detected browser")}: {detectedLabel}</p>
        <p className="hm-meta">{t(messages, "download.recommended", "Recommended store")}: {recommendedLabel}</p>
      </Panel>

      <Panel>
        <p className="hm-kicker">{t(messages, "download.flowKicker", "FLOW")}</p>
        <h2 className="hm-subtitle">{t(messages, "download.flowTitle", "Start trial → checkout success → download")}</h2>
        <p className="hm-meta">
          {t(messages, "download.flowBody", "If you have not started checkout yet, begin your 3-day trial first. If you already paid, use your session id or license key below.")}
        </p>
        <div className="hm-cta-row">
          <Button href={pathWithLocale(locale, "/dashboard/subscribe")} variant="primary">{t(messages, "common.trialCta", "Start 3-Day Trial")}</Button>
          <Button href={pathWithLocale(locale, "/billing/success")}>{t(messages, "subscribe.alreadyCheckedOut", "I ALREADY CHECKED OUT")}</Button>
          <Button href={pathWithLocale(locale, "/")}>{t(messages, "common.seeHowItWorks", "See How It Works")}</Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">{t(messages, "download.storesKicker", "BROWSER STORES")}</p>
        <div className="hm-cta-row">
          <Button variant={selectedChoice === "chromium" ? "primary" : "secondary"} onClick={() => setSelectedChoice("chromium")}>
            {t(messages, "download.storeChromium", "Chrome / Edge")}
          </Button>
          <Button variant={selectedChoice === "firefox" ? "primary" : "secondary"} onClick={() => setSelectedChoice("firefox")}>
            {t(messages, "download.storeFirefox", "Firefox")}
          </Button>
          <Button variant={selectedChoice === "safari" ? "primary" : "secondary"} onClick={() => setSelectedChoice("safari")}>
            {t(messages, "download.storeSafari", "Safari")}
          </Button>
        </div>
        <div className="hm-cta-row">
          <Button
            disabled={!storeUrl}
            onClick={() => {
              if (!storeUrl) {
                return;
              }
              trackEvent("extension_install_click", {
                locale,
                store: selectedChoice || "unknown",
                browserDetected: detectedType
              });
              window.open(storeUrl, "_blank", "noopener,noreferrer");
            }}
          >
            {storeUrl
              ? t(messages, "download.installStore", "Install from Store")
              : t(messages, "download.storeMissing", "Store Link Not Configured")}
          </Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">{t(messages, "download.protectedKicker", "PROTECTED ZIP DOWNLOAD")}</p>
        <div className="hm-field-row hm-download-row">
          <label htmlFor="sessionId" className="hm-label">{t(messages, "download.sessionLabel", "CHECKOUT SESSION ID")}</label>
          <input
            id="sessionId"
            className="hm-field"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="cs_live_..."
          />
        </div>
        <div className="hm-field-row hm-download-row">
          <label htmlFor="licenseKey" className="hm-label">{t(messages, "download.licenseLabel", "LICENSE KEY (ALTERNATE)")}</label>
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
            {downloading
              ? t(messages, "download.downloadVerifying", "Verifying…")
              : t(messages, "download.downloadButton", "Download Extension")}
          </Button>
          <Button href={pathWithLocale(locale, "/billing/success")}>{t(messages, "billingSuccess.openDownload", "Open Download Page")}</Button>
          <Button href={pathWithLocale(locale, "/billing/help")}>{t(messages, "billingSuccess.help", "Refund / Cancel Help")}</Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">{t(messages, "download.manualKicker", "MANUAL INSTALL (CHROMIUM)")}</p>
        <p className="hm-meta">
          {t(messages, "download.manualBody", "After download: extract zip → open chrome://extensions → enable Developer mode → Load unpacked → select extracted folder containing manifest.json.")}
        </p>
      </Panel>
    </main>
  );
}
