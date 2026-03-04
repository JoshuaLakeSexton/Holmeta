import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

export default function BillingCancelPage() {
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">BILLING</p>
        <h1 className="hm-title">checkout cancelled</h1>
        <p className="hm-meta">No charge was made. Restart checkout when ready.</p>
        <div className="hm-cta-row">
          <Button href="/dashboard/subscribe" variant="primary">
            START CHECKOUT
          </Button>
          <Button href="/billing/help">BILLING HELP</Button>
          <Button href="/">BACK TO HOME</Button>
        </div>
      </Panel>
    </main>
  );
}
