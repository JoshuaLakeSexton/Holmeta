# Holmeta International Rollout (Production Plan)

## 1) Current Blockers (Resolved + Remaining)

### Resolved in this pass
- Locale routes were missing; `/<locale>/...` now exists for all funnel pages.
- Middleware now reliably redirects to locale paths and no longer always forces `en` from an invalid cookie.
- Localized metadata + hreflang alternates are now emitted per locale route.
- Checkout now accepts locale/country/currency signals and records market metadata.
- Dashboard/subscribe/billing/download pages now pass locale context end-to-end.

### Remaining blockers to address next
- Japanese/Korean/Chinese catalogs are partial and currently rely on English fallback for many strings.
- Extension UI still needs full `_locales` localization pass (website funnel is now scaffolded first).
- Stripe market-specific price IDs are optional envs and need to be configured in production for true local pricing.

## 2) Locale + URL Architecture

Implemented locale-first URL strategy:
- `/en`
- `/ja`
- `/ko`
- `/zh-cn`
- `/zh-tw`

Each localized route now has:
- locale-specific content rendering
- localized metadata
- hreflang alternates + x-default

## 3) Full Funnel Localization Coverage

Localized/scaffolded routes:
- Home
- Dashboard checkout
- Subscribe
- Billing success
- Billing cancel
- Billing help
- Download
- Privacy
- Terms
- Status

Translation architecture:
- `apps/web/locales/*.json`
- fallback merge from `en.json`
- key-based access helpers in `apps/web/lib/i18n/messages.ts`

## 4) Country Rollout Priority (Execution Order)

1. Japan (`ja`)
2. South Korea (`ko`)
3. Traditional Chinese markets (`zh-tw`)
4. Simplified Chinese where operationally feasible (`zh-cn`)
5. Next wave (after conversion proof): India, Indonesia, Thailand, Vietnam

### Country matrix (go-to-market + payments)

| Country/Market | Locale | Primary user wedge | Positioning angle | Initial price strategy | Payment focus | Launch risk |
| --- | --- | --- | --- | --- | --- | --- |
| Japan | `ja` | Developers + office users | Eye comfort + deep focus during long desktop sessions | Start USD-anchor equivalent, test localized JPY in month 2 | Card first, then local methods if Stripe account supports | Medium (translation quality + support expectations) |
| South Korea | `ko` | Developers + gamers + desk workers | Focus durability + night comfort | Start USD-anchor equivalent, test KRW localized pricing after baseline | Card first; validate local conversion drop-offs | Medium |
| Traditional Chinese markets (TW/HK) | `zh-tw` | Designers + ecommerce-heavy users | Readability + browser comfort with minimal setup | USD anchor, then TWD/HKD experiment split by geo | Card first; add local wallet methods based on funnel loss | Medium |
| Simplified Chinese strategy | `zh-cn` | Cross-border users reachable from supported channels | Browser-only utility with local-first privacy | Test only where legal/distribution is feasible | Card only initially | High (distribution + legal constraints) |

Next-wave markets (post-Asia proof): India, Indonesia, Thailand, Vietnam.

## 5) Payments + Pricing Architecture

### Implemented
- Checkout accepts `locale`, `country`, `currency`.
- Market resolver maps request signals to market keys (`default`, `jp`, `kr`, `zh_cn`, `zh_tw`).
- Price ID resolution supports market env overrides with fallback to default.

### Supported env naming (set as available)
- Monthly:
  - `STRIPE_PRICE_MONTHLY_A`
  - `STRIPE_PRICE_MONTHLY_A_JP`
  - `STRIPE_PRICE_MONTHLY_A_KR`
  - `STRIPE_PRICE_MONTHLY_A_ZH_CN`
  - `STRIPE_PRICE_MONTHLY_A_ZH_TW`
- Yearly:
  - `STRIPE_PRICE_YEARLY`
  - `STRIPE_PRICE_YEARLY_JP`
  - `STRIPE_PRICE_YEARLY_KR`
  - `STRIPE_PRICE_YEARLY_ZH_CN`
  - `STRIPE_PRICE_YEARLY_ZH_TW`

### Guidance
- Start with USD fallback across all markets.
- Add local-currency Stripe Prices per market once baseline conversion is measured.
- Keep one globally simple plan (`$2/mo`) for first rollout wave; localize currency display before changing price points.
- Add annual localized plan test only after monthly trial-to-paid data stabilizes by locale.

### Suggested payment-method roadmap
- Phase 1: Cards only (all markets), optimize checkout copy + trust messaging.
- Phase 2: Add highest-impact local methods where Stripe availability supports it and conversion drop-off justifies complexity.
- Phase 3: Market-specific checkout defaults (language + payment method ordering).

## 6) Analytics Event Plan (Implemented Scaffold)

Client event endpoint:
- `/.netlify/functions/client-event`

Current tracked events:
- `locale_selected`
- `checkout_opened`
- `checkout_session_created`
- `checkout_create_failed`
- `license_reveal_started`
- `license_revealed`
- `license_reveal_failed`
- `billing_portal_open_started`
- `billing_portal_opened`
- `billing_portal_open_failed`
- `download_zip_started`
- `download_zip_success`
- `download_zip_failed`

## 7) SEO Implementation

- Distinct URLs per locale.
- Canonical now points to self-locale route.
- `alternates.languages` emitted for all locales.
- `x-default` points to `/en` path equivalent.
- Sitemap should include each locale URL variant for every indexable page (`/en/...`, `/ja/...`, `/ko/...`, `/zh-cn/...`, `/zh-tw/...`).

## 8) Open Legal / Tax / Compliance Review

Human review required for launch by region:
- VAT/GST/JCT registration threshold and remittance responsibilities.
- Regional consumer cancellation/refund rights wording.
- Whether ICP or local entity requirements apply for CN-specific distribution.
- Updated privacy + terms translations reviewed by legal translator.

## 9) Release Checklist for International GA

- [ ] Fill localized catalogs (ja/ko/zh-cn/zh-tw) to 100% non-fallback.
- [ ] Configure Stripe market-specific prices.
- [ ] Validate checkout in each locale with real test cards and webhook confirmation.
- [ ] Confirm locale-specific success/cancel URLs in production.
- [ ] QA all locale pages on desktop + mobile breakpoints.

## 10) KPI Targets by Phase

### Phase 1 (EN + JA + KO)
- KPI: Checkout start rate by locale
- KPI: Trial start rate by locale
- KPI: Trial-to-paid conversion within 7 days

### Phase 2 (add ZH-TW, selective ZH-CN)
- KPI: Payment completion by payment method and locale
- KPI: Cancellation rate by locale
- KPI: Activation success rate (`billing/success -> extension activated`)

### Phase 3 (next-wave markets)
- KPI: CAC payback by market
- KPI: 30-day retention by locale
- KPI: Support ticket rate per 100 paid users by locale
