import { redirectToLocalizedPath } from "@/lib/i18n/server-locale";

export default async function BillingSuccessPage() {
  await redirectToLocalizedPath("/billing/success");
}
