"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { BROWSER_LABELS, detectBrowser, type BrowserFamily, type BrowserType } from "@/lib/browser";
import { StatusCard } from "@/components/status-card";

const PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_2 ?? null;

type CheckoutResponse = {
  url?: string;
  error?: string;
};

export default function HomePage() {
  const [browserType, setBrowserType] = useState<BrowserType>("unknown");
  const [browserFamily, setBrowserFamily] = useState<BrowserFamily>("unknown");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    let alive = true;

    detectBrowser()
      .then((info) => {
        if (!alive) return;
        setBrowserType(info.type);
        setBrowserFamily(info.family);
      })
      .catch(() => {
        if (!alive) return;
        setBrowserType("unknown");
        setBrowserFamily("unknown");
      });

    return () => {
      alive = false;
    };
  }, []);

  const downloadHref = useMemo(() => {
    if (browserFamily === "chromium") {
      return "/downloads/holmeta-extension.zip";
    }

    if (browserType === "firefox") {
      return "/download?browser=firefox";
    }

    return "/download";
  }, [browserFamily, browserType]);

  const downloadLabel = useMemo(() => {
    if (browserFamily === "chromium") {
      return "Download Extension";
    }

    if (browserType === "firefox") {
      return "Firefox Install Info";
    }

    return "Download Options";
  }, [browserFamily, browserType]);

  async function startCheckout() {
    setCheckoutBusy(true);
    setCheckoutError("");

    try {
      const response = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          priceId: PRICE_ID
        })
      });

      const payload = (await response.json().catch(() => ({}))) as CheckoutResponse;

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || `Checkout request failed (${response.status}).`);
      }

      window.location.href = payload.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start Stripe Checkout.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <main className="shell">
      <Panel as="header" className="hero">
        <p className="hm-kicker">MISSION BRIEFING</p>
        <h1 className="hm-title">holmeta</h1>
        <p className="hm-lede">
          Extension-first screen health + deep work instrumentation for people on screens 8+ hours/day. Local-first reminders,
          browser-only filter engine, and a $2/mo plan with a 3-day trial (trial enables Light Filters only).
        </p>
        <p className="hm-meta">DETECTED BROWSER: {BROWSER_LABELS[browserType]}</p>
        <div className="hm-cta-row">
          <Button href={downloadHref} variant="primary">
            {downloadLabel}
          </Button>
          <Button href="/dashboard">Start Free</Button>
          <Button onClick={startCheckout} disabled={checkoutBusy}>
            {checkoutBusy ? "Starting Checkout..." : "Subscribe ($2/mo)"}
          </Button>
        </div>
        {checkoutError ? <p className="hm-warning-line">CHECKOUT ERROR: {checkoutError}</p> : null}
      </Panel>

      <Panel className="hm-status-grid">
        <StatusCard label="STATUS" value="DEPLOYED" detail="MV3 extension + web dashboard" />
        <StatusCard label="PRICING" value="$2/MO" detail="Single premium tier" />
        <StatusCard label="PRIVACY" value="LOCAL-FIRST" detail="No data resale. Webcam posture local-only." />
        <StatusCard label="BILLING" value="STRIPE + NETLIFY" detail="Checkout, webhook, entitlement, pairing flow" />
      </Panel>

      <Panel id="pricing">
        <p className="hm-kicker">PRICING</p>
        <h2 className="hm-subtitle">Free + Premium</h2>
        <div className="hm-split-grid">
          <article>
            <p className="hm-meta">FREE</p>
            <ul className="hm-list">
              <li>Basic filters + intensity controls</li>
              <li>Basic eye reminders (interval mode)</li>
              <li>Manual focus sessions</li>
            </ul>
          </article>
          <article>
            <p className="hm-meta">SUBSCRIPTION ($2/MO)</p>
            <ul className="hm-list">
              <li>During 3-day trial: Light Filters only</li>
              <li>Active subscription: all reminders, cadence, deep work, logs, posture, hydration, breathwork</li>
              <li>Pairing token + entitlement gating via Netlify functions</li>
            </ul>
          </article>
        </div>
        <div className="hm-cta-row">
          <Button href="/dashboard" variant="primary">
            Open Account Console
          </Button>
          <Button href="/download">Download Details</Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">BROWSER-ONLY LIMIT</p>
        <p className="hm-lede">
          holmeta v1 can only transform browser-rendered content. It cannot apply OS-level gamma ramps like Iris system-wide
          controls. Strong in-browser intensity is achieved via matrix + CSS + overlay pipeline.
        </p>
      </Panel>

      <Panel>
        <p className="hm-kicker">WELLNESS DISCLAIMER</p>
        <p className="hm-lede">holmeta provides comfort/focus guidance and is not medical advice.</p>
      </Panel>
    </main>
  );
}
