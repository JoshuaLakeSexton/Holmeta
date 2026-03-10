import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

export default function PrivacyPage() {
  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">PRIVACY POLICY</p>
        <h1 className="hm-title">Holmeta Privacy Posture</h1>
        <p className="hm-meta">
          Effective date: March 2, 2026
        </p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">What We Store</h2>
        <ul className="hm-list">
          <li>Extension settings and reminder logs are stored locally in your browser by default.</li>
          <li>Stripe billing records and license hashes are stored server-side for subscriptions and unlock checks.</li>
          <li>Entitlement state (trialing/active/inactive) is stored to unlock paid features.</li>
        </ul>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">What We Do Not Store</h2>
        <ul className="hm-list">
          <li>No keylogging.</li>
          <li>No sale of personal data.</li>
          <li>No page-content harvesting for ad analytics.</li>
        </ul>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">Permissions and Processing</h2>
        <ul className="hm-list">
          <li>Screen filters and reminder overlays run in-browser.</li>
          <li>Camera access is optional and requested only if webcam posture mode is enabled.</li>
          <li>Billing, download gating, and license checks are processed through secure server functions.</li>
        </ul>
        <div className="hm-cta-row">
          <Button href="/terms">Open Terms</Button>
          <Button href="/dashboard/subscribe" variant="primary">Start 3-Day Trial</Button>
        </div>
      </Panel>
    </main>
  );
}
