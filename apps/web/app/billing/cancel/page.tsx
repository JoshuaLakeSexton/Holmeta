import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

export default function BillingCancelPage() {
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">BILLING</p>
        <h1 className="hm-title">checkout cancelled</h1>
        <p className="hm-meta">
          No changes were made. You can restart checkout from the dashboard at any time.
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
