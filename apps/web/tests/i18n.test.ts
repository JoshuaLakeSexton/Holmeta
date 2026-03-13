import { describe, expect, it } from "vitest";

import { localeFromAcceptLanguage, pathWithLocale, splitLocaleFromPath } from "../lib/i18n/config";

describe("i18n routing", () => {
  it("maps Accept-Language to supported locales", () => {
    expect(localeFromAcceptLanguage("ar-SA,ar;q=0.9,en;q=0.8")).toBe("ar");
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9")).toBe("fr");
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(localeFromAcceptLanguage("es-ES,es;q=0.9,en;q=0.8")).toBe("es");
    expect(localeFromAcceptLanguage("ja-JP,ja;q=0.8,en-US;q=0.6")).toBe("ja");
    expect(localeFromAcceptLanguage("ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
    expect(localeFromAcceptLanguage("zh-TW,zh;q=0.9,en;q=0.8")).toBe("zh-tw");
    expect(localeFromAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh-cn");
  });

  it("builds localized paths consistently", () => {
    expect(pathWithLocale("en", "/")).toBe("/en");
    expect(pathWithLocale("fr", "/pricing")).toBe("/fr/pricing");
    expect(pathWithLocale("ja", "/dashboard")).toBe("/ja/dashboard");
  });

  it("splits locale and rest path correctly", () => {
    expect(splitLocaleFromPath("/ar/download")).toEqual({ locale: "ar", restPath: "/download" });
    expect(splitLocaleFromPath("/ko/download")).toEqual({ locale: "ko", restPath: "/download" });
    expect(splitLocaleFromPath("/zh-tw")).toEqual({ locale: "zh-tw", restPath: "/" });
    expect(splitLocaleFromPath("/dashboard")).toEqual({ locale: null, restPath: "/dashboard" });
  });
});
