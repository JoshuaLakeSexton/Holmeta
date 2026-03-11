import { redirectToLocalizedPath } from "@/lib/i18n/server-locale";

export default async function PricingPage() {
  await redirectToLocalizedPath("/pricing");
}
