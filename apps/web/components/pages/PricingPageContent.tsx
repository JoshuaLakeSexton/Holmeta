"use client";

import { useEffect } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { trackEvent } from "@/lib/analytics/client";
import { formatCurrency } from "@/lib/i18n/format";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, listAt, t } from "@/lib/i18n/messages";
import { resolveDisplayPlan } from "@/lib/pricing/display";

type PricingPageProps = {
  locale?: SupportedLocale;
};

export function PricingPageContent({ locale = "en" }: PricingPageProps) {
  const messages = getMessages(locale);
  const plan = resolveDisplayPlan(locale);
  const bullets = listAt(messages, "home.pricing.bullets").map((item) => String(item || "")).filter(Boolean);

  const monthlyLabel = formatCurrency(plan.monthlyAmount, plan.currency, locale);
  const yearlyLabel = formatCurrency(plan.yearlyAmount, plan.currency, locale);

  useEffect(() => {
    trackEvent("pricing_page_viewed", {
      locale,
      currency: plan.currency,
      source: plan.source
    });
  }, [locale, plan.currency, plan.source]);

  function onSelectPlan(planKey: "monthly_a" | "yearly") {
    trackEvent("subscription_plan_selected", {
      locale,
      planKey,
      currency: plan.currency,
      source: plan.source
    });
  }

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">{t(messages, "home.pricing.kicker", "PRICING")}</p>
        <h1 className="hm-title">{t(messages, "home.pricing.title", "Simple pricing")}</h1>
        <p className="hm-meta">{t(messages, "pricingPage.subtitle", "Full Holmeta access in one clean subscription. Adaptive appearance, filters, alerts, insight, and vault tools all stay inside the same command center.")}</p>
      </Panel>

      <Panel>
        <article className="hm-pricing-card" aria-label={t(messages, "pricingPage.aria.premiumCard", "Holmeta Premium pricing")}>
          <p className="hm-plan-kicker">{t(messages, "pricingPage.monthlyLabel", "MONTHLY")}</p>
          <h2 className="hm-subtitle">{monthlyLabel} / {t(messages, "pricingPage.perMonth", "month")}</h2>
          <ul className="hm-list">
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="hm-cta-row">
            <Button
              variant="primary"
              onClick={() => {
                onSelectPlan("monthly_a");
                window.location.href = pathWithLocale(locale, "/dashboard/subscribe");
              }}
            >
              {t(messages, "common.trialCta", "Start 3-Day Trial")}
            </Button>
          </div>
        </article>

        <article className="hm-pricing-card" aria-label={t(messages, "pricingPage.aria.yearlyCard", "Holmeta Yearly pricing")}>
          <p className="hm-plan-kicker">{t(messages, "pricingPage.yearlyLabel", "YEARLY")}</p>
          <h2 className="hm-subtitle">{yearlyLabel} / {t(messages, "pricingPage.perYear", "year")}</h2>
          <p className="hm-meta">{t(messages, "pricingPage.yearlyNote", "Prefer yearly billing? You can switch to it in checkout.")}</p>
          <div className="hm-cta-row">
            <Button
              onClick={() => {
                onSelectPlan("yearly");
                window.location.href = pathWithLocale(locale, "/dashboard/subscribe");
              }}
            >
              {t(messages, "pricingPage.openCheckout", "Start Checkout")}
            </Button>
          </div>
        </article>

        <p className="hm-meta">
          {t(messages, "pricingPage.footer", "Prices may localize by region. Stripe shows the final amount before you confirm.")}
        </p>
      </Panel>
    </main>
  );
}
