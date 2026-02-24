import type { ReactNode } from "react";

import { Accordion } from "@/components/holmeta/Accordion";

type FAQItemProps = {
  question: string;
  children: ReactNode;
};

export function FAQItem({ question, children }: FAQItemProps) {
  return <Accordion title={question}>{children}</Accordion>;
}
