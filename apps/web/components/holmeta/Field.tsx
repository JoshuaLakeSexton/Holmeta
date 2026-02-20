import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type InputFieldProps = {
  as?: "input";
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>;

type TextareaFieldProps = {
  as: "textarea";
  className?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

type SelectFieldProps = {
  as: "select";
  className?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

type FieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

export function Field(props: FieldProps) {
  if (props.as === "textarea") {
    const { as: _unusedAs, className = "", ...textareaProps } = props;
    return <textarea {...textareaProps} className={`hm-field hm-textarea ${className}`.trim()} />;
  }

  if (props.as === "select") {
    const { as: _unusedAs, className = "", children, ...selectProps } = props;
    return (
      <select {...selectProps} className={`hm-field hm-select ${className}`.trim()}>
        {children}
      </select>
    );
  }

  const { as: _unusedAs, className = "", ...inputProps } = props;
  return <input {...inputProps} className={`hm-field ${className}`.trim()} />;
}
