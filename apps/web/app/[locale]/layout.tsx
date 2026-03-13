import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

export const dynamicParams = false;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const direction = locale === "ar" ? "rtl" : "ltr";
  return (
    <div lang={locale} dir={direction}>
      {children}
    </div>
  );
}
