import type { Metadata } from "next";

import { FAQPageContent } from "@/components/pages/FAQPageContent";
import { localeFromRouteParam } from "@/lib/i18n/route";
import { localeMetadata } from "@/lib/i18n/seo";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return localeMetadata(locale, "/faq");
}

export default async function LocaleFaqPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return <FAQPageContent locale={locale} />;
}
