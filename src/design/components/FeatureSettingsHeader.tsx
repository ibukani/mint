import { RotateCcw } from "lucide-react";
import type React from "react";
import { Button } from "./Button";
import { Switch } from "./Switch";

interface FeatureSettingsHeaderProps {
  switchId: string;
  label: string;
  enabled: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  ariaLabel?: string;
}

export const FeatureSettingsHeader: React.FC<FeatureSettingsHeaderProps> = ({
  switchId,
  label,
  enabled,
  onChange,
  onReset,
  ariaLabel = "この機能を有効にする (Enable Feature)",
}) => {
  return (
    <div className="feature-settings-header">
      <div className="feature-settings-state">
        <Switch
          id={switchId}
          checked={enabled}
          onChange={onChange}
          aria-label={ariaLabel}
        />
        <div>
          <label htmlFor={switchId}>{label}</label>
          <span>{enabled ? "有効" : "無効"}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        className="feature-settings-header__reset"
        onClick={onReset}
      >
        <RotateCcw size={15} aria-hidden="true" />
        デフォルトに戻す
      </Button>
    </div>
  );
};
