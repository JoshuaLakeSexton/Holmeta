import { redirectToLocalizedPath } from "@/lib/i18n/server-locale";

export default async function BillingCancelPage() {
  await redirectToLocalizedPath("/billing/cancel");
}
