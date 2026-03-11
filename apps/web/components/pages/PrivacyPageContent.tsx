import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { listAt, getMessages, t } from "@/lib/i18n/messages";

type PrivacyPageProps = {
  locale?: SupportedLocale;
};

export function PrivacyPageContent({ locale = "en" }: PrivacyPageProps) {
  const messages = getMessages(locale);
  const storeList = listAt(messages, "privacyPage.store").map((item) => String(item || "")).filter(Boolean);
  const skipList = listAt(messages, "privacyPage.notStore").map((item) => String(item || "")).filter(Boolean);
  const processList = listAt(messages, "privacyPage.processing").map((item) => String(item || "")).filter(Boolean);

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">{t(messages, "privacyPage.kicker", "PRIVACY POLICY")}</p>
        <h1 className="hm-title">{t(messages, "privacyPage.title", "Holmeta Privacy Posture")}</h1>
        <p className="hm-meta">
          {t(messages, "privacyPage.effective", "Effective date: March 2, 2026")}
        </p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "privacyPage.storeTitle", "What We Store")}</h2>
        <ul className="hm-list">
          {storeList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "privacyPage.notStoreTitle", "What We Do Not Store")}</h2>
        <ul className="hm-list">
          {skipList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "privacyPage.processingTitle", "Permissions and Processing")}</h2>
        <ul className="hm-list">
          {processList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="hm-meta">
          {t(messages, "privacyPage.contact", "Contact")}: <a href={`mailto:${t(messages, "common.contactEmail", "reach@holmeta.com")}`}>{t(messages, "common.contactEmail", "reach@holmeta.com")}</a>
        </p>
        <div className="hm-cta-row">
          <Button href={pathWithLocale(locale, "/terms")}>{t(messages, "privacyPage.openTerms", "Open Terms")}</Button>
          <Button href={pathWithLocale(locale, "/dashboard/subscribe")} variant="primary">{t(messages, "common.trialCta", "Start 3-Day Trial")}</Button>
        </div>
      </Panel>
    </main>
  );
}
