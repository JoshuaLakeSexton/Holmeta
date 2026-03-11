import { redirectToLocalizedPath } from "@/lib/i18n/server-locale";

export default async function BillingHelpPage() {
  await redirectToLocalizedPath("/billing/help");
}
