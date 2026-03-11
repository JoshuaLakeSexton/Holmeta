import { Panel } from "@/components/holmeta/Panel";
import { type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, t } from "@/lib/i18n/messages";

const changelog = [
  {
    date: "2026-03-10",
    id: "HM-2026-03-10-A",
    summary: "Light Filters hardening: dark/light reading now uses safe single-strategy rendering with page-tone fallback clamps to prevent unreadable pages."
  },
  {
    date: "2026-03-10",
    id: "HM-2026-03-10-B",
    summary: "Production verification pass: Netlify env check, checkout smoke for monthly_a + yearly, gated download access control, and extension zip sync validation."
  },
  {
    date: "2026-03-04",
    id: "HM-2026-03-04-B",
    summary: "GA hardening: gated extension download, no-login license activation flow, and webhook idempotency checks."
  },
  {
    date: "2026-03-04",
    id: "HM-2026-03-04-A",
    summary: "Plan simplification: monthly_a + yearly only across checkout, validation, and smoke scripts."
  },
  {
    date: "2026-02-25",
    id: "HM-2026-02-25-B",
    summary: "Netlify build pipeline stabilized with extension zip sync and CSS integrity guard."
  },
  {
    date: "2026-02-24",
    id: "HM-2026-02-24-C",
    summary: "Homepage structure updated to mission-briefing format with browser-aware download flow."
  }
];

type StatusPageProps = {
  locale?: SupportedLocale;
};

export function StatusPageContent({ locale = "en" }: StatusPageProps) {
  const messages = getMessages(locale);
  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">{t(messages, "statusPage.kicker", "SYSTEM STATUS")}</p>
        <h1 className="hm-title">{t(messages, "statusPage.title", "Holmeta Release Status")}</h1>
        <p className="hm-chip status-active">{t(messages, "statusPage.operational", "STATUS: OPERATIONAL")}</p>
        <p className="hm-chip status-warning">{t(messages, "statusPage.monitoring", "MONITORING: ENABLED (FUNCTION LOGS + CLIENT ERROR INGEST)")}</p>
        <p className="hm-meta">{t(messages, "statusPage.updated", "Last updated: March 10, 2026")}</p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">{t(messages, "statusPage.recent", "Recent Changelog")}</h2>
        <ul className="hm-list">
          {changelog.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.date}</strong> · {entry.id} · {entry.summary}
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
