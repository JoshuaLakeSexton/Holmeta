import en from "@/locales/en.json";
import ar from "@/locales/ar.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import es from "@/locales/es.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import zhCn from "@/locales/zh-cn.json";
import zhTw from "@/locales/zh-tw.json";

import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";

type MessageValue = string | number | boolean | null | MessageTree | MessageValue[];
export type MessageTree = { [key: string]: MessageValue };

const localeMessages: Record<SupportedLocale, MessageTree> = {
  en,
  ar,
  fr,
  de,
  es,
  ja,
  ko,
  "zh-cn": zhCn,
  "zh-tw": zhTw
};

const warnedMissingKeys = new Set<string>();
const warnedLocaleCoverage = new Set<SupportedLocale>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function missingLeafPaths(reference: MessageTree, candidate: MessageTree, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(reference)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const maybe = candidate[key];
    if (isRecord(value)) {
      if (!isRecord(maybe)) {
        out.push(path);
      } else {
        out.push(...missingLeafPaths(value as MessageTree, maybe as MessageTree, path));
      }
      continue;
    }

    if (Array.isArray(value)) {
      if (!Array.isArray(maybe)) {
        out.push(path);
      }
      continue;
    }

    if (typeof maybe === "undefined") {
      out.push(path);
    }
  }
  return out;
}

function logLocaleCoverage(locale: SupportedLocale) {
  if (locale === DEFAULT_LOCALE) return;
  if (process.env.NODE_ENV === "production") return;
  if (warnedLocaleCoverage.has(locale)) return;

  warnedLocaleCoverage.add(locale);
  const missing = missingLeafPaths(localeMessages.en, localeMessages[locale]);
  if (!missing.length) return;

  const sample = missing.slice(0, 12).join(", ");
  // eslint-disable-next-line no-console
  console.warn(`[i18n] Locale "${locale}" is missing ${missing.length} keys. Sample: ${sample}`);
}

export function getMessages(localeInput?: string | null): MessageTree {
  const locale = normalizeLocale(localeInput);
  logLocaleCoverage(locale);
  return localeMessages[locale] || localeMessages.en;
}

export function messageAt<T = MessageValue>(messages: MessageTree, path: string, fallback?: T): MessageValue | T {
  const segments = String(path || "").split(".").filter(Boolean);
  let cursor: unknown = messages;
  for (const segment of segments) {
    if (!isRecord(cursor) || !(segment in cursor)) {
      return fallback as T;
    }
    cursor = cursor[segment];
  }
  return cursor as MessageValue | T;
}

export function t(
  messages: MessageTree,
  path: string,
  varsOrFallback?: Record<string, string | number> | string,
  fallback = ""
): string {
  const MISSING = Symbol("missing_message");
  const vars = typeof varsOrFallback === "string" ? undefined : varsOrFallback;
  const safeFallback = typeof varsOrFallback === "string" ? varsOrFallback : fallback;
  const value = messageAt(messages, path, MISSING as unknown as MessageValue);
  if (value === (MISSING as unknown as MessageValue)) {
    if (process.env.NODE_ENV !== "production" && !warnedMissingKeys.has(path)) {
      warnedMissingKeys.add(path);
      // eslint-disable-next-line no-console
      console.warn(`[i18n] Missing key: ${path}`);
    }
    return safeFallback;
  }

  if (typeof value !== "string") {
    return typeof value === "number" ? String(value) : safeFallback;
  }
  if (!vars || !Object.keys(vars).length) {
    return value;
  }
  return value.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in vars)) return `{${key}}`;
    return String(vars[key]);
  });
}

export function listAt(messages: MessageTree, path: string): MessageValue[] {
  const value = messageAt(messages, path, [] as MessageValue[]);
  return Array.isArray(value) ? value : [];
}

export function objectAt<T extends Record<string, unknown>>(messages: MessageTree, path: string, fallback: T): T {
  const value = messageAt(messages, path, fallback);
  return isRecord(value) ? (value as T) : fallback;
}
