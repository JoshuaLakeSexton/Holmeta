import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

export default function BillingSuccessPage() {
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">BILLING</p>
        <h1 className="hm-title">checkout complete</h1>
        <p className="hm-meta">
          Stripe checkout succeeded. Return to the dashboard and refresh entitlement to unlock access.
        </p>
        <div className="hm-cta-row">
          <Button href="/dashboard" variant="primary">
            OPEN DASHBOARD
          </Button>
          <Button href="/">BACK TO HOME</Button>
        </div>
      </Panel>
    </main>
  );
}
