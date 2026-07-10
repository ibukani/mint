import type React from "react";
import {
  FeatureSettingsHeader,
  SettingsSection,
} from "../../../design/components";
import { useClockSettingsController } from "../hooks/useClockSettingsController";
import { ClockAppearanceSettings } from "./ClockAppearanceSettings";
import { ClockBehaviorSettings } from "./ClockBehaviorSettings";
import { ClockPreview } from "./ClockPreview";
import "./ClockSettings.css";

export const ClockSettings: React.FC = () => {
  const controller = useClockSettingsController();
  if (!controller) return null;

  const { clock, handleChange, resetClockSettings } = controller;

  return (
    <SettingsSection
      title="時計オーバーレイ設定"
      description="呼び出した瞬間に時刻を確認できる、軽量なデスクトップ時計です。"
    >
      <FeatureSettingsHeader
        switchId="clock-enabled-checkbox"
        label="時計オーバーレイ"
        enabled={clock.enabled}
        onChange={(event) => handleChange("enabled", event.target.checked)}
        onReset={resetClockSettings}
        ariaLabel="時計オーバーレイを有効にする"
      />

      <div className="clock-settings-workspace">
        <div className="clock-settings-controls">
          <ClockBehaviorSettings controller={controller} />
          <ClockAppearanceSettings controller={controller} />
        </div>
        <ClockPreview controller={controller} />
      </div>
    </SettingsSection>
  );
};
