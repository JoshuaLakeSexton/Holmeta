import type { Metadata } from "next";

import { HomePageContent } from "@/components/pages/HomePageContent";
import { localeFromRouteParam } from "@/lib/i18n/route";
import { localeMetadata } from "@/lib/i18n/seo";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return localeMetadata(locale, "/");
}

export default async function LocaleHomePage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return <HomePageContent locale={locale} />;
}
