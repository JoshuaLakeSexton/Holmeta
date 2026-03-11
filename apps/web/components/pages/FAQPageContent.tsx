import { FAQItem } from "@/components/holmeta/FAQItem";
import { Panel } from "@/components/holmeta/Panel";
import { type SupportedLocale } from "@/lib/i18n/config";
import { getMessages, listAt, t } from "@/lib/i18n/messages";

type FAQPageProps = {
  locale?: SupportedLocale;
};

export function FAQPageContent({ locale = "en" }: FAQPageProps) {
  const messages = getMessages(locale);
  const faqs = listAt(messages, "home.faq.items")
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { q?: string; a?: string };
      return {
        q: String(row.q || ""),
        a: String(row.a || "")
      };
    })
    .filter((item): item is { q: string; a: string } => Boolean(item?.q && item?.a));

  return (
    <main className="shell">
      <Panel as="header">
        <p className="hm-kicker">{t(messages, "home.faq.kicker", "FAQ")}</p>
        <h1 className="hm-title">{t(messages, "home.faq.title", "Common Questions")}</h1>
      </Panel>

      <Panel>
        <div className="hm-faq-list">
          {faqs.map((item) => (
            <FAQItem key={item.q} question={item.q}>
              <p className="hm-meta">{item.a}</p>
            </FAQItem>
          ))}
        </div>
      </Panel>
    </main>
  );
}
