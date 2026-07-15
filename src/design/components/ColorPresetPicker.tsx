import type React from "react";

export const COLOR_PRESETS = [
  { value: "#818cf8", label: "インディゴ" },
  { value: "#38bdf8", label: "スカイ" },
  { value: "#34d399", label: "ミント" },
  { value: "#fbbf24", label: "アンバー" },
  { value: "#fb7185", label: "ローズ" },
  { value: "#f8fafc", label: "ホワイト" },
] as const;

interface ColorPresetPickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export const ColorPresetPicker: React.FC<ColorPresetPickerProps> = ({
  value,
  onChange,
  ariaLabel = "テーマカラー",
}) => (
  <fieldset className="color-picker-palette" aria-label={ariaLabel}>
    {COLOR_PRESETS.map((color) => {
      const isActive = value === color.value;

      return (
        <button
          key={color.value}
          type="button"
          className={`color-picker-badge ${isActive ? "is-active" : ""}`}
          style={{ "--swatch-color": color.value } as React.CSSProperties}
          title={color.label}
          onClick={() => onChange(color.value)}
          aria-label={color.label}
          aria-pressed={isActive}
        />
      );
    })}
  </fieldset>
);
