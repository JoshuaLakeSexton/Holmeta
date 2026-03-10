import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

export default function BillingCancelPage() {
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">CHECKOUT CANCELLED</p>
        <h1 className="hm-title">no charge was made</h1>
        <p className="hm-meta">When you are ready, restart checkout and begin your 3-day trial.</p>
        <div className="hm-cta-row">
          <Button href="/dashboard/subscribe" variant="primary">
            Start 3-Day Trial
          </Button>
          <Button href="/">See How It Works</Button>
          <Button href="/billing/help">Billing Help</Button>
        </div>
      </Panel>
    </main>
  );
}
