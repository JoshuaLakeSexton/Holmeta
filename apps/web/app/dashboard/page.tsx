"use client";

import { Button } from "@/components/holmeta/Button";
import { Field } from "@/components/holmeta/Field";
import { Label } from "@/components/holmeta/Label";
import { Panel } from "@/components/holmeta/Panel";
import { useCallback, useEffect, useMemo, useState } from "react";

type Entitlement = {
  ok?: boolean;
  userId?: string | null;
  entitled: boolean;
  active: boolean;
  status?: string;
  plan?: string | null;
  renewsAt?: string | null;
  trialEndsAt?: string | null;
  features?: Record<string, boolean>;
};

type AccountUser = {
  id: string;
  email: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/.netlify/functions";

const defaultEntitlement: Entitlement = {
  entitled: false,
  active: false,
  status: "inactive",
  plan: "2",
  renewsAt: null,
  trialEndsAt: null,
  features: {
    lightFilters: false,
    everythingElse: false
  }
};

function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/${path}`;
}

function parseDate(value?: string | null): number {
  if (!value) {
    return 0;
  }
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

function trialDaysRemaining(trialEndsAt?: string | null): number | null {
  const ts = parseDate(trialEndsAt);
  if (!ts) {
    return null;
  }

  const delta = ts - Date.now();
  if (delta <= 0) {
    return 0;
  }

  return Math.ceil(delta / (24 * 60 * 60 * 1000));
}

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [email, setEmail] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement>(defaultEntitlement);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState("STATUS: IDLE");
  const [loading, setLoading] = useState(false);

  const trialDays = useMemo(() => trialDaysRemaining(entitlement.trialEndsAt), [entitlement.trialEndsAt]);

  const subscriptionSummary = useMemo(() => {
    const status = String(entitlement.status || "inactive").toLowerCase();

    if (status === "active" && entitlement.entitled) {
      return {
        chipClass: "status-active",
        label: "STATUS: PREMIUM ACTIVE",
        detail: "All extension features are unlocked."
      };
    }

    if (status === "trialing" && entitlement.entitled) {
      return {
        chipClass: "status-warning",
        label: trialDays === null ? "STATUS: TRIAL ACTIVE" : `STATUS: TRIAL ACTIVE (${Math.max(0, trialDays)}D LEFT)`,
        detail: "During trial only Light Filters are enabled in the extension."
      };
    }

    if (status === "trialing" && trialDays === 0) {
      return {
        chipClass: "status-locked",
        label: "STATUS: TRIAL ENDED",
        detail: "Trial ended. Subscribe to enable Light Filters and unlock all features."
      };
    }

    if (["past_due", "unpaid", "canceled", "incomplete_expired"].includes(status)) {
      return {
        chipClass: "status-locked",
        label: `STATUS: ${status.toUpperCase()}`,
        detail: "Subscription inactive. Subscribe to continue."
      };
    }

    return {
      chipClass: "status-locked",
      label: "STATUS: SUBSCRIBE $2/MO",
      detail: "Start a 3-day trial. Trial unlocks Light Filters only."
    };
  }, [entitlement.entitled, entitlement.status, trialDays]);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }, [token]);

  const loadEntitlement = useCallback(async () => {
    if (!token) {
      setEntitlement(defaultEntitlement);
      return;
    }

    try {
      const response = await fetch(apiUrl("entitlement"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = (await response.json()) as Entitlement;
      setEntitlement({
        entitled: Boolean(json.entitled ?? json.active),
        active: Boolean(json.active ?? json.entitled),
        status: String(json.status || (json.entitled || json.active ? "active" : "inactive")).toLowerCase(),
        plan: json.plan || "2",
        renewsAt: json.renewsAt || null,
        trialEndsAt: json.trialEndsAt || null,
        features: json.features || {
          lightFilters: false,
          everythingElse: false
        }
      });

      setStatusLine("STATUS: ENTITLEMENT REFRESHED");
    } catch {
      setEntitlement(defaultEntitlement);
      setStatusLine("STATUS: ENTITLEMENT REQUEST FAILED");
    }
  }, [token]);

  async function requestAccountCode() {
    setLoading(true);
    setStatusLine("STATUS: REQUESTING ACCOUNT CODE");

    try {
      const response = await fetch(apiUrl("request-account-code"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      setIssuedCode(json.code || "");
      setCodeExpiresAt(json.expiresAt || null);
      setStatusLine("STATUS: ACCOUNT CODE ISSUED");
    } catch (error) {
      setStatusLine(`STATUS: ${error instanceof Error ? error.message : "REQUEST FAILED"}`);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCodeAndLogin() {
    setLoading(true);
    setStatusLine("STATUS: VERIFYING CODE");

    try {
      const response = await fetch(apiUrl("verify-account-code"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, code: codeInput })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      setToken(json.token || "");
      setUser(json.user || null);
      if (json.entitlement) {
        setEntitlement({
          entitled: Boolean(json.entitlement.entitled ?? json.entitlement.active),
          active: Boolean(json.entitlement.active ?? json.entitlement.entitled),
          status: String(json.entitlement.status || (json.entitlement.entitled || json.entitlement.active ? "active" : "inactive")).toLowerCase(),
          plan: json.entitlement.plan || "2",
          renewsAt: json.entitlement.renewsAt || null,
          trialEndsAt: json.entitlement.trialEndsAt || null,
          features: json.entitlement.features || {
            lightFilters: false,
            everythingElse: false
          }
        });
      }
      setStatusLine("STATUS: AUTHENTICATED");
    } catch (error) {
      setStatusLine(`STATUS: ${error instanceof Error ? error.message : "VERIFY FAILED"}`);
    } finally {
      setLoading(false);
    }
  }

  async function startCheckout() {
    if (!token) return;
    setLoading(true);
    setStatusLine("STATUS: OPENING CHECKOUT");

    try {
      const response = await fetch(apiUrl("create-checkout-session"), {
        method: "POST",
        headers: authHeaders
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      if (json.url) {
        window.location.href = json.url;
      }
    } catch (error) {
      setStatusLine(`STATUS: ${error instanceof Error ? error.message : "CHECKOUT FAILED"}`);
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    if (!token) return;
    setLoading(true);
    setStatusLine("STATUS: OPENING BILLING PORTAL");

    try {
      const response = await fetch(apiUrl("create-portal-session"), {
        method: "POST",
        headers: authHeaders
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      if (json.url) {
        window.location.href = json.url;
      }
    } catch (error) {
      setStatusLine(`STATUS: ${error instanceof Error ? error.message : "PORTAL FAILED"}`);
    } finally {
      setLoading(false);
    }
  }

  async function createPairingCode() {
    if (!token) return;
    setLoading(true);
    setStatusLine("STATUS: GENERATING PAIRING CODE");

    try {
      const response = await fetch(apiUrl("create-pairing-code"), {
        method: "POST",
        headers: authHeaders
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      setPairingCode(json.code || "");
      setPairingExpiresAt(json.expiresAt || null);
      setStatusLine("STATUS: PAIRING CODE READY");
    } catch (error) {
      setStatusLine(`STATUS: ${error instanceof Error ? error.message : "PAIRING FAILED"}`);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setEntitlement(defaultEntitlement);
    setPairingCode("");
    setPairingExpiresAt(null);
    setStatusLine("STATUS: LOGGED OUT");
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem("holmeta.dashboard.token") || "";
    const savedEmail = window.localStorage.getItem("holmeta.dashboard.email") || "";

    if (savedToken) {
      setToken(savedToken);
    }
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  useEffect(() => {
    if (token) {
      window.localStorage.setItem("holmeta.dashboard.token", token);
      loadEntitlement();
    } else {
      window.localStorage.removeItem("holmeta.dashboard.token");
    }
  }, [token, loadEntitlement]);

  useEffect(() => {
    window.localStorage.setItem("holmeta.dashboard.email", email);
  }, [email]);

  useEffect(() => {
    const checkoutState = String(new URLSearchParams(window.location.search).get("checkout") || "").toLowerCase();
    if (checkoutState === "success") {
      setStatusLine("STATUS: CHECKOUT COMPLETE");
      loadEntitlement();
    }
    if (checkoutState === "cancel") {
      setStatusLine("STATUS: CHECKOUT CANCELLED");
    }
  }, [loadEntitlement]);

  const lightFiltersEnabled = Boolean(entitlement.features?.lightFilters);
  const everythingElseEnabled = Boolean(entitlement.features?.everythingElse);

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">ACCOUNT / DASHBOARD</p>
        <h1 className="hm-title">holmeta account console</h1>
        <p className={`hm-chip ${subscriptionSummary.chipClass}`}>{subscriptionSummary.label}</p>
        <p className="hm-meta">{subscriptionSummary.detail}</p>
        <p className="hm-meta">
          {entitlement.trialEndsAt
            ? `TRIAL ENDS: ${new Date(entitlement.trialEndsAt).toLocaleString()}`
            : "TRIAL ENDS: N/A"}
        </p>
        <p className="hm-meta">
          {entitlement.renewsAt
            ? `RENEWS AT: ${new Date(entitlement.renewsAt).toLocaleString()}`
            : "RENEWAL: N/A"}
        </p>
        <p className="hm-meta">{statusLine}</p>
      </Panel>

      {!token ? (
        <Panel>
          <h2 className="hm-subtitle">Sign In</h2>
          <p className="hm-meta">Enter email, request a code, then verify to manage trial/subscription and generate extension pairing codes.</p>

          <div className="hm-field-row">
            <Label htmlFor="email">EMAIL</Label>
            <Field
              id="email"
              value={email}
              placeholder="you@company.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="hm-field-row">
            <Label htmlFor="accountCode">ACCOUNT CODE</Label>
            <Field
              id="accountCode"
              value={codeInput}
              placeholder="123456"
              onChange={(event) => setCodeInput(event.target.value)}
            />
          </div>

          <div className="hm-cta-row">
            <Button onClick={requestAccountCode} disabled={loading || !email}>
              REQUEST CODE
            </Button>
            <Button variant="primary" onClick={verifyCodeAndLogin} disabled={loading || !email || !codeInput}>
              VERIFY + LOGIN
            </Button>
          </div>

          {issuedCode ? (
            <p className="hm-meta">
              TEST CODE: <strong>{issuedCode}</strong>
              {codeExpiresAt ? ` · EXPIRES ${new Date(codeExpiresAt).toLocaleTimeString()}` : ""}
            </p>
          ) : null}
        </Panel>
      ) : (
        <>
          <Panel>
            <h2 className="hm-subtitle">Billing</h2>
            <p className="hm-meta">SIGNED IN AS: {user?.email || email}</p>
            <p className="hm-meta">$2/month subscription · 3-day trial.</p>
            <div className="hm-cta-row">
              <Button variant="primary" onClick={startCheckout} disabled={loading}>
                SUBSCRIBE $2/MO (3-DAY TRIAL)
              </Button>
              <Button onClick={openPortal} disabled={loading}>
                OPEN BILLING PORTAL
              </Button>
              <Button onClick={loadEntitlement} disabled={loading}>
                REFRESH ENTITLEMENT
              </Button>
              <Button onClick={logout}>LOG OUT</Button>
            </div>
          </Panel>

          <Panel>
            <h2 className="hm-subtitle">Connect holmeta Extension</h2>
            <p className="hm-meta">Generate a one-time pairing code (valid for 10 minutes), then paste it in Extension Options.</p>
            <div className="hm-cta-row">
              <Button variant="primary" onClick={createPairingCode} disabled={loading}>
                GENERATE PAIRING CODE
              </Button>
            </div>
            {pairingCode ? (
              <div className="hm-pairing-box">
                <p className="hm-pairing-code">{pairingCode}</p>
                <p className="hm-meta">
                  VALID UNTIL: {pairingExpiresAt ? new Date(pairingExpiresAt).toLocaleTimeString() : "N/A"}
                </p>
                <p className="hm-meta">Extension path: Options → Account + Premium Entitlement → Pair extension.</p>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <h2 className="hm-subtitle">Feature Access</h2>
            <div className="hm-feature-grid">
              <div className="hm-feature-item">
                <span>lightFilters</span>
                <strong>{lightFiltersEnabled ? "ON" : "OFF"}</strong>
              </div>
              <div className="hm-feature-item">
                <span>everythingElse</span>
                <strong>{everythingElseEnabled ? "ON" : "OFF"}</strong>
              </div>
            </div>
          </Panel>
        </>
      )}

      <Panel>
        <p className="hm-kicker">WELLNESS DISCLAIMER</p>
        <p className="hm-meta">holmeta offers comfort/focus guidance and is not medical advice.</p>
      </Panel>
    </main>
  );
}
