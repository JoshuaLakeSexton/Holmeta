import type { InputHTMLAttributes } from "react";

type ToggleProps = {
  label: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Toggle({ label, className = "", id, ...props }: ToggleProps) {
  const htmlFor = id || props.name || undefined;

  return (
    <label className={`hm-toggle ${className}`.trim()} htmlFor={htmlFor}>
      <input id={htmlFor} className="hm-toggle-input" type="checkbox" {...props} />
      <span className="hm-label">{label}</span>
    </label>
  );
}
