"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { trackEvent } from "@/lib/analytics/client";
import { formatCurrency } from "@/lib/i18n/format";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, listAt, objectAt, t } from "@/lib/i18n/messages";
import { resolveDisplayPlan } from "@/lib/pricing/display";

type PlanKey = "monthly_a" | "yearly";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/.netlify/functions";

const PLAN_COPY_DEFAULT: Record<PlanKey, { title: string; note: string }> = {
  monthly_a: {
    title: "HOLMETA PREMIUM",
    note: "full command center access"
  },
  yearly: {
    title: "HOLMETA YEARLY",
    note: "best for daily use"
  }
};

const DASHBOARD_STEPS_DEFAULT = [
  "Open /billing/success with your checkout session ID.",
  "Reveal and copy your one-time license key.",
  "Download the extension, paste the key, and turn on the tools you want."
] as const;

function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/${path}`;
}

type DashboardPageProps = {
  locale?: SupportedLocale;
};

export function DashboardPageContent({ locale = "en" }: DashboardPageProps) {
  const messages = getMessages(locale);
  const displayPlan = resolveDisplayPlan(locale);
  const monthlyPrice = `${formatCurrency(displayPlan.monthlyAmount, displayPlan.currency, locale)} / ${t(messages, "pricingPage.perMonth", "month")}`;
  const yearlyPrice = `${formatCurrency(displayPlan.yearlyAmount, displayPlan.currency, locale)} / ${t(messages, "pricingPage.perYear", "year")}`;
  const planCopy = {
    monthly_a: {
      title: String(objectAt(messages, "dashboard.plans.monthly_a", PLAN_COPY_DEFAULT.monthly_a)?.title || PLAN_COPY_DEFAULT.monthly_a.title),
      detail: `${monthlyPrice} · ${String(objectAt(messages, "dashboard.plans.monthly_a", PLAN_COPY_DEFAULT.monthly_a)?.note || PLAN_COPY_DEFAULT.monthly_a.note)}`
    },
    yearly: {
      title: String(objectAt(messages, "dashboard.plans.yearly", PLAN_COPY_DEFAULT.yearly)?.title || PLAN_COPY_DEFAULT.yearly.title),
      detail: `${yearlyPrice} · ${String(objectAt(messages, "dashboard.plans.yearly", PLAN_COPY_DEFAULT.yearly)?.note || PLAN_COPY_DEFAULT.yearly.note)}`
    }
  } satisfies Record<PlanKey, { title: string; detail: string }>;
  const [planKey, setPlanKey] = useState<PlanKey>("monthly_a");
  const [loading, setLoading] = useState(false);
  const [statusLine, setStatusLine] = useState(t(messages, "dashboard.statusReady", "STATUS: READY TO START 3-DAY TRIAL"));
  const checkoutSteps = listAt(messages, "dashboard.steps")
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const steps = checkoutSteps.length ? checkoutSteps : [...DASHBOARD_STEPS_DEFAULT];

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
        <p className="hm-kicker">{t(messages, "dashboard.kicker", "COMMAND CENTER ACCESS")}</p>
        <h1 className="hm-title">{t(messages, "dashboard.title", "pick the Holmeta plan that fits your browser workflow")}</h1>
        <p className="hm-meta">
          {t(messages, "dashboard.body", "One subscription unlocks adaptive appearance, light filters, alerts, meditation, site insight, translation, screenshot tools, and the local vault.")}
        </p>
        <p className="hm-meta">{statusLine}</p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "dashboard.selectPlan", "Choose your access plan")}</h2>
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
        <h2 className="hm-subtitle">{t(messages, "dashboard.afterCheckout", "What happens next")}</h2>
        <ol className="hm-protocol-grid">
          {steps.map((step, index) => (
            <li key={index}>
              <strong>{index + 1})</strong> {step}
            </li>
          ))}
        </ol>
      </Panel>
    </main>
  );
}
