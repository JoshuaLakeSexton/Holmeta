"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { trackEvent } from "@/lib/analytics/client";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, t } from "@/lib/i18n/messages";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/.netlify/functions";

function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/${path}`;
}

function sessionIdFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return String(new URLSearchParams(window.location.search).get("session_id") || "").trim();
}

type BillingSuccessPageProps = {
  locale?: SupportedLocale;
};

export function BillingSuccessPageContent({ locale = "en" }: BillingSuccessPageProps) {
  const messages = getMessages(locale);
  const [sessionId, setSessionId] = useState<string>(() => sessionIdFromLocation());
  const [licenseKey, setLicenseKey] = useState("");
  const [statusLine, setStatusLine] = useState(t(messages, "billingSuccess.statusReady", "STATUS: READY"));
  const [loading, setLoading] = useState(false);

  const canReveal = useMemo(() => sessionId.length > 0 && !loading, [sessionId, loading]);

  useEffect(() => {
    trackEvent("checkout_success_page_viewed", {
      locale,
      hasSessionId: Boolean(sessionId)
    });
  }, [locale, sessionId]);

  async function fetchLicense() {
    const currentSession = String(sessionId || "").trim();
    if (!currentSession) {
      setStatusLine(t(messages, "billingSuccess.statusSessionRequired", "STATUS: SESSION ID REQUIRED"));
      return;
    }

    setLoading(true);
    setStatusLine(t(messages, "billingSuccess.statusFetching", "STATUS: FETCHING LICENSE KEY"));
    trackEvent("license_reveal_started", { locale, hasSessionId: Boolean(currentSession) });

    try {
      const response = await fetch(`${apiUrl("get-license")}?session_id=${encodeURIComponent(currentSession)}`);
      const payload = (await response.json()) as {
        ok?: boolean;
        licenseKey?: string;
        planKey?: string;
        error?: string;
        code?: string;
      };

      if (!response.ok || !payload?.ok || !payload?.licenseKey) {
        if (payload?.error === "already_revealed") {
          setStatusLine(t(messages, "billingSuccess.statusAlreadyRevealed", "STATUS: LICENSE ALREADY REVEALED FOR THIS SESSION"));
          trackEvent("license_reveal_already_revealed", { locale });
          return;
        }
        trackEvent("license_reveal_failed", {
          locale,
          status: response.status,
          error: String(payload?.error || payload?.code || "unknown")
        });
        throw new Error(payload?.error || payload?.code || `HTTP ${response.status}`);
      }

      setLicenseKey(payload.licenseKey);
      setStatusLine(t(messages, "billingSuccess.statusLicenseReady", "STATUS: LICENSE READY"));
      trackEvent("license_revealed", { locale, planKey: payload.planKey || "unknown" });
    } catch (error) {
      setStatusLine(
        t(messages, "billingSuccess.statusLicenseFailed", {
          message: error instanceof Error ? error.message : "UNKNOWN"
        }, "STATUS: LICENSE FETCH FAILED ({message})")
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyLicense() {
    if (!licenseKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(licenseKey);
      setStatusLine(t(messages, "billingSuccess.statusLicenseCopied", "STATUS: LICENSE COPIED"));
      trackEvent("license_copied", { locale });
    } catch {
      setStatusLine(t(messages, "billingSuccess.statusCopyFailed", "STATUS: COPY FAILED"));
    }
  }

  async function openPortal() {
    const currentSession = String(sessionId || "").trim();
    if (!currentSession) {
      setStatusLine(t(messages, "billingSuccess.statusSessionRequired", "STATUS: SESSION ID REQUIRED"));
      return;
    }

    setLoading(true);
    setStatusLine(t(messages, "billingSuccess.statusOpeningPortal", "STATUS: OPENING BILLING PORTAL"));
    trackEvent("billing_portal_open_started", { locale });

    try {
      const response = await fetch(apiUrl("create-portal-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ session_id: currentSession })
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload?.url) {
        trackEvent("billing_portal_open_failed", { locale, status: response.status });
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      trackEvent("billing_portal_opened", { locale });
      window.location.href = payload.url;
    } catch (error) {
      setStatusLine(
        t(messages, "billingSuccess.statusPortalFailed", {
          message: error instanceof Error ? error.message : "UNKNOWN"
        }, "STATUS: PORTAL FAILED ({message})")
      );
      setLoading(false);
    }
  }

  async function downloadExtensionNow() {
    const currentSession = String(sessionId || "").trim();
    if (!currentSession) {
      setStatusLine(t(messages, "billingSuccess.statusSessionRequired", "STATUS: SESSION ID REQUIRED"));
      return;
    }

    setLoading(true);
    setStatusLine(t(messages, "billingSuccess.statusVerifyingDownload", "STATUS: VERIFYING DOWNLOAD ACCESS"));
    trackEvent("download_zip_started", { locale, hasSessionId: Boolean(currentSession) });

    try {
      const response = await fetch(`${apiUrl("download-extension")}?session_id=${encodeURIComponent(currentSession)}`, {
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
        trackEvent("download_zip_failed", {
          locale,
          status: response.status,
          detail
        });
        throw new Error(detail);
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("Empty zip response");
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "holmeta-extension.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      setStatusLine(t(messages, "billingSuccess.statusDownloadStarted", "STATUS: DOWNLOAD STARTED"));
      trackEvent("download_zip_success", { locale });
    } catch (error) {
      setStatusLine(
        t(messages, "billingSuccess.statusDownloadFailed", {
          message: error instanceof Error ? error.message : "UNKNOWN"
        }, "STATUS: DOWNLOAD FAILED ({message})")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">{t(messages, "billingSuccess.kicker", "CHECKOUT SUCCESS")}</p>
        <h1 className="hm-title">{t(messages, "billingSuccess.title", "your holmeta license key")}</h1>
        <p className="hm-meta">
          {t(messages, "billingSuccess.body", "Save this key now. You need it to activate Premium inside the extension.")}
        </p>
        <p className="hm-meta">{statusLine}</p>

        <div className="hm-field-row hm-download-row">
          <label htmlFor="sessionId" className="hm-label">{t(messages, "billingSuccess.sessionLabel", "CHECKOUT SESSION ID")}</label>
          <input
            id="sessionId"
            className="hm-field"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="cs_test_..."
          />
        </div>

        <div className="hm-cta-row">
          <Button variant="primary" onClick={fetchLicense} disabled={!canReveal}>
            {t(messages, "billingSuccess.reveal", "Reveal License")}
          </Button>
          <Button onClick={openPortal} disabled={!sessionId || loading}>
            {t(messages, "billingSuccess.manage", "Manage Billing")}
          </Button>
          <Button href={pathWithLocale(locale, "/billing/help")}>{t(messages, "billingSuccess.help", "Refund / Cancel Help")}</Button>
        </div>

        <div className="hm-pairing-box">
          <p className="hm-kicker">{t(messages, "billingSuccess.licenseBox", "LICENSE KEY")}</p>
          <p className="hm-pairing-code">{licenseKey || t(messages, "billingSuccess.notRevealed", "NOT REVEALED YET")}</p>
          <div className="hm-cta-row">
            <Button onClick={copyLicense} disabled={!licenseKey}>{t(messages, "billingSuccess.copy", "Copy License")}</Button>
            <Button onClick={downloadExtensionNow} variant="primary" disabled={!sessionId || loading}>{t(messages, "billingSuccess.download", "Download Extension")}</Button>
            <Button href={`${pathWithLocale(locale, "/download")}?session_id=${encodeURIComponent(sessionId)}`}>{t(messages, "billingSuccess.openDownload", "Open Download Page")}</Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "billingSuccess.activateTitle", "Activate in Under a Minute")}</h2>
        <ol className="hm-protocol-grid">
          {[0, 1, 2, 3].map((index) => (
            <li key={index}>
              <strong>{index + 1})</strong> {t(messages, `billingSuccess.activateSteps.${index}`, "")}
            </li>
          ))}
        </ol>
      </Panel>
    </main>
  );
}
