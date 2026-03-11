import { redirectToLocalizedPath } from "@/lib/i18n/server-locale";

export default async function DownloadPage() {
  await redirectToLocalizedPath("/download");
}
