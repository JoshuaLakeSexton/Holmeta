import type { Metadata } from "next";

import { PricingPageContent } from "@/components/pages/PricingPageContent";
import { localeFromRouteParam } from "@/lib/i18n/route";
import { localeMetadata } from "@/lib/i18n/seo";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return localeMetadata(locale, "/pricing");
}

export default async function LocalePricingPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return <PricingPageContent locale={locale} />;
}
