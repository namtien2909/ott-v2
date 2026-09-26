import { useId, useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
};

export function PasswordField({ label, hint, id, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <label className="password-field" htmlFor={inputId}>
      <span>{label}</span>
      <span className="password-control">
        <input {...props} id={inputId} type={visible ? "text" : "password"} />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Ẩn" : "Hiện"}
        </button>
      </span>
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
