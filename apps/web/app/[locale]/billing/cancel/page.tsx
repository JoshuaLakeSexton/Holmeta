import type { Metadata } from "next";

import { BillingCancelPageContent } from "@/components/pages/BillingCancelPageContent";
import { localeFromRouteParam } from "@/lib/i18n/route";
import { localeMetadata } from "@/lib/i18n/seo";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return localeMetadata(locale, "/billing/cancel");
}

export default async function LocaleBillingCancelPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return <BillingCancelPageContent locale={locale} />;
}
