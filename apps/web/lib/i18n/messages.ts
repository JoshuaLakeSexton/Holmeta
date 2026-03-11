import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import zhCn from "@/locales/zh-cn.json";
import zhTw from "@/locales/zh-tw.json";

import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";

type MessageValue = string | number | boolean | null | MessageTree | MessageValue[];
export type MessageTree = { [key: string]: MessageValue };

const localeMessages: Record<SupportedLocale, MessageTree> = {
  en,
  ja,
  ko,
  "zh-cn": zhCn,
  "zh-tw": zhTw
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const output: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isRecord(value) && isRecord(output[key])) {
      output[key] = deepMerge(output[key] as MessageTree, value as MessageTree);
    } else {
      output[key] = value as MessageValue;
    }
  }
  return output;
}

export function getMessages(localeInput?: string | null): MessageTree {
  const locale = normalizeLocale(localeInput);
  if (locale === DEFAULT_LOCALE) {
    return localeMessages.en;
  }
  return deepMerge(localeMessages.en, localeMessages[locale]);
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
  const vars = typeof varsOrFallback === "string" ? undefined : varsOrFallback;
  const safeFallback = typeof varsOrFallback === "string" ? varsOrFallback : fallback;
  const value = messageAt(messages, path, safeFallback);
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
