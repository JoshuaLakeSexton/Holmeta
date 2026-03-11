import { redirectToLocalizedPath } from "@/lib/i18n/server-locale";

export default async function PrivacyPage() {
  await redirectToLocalizedPath("/privacy");
}
