import { createElement, type HTMLAttributes } from "react";

type PanelTag = "section" | "article" | "header" | "footer" | "div" | "main";

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: PanelTag;
};

export function Panel({ as = "section", className = "", ...props }: PanelProps) {
  return createElement(as, {
    ...props,
    className: `hm-panel ${className}`.trim()
  });
}
