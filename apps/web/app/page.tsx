import Link from "next/link";
import { buildColorMatrix, matrixToString } from "@holmeta/shared";
import { StatusCard } from "@/components/status-card";

const previewMatrix = matrixToString(
  buildColorMatrix("nightWarm", 0.65, {
    wakeTime: "07:00",
    sleepTime: "23:00",
    rampMinutes: 60
  })
);

export default function HomePage() {
  return (
    <main className="shell">
      <header className="hero panel">
        <p className="kicker">MISSION BRIEFING</p>
        <h1>holmeta</h1>
        <p className="lede">
          Extension-first screen health, deep work enforcement, and biohacking micro-protocols for 8+ hour screen workers.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/dashboard">
            OPEN DASHBOARD
          </Link>
          <a className="btn" href="#pricing">
            VIEW PRICING
          </a>
        </div>
      </header>

      <section className="panel status-grid">
        <StatusCard label="STATUS" value="DEPLOYED" detail="Browser extension MVP available now" />
        <StatusCard label="PRICING" value="$2/MO" detail="Stripe scaffold + entitlement endpoint included" />
        <StatusCard label="PRIVACY" value="LOCAL-FIRST" detail="No data resale. Webcam posture mode stays local." />
        <StatusCard label="FILTER MATRIX" value="SVG feColorMatrix" detail={`PREVIEW: ${previewMatrix}`} />
      </section>

      <section className="panel" id="pricing">
        <p className="kicker">PRICING</p>
        <h2>Single Operator Plan</h2>
        <p className="lede">$2/month. Basic reminders remain available in trial mode. Premium unlocks advanced customization and webcam posture monitor.</p>
        <ul className="list">
          <li>Deep work domain rules + panic button</li>
          <li>Circadian filter presets + local schedule ramp</li>
          <li>Hydration, breathwork, and daily audit logs</li>
          <li>Premium-only: custom ramps, webcam posture mode, advanced theming</li>
        </ul>
        <Link className="btn btn-primary" href="/dashboard">
          UNLOCK PREMIUM
        </Link>
      </section>

      <section className="panel">
        <p className="kicker">LIMITATION NOTICE</p>
        <p className="lede">
          v1 applies health filters inside browser content only. True system-wide color and app-level control requires a future desktop companion.
        </p>
      </section>
    </main>
  );
}
