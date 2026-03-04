"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

type PlanKey = "monthly_a" | "monthly_b" | "yearly";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/.netlify/functions";

const PLAN_COPY: Record<PlanKey, { title: string; detail: string }> = {
  monthly_a: {
    title: "CORE MONTHLY",
    detail: "$2/mo · 3-day trial"
  },
  monthly_b: {
    title: "PRO MONTHLY",
    detail: "Monthly option B"
  },
  yearly: {
    title: "PRO YEARLY",
    detail: "Yearly plan"
  }
};

function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/${path}`;
}

export default function DashboardPage() {
  const [planKey, setPlanKey] = useState<PlanKey>("monthly_a");
  const [loading, setLoading] = useState(false);
  const [statusLine, setStatusLine] = useState("STATUS: READY");

  const ctaLabel = useMemo(() => {
    const selected = PLAN_COPY[planKey];
    return `START CHECKOUT · ${selected.title}`;
  }, [planKey]);

  async function startCheckout(selectedPlan: PlanKey) {
    setLoading(true);
    setStatusLine("STATUS: CREATING CHECKOUT SESSION");

    try {
      const response = await fetch(apiUrl("create-checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          planKey: selectedPlan
        })
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      window.location.href = payload.url;
    } catch (error) {
      setStatusLine(`STATUS: CHECKOUT FAILED (${error instanceof Error ? error.message : "UNKNOWN"})`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">BILLING CONSOLE</p>
        <h1 className="hm-title">holmeta launch checkout</h1>
        <p className="hm-meta">
          No account required for launch. Complete Stripe Checkout, then copy your license key on success.
        </p>
        <p className="hm-meta">{statusLine}</p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">Select Plan</h2>
        <div className="hm-plan-grid">
          {(Object.keys(PLAN_COPY) as PlanKey[]).map((key) => {
            const plan = PLAN_COPY[key];
            return (
              <button
                key={key}
                type="button"
                className={`hm-plan-card ${planKey === key ? "is-selected" : ""}`}
                onClick={() => setPlanKey(key)}
                aria-pressed={planKey === key}
              >
                <span className="hm-plan-kicker">{plan.title}</span>
                <strong>{plan.detail}</strong>
              </button>
            );
          })}
        </div>

        <div className="hm-cta-row">
          <Button variant="primary" onClick={() => startCheckout(planKey)} disabled={loading}>
            {ctaLabel}
          </Button>
          <Button href="/billing/success">I ALREADY PAID</Button>
          <Button href="/download">DOWNLOAD EXTENSION</Button>
        </div>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">After Payment</h2>
        <ol className="hm-protocol-grid">
          <li>
            <strong>1)</strong> You land on <code>/billing/success</code> with a checkout session id.
          </li>
          <li>
            <strong>2)</strong> Copy your one-time revealed license key.
          </li>
          <li>
            <strong>3)</strong> In the extension: Options → Account/Premium → Enter License Key → Activate.
          </li>
        </ol>
      </Panel>
    </main>
  );
}
