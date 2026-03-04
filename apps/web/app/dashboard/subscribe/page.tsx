"use client";

import { useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

type PlanKey = "monthly_a" | "yearly";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/.netlify/functions";

const PLANS: Array<{ key: PlanKey; label: string; detail: string }> = [
  { key: "monthly_a", label: "CORE MONTHLY", detail: "$2/mo · 3-day trial" },
  { key: "yearly", label: "PRO YEARLY", detail: "Yearly option" }
];

function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/${path}`;
}

export default function DashboardSubscribePage() {
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [statusLine, setStatusLine] = useState("STATUS: READY");

  async function startCheckout(planKey: PlanKey) {
    setLoading(planKey);
    setStatusLine(`STATUS: OPENING ${planKey.toUpperCase()} CHECKOUT`);

    try {
      const response = await fetch(apiUrl("create-checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ planKey })
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      window.location.href = payload.url;
    } catch (error) {
      setStatusLine(`STATUS: CHECKOUT FAILED (${error instanceof Error ? error.message : "UNKNOWN"})`);
      setLoading(null);
    }
  }

  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">SUBSCRIBE</p>
        <h1 className="hm-title">start trial + unlock holmeta</h1>
        <p className="hm-meta">No login account for launch. Stripe checkout returns a one-time license key.</p>
        <p className="hm-meta">{statusLine}</p>

        <div className="hm-plan-grid">
          {PLANS.map((plan) => (
            <button
              key={plan.key}
              type="button"
              className="hm-plan-card"
              onClick={() => startCheckout(plan.key)}
              disabled={Boolean(loading)}
            >
              <span className="hm-plan-kicker">{plan.label}</span>
              <strong>{plan.detail}</strong>
              <span className="hm-meta">{loading === plan.key ? "CREATING SESSION…" : "START CHECKOUT"}</span>
            </button>
          ))}
        </div>

        <div className="hm-cta-row">
          <Button href="/billing/success">I ALREADY CHECKED OUT</Button>
          <Button href="/download">DOWNLOAD EXTENSION</Button>
          <Button href="/" variant="secondary">BACK HOME</Button>
        </div>
      </Panel>
    </main>
  );
}
