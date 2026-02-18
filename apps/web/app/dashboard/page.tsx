"use client";

import { useEffect, useMemo, useState } from "react";

type Entitlement = {
  active: boolean;
  plan?: string | null;
  renewsAt?: string | null;
};

const defaultEntitlement: Entitlement = {
  active: false,
  plan: null,
  renewsAt: null
};

export default function DashboardPage() {
  const [entitlement, setEntitlement] = useState<Entitlement>(defaultEntitlement);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [syncStatus, setSyncStatus] = useState("IDLE");

  const premiumStatus = useMemo(() => {
    if (entitlement.active) {
      return `STATUS: ACTIVE${entitlement.plan ? ` (${entitlement.plan.toUpperCase()})` : ""}`;
    }
    return "STATUS: LOCKED";
  }, [entitlement]);

  async function loadEntitlement() {
    try {
      const response = await fetch("/api/entitlement");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = (await response.json()) as Entitlement;
      setEntitlement({
        active: Boolean(json.active),
        plan: json.plan || null,
        renewsAt: json.renewsAt || null
      });
    } catch (_) {
      setEntitlement(defaultEntitlement);
    }
  }

  async function beginCheckout() {
    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const json = await response.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } finally {
      setLoading(false);
    }
  }

  async function testSync() {
    setSyncStatus("RUNNING");
    try {
      const response = await fetch("/api/settings-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sample: true,
          source: "web-dashboard"
        })
      });

      if (response.status === 402) {
        setSyncStatus("PREMIUM REQUIRED");
        return;
      }

      if (!response.ok) {
        setSyncStatus(`ERROR ${response.status}`);
        return;
      }

      setSyncStatus("SYNCED");
    } catch (_) {
      setSyncStatus("NETWORK ERROR");
    }
  }

  useEffect(() => {
    loadEntitlement();
  }, []);

  return (
    <main className="shell">
      <header className="panel">
        <p className="kicker">ACCOUNT / DASHBOARD</p>
        <h1>holmeta account console</h1>
        <p className={`status-chip ${entitlement.active ? "status-active" : "status-locked"}`}>{premiumStatus}</p>
        <p className="meta-line">
          {entitlement.renewsAt
            ? `RENEWS AT: ${new Date(entitlement.renewsAt).toLocaleDateString()}`
            : "No active renewal date in the current stub state."}
        </p>
      </header>

      <section className="panel">
        <h2>Unlock Premium</h2>
        <p className="meta-line">Stripe checkout is scaffolded via Netlify Function endpoint.</p>
        <div className="field-row">
          <label htmlFor="email">EMAIL</label>
          <input
            id="email"
            value={email}
            placeholder="you@company.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="cta-row">
          <button className="btn btn-primary" onClick={beginCheckout} disabled={loading}>
            {loading ? "PREPARING..." : "UNLOCK PREMIUM ($2/MO)"}
          </button>
          <button className="btn" onClick={loadEntitlement}>
            REFRESH ENTITLEMENT
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Settings Sync Stub</h2>
        <p className="meta-line">
          This endpoint is reserved for paid users. Current MVP keeps health data local in extension storage.
        </p>
        <div className="cta-row">
          <button className="btn" onClick={testSync}>
            TEST SYNC ENDPOINT
          </button>
          <p className="meta-line">SYNC STATUS: {syncStatus}</p>
        </div>
      </section>
    </main>
  );
}
