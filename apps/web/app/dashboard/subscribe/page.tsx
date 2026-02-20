import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

export default function DashboardSubscribePage() {
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">SUBSCRIBE</p>
        <h1 className="hm-title">holmeta billing gateway</h1>
        <p className="hm-meta">Sign in on the dashboard, then start a 3-day trial or subscribe to keep premium extension features active.</p>
        <div className="hm-cta-row">
          <Button href="/dashboard" variant="primary">
            OPEN DASHBOARD
          </Button>
          <Button href="/">BACK TO HOME</Button>
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">PRICING</p>
        <p className="hm-meta">$2/month subscription with 3-day free trial. Comfort/focus guidance only, not medical advice.</p>
      </Panel>
    </main>
  );
}
