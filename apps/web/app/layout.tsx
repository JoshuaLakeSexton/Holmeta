import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClientMonitor } from "@/components/holmeta/ClientMonitor";
import { BackHomeNav } from "@/components/holmeta/BackHomeNav";
import { LocaleTelemetry } from "@/components/holmeta/LocaleTelemetry";
import { normalizeLocale } from "@/lib/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "holmeta",
  description: "Extension-first screen health and deep work ops console",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_BASE_URL || "https://holmeta.com")
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = normalizeLocale(cookieStore.get("holmeta_locale")?.value || "en");

  return (
    <html lang={lang}>
      <body>
        <ClientMonitor />
        <LocaleTelemetry />
        <BackHomeNav />
        {children}
      </body>
    </html>
  );
}
