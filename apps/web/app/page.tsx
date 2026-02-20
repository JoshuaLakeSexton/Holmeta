import { Button } from "@/components/holmeta/Button";
import { DownloadCTA } from "@/components/holmeta/DownloadCTA";
import { Panel } from "@/components/holmeta/Panel";
import { StatusCard } from "@/components/status-card";

export default function HomePage() {
  return (
    <main className="shell">
      <Panel as="header" className="hero">
        <p className="hm-kicker">MISSION BRIEFING</p>
        <h1 className="hm-title">holmeta</h1>
        <p className="hm-lede">
          Extension-first screen health + deep work instrumentation for people on screens 8+ hours/day. Local-first reminders,
          browser-only filter engine, and a $2/mo plan with a 3-day trial (trial enables Light Filters only).
        </p>
        <div className="hm-cta-row">
          <DownloadCTA />
          <Button href="/dashboard">Start Free</Button>
          <Button href="/dashboard/subscribe">Subscribe ($2/mo)</Button>
        </div>
      </Panel>

      <Panel className="hm-status-grid">
        <StatusCard label="STATUS" value="DEPLOYED" detail="MV3 extension + web dashboard" />
        <StatusCard label="PRICING" value="$2/MO" detail="Single premium tier" />
        <StatusCard label="PRIVACY" value="LOCAL-FIRST" detail="No data resale. Webcam posture local-only." />
        <StatusCard label="BILLING" value="STRIPE + NETLIFY" detail="Checkout, webhook, entitlement, pairing flow" />
      </Panel>

      <Panel id="pricing">
        <p className="hm-kicker">PRICING</p>
        <h2 className="hm-subtitle">Free + Premium</h2>
        <div className="hm-split-grid">
          <article>
            <p className="hm-meta">FREE</p>
            <ul className="hm-list">
              <li>Basic filters + intensity controls</li>
              <li>Basic eye reminders (interval mode)</li>
              <li>Manual focus sessions</li>
            </ul>
          </article>
          <article>
            <p className="hm-meta">SUBSCRIPTION ($2/MO)</p>
            <ul className="hm-list">
              <li>During 3-day trial: Light Filters only</li>
              <li>Active subscription: all reminders, cadence, deep work, logs, posture, hydration, breathwork</li>
              <li>Pairing token + entitlement gating via Netlify functions</li>
            </ul>
          </article>
        </div>
        <div className="hm-cta-row">
          <Button href="/dashboard" variant="primary">
            Open Account Console
          </Button>
          <DownloadCTA />
        </div>
      </Panel>

      <Panel>
        <p className="hm-kicker">BROWSER-ONLY LIMIT</p>
        <p className="hm-lede">
          holmeta v1 can only transform browser-rendered content. It cannot apply OS-level gamma ramps like Iris system-wide
          controls. Strong in-browser intensity is achieved via matrix + CSS + overlay pipeline.
        </p>
      </Panel>

      <Panel>
        <p className="hm-kicker">WELLNESS DISCLAIMER</p>
        <p className="hm-lede">holmeta provides comfort/focus guidance and is not medical advice.</p>
      </Panel>
    </main>
  );
}
