import { Panel } from "@/components/holmeta/Panel";

const changelog = [
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

export default function StatusPage() {
  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">SYSTEM STATUS</p>
        <h1 className="hm-title">Holmeta Release Status</h1>
        <p className="hm-chip status-active">STATUS: OPERATIONAL</p>
        <p className="hm-chip status-warning">MONITORING: ENABLED (FUNCTION LOGS + CLIENT ERROR INGEST)</p>
        <p className="hm-meta">Last updated: March 4, 2026</p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">Recent Changelog</h2>
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
