import type { ReactNode } from "react";

type AccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  return (
    <details className="hm-accordion" open={defaultOpen}>
      <summary className="hm-accordion-summary">
        <span className="hm-label">{title}</span>
        <span className="hm-accordion-icon" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="hm-accordion-content">{children}</div>
    </details>
  );
}
