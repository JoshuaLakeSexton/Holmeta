"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

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

export default function BillingSuccessPage() {
  const [sessionId, setSessionId] = useState<string>(() => sessionIdFromLocation());
  const [licenseKey, setLicenseKey] = useState("");
  const [statusLine, setStatusLine] = useState("STATUS: READY");
  const [loading, setLoading] = useState(false);

  const canReveal = useMemo(() => sessionId.length > 0 && !loading, [sessionId, loading]);

  async function fetchLicense() {
    const currentSession = String(sessionId || "").trim();
    if (!currentSession) {
      setStatusLine("STATUS: SESSION ID REQUIRED");
      return;
    }

    setLoading(true);
    setStatusLine("STATUS: FETCHING LICENSE KEY");

    try {
      const response = await fetch(`${apiUrl("get-license")}?session_id=${encodeURIComponent(currentSession)}`);
      const payload = (await response.json()) as {
        ok?: boolean;
        licenseKey?: string;
        error?: string;
        code?: string;
      };

      if (!response.ok || !payload?.ok || !payload?.licenseKey) {
        if (payload?.error === "already_revealed") {
          setStatusLine("STATUS: LICENSE ALREADY REVEALED FOR THIS SESSION");
          return;
        }
        throw new Error(payload?.error || payload?.code || `HTTP ${response.status}`);
      }

      setLicenseKey(payload.licenseKey);
      setStatusLine("STATUS: LICENSE READY");
    } catch (error) {
      setStatusLine(`STATUS: LICENSE FETCH FAILED (${error instanceof Error ? error.message : "UNKNOWN"})`);
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
      setStatusLine("STATUS: LICENSE COPIED");
    } catch {
      setStatusLine("STATUS: COPY FAILED");
    }
  }

  async function openPortal() {
    const currentSession = String(sessionId || "").trim();
    if (!currentSession) {
      setStatusLine("STATUS: SESSION ID REQUIRED");
      return;
    }

    setLoading(true);
    setStatusLine("STATUS: OPENING BILLING PORTAL");

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
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      window.location.href = payload.url;
    } catch (error) {
      setStatusLine(`STATUS: PORTAL FAILED (${error instanceof Error ? error.message : "UNKNOWN"})`);
      setLoading(false);
    }
  }

  async function downloadExtensionNow() {
    const currentSession = String(sessionId || "").trim();
    if (!currentSession) {
      setStatusLine("STATUS: SESSION ID REQUIRED");
      return;
    }

    setLoading(true);
    setStatusLine("STATUS: VERIFYING DOWNLOAD ACCESS");

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

      setStatusLine("STATUS: DOWNLOAD STARTED");
    } catch (error) {
      setStatusLine(`STATUS: DOWNLOAD FAILED (${error instanceof Error ? error.message : "UNKNOWN"})`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">BILLING SUCCESS</p>
        <h1 className="hm-title">your holmeta license key</h1>
        <p className="hm-meta">
          License is revealed once per checkout session. Save it before closing this page.
        </p>
        <p className="hm-meta">{statusLine}</p>

        <div className="hm-field-row">
          <label htmlFor="sessionId" className="hm-label">CHECKOUT SESSION ID</label>
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
            REVEAL LICENSE
          </Button>
          <Button onClick={openPortal} disabled={!sessionId || loading}>
            MANAGE BILLING
          </Button>
          <Button href="/billing/help">REFUND HELP</Button>
        </div>

        <div className="hm-pairing-box">
          <p className="hm-kicker">LICENSE KEY</p>
          <p className="hm-pairing-code">{licenseKey || "NOT REVEALED YET"}</p>
          <div className="hm-cta-row">
            <Button onClick={copyLicense} disabled={!licenseKey}>COPY LICENSE</Button>
            <Button onClick={downloadExtensionNow} variant="primary" disabled={!sessionId || loading}>DOWNLOAD EXTENSION</Button>
            <Button href={`/download?session_id=${encodeURIComponent(sessionId)}`}>OPEN DOWNLOAD PAGE</Button>
            <Button onClick={openPortal} disabled={!sessionId || loading}>CANCEL / PLAN CHANGES</Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">Install + Unlock Steps</h2>
        <ol className="hm-protocol-grid">
          <li><strong>1)</strong> Download and load the extension in your browser.</li>
          <li><strong>2)</strong> Open extension Options or Popup and go to Premium unlock.</li>
          <li><strong>3)</strong> Paste license key and click Activate.</li>
          <li><strong>4)</strong> Refresh entitlement to confirm trialing/active status.</li>
        </ol>
      </Panel>
    </main>
  );
}
