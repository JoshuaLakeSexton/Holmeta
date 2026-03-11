import type { Metadata } from "next";

import { TermsPageContent } from "@/components/pages/TermsPageContent";
import { localeFromRouteParam } from "@/lib/i18n/route";
import { localeMetadata } from "@/lib/i18n/seo";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return localeMetadata(locale, "/terms");
}

export default async function LocaleTermsPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return <TermsPageContent locale={locale} />;
}
