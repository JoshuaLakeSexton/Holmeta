import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { listAt, getMessages, t } from "@/lib/i18n/messages";

type TermsPageProps = {
  locale?: SupportedLocale;
};

export function TermsPageContent({ locale = "en" }: TermsPageProps) {
  const messages = getMessages(locale);
  const scopeList = listAt(messages, "termsPage.scope").map((item) => String(item || "")).filter(Boolean);
  const billingList = listAt(messages, "termsPage.billing").map((item) => String(item || "")).filter(Boolean);
  const acceptableList = listAt(messages, "termsPage.acceptable").map((item) => String(item || "")).filter(Boolean);

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">{t(messages, "termsPage.kicker", "TERMS OF USE")}</p>
        <h1 className="hm-title">{t(messages, "termsPage.title", "Holmeta Terms")}</h1>
        <p className="hm-meta">
          {t(messages, "termsPage.effective", "Effective date: March 2, 2026")}
        </p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "termsPage.scopeTitle", "Service Scope")}</h2>
        <ul className="hm-list">
          {scopeList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "termsPage.billingTitle", "Billing and Trials")}</h2>
        <ul className="hm-list">
          {billingList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "termsPage.acceptableTitle", "Acceptable Use")}</h2>
        <ul className="hm-list">
          {acceptableList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="hm-meta">
          {t(messages, "termsPage.contact", "Contact")}: <a href={`mailto:${t(messages, "common.contactEmail", "reach@holmeta.com")}`}>{t(messages, "common.contactEmail", "reach@holmeta.com")}</a>
        </p>
        <div className="hm-cta-row">
          <Button href={pathWithLocale(locale, "/privacy")}>{t(messages, "termsPage.openPrivacy", "Read Privacy")}</Button>
          <Button href={pathWithLocale(locale, "/dashboard/subscribe")} variant="primary">{t(messages, "common.trialCta", "Start 3-Day Trial")}</Button>
        </div>
      </Panel>
    </main>
  );
}
