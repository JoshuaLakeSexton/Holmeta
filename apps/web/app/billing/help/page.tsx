import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

export default function BillingHelpPage() {
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">BILLING SUPPORT</p>
        <h1 className="hm-title">license, cancellation, and refunds</h1>
        <p className="hm-meta">
          Need help after checkout? Use this page to recover your license key, cancel in Stripe, or request a refund review.
        </p>

        <h2 className="hm-subtitle">Quick Actions</h2>
        <div className="hm-cta-row">
          <Button href="/billing/success">Recover License Key</Button>
          <Button href="/dashboard/subscribe" variant="primary">Start 3-Day Trial</Button>
          <Button href="/terms">Read Billing Terms</Button>
        </div>

        <h2 className="hm-subtitle">How to Cancel</h2>
        <ol className="hm-protocol-grid">
          <li><strong>1)</strong> Open <code>/billing/success</code> with your checkout <code>session_id</code>.</li>
          <li><strong>2)</strong> Click <strong>Manage Billing</strong> to open the Stripe billing portal.</li>
          <li><strong>3)</strong> In Stripe, select <strong>Cancel subscription</strong>.</li>
        </ol>

        <h2 className="hm-subtitle">Refund Requests</h2>
        <p className="hm-meta">
          Refunds are handled case-by-case. Include your checkout session id and reason so support can review quickly.
        </p>
        <ul className="hm-protocol-grid">
          <li><strong>Contact:</strong> use the support address listed on your Stripe receipt.</li>
          <li><strong>Subject:</strong> HOLMETA REFUND REQUEST</li>
          <li><strong>Include:</strong> session id, purchase date, and a brief issue summary</li>
        </ul>
      </Panel>
    </main>
  );
}
