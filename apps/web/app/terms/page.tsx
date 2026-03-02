import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

export default function TermsPage() {
  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">TERMS OF USE</p>
        <h1 className="hm-title">Holmeta Terms</h1>
        <p className="hm-meta">
          Effective date: March 2, 2026
        </p>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">Service Scope</h2>
        <ul className="hm-list">
          <li>Holmeta provides browser-based wellness and focus tooling.</li>
          <li>Holmeta is not medical advice, diagnosis, or treatment.</li>
          <li>Some features require an active subscription.</li>
        </ul>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">Billing and Trials</h2>
        <ul className="hm-list">
          <li>Premium pricing is $2 per month.</li>
          <li>Trial terms are shown in checkout and dashboard status.</li>
          <li>You can manage or cancel from the billing portal.</li>
        </ul>
      </Panel>

      <Panel>
        <h2 className="hm-subtitle">Acceptable Use</h2>
        <ul className="hm-list">
          <li>Do not use the service for unlawful activity.</li>
          <li>Do not attempt to abuse billing, pairing, or entitlement systems.</li>
          <li>Use at your own discretion in accordance with browser and platform policies.</li>
        </ul>
        <div className="hm-cta-row">
          <Button href="/privacy">Open Privacy</Button>
          <Button href="/dashboard/subscribe" variant="primary">Open Billing</Button>
        </div>
      </Panel>
    </main>
  );
}
