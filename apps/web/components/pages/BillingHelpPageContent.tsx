import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, t } from "@/lib/i18n/messages";

type BillingHelpPageProps = {
  locale?: SupportedLocale;
};

export function BillingHelpPageContent({ locale = "en" }: BillingHelpPageProps) {
  const messages = getMessages(locale);
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">{t(messages, "billingHelp.kicker", "BILLING SUPPORT")}</p>
        <h1 className="hm-title">{t(messages, "billingHelp.title", "license, cancellation, and refunds")}</h1>
        <p className="hm-meta">
          {t(messages, "billingHelp.body", "Need help after checkout? Use this page to recover your license key, cancel in Stripe, or request a refund review.")}
        </p>

        <h2 className="hm-subtitle">{t(messages, "billingHelp.quickActions", "Quick Actions")}</h2>
        <div className="hm-cta-row">
          <Button href={pathWithLocale(locale, "/billing/success")}>{t(messages, "billingHelp.recover", "Recover License Key")}</Button>
          <Button href={pathWithLocale(locale, "/dashboard/subscribe")} variant="primary">{t(messages, "common.trialCta", "Start 3-Day Trial")}</Button>
          <Button href={pathWithLocale(locale, "/terms")}>{t(messages, "billingHelp.readTerms", "Read Billing Terms")}</Button>
        </div>

        <h2 className="hm-subtitle">{t(messages, "billingHelp.cancelTitle", "How to Cancel")}</h2>
        <ol className="hm-protocol-grid">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <strong>{index + 1})</strong> {t(messages, `billingHelp.cancelSteps.${index}`, "")}
            </li>
          ))}
        </ol>

        <h2 className="hm-subtitle">{t(messages, "billingHelp.refundTitle", "Refund Requests")}</h2>
        <p className="hm-meta">
          {t(messages, "billingHelp.refundBody", "Refunds are handled case-by-case. Include your checkout session id and reason so support can review quickly.")}
        </p>
        <ul className="hm-protocol-grid">
          <li>
            <strong>{t(messages, "billingHelp.contactLabel", "Contact")}:</strong>{" "}
            <a href={`mailto:${t(messages, "common.contactEmail", "reach@holmeta.com")}`}>{t(messages, "common.contactEmail", "reach@holmeta.com")}</a>
          </li>
          <li><strong>{t(messages, "billingHelp.subjectLabel", "Subject")}:</strong> {t(messages, "billingHelp.subject", "HOLMETA REFUND REQUEST")}</li>
          <li><strong>{t(messages, "billingHelp.includeLabel", "Include")}:</strong> {t(messages, "billingHelp.includeBody", "session id, purchase date, and a brief issue summary")}</li>
        </ul>
      </Panel>
    </main>
  );
}
