import { Button } from "@/components/holmeta/Button";
import { Panel } from "@/components/holmeta/Panel";

const plans = [
  {
    key: "monthly_a",
    label: "MONTHLY A",
    detail: "$2/mo"
  },
  {
    key: "monthly_b",
    label: "MONTHLY B",
    detail: "Alt monthly option"
  },
  {
    key: "yearly",
    label: "YEARLY",
    detail: "Annual option"
  }
];

export default function DashboardSubscribePage() {
  return (
    <main className="shell">
      <Panel>
        <p className="hm-kicker">SUBSCRIBE</p>
        <h1 className="hm-title">holmeta billing gateway</h1>
        <p className="hm-meta">
          Sign in on the dashboard, pick a plan, then start Stripe Checkout.
        </p>
        <p className="hm-meta">
          Trial: 3 days. During trial, only Light Filters stay enabled in the extension.
        </p>
        <div className="hm-plan-grid">
          {plans.map((plan) => (
            <div key={plan.key} className="hm-plan-card" aria-label={plan.label}>
              <span className="hm-plan-kicker">{plan.label}</span>
              <strong>{plan.detail}</strong>
            </div>
          ))}
        </div>
        <div className="hm-cta-row">
          <Button href="/dashboard" variant="primary">
            OPEN DASHBOARD TO CHECK OUT
          </Button>
          <Button href="/">BACK TO HOME</Button>
        </div>
      </Panel>
    </main>
  );
}
