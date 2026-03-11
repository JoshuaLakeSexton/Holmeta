"use client";

import { useEffect } from "react";

import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { trackEvent } from "@/lib/analytics/client";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, t } from "@/lib/i18n/messages";

type BillingCancelPageProps = {
  locale?: SupportedLocale;
};

export function BillingCancelPageContent({ locale = "en" }: BillingCancelPageProps) {
  const messages = getMessages(locale);
  useEffect(() => {
    trackEvent("checkout_cancel_page_viewed", { locale });
  }, [locale]);
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">{t(messages, "billingCancel.kicker", "CHECKOUT CANCELLED")}</p>
        <h1 className="hm-title">{t(messages, "billingCancel.title", "no charge was made")}</h1>
        <p className="hm-meta">{t(messages, "billingCancel.body", "When you are ready, restart checkout and begin your 3-day trial.")}</p>
        <div className="hm-cta-row">
          <Button href={pathWithLocale(locale, "/dashboard/subscribe")} variant="primary">
            {t(messages, "common.trialCta", "Start 3-Day Trial")}
          </Button>
          <Button href={pathWithLocale(locale, "/")}>{t(messages, "common.seeHowItWorks", "See How It Works")}</Button>
          <Button href={pathWithLocale(locale, "/billing/help")}>{t(messages, "billingCancel.help", "Billing Help")}</Button>
        </div>
      </Panel>
    </main>
  );
}
