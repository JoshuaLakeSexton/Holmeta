import type { Metadata } from "next";

import { DashboardSubscribePageContent } from "@/components/pages/DashboardSubscribePageContent";
import { localeFromRouteParam } from "@/lib/i18n/route";
import { localeMetadata } from "@/lib/i18n/seo";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return localeMetadata(locale, "/dashboard/subscribe");
}

export default async function LocaleDashboardSubscribePage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = localeFromRouteParam(rawLocale);
  return <DashboardSubscribePageContent locale={locale} />;
}
