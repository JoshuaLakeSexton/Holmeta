import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

type BaseProps = {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
};

type LinkProps = BaseProps & {
  href: string;
  disabled?: boolean;
  target?: string;
  rel?: string;
};

type NativeButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type Props = LinkProps | NativeButtonProps;

function variantClass(variant: ButtonVariant) {
  if (variant === "primary") return "hm-btn--primary";
  if (variant === "danger") return "hm-btn--danger";
  return "hm-btn--secondary";
}

export function Button(props: Props) {
  const variant = props.variant || "secondary";
  const className = `hm-btn ${variantClass(variant)} ${props.className || ""}`.trim();

  if ("href" in props && props.href) {
    if (props.disabled) {
      return (
        <span className={`${className} is-disabled`} aria-disabled="true">
          {props.children}
        </span>
      );
    }

    return (
      <Link href={props.href} className={className} target={props.target} rel={props.rel}>
        {props.children}
      </Link>
    );
  }

  const { className: _unusedClassName, variant: _unusedVariant, ...buttonProps } = props;
  return <button {...buttonProps} className={className} />;
}
