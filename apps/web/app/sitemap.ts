import type { MetadataRoute } from "next";

import { SUPPORTED_LOCALES, pathWithLocale } from "@/lib/i18n/config";

const BASE_URL = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_BASE_URL || "https://holmeta.com").replace(/\/$/, "");
const LOCALIZED_PATHS = ["/", "/pricing", "/faq", "/dashboard/subscribe", "/download", "/privacy", "/terms", "/status"];

export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const locale of SUPPORTED_LOCALES) {
    for (const path of LOCALIZED_PATHS) {
      out.push({
        url: `${BASE_URL}${pathWithLocale(locale, path)}`,
        lastModified: new Date(),
        changeFrequency: path === "/" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.6
      });
    }
  }
  return out;
}
