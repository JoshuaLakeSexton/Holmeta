import { Panel } from "@/components/holmeta/Panel";
import { type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, listAt, t } from "@/lib/i18n/messages";

type StatusPageProps = {
  locale?: SupportedLocale;
};

export function StatusPageContent({ locale = "en" }: StatusPageProps) {
  const messages = getMessages(locale);
  const localizedChangelog = listAt(messages, "statusPage.changelog")
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as { date?: string; id?: string; summary?: string };
      return {
        date: String(item.date || ""),
        id: String(item.id || ""),
        summary: String(item.summary || "")
      };
    })
    .filter((entry): entry is { date: string; id: string; summary: string } => Boolean(entry?.date && entry?.id && entry?.summary));

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
          {localizedChangelog.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.date}</strong> · {entry.id} · {entry.summary}
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
