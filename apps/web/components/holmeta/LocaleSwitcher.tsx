"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { trackEvent } from "@/lib/analytics/client";
import { localeDisplayName, normalizeLocale, splitLocaleFromPath, SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, t } from "@/lib/i18n/messages";

type LocaleSwitcherProps = {
  compact?: boolean;
};

export function LocaleSwitcher({ compact = false }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const resolved = useMemo(() => splitLocaleFromPath(pathname || "/"), [pathname]);
  const activeLocale = normalizeLocale(resolved.locale || "en");
  const messages = useMemo(() => getMessages(activeLocale), [activeLocale]);

  function onChange(locale: SupportedLocale) {
    trackEvent("locale_selected", {
      from: activeLocale,
      to: locale
    });
    const nextPath = `/${locale}${resolved.restPath === "/" ? "" : resolved.restPath}`;
    const query = searchParams?.toString();
    router.push(query ? `${nextPath}?${query}` : nextPath);
  }

  return (
    <label className={`hm-locale-switch ${compact ? "is-compact" : ""}`.trim()} aria-label={t(messages, "language.switcherAria", "Switch language")}>
      {!compact ? <span className="hm-label">{t(messages, "language.label", "Language")}</span> : null}
      <select value={activeLocale} onChange={(event) => onChange(normalizeLocale(event.target.value))}>
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {localeDisplayName(locale)}
          </option>
        ))}
      </select>
    </label>
  );
}
