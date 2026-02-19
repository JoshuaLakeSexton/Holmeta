import Link from "next/link";
import { StatusCard } from "@/components/status-card";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="hero panel">
        <p className="kicker">MISSION BRIEFING</p>
        <h1>holmeta</h1>
        <p className="lede">
          Extension-first screen health + deep work instrumentation for people on screens 8+ hours/day. Local-first reminders, browser-only filter engine, and a $2/mo plan with a 3-day trial (trial enables Light Filters only).
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/dashboard">
            START FREE
          </Link>
          <Link className="btn" href="/dashboard">
            SUBSCRIBE ($2/MO)
          </Link>
        </div>
      </header>

      <section className="panel status-grid">
        <StatusCard label="STATUS" value="DEPLOYED" detail="MV3 extension + web dashboard" />
        <StatusCard label="PRICING" value="$2/MO" detail="Single premium tier" />
        <StatusCard label="PRIVACY" value="LOCAL-FIRST" detail="No data resale. Webcam posture local-only." />
        <StatusCard label="BILLING" value="STRIPE + NETLIFY" detail="Checkout, webhook, entitlement, pairing flow" />
      </section>

      <section className="panel" id="pricing">
        <p className="kicker">PRICING</p>
        <h2>Free + Premium</h2>
        <div className="split-grid">
          <article>
            <p className="meta-line">FREE</p>
            <ul className="list">
              <li>Basic filters + intensity controls</li>
              <li>Basic eye reminders (interval mode)</li>
              <li>Manual focus sessions</li>
            </ul>
          </article>
          <article>
            <p className="meta-line">SUBSCRIPTION ($2/MO)</p>
            <ul className="list">
              <li>During 3-day trial: Light Filters only</li>
              <li>Active subscription: all reminders, cadence, deep work, logs, posture, hydration, breathwork</li>
              <li>Pairing token + entitlement gating via Netlify functions</li>
            </ul>
          </article>
        </div>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/dashboard">
            OPEN ACCOUNT CONSOLE
          </Link>
        </div>
      </section>

      <section className="panel">
        <p className="kicker">BROWSER-ONLY LIMIT</p>
        <p className="lede">
          holmeta v1 can only transform browser-rendered content. It cannot apply OS-level gamma ramps like Iris system-wide controls. Strong in-browser intensity is achieved via matrix + CSS + overlay pipeline.
        </p>
      </section>

      <section className="panel">
        <p className="kicker">WELLNESS DISCLAIMER</p>
        <p className="lede">holmeta provides comfort/focus guidance and is not medical advice.</p>
      </section>
    </main>
  );
}
