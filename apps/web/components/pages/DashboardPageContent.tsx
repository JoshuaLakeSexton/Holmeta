"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { trackEvent } from "@/lib/analytics/client";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, objectAt, t } from "@/lib/i18n/messages";

type PlanKey = "monthly_a" | "yearly";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/.netlify/functions";

const PLAN_COPY_DEFAULT: Record<PlanKey, { title: string; detail: string }> = {
  monthly_a: {
    title: "HOLMETA PREMIUM",
    detail: "$2/mo · 3-day trial"
  },
  yearly: {
    title: "HOLMETA YEARLY",
    detail: "Yearly billing"
  }
};

function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/${path}`;
}

type DashboardPageProps = {
  locale?: SupportedLocale;
};

export function DashboardPageContent({ locale = "en" }: DashboardPageProps) {
  const messages = getMessages(locale);
  const planCopy = {
    monthly_a: objectAt(messages, "dashboard.plans.monthly_a", PLAN_COPY_DEFAULT.monthly_a),
    yearly: objectAt(messages, "dashboard.plans.yearly", PLAN_COPY_DEFAULT.yearly)
  } satisfies Record<PlanKey, { title: string; detail: string }>;
  const [planKey, setPlanKey] = useState<PlanKey>("monthly_a");
  const [loading, setLoading] = useState(false);
  const [statusLine, setStatusLine] = useState(t(messages, "dashboard.statusReady", "STATUS: READY TO START 3-DAY TRIAL"));

  const ctaLabel = useMemo(() => {
    const selected = planCopy[planKey];
    return `${t(messages, "common.trialCta", "Start 3-Day Trial")} · ${selected.title}`;
  }, [messages, planCopy, planKey]);

  async function startCheckout(selectedPlan: PlanKey) {
    setLoading(true);
    setStatusLine(t(messages, "dashboard.statusCreating", "STATUS: CREATING CHECKOUT SESSION"));
    trackEvent("checkout_opened", { planKey: selectedPlan, locale });

    try {
      const response = await fetch(apiUrl("create-checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          planKey: selectedPlan,
          locale
        })
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload?.url) {
        trackEvent("checkout_create_failed", {
          locale,
          planKey: selectedPlan,
          status: response.status
        });
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      trackEvent("checkout_session_created", {
        locale,
        planKey: selectedPlan
      });
      window.location.href = payload.url;
    } catch (error) {
      setStatusLine(
        t(messages, "dashboard.statusFailed", {
          message: error instanceof Error ? error.message : "UNKNOWN"
        }, "STATUS: CHECKOUT FAILED ({message})")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">TRIAL CHECKOUT</p>
        <h1 className="hm-title">{t(messages, "dashboard.title", "start your 3-day trial")}</h1>
        <p className="hm-meta">
          {t(messages, "dashboard.body", "Keep your flow simple: checkout first, reveal your license on success, then download and activate the extension.")}
        </p>
        <p className="hm-meta">{statusLine}</p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "dashboard.selectPlan", "Select Plan")}</h2>
        <div className="hm-plan-grid hm-plan-grid--two">
          {(Object.keys(planCopy) as PlanKey[]).map((key) => {
            const plan = planCopy[key];
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
          <Button href={pathWithLocale(locale, "/billing/success")}>{t(messages, "subscribe.alreadyCheckedOut", "I ALREADY CHECKED OUT")}</Button>
          <Button href={pathWithLocale(locale, "/")}>{t(messages, "common.seeHowItWorks", "See How It Works")}</Button>
        </div>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "dashboard.afterCheckout", "After Checkout")}</h2>
        <ol className="hm-protocol-grid">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <strong>{index + 1})</strong> {t(messages, `dashboard.steps.${index}`, "")}
            </li>
          ))}
        </ol>
      </Panel>
    </main>
  );
}
