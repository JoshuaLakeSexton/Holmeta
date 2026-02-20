import type { LabelHTMLAttributes } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  className?: string;
};

export function Label({ className = "", ...props }: LabelProps) {
  return <label {...props} className={`hm-label ${className}`.trim()} />;
}
