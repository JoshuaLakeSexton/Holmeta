"use client";

import Image from "next/image";

import { Button } from "@/components/holmeta/Button";
import { FAQItem } from "@/components/holmeta/FAQItem";
import { FeatureCard } from "@/components/holmeta/FeatureCard";
import { Panel } from "@/components/holmeta/Panel";

const DEMO_VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || "";

const whyHolmeta = [
  {
    title: "Reduce eye strain",
    body: "Switch on browser light filters that make late work easier on your eyes."
  },
  {
    title: "Stay in deep work",
    body: "Run focus sessions that reduce interruptions and help you keep momentum."
  },
  {
    title: "Remember to reset",
    body: "Get subtle reminders for breaks, blinking, posture, and hydration."
  }
];

const pricingBullets = [
  "Red light + dim + contrast filters",
  "Focus timer and deep work mode",
  "Break, blink, posture, and hydration reminders",
  "Per-site presets",
  "3-day trial, cancel anytime"
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
            <Button href="/dashboard/subscribe" variant="primary">
              Start 3-Day Trial
            </Button>
            <Button href="#demo">Watch 30-Sec Demo</Button>
          </div>
        </div>
      </Panel>

      <section className="hm-section hm-hero" aria-labelledby="hero-title">
        <div className="hm-hero-grid">
          <Panel className="hm-hero-copy">
            <p className="hm-kicker">MISSION BRIEFING</p>
            <h1 className="hm-title" id="hero-title">
              Protect your eyes. Keep your focus.
            </h1>
            <p className="hm-lede">
              Holmeta is a browser extension for people who spend hours on screens. Use light filters,
              deep work sessions, and gentle reminders to reduce strain and stay on task.
            </p>
            <div className="hm-cta-row">
              <Button href="/dashboard/subscribe" variant="primary">
                Start 3-Day Trial
              </Button>
              <Button href="#demo">Watch 30-Sec Demo</Button>
            </div>
            <p className="hm-meta">Browser-only. Privacy-first. Cancel anytime.</p>
            <ul className="hm-list hm-hero-list hm-proof-list">
              <li>One-click Red Mode</li>
              <li>Deep Work Timer</li>
              <li>Break Reminders That Don’t Nag</li>
            </ul>
          </Panel>

          <Panel className="hm-proof-card" id="demo" aria-label="Holmeta demo preview">
            <p className="hm-kicker">30-SECOND DEMO</p>
            <p className="hm-meta">See filter toggle, focus timer, and reminder prompts in one quick walkthrough.</p>
            <figure className="hm-proof-frame hm-demo-frame">
              {DEMO_VIDEO_URL ? (
                <video
                  className="hm-demo-video"
                  src={DEMO_VIDEO_URL}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                />
              ) : (
                <div className="hm-demo-placeholder" role="status" aria-live="polite">
                  <strong>Demo coming live</strong>
                  <span>Video embed is supported here via NEXT_PUBLIC_DEMO_VIDEO_URL.</span>
                </div>
              )}
              <Image
                src="/images/holmeta-extension-command-center.png"
                alt="Holmeta extension popup showing focus, filters, reminders, and quick controls."
                width={384}
                height={1240}
                className="hm-proof-image"
                priority
              />
            </figure>
          </Panel>
        </div>
      </section>

      <section className="hm-section" aria-label="Proof strip">
        <Panel>
          <p className="hm-kicker">BUILT FOR PEOPLE WHO LIVE IN TABS</p>
          <div className="hm-trust-strip" aria-label="Trust markers">
            <span className="hm-chip">Browser-only controls</span>
            <span className="hm-chip">Local-first defaults</span>
            <span className="hm-chip">No ad-driven business model</span>
          </div>
        </Panel>
      </section>

      <section className="hm-section" id="features" aria-labelledby="features-title">
        <p className="hm-kicker">WHY HOLMETA</p>
        <h2 className="hm-subtitle" id="features-title">
          Why people keep Holmeta open
        </h2>
        <div className="hm-cap-grid hm-cap-grid--three">
          {whyHolmeta.map((item) => (
            <FeatureCard key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      <section className="hm-section" id="how-it-works" aria-labelledby="how-title">
        <Panel>
          <p className="hm-kicker">HOW IT WORKS</p>
          <h2 className="hm-subtitle" id="how-title">
            How Holmeta works
          </h2>
          <ol className="hm-protocol-grid">
            <li>
              <strong>1)</strong> Start your 3-day trial
            </li>
            <li>
              <strong>2)</strong> Download the extension
            </li>
            <li>
              <strong>3)</strong> Turn on filters, focus mode, and reminders in under a minute
            </li>
          </ol>
          <p className="hm-meta">
            No complicated setup. No account maze. Just install, activate, and go.
          </p>
          <div className="hm-cta-row">
            <Button href="/dashboard/subscribe" variant="primary">
              Start 3-Day Trial
            </Button>
            <Button href="#privacy">Read Privacy</Button>
          </div>
        </Panel>
      </section>

      <section className="hm-section" id="pricing" aria-labelledby="pricing-title">
        <Panel>
          <p className="hm-kicker">PRICING</p>
          <h2 className="hm-subtitle" id="pricing-title">
            Simple pricing
          </h2>

          <article className="hm-pricing-card" aria-label="Holmeta Premium pricing">
            <p className="hm-meta">HOLMETA PREMIUM — $2/MONTH</p>
            <ul className="hm-list">
              {pricingBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="hm-cta-row">
              <Button href="/dashboard/subscribe" variant="primary">
                Start 3-Day Trial
              </Button>
              <Button href="#how-it-works">See How It Works</Button>
            </div>
          </article>

          <p className="hm-meta">
            No ads. No data-selling business model. Just a focused utility that helps you work better.
          </p>
        </Panel>
      </section>

      <section className="hm-section" id="privacy" aria-labelledby="privacy-title">
        <Panel>
          <p className="hm-kicker">PRIVACY</p>
          <h2 className="hm-subtitle" id="privacy-title">
            Built to stay in your browser
          </h2>
          <p className="hm-lede">
            Holmeta runs where you work: inside the browser. Sensitive controls stay local. Billing only unlocks
            premium features.
          </p>
          <ul className="hm-list">
            <li>Local-first by default</li>
            <li>Browser-only by design</li>
            <li>Cancel anytime</li>
            <li>No ad-driven business model</li>
          </ul>
          <div className="hm-cta-row">
            <Button href="/privacy">Read Privacy</Button>
            <Button href="/terms">Read Terms</Button>
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
            <FAQItem question="Why is Holmeta paid?">
              <p className="hm-meta">
                Holmeta is a focused utility with ongoing updates, privacy-first local controls, and no ad-based
                business model. At $2/month, it’s designed to be a small tool that makes your browser easier on your
                eyes and attention.
              </p>
            </FAQItem>

            <FAQItem question="Does Holmeta work system-wide?">
              <p className="hm-meta">Holmeta v1 is browser-only by design.</p>
            </FAQItem>

            <FAQItem question="What happens during the trial?">
              <p className="hm-meta">You get access to Premium features for 3 days. Cancel anytime.</p>
            </FAQItem>

            <FAQItem question="What data do you store?">
              <p className="hm-meta">
                Billing and license records needed to unlock Premium. Core browsing controls run locally in your
                extension.
              </p>
            </FAQItem>

            <FAQItem question="Which browsers are supported?">
              <p className="hm-meta">
                Chromium browsers now. Expand support later as store distribution grows.
              </p>
            </FAQItem>
          </div>
        </Panel>
      </section>

      <footer className="hm-footer" aria-label="Footer links">
        <a href="/status">Status / Changelog</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/dashboard/subscribe">Start 3-Day Trial</a>
      </footer>
    </main>
  );
}
