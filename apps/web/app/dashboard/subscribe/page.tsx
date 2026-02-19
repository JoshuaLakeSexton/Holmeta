import Link from "next/link";

export default function DashboardSubscribePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="kicker">SUBSCRIBE</p>
        <h1>holmeta billing gateway</h1>
        <p className="meta-line">Sign in on the dashboard, then start a 3-day trial or subscribe to keep premium extension features active.</p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/dashboard">
            OPEN DASHBOARD
          </Link>
          <Link className="btn" href="/">
            BACK TO HOME
          </Link>
        </div>
      </section>

      <section className="panel">
        <p className="kicker">PRICING</p>
        <p className="meta-line">$2/month subscription with 3-day free trial. Comfort/focus guidance only, not medical advice.</p>
      </section>
    </main>
  );
}
