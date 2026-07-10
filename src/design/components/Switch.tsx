import type React from "react";

interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  className,
  id,
  disabled,
  ...props
}) => {
  const classes = ["design-switch__input", disabled ? "is-disabled" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <label
      className={`design-switch ${disabled ? "design-switch--disabled" : ""} ${className || ""}`}
      htmlFor={id}
    >
      <input
        type="checkbox"
        role="switch"
        id={id}
        checked={checked}
        aria-checked={checked}
        onChange={onChange}
        className={classes}
        disabled={disabled}
        {...props}
      />
      <span className="design-switch__slider" />
    </label>
  );
};
