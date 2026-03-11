"use client";

import { Button } from "@/components/holmeta/Button";
import { FAQItem } from "@/components/holmeta/FAQItem";
import { FeatureCard } from "@/components/holmeta/FeatureCard";
import { Panel } from "@/components/holmeta/Panel";
import { pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, listAt, t, type MessageTree } from "@/lib/i18n/messages";

const DEMO_VIDEO_PATH = "/videos/holmeta-demo.mp4";
const NAV_LOCALES: Array<{ code: SupportedLocale; label: string }> = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh-cn", label: "简体中文" },
  { code: "zh-tw", label: "繁體中文" }
];

type HomePageProps = {
  locale?: SupportedLocale;
};

function localizedHref(locale: SupportedLocale, pathOrHash: string): string {
  if (pathOrHash.startsWith("#")) {
    return pathWithLocale(locale, "/") + pathOrHash;
  }
  return pathWithLocale(locale, pathOrHash);
}

function featureItems(messages: MessageTree) {
  const items = listAt(messages, "home.why.items");
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { title?: string; body?: string };
      return {
        title: String(row.title || ""),
        body: String(row.body || "")
      };
    })
    .filter((item): item is { title: string; body: string } => Boolean(item?.title && item?.body));
}

function faqItems(messages: MessageTree) {
  const items = listAt(messages, "home.faq.items");
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { q?: string; a?: string };
      return {
        q: String(row.q || ""),
        a: String(row.a || "")
      };
    })
    .filter((item): item is { q: string; a: string } => Boolean(item?.q && item?.a));
}

export function HomePageContent({ locale = "en" }: HomePageProps) {
  const messages = getMessages(locale);
  const whyHolmeta = featureItems(messages);
  const pricingBullets = listAt(messages, "home.pricing.bullets").map((item) => String(item || "")).filter(Boolean);
  const heroProof = listAt(messages, "home.proof").map((item) => String(item || "")).filter(Boolean);
  const trustItems = listAt(messages, "home.trust.items").map((item) => String(item || "")).filter(Boolean);
  const howSteps = listAt(messages, "home.how.steps").map((item) => String(item || "")).filter(Boolean);
  const faqs = faqItems(messages);

  return (
    <main className="shell hm-home" id="top">
      <Panel as="header" className="hm-home-header">
        <div className="hm-top-nav">
          <a href="#top" className="hm-brand" aria-label="HOLMETA home">
            {t(messages, "common.brand", "HOLMETA")}
          </a>
          <nav className="hm-nav-links" aria-label="Primary navigation">
            <a href="#features">{t(messages, "home.nav.features", "Features")}</a>
            <a href="#how-it-works">{t(messages, "home.nav.howItWorks", "How it Works")}</a>
            <a href="#privacy">{t(messages, "home.nav.privacy", "Privacy")}</a>
            <a href={localizedHref(locale, "/pricing")}>{t(messages, "home.nav.pricing", "Pricing")}</a>
            <a href={localizedHref(locale, "/faq")}>{t(messages, "home.nav.faq", "FAQ")}</a>
          </nav>
          <div className="hm-nav-actions">
            <details className="hm-lang-menu">
              <summary className="hm-lang-menu-trigger" aria-label={t(messages, "language.switcherAria", "Switch language")}>
                <span aria-hidden="true">☰</span>
              </summary>
              <div className="hm-lang-menu-list" role="menu" aria-label={t(messages, "language.label", "Language")}>
                {NAV_LOCALES.map((entry) => (
                  <a
                    key={entry.code}
                    href={pathWithLocale(entry.code, "/")}
                    className={`hm-lang-menu-item ${locale === entry.code ? "is-active" : ""}`.trim()}
                    role="menuitem"
                    lang={entry.code}
                  >
                    {entry.label}
                  </a>
                ))}
              </div>
            </details>
            <Button href={localizedHref(locale, "/dashboard/subscribe")} variant="primary">
              {t(messages, "common.trialCta", "Start 3-Day Trial")}
            </Button>
          </div>
        </div>
      </Panel>

      <section className="hm-section hm-hero" aria-labelledby="hero-title">
        <div className="hm-hero-grid">
          <Panel className="hm-hero-copy">
            <p className="hm-kicker">{t(messages, "home.kicker", "MISSION BRIEFING")}</p>
            <h1 className="hm-title" id="hero-title">
              {t(messages, "home.title", "Protect your eyes. Keep your focus.")}
            </h1>
            <p className="hm-lede">
              {t(messages, "home.subtitle", "Holmeta is a browser extension for people who spend hours on screens. Use light filters, deep work sessions, and gentle reminders to reduce strain and stay on task.")}
            </p>
            <div className="hm-cta-row">
              <Button href={localizedHref(locale, "/dashboard/subscribe")} variant="primary">
                {t(messages, "common.trialCta", "Start 3-Day Trial")}
              </Button>
              <Button href="#demo">{t(messages, "common.watchDemo", "Watch 30-Sec Demo")}</Button>
            </div>
            <p className="hm-meta">{t(messages, "home.supportLine", "Browser-only. Privacy-first. Cancel anytime.")}</p>
            <ul className="hm-list hm-hero-list hm-proof-list">
              {heroProof.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Panel>

          <Panel className="hm-proof-card" id="demo" aria-label="Holmeta demo preview">
            <p className="hm-kicker">{t(messages, "home.demo.kicker", "30-SECOND DEMO")}</p>
            <p className="hm-meta">{t(messages, "home.demo.summary", "See filter toggle, focus timer, and reminder prompts in one quick walkthrough.")}</p>
            <figure className="hm-proof-frame hm-demo-frame">
              <video
                className="hm-demo-video"
                autoPlay
                loop
                muted
                playsInline
                controls
              >
                <source src={DEMO_VIDEO_PATH} type="video/mp4" />
                Your browser does not support the demo video.
              </video>
            </figure>
          </Panel>
        </div>
      </section>

      <section className="hm-section" aria-label="Proof strip">
        <Panel>
          <p className="hm-kicker">{t(messages, "home.trust.kicker", "BUILT FOR PEOPLE WHO LIVE IN TABS")}</p>
          <div className="hm-trust-strip" aria-label="Trust markers">
            {trustItems.map((item) => (
              <span key={item} className="hm-chip">{item}</span>
            ))}
          </div>
        </Panel>
      </section>

      <section className="hm-section" id="features" aria-labelledby="features-title">
        <p className="hm-kicker">{t(messages, "home.why.kicker", "WHY HOLMETA")}</p>
        <h2 className="hm-subtitle" id="features-title">
          {t(messages, "home.why.title", "Why people keep Holmeta open")}
        </h2>
        <div className="hm-cap-grid hm-cap-grid--three">
          {whyHolmeta.map((item) => (
            <FeatureCard key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      <section className="hm-section" id="how-it-works" aria-labelledby="how-title">
        <Panel>
          <p className="hm-kicker">{t(messages, "home.how.kicker", "HOW IT WORKS")}</p>
          <h2 className="hm-subtitle" id="how-title">
            {t(messages, "home.how.title", "How Holmeta works")}
          </h2>
          <ol className="hm-protocol-grid">
            {howSteps.map((step, index) => (
              <li key={step}>
                <strong>{index + 1})</strong> {step}
              </li>
            ))}
          </ol>
          <p className="hm-meta">
            {t(messages, "home.how.body", "No complicated setup. No account maze. Just install, activate, and go.")}
          </p>
          <div className="hm-cta-row">
            <Button href={localizedHref(locale, "/dashboard/subscribe")} variant="primary">
              {t(messages, "common.trialCta", "Start 3-Day Trial")}
            </Button>
            <Button href="#privacy">{t(messages, "common.readPrivacy", "Read Privacy")}</Button>
          </div>
        </Panel>
      </section>

      <section className="hm-section" id="pricing" aria-labelledby="pricing-title">
        <Panel>
          <p className="hm-kicker">{t(messages, "home.pricing.kicker", "PRICING")}</p>
          <h2 className="hm-subtitle" id="pricing-title">
            {t(messages, "home.pricing.title", "Simple pricing")}
          </h2>

          <article className="hm-pricing-card" aria-label="Holmeta Premium pricing">
            <p className="hm-meta">{t(messages, "home.pricing.planTitle", "HOLMETA PREMIUM — $2/MONTH")}</p>
            <ul className="hm-list">
              {pricingBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="hm-cta-row">
              <Button href={localizedHref(locale, "/dashboard/subscribe")} variant="primary">
                {t(messages, "common.trialCta", "Start 3-Day Trial")}
              </Button>
              <Button href="#how-it-works">{t(messages, "common.seeHowItWorks", "See How It Works")}</Button>
            </div>
          </article>

          <p className="hm-meta">
            {t(messages, "home.pricing.foot", "No ads. No data-selling business model. Just a focused utility that helps you work better.")}
          </p>
        </Panel>
      </section>

      <section className="hm-section" id="privacy" aria-labelledby="privacy-title">
        <Panel>
          <p className="hm-kicker">{t(messages, "home.privacy.kicker", "PRIVACY")}</p>
          <h2 className="hm-subtitle" id="privacy-title">
            {t(messages, "home.privacy.title", "Built to stay in your browser")}
          </h2>
          <p className="hm-lede">
            {t(messages, "home.privacy.body", "Holmeta runs where you work: inside the browser. Sensitive controls stay local. Billing only unlocks premium features.")}
          </p>
          <ul className="hm-list">
            {listAt(messages, "home.privacy.bullets").map((item) => (
              <li key={String(item || "")}>{String(item || "")}</li>
            ))}
          </ul>
          <div className="hm-cta-row">
            <Button href={localizedHref(locale, "/privacy")}>{t(messages, "common.readPrivacy", "Read Privacy")}</Button>
            <Button href={localizedHref(locale, "/terms")}>{t(messages, "common.readTerms", "Read Terms")}</Button>
          </div>
        </Panel>
      </section>

      <section className="hm-section" id="faq" aria-labelledby="faq-title">
        <Panel>
          <p className="hm-kicker">{t(messages, "home.faq.kicker", "FAQ")}</p>
          <h2 className="hm-subtitle" id="faq-title">
            {t(messages, "home.faq.title", "Common Questions")}
          </h2>

          <div className="hm-faq-list">
            {faqs.map((item) => (
              <FAQItem key={item.q} question={item.q}>
                <p className="hm-meta">{item.a}</p>
              </FAQItem>
            ))}
          </div>
        </Panel>
      </section>

      <footer className="hm-footer" aria-label="Footer links">
        <a href={localizedHref(locale, "/status")}>{t(messages, "home.footer.status", "Status / Changelog")}</a>
        <a href={localizedHref(locale, "/privacy")}>{t(messages, "home.footer.privacy", "Privacy")}</a>
        <a href={localizedHref(locale, "/terms")}>{t(messages, "home.footer.terms", "Terms")}</a>
        <a href={`mailto:${t(messages, "common.contactEmail", "reach@holmeta.com")}`}>{t(messages, "home.footer.contact", "Contact")}</a>
        <a href={localizedHref(locale, "/dashboard/subscribe")}>{t(messages, "common.trialCta", "Start 3-Day Trial")}</a>
      </footer>
    </main>
  );
}
