"use client";

import Image from "next/image";

import { Accordion } from "@/components/holmeta/Accordion";
import { Button } from "@/components/holmeta/Button";
import { FAQItem } from "@/components/holmeta/FAQItem";
import { FeatureCard } from "@/components/holmeta/FeatureCard";
import { Panel } from "@/components/holmeta/Panel";

const capabilities = [
  {
    title: "Light Filters",
    body: "night-friendly color + brightness controls, per-site options."
  },
  {
    title: "Focus Sessions",
    body: "timed deep work with clean transitions and optional audio cues."
  },
  {
    title: "Reminders",
    body: "hydration, posture, blink/break nudges (you choose frequency)."
  },
  {
    title: "Per-Site Rules",
    body: "\"allow/deny + intensity profiles\" for different workflows."
  },
  {
    title: "Minimal UI",
    body: "fast toggles, no bloat, predictable behavior."
  },
  {
    title: "Local-first Defaults",
    body: "sensitive settings stay on-device; license checks only unlock paid modules."
  }
];

export default function HomePage() {
  return (
    <main className="shell hm-home" id="top">
      <Panel as="header" className="hm-home-header">
        <div className="hm-top-nav">
          <a href="#top" className="hm-brand" aria-label="HOLMETA home">
            HOLMETA
          </a>
          <nav className="hm-nav-links" aria-label="Primary navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it Works</a>
            <a href="#privacy">Privacy</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="hm-nav-actions">
            <Button href="/download" variant="primary">
              Get Extension
            </Button>
            <Button href="/dashboard">Open Dashboard</Button>
          </div>
        </div>
      </Panel>

      <section className="hm-section hm-hero" aria-labelledby="hero-title">
        <div className="hm-hero-grid">
          <Panel className="hm-proof-card" aria-label="Holmeta extension screenshot">
            <p className="hm-kicker">LIVE PREVIEW</p>
            <p className="hm-meta">Holmeta extension command center</p>
            <figure className="hm-proof-frame">
              <Image
                src="/images/holmeta-extension-command-center.png"
                alt="Holmeta extension popup with reminder readouts, focus controls, and filter controls."
                width={384}
                height={1240}
                className="hm-proof-image"
                priority
              />
            </figure>
          </Panel>

          <Panel className="hm-hero-copy">
            <p className="hm-kicker">MISSION BRIEFING</p>
            <h1 className="hm-title" id="hero-title">
              MISSION: Reduce screen strain. Increase focus.
            </h1>
            <p className="hm-lede">
              HOLMETA is a browser toolkit for devs, designers, desk workers, and biohackers.
            </p>
            <ul className="hm-list hm-hero-list">
              <li>Light Filters — redlight, dim, contrast</li>
              <li>Focus Sessions — deep work, fewer interruptions</li>
              <li>Micro-Reminders — breaks, posture, hydration</li>
            </ul>
            <div className="hm-cta-row">
              <Button href="/download" variant="primary">
                Get Extension
              </Button>
              <Button href="/dashboard">Open Dashboard</Button>
            </div>
            <p className="hm-meta">Browser-only by design. Cancel anytime.</p>
            <div className="hm-trust-strip" aria-label="Trust markers">
              <span className="hm-chip">Browser-only</span>
              <span className="hm-chip">Cancel anytime</span>
            </div>
          </Panel>
        </div>
      </section>

      <section className="hm-section" id="features" aria-labelledby="features-title">
        <p className="hm-kicker">FEATURES</p>
        <h2 className="hm-subtitle" id="features-title">
          Capabilities
        </h2>
        <div className="hm-cap-grid">
          {capabilities.map((item) => (
            <FeatureCard key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      <section className="hm-section" id="how-it-works" aria-labelledby="protocol-title">
        <Panel>
          <p className="hm-kicker">HOW IT WORKS</p>
          <h2 className="hm-subtitle" id="protocol-title">
            Protocol
          </h2>
          <ol className="hm-protocol-grid">
            <li>
              <strong>1)</strong> Install the extension for your browser.
            </li>
            <li>
              <strong>2)</strong> Choose a plan and complete Stripe Checkout.
            </li>
            <li>
              <strong>3)</strong> Copy your license key from Billing Success and activate it in the extension.
            </li>
          </ol>
        </Panel>
      </section>

      <section className="hm-section" id="privacy" aria-labelledby="privacy-title">
        <Panel>
          <p className="hm-kicker">PRIVACY</p>
          <h2 className="hm-subtitle" id="privacy-title">
            Privacy Posture
          </h2>
          <p className="hm-lede">Holmeta is built to work without exporting your browsing life.</p>
          <p className="hm-lede">Filters + session controls run in your browser.</p>
          <p className="hm-lede">Subscription status is verified so Premium features can be unlocked.</p>

          <Accordion title="Tech Notes">
            <ul className="hm-list">
              <li>MV3 extension + web dashboard</li>
              <li>License validation + entitlements via secure server functions</li>
              <li>Minimal telemetry (or none) — document what you actually do</li>
            </ul>
          </Accordion>
        </Panel>
      </section>

      <section className="hm-section" id="pricing" aria-labelledby="pricing-title">
        <Panel>
          <p className="hm-kicker">PRICING</p>
          <h2 className="hm-subtitle" id="pricing-title">
            Free vs Premium
          </h2>
          <div className="hm-split-grid">
            <article>
              <p className="hm-meta">FREE</p>
              <ul className="hm-list">
                <li>Core baseline controls</li>
                <li>Basic reminders</li>
                <li>Access to dashboard</li>
              </ul>
            </article>
            <article>
              <p className="hm-meta">PREMIUM — $2/mo</p>
              <ul className="hm-list">
                <li>Full filter suite + per-site rules</li>
                <li>Focus sessions with advanced controls</li>
                <li>Priority updates + new modules</li>
              </ul>
            </article>
          </div>
          <div className="hm-cta-row">
            <Button href="/dashboard/subscribe" variant="primary">
              Start Trial
            </Button>
            <p className="hm-meta">3 days · Cancel anytime.</p>
          </div>
        </Panel>
      </section>

      <section className="hm-section" id="faq" aria-labelledby="faq-title">
        <Panel>
          <p className="hm-kicker">FAQ</p>
          <h2 className="hm-subtitle" id="faq-title">
            Common Questions
          </h2>

          <div className="hm-faq-list">
            <FAQItem question="What does “local-first” mean here?">
              <p className="hm-meta">
                Core browsing controls run in your extension. Billing and entitlement checks are handled
                server-side.
              </p>
            </FAQItem>

            <FAQItem question="Does this work system-wide or only in the browser?">
              <p className="hm-meta">Holmeta v1 is browser-only by design.</p>
            </FAQItem>

            <FAQItem question="Which browsers are supported?">
              <p className="hm-meta">
                Chromium browsers are supported now. Firefox/Safari rollout depends on store publishing
                status.
              </p>
            </FAQItem>

            <FAQItem question="What’s included in the trial vs free vs premium?">
              <p className="hm-meta">
                Free covers baseline controls. The 3-day trial is for Premium evaluation. Premium unlocks
                advanced modules.
              </p>
            </FAQItem>

            <FAQItem question="Can I cancel immediately?">
              <p className="hm-meta">Yes. You can cancel anytime from the billing flow.</p>
            </FAQItem>

            <FAQItem question="What data do you store?">
              <p className="hm-meta">
                License and subscription records required for billing. Sensitive browsing behavior is not
                required
                for core operation.
              </p>
            </FAQItem>

            <FAQItem question="I installed it—how do I unlock Premium?">
              <p className="hm-meta">
                Open billing success, copy your license key, then paste it in Extension Options and click Activate.
              </p>
            </FAQItem>

            <FAQItem question="Where’s the changelog / status?">
              <p className="hm-meta">Use the dashboard links in the footer for current status and rollout notes.</p>
            </FAQItem>
          </div>
        </Panel>
      </section>

      <footer className="hm-footer" aria-label="Footer links">
        <a href="/status">Status / Changelog</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/dashboard/subscribe">Billing</a>
      </footer>
    </main>
  );
}
