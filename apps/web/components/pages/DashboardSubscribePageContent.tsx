"use client";

import { useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { trackEvent } from "@/lib/analytics/client";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, objectAt, t } from "@/lib/i18n/messages";

type PlanKey = "monthly_a" | "yearly";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/.netlify/functions";

const DEFAULT_PLANS: Array<{ key: PlanKey; label: string; detail: string; note: string }> = [
  { key: "monthly_a", label: "HOLMETA PREMIUM", detail: "$2/mo", note: "Full command center access" },
  { key: "yearly", label: "HOLMETA YEARLY", detail: "Yearly billing", note: "Best for daily command-center use" }
];

function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/${path}`;
}

type DashboardSubscribePageProps = {
  locale?: SupportedLocale;
};

export function DashboardSubscribePageContent({ locale = "en" }: DashboardSubscribePageProps) {
  const messages = getMessages(locale);
  const localizedPlans = {
    monthly_a: objectAt(messages, "subscribe.plans.monthly_a", DEFAULT_PLANS[0]),
    yearly: objectAt(messages, "subscribe.plans.yearly", DEFAULT_PLANS[1])
  } as Record<PlanKey, { key?: PlanKey; label: string; detail: string; note: string }>;
  const displayPlans = (["monthly_a", "yearly"] as const).map((key) => ({
    key,
    label: String(localizedPlans[key]?.label || DEFAULT_PLANS.find((row) => row.key === key)?.label || ""),
    detail: String(localizedPlans[key]?.detail || DEFAULT_PLANS.find((row) => row.key === key)?.detail || ""),
    note: String(localizedPlans[key]?.note || DEFAULT_PLANS.find((row) => row.key === key)?.note || "")
  }));
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [statusLine, setStatusLine] = useState(t(messages, "subscribe.statusReady", "STATUS: READY TO START 3-DAY TRIAL"));

  async function startCheckout(planKey: PlanKey) {
    setLoading(planKey);
    trackEvent("checkout_opened", { planKey, locale });
    setStatusLine(
      t(messages, "subscribe.statusOpening", {
        plan: planKey.toUpperCase()
      }, "STATUS: OPENING {plan} CHECKOUT")
    );

    try {
      const response = await fetch(apiUrl("create-checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ planKey, locale })
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload?.url) {
        trackEvent("checkout_create_failed", {
          locale,
          planKey,
          status: response.status
        });
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      trackEvent("checkout_session_created", {
        locale,
        planKey
      });
      window.location.href = payload.url;
    } catch (error) {
      setStatusLine(
        t(messages, "subscribe.statusFailed", {
          message: error instanceof Error ? error.message : "UNKNOWN"
        }, "STATUS: CHECKOUT FAILED ({message})")
      );
      setLoading(null);
    }
  }

  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">{t(messages, "subscribe.kicker", "UNLOCK HOLMETA")}</p>
        <h1 className="hm-title">{t(messages, "subscribe.title", "choose your Holmeta plan and continue to Stripe")}</h1>
        <p className="hm-meta">
          {t(messages, "subscribe.body", "Start in Stripe Checkout. Billing Success reveals your license key and moves you straight into download and activation.")}
        </p>
        <p className="hm-meta">{statusLine}</p>

        <div className="hm-plan-grid hm-plan-grid--two">
          {displayPlans.map((plan) => (
            <button
              key={plan.key}
              type="button"
              className="hm-plan-card"
              onClick={() => startCheckout(plan.key)}
              disabled={Boolean(loading)}
            >
              <span className="hm-plan-kicker">{plan.label}</span>
              <strong>{plan.detail}</strong>
              <span className="hm-meta">{plan.note}</span>
              <span className="hm-meta">
                {loading === plan.key
                  ? t(messages, "subscribe.creating", "CREATING SESSION…")
                  : t(messages, "subscribe.startTrial", "START 3-DAY TRIAL")}
              </span>
            </button>
          ))}
        </div>

        <div className="hm-cta-row">
          <Button href={pathWithLocale(locale, "/billing/success")}>{t(messages, "subscribe.alreadyCheckedOut", "I ALREADY CHECKED OUT")}</Button>
          <Button href={pathWithLocale(locale, "/")} variant="secondary">{t(messages, "common.seeHowItWorks", "See How It Works")}</Button>
          <Button href={pathWithLocale(locale, "/privacy")}>{t(messages, "common.readPrivacy", "Read Privacy")}</Button>
        </div>
      </Panel>
    </main>
  );
}
