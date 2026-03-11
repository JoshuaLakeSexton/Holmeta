# Holmeta Translation Workflow

## Source of truth
- Base catalog: `apps/web/locales/en.json`
- Localized catalogs:
  - `apps/web/locales/ja.json`
  - `apps/web/locales/ko.json`
  - `apps/web/locales/zh-cn.json`
  - `apps/web/locales/zh-tw.json`

## Workflow
1. Add new keys in `en.json` only.
2. Add translated overrides in each locale catalog.
3. Keep catalogs sparse when needed; fallback merge automatically fills missing keys from English.
4. Validate UI in each locale route and ensure no key path typo returns blank fallback.

## QA expectations
- No hardcoded English in funnel-critical CTA rows.
- All primary CTA labels translated.
- Billing/legal pages reviewed by native speaker before production market launch.

## Formatting rules
- Keep placeholders in braces: `{name}`, `{message}`.
- Preserve punctuation and capitalization style per market.
- Avoid machine-literal translations for billing/legal strings without review.
